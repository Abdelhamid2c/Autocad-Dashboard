import { useEffect, useMemo, useState } from 'react';
import { A } from '../state/actions.js';
import { useStore } from '../state/store.jsx';
import { fmtPct, round2 } from '../utils/capacityCalculations.js';
import { rankCandidates } from '../utils/allocation.js';
import { PLANTS } from '../utils/milestoneStyle.js';
import { taskWindow } from '../utils/scheduling.js';
import { formatShort, weekLabel } from '../utils/weekCalendar.js';
import TaskForm from './TaskForm.jsx';
import { Banner, Empty, LoadBadge, Modal, TaskStatusBadge, UtilBar } from './ui.jsx';

function ReviewDialog({ task, cand, plant, onClose, onConfirm }) {
  const { impact, tech } = cand;
  const [ack, setAck] = useState(false);
  const over = cand.overloaded;
  return (
    <Modal
      title={`Review impact — ${task.name} → ${tech.displayName}`}
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className={`btn ${over ? 'danger' : 'primary'}`} disabled={over && !ack} onClick={onConfirm}>Confirm assignment</button></>}
    >
      <div className="stat-line">
        <span>Task <b>{round2(task.estimatedMinutes / 60)} h</b></span>
        <span>Period capacity <b>{round2(impact.capacity)} h</b></span>
        <span>Before <b>{round2(impact.allocatedBefore)} h · {fmtPct(impact.utilBefore)}</b></span>
        <span>After <b>{round2(impact.allocatedAfter)} h · {fmtPct(impact.utilAfter)}</b></span>
        <span>Remaining <b>{round2(impact.remainingAfter)} h</b></span>
      </div>
      <table className="t mt">
        <thead><tr><th>Week</th><th className="num">Capacity</th><th className="num">Before</th><th className="num">After</th><th /></tr></thead>
        <tbody>
          {impact.weekRows.map((w) => (
            <tr key={w.week}><td>{weekLabel(w.week)}</td><td className="num">{round2(w.cap)} h</td><td className="num">{round2(w.before)} h</td><td className="num"><b>{round2(w.after)} h</b></td><td>{w.over && <span className="badge bad">over capacity</span>}</td></tr>
          ))}
        </tbody>
      </table>
      {cand.crossPlant && <Banner type="warn">Cross-plant: {tech.displayName} belongs to {tech.plantId} but the task is for {plant}. The assignment will be flagged for review.</Banner>}
      {over && (
        <>
          <Banner type="err">This assignment exceeds capacity ({impact.overDays.length} day(s), {impact.overWeeks.length} week(s)).</Banner>
          <label className="row"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I understand and want to assign anyway</label>
        </>
      )}
    </Modal>
  );
}

export default function TaskAllocationBoard({ params, navigate }) {
  const { model, dispatch, notify, presentation } = useStore();
  const withMs = model.lines.filter((l) => l.milestones.length);
  const initialMs = params.m && model.msById[params.m] ? model.msById[params.m] : null;
  const [lineId, setLineId] = useState(initialMs?.lineId ?? withMs[0]?.id ?? '');
  const [msId, setMsId] = useState(initialMs?.id ?? '');
  const [taskId, setTaskId] = useState(params.task ?? '');
  const [plant, setPlant] = useState('');
  const [cross, setCross] = useState(false);
  const [review, setReview] = useState(null);
  const [adding, setAdding] = useState(false);

  const line = model.lineById[lineId];
  const ms = msId && model.msById[msId]?.lineId === lineId ? model.msById[msId] : null;
  useEffect(() => { if (line && !ms) setMsId(line.milestones[0]?.id ?? ''); }, [line, ms]);
  const tasks = ms ? model.tasksByMs[ms.id] ?? [] : [];
  const task = tasks.find((t) => t.id === taskId) ?? null;

  useEffect(() => { if (task) setPlant(task.plant ?? ''); }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const ranking = useMemo(() => (task ? rankCandidates(model, task, { plant, includeCrossPlant: cross }) : null), [model, task, plant, cross]);

  const confirm = () => {
    const { cand } = review;
    const crossNeeded = !!(plant && cand.tech.plantId !== plant);
    dispatch(A.taskSave({ ...task, plant: plant || cand.tech.plantId, technicianId: cand.tech.id }, crossNeeded));
    notify(`${task.name} assigned to ${cand.tech.displayName}`, 'ok');
    setReview(null);
  };

  return (
    <>
      <div className="steps"><b>1</b> Project line → <b>2</b> milestone → <b>3</b> task → <b>4</b> plant → <b>5</b> candidates → <b>6</b> assign &amp; review impact → <b>7</b> confirm</div>
      <div className="card">
        <div className="form-grid">
          <label className="field"><span className="field-label">Project line</span>
            <select value={lineId} onChange={(e) => { setLineId(e.target.value); setMsId(''); setTaskId(''); }}>
              {withMs.map((l) => <option key={l.id} value={l.id}>{l.bu} · {l.project} (row {l.sourceRow ?? 'new'})</option>)}
            </select>
          </label>
          <label className="field"><span className="field-label">Milestone</span>
            <select value={ms?.id ?? ''} onChange={(e) => { setMsId(e.target.value); setTaskId(''); }}>
              {line?.milestones.map((m) => <option key={m.id} value={m.id}>{m.label} ({weekLabel(m.startWeek)})</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="split mt">
        <div className="card">
          <div className="card-head"><h2>Tasks</h2>{!presentation && ms && <button className="btn sm" onClick={() => setAdding(true)}>+ Task</button>}</div>
          {!tasks.length ? <Empty>No tasks defined for this milestone. Define them first.</Empty> : tasks.map((t) => {
            const w = taskWindow(t);
            return (
              <div key={t.id} className={`list-item${t.id === taskId ? ' sel' : ''}`} onClick={() => setTaskId(t.id)}>
                <div className="row between"><b>{t.name}</b><span>{round2(t.estimatedMinutes / 60)} h</span></div>
                <div className="small muted">{w ? `${formatShort(w.start)} → ${formatShort(w.end)}` : 'unscheduled'} · <TaskStatusBadge status={t.status} /></div>
                <div className="small">{t.technicianId ? <>👤 {model.techById[t.technicianId]?.displayName}</> : <span className="badge warn">Unassigned</span>}</div>
              </div>
            );
          })}
        </div>

        <div>
          {!task ? <Empty>Select a task to see candidate technicians.</Empty> : (
            <>
              <div className="card">
                <div className="card-head">
                  <h2>{task.name} — {round2(task.estimatedMinutes / 60)} h</h2>
                  {task.technicianId && !presentation && <button className="btn sm danger" onClick={() => { dispatch(A.taskAssign(task.id, null)); notify('Task unassigned', 'ok'); }}>Unassign</button>}
                </div>
                <div className="row">
                  <label className="row">Plant <select value={plant} onChange={(e) => setPlant(e.target.value)}><option value="">TBC (all)</option>{PLANTS.map((p) => <option key={p}>{p}</option>)}</select></label>
                  <label className="row"><input type="checkbox" checked={cross} onChange={(e) => setCross(e.target.checked)} /> Allow cross-plant (explicit decision, flagged for review)</label>
                </div>
                <p className="muted small mt">Capacity evaluated for {formatShort(ranking.window.start)} → {formatShort(ranking.window.end)} — {ranking.window.source}.</p>
                {task.skills?.length > 0 && <p className="small">Required skills: {task.skills.map((s) => <span className="chip" key={s}>{s}</span>)}</p>}
              </div>
              <div className="col mt">
                {ranking.rows.length === 0 && <Empty>No confirmed technician in {plant || 'any plant'}. Add technicians in Organization or allow cross-plant.</Empty>}
                {ranking.rows.map((c) => (
                  <div key={c.tech.id} className={`cand${c.recommended ? ' rec' : ''}${c.overloaded ? ' blocked' : ''}`}>
                    <div>
                      <b>{c.tech.displayName}</b> <span className="badge">{c.tech.plantId}</span>
                      {c.recommended && <span className="badge origin-user"> Recommended</span>}
                      {c.crossPlant && <span className="badge warn">cross-plant</span>}
                      {c.current && <span className="badge">current</span>}
                      <div className="small muted">Weekly capacity {c.weeklyCap} h · in period: {round2(c.impact.allocatedBefore)} h of {round2(c.impact.capacity)} h allocated → <b>{round2(c.impact.capacity - c.impact.allocatedBefore)} h remaining</b> · {fmtPct(c.utilBefore)}</div>
                      <div className="small">After this task: <b>{fmtPct(c.utilAfter)}</b> ({round2(c.impact.remainingAfter)} h left) <LoadBadge status={c.statusAfter} /></div>
                      <UtilBar pct={c.utilAfter} status={c.statusAfter} />
                      <div className="small muted">
                        Projects in period: {c.projects.length ? c.projects.map((l) => l.project).join(', ') : 'none'}
                        {' · '}Skills: {c.tech.skills?.length ? c.tech.skills.join(', ') : 'none recorded'}{c.skillsRequired ? ` (${c.skillMatch}/${c.skillsRequired} match)` : ''}
                      </div>
                      {c.overloaded && <div className="small" style={{ color: 'var(--bad)' }}>⚠ Conflict: {c.impact.overDays.length} day(s) / {c.impact.overWeeks.length} week(s) over capacity</div>}
                    </div>
                    <div>{!presentation && !c.current && <button className={`btn sm ${c.recommended ? 'primary' : ''}`} onClick={() => setReview({ cand: c })}>Assign</button>}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {review && <ReviewDialog task={task} cand={review.cand} plant={plant} onClose={() => setReview(null)} onConfirm={confirm} />}
      {adding && ms && <TaskForm milestone={ms} onClose={() => setAdding(false)} />}
    </>
  );
}
