import { useMemo, useState } from 'react';
import { A } from '../state/actions.js';
import { useStore } from '../state/store.jsx';
import { fmtPct, round2 } from '../utils/capacityCalculations.js';
import { assignmentImpact, isCompleted, taskDailyHours } from '../utils/scheduling.js';
import { weekLabel, weekOfDate } from '../utils/weekCalendar.js';
import { techWeek } from '../utils/workloadAggregation.js';
import { Banner, Empty } from './ui.jsx';

/** Test an alternative assignment for a week; applying it is an explicit decision (never automatic). */
export default function WhatIf({ week }) {
  const { model, dispatch, notify, presentation } = useStore();
  const overloaded = model.activeTechs.filter((t) => techWeek(model, t.id, week).allocated > techWeek(model, t.id, week).capacity + 1e-6);
  const [srcId, setSrcId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [dstId, setDstId] = useState('');
  const [cross, setCross] = useState(false);

  const src = model.techById[srcId] ?? null;
  const tasks = useMemo(() => (src ? (model.tasksByTech[src.id] ?? []).filter((t) => !isCompleted(t) && taskDailyHours(t, model.settings, model.refDate).some((d) => weekOfDate(d.date, model.year) === week)) : []), [src, model, week]);
  const task = tasks.find((t) => t.id === taskId);
  const dst = model.techById[dstId];
  const moved = task ? taskDailyHours(task, model.settings, model.refDate).filter((d) => weekOfDate(d.date, model.year) === week).reduce((s, d) => s + d.hours, 0) : 0;
  const impact = task && dst ? assignmentImpact(dst, task, model.tasks, model.settings, model.refDate, model.year) : null;
  const crossNeeded = !!(task && dst && task.plant && dst.plantId !== task.plant);

  if (!overloaded.length) {console.log('No overloaded technicians ', overloaded.length); return <Empty>No overloaded technician in {weekLabel(week)} — nothing to rebalance.</Empty>;}
  const sw = src ? techWeek(model, src.id, week) : null;
  const dw = dst ? techWeek(model, dst.id, week) : null;

  return (
    <div className="col">
      <div className="form-grid">
        <label className="field"><span className="field-label">Overloaded technician ({weekLabel(week)})</span>
          <select value={srcId} onChange={(e) => { setSrcId(e.target.value); setTaskId(''); }}><option value="">Select…</option>{overloaded.map((t) => <option key={t.id} value={t.id}>{t.displayName} ({t.plantId})</option>)}</select>
        </label>
        <label className="field"><span className="field-label">Task to move</span>
          <select value={taskId} onChange={(e) => setTaskId(e.target.value)} disabled={!src}><option value="">Select…</option>{tasks.map((t) => <option key={t.id} value={t.id}>{t.name} ({round2(t.estimatedMinutes / 60)} h)</option>)}</select>
        </label>
        <label className="field full"><span className="field-label">Move to</span>
          <select value={dstId} onChange={(e) => setDstId(e.target.value)} disabled={!task}><option value="">Select…</option>{model.activeTechs.filter((t) => t.id !== srcId).map((t) => <option key={t.id} value={t.id}>{t.displayName} ({t.plantId}) — {round2(techWeek(model, t.id, week).remaining)} h free</option>)}</select>
        </label>
      </div>
      {task && dst && impact && (
        <>
          <table className="t">
            <thead><tr><th>{weekLabel(week)}</th><th className="num">Capacity</th><th className="num">Allocated now</th><th className="num">After move</th><th className="num">Utilization after</th></tr></thead>
            <tbody>
              <tr><td>{src.displayName} (source)</td><td className="num">{round2(sw.capacity)} h</td><td className="num">{round2(sw.allocated)} h</td><td className="num">{round2(sw.allocated - moved)} h</td><td className="num">{fmtPct(((sw.allocated - moved) / sw.capacity) * 100)}</td></tr>
              <tr><td>{dst.displayName} (target)</td><td className="num">{round2(dw.capacity)} h</td><td className="num">{round2(dw.allocated)} h</td><td className="num">{round2(dw.allocated + moved)} h</td><td className="num">{fmtPct(((dw.allocated + moved) / dw.capacity) * 100)}</td></tr>
            </tbody>
          </table>
          {impact.overWeeks.length > 0 && <Banner type="warn">Target would exceed its weekly capacity in {impact.overWeeks.map((w) => weekLabel(w.week)).join(', ')}.</Banner>}
          {crossNeeded && <label className="row"><input type="checkbox" checked={cross} onChange={(e) => setCross(e.target.checked)} /> Cross-plant reallocation ({task.plant} → {dst.plantId}): I confirm this decision (flagged for review)</label>}
          {!presentation && (
            <button className="btn primary" disabled={crossNeeded && !cross} onClick={() => { dispatch(A.taskAssign(task.id, dst.id, crossNeeded && cross)); notify(`${task.name} moved to ${dst.displayName}`, 'ok'); setTaskId(''); }}>Apply reallocation</button>
          )}
        </>
      )}
    </div>
  );
}
