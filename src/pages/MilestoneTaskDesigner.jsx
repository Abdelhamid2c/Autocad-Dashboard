import { AlertTriangle, ListPlus, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import MilestoneForm from '../components/MilestoneForm.jsx';
import MilestoneTaskList from '../components/MilestoneTaskList.jsx';
import TaskForm from '../components/TaskForm.jsx';
import { Banner, EditOnly, OriginBadge, PageHead } from '../components/ui.jsx';
import { useStore } from '../state/store.jsx';
import { round2 } from '../utils/capacityCalculations.js';
import { milestoneColors } from '../utils/milestoneStyle.js';
import { formatDate, weekLabel } from '../utils/weekCalendar.js';
import { linePlantLabel } from '../utils/workloadAggregation.js';

export function milestoneStatusText(m, refWeek) {
  if (m.endWeek < refWeek) return 'Passed';
  if (m.startWeek <= refWeek) return 'In progress';
  return `Starts in ${m.startWeek - refWeek} week(s)`;
}

export default function MilestoneTaskDesigner({ params, navigate }) {
  const { model, data } = useStore();
  const [q, setQ] = useState('');
  const [bu, setBu] = useState('');
  const [noTasks, setNoTasks] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);

  const selId = params.m && model.msById[params.m] ? params.m : model.milestoneList[0]?.id;
  const ms = selId ? model.msById[selId] : null;
  const line = ms ? model.lineById[ms.lineId] : null;
  const tasks = ms ? model.tasksByMs[ms.id] ?? [] : [];
  const types = data.milestones.meta.milestoneTypes;

  const groups = useMemo(() => {
    const out = [];
    for (const l of model.lines) {
      if (bu && l.bu !== bu) continue;
      const list = l.milestones.filter((m) => (!noTasks || !model.tasksByMs[m.id]?.length) && (!q || `${l.project} ${m.label}`.toLowerCase().includes(q.toLowerCase())));
      if (list.length) out.push({ line: l, list });
    }
    return out;
  }, [model, q, bu, noTasks]);

  const eff = ms ? model.effortByMs[ms.id] : null;
  const total = (eff?.minutes ?? 0) / 60;
  const allocated = (eff?.assignedMinutes ?? 0) / 60;
  const upcomingNoTasks = ms && tasks.length === 0 && ms.endWeek >= model.refWeek && ms.startWeek <= model.refWeek + model.settings.nearMilestoneWeeks - 1;
  const byTech = {};
  for (const t of tasks) if (t.technicianId) byTech[t.technicianId] = (byTech[t.technicianId] ?? 0) + t.estimatedMinutes / 60;

  return (
    <>
      <PageHead title="Milestone Task Designer" subtitle="Select a milestone and define its own task list. Different milestones need different tasks — nothing is assumed." />
      <div className="split">
        <div>
          <div className="toolbar">
            <input type="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 0, flex: 1 }} />
            <select value={bu} onChange={(e) => setBu(e.target.value)}><option value="">All BUs</option>{data.milestones.businessUnits.map((b) => <option key={b.id}>{b.name}</option>)}</select>
            <label className="row small"><input type="checkbox" checked={noTasks} onChange={(e) => setNoTasks(e.target.checked)} /> Without tasks</label>
          </div>
          <div className="list">
            {groups.length === 0 && <div className="empty">No milestones.</div>}
            {groups.map(({ line: l, list }) => (
              <div key={l.id}>
                <div className="list-group">{l.bu} · {l.project}</div>
                {list.map((m) => {
                  const c = milestoneColors(m, types);
                  const n = model.tasksByMs[m.id]?.length ?? 0;
                  return (
                    <div key={m.id} className={`list-item${m.id === selId ? ' sel' : ''}`} onClick={() => navigate('designer', { m: m.id })}>
                      <div className="row between">
                        <span><span className="badge" style={{ background: c.bg, color: c.fg }}>{m.type}</span> {m.label}</span>
                        <span className="muted small">{weekLabel(m.startWeek)}{m.endWeek !== m.startWeek ? `–${weekLabel(m.endWeek)}` : ''}</span>
                      </div>
                      <div className="muted small">{n ? `${n} task(s) · ${round2((model.effortByMs[m.id]?.minutes ?? 0) / 60)} h` : 'No tasks defined'}</div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div>
          {!ms ? <div className="empty">No milestone available. Add one in the Milestone Planner.</div> : (
            <div className="card">
              <div className="card-head">
                <div>
                  <h2>{ms.label} <span className="badge" style={{ background: milestoneColors(ms, types).bg, color: milestoneColors(ms, types).fg }}>{ms.type}</span> <OriginBadge origin={ms.origin} /></h2>
                  <div className="muted">{line.bu} · {line.project} · plant {linePlantLabel(line)} · EOP {line.eop?.raw ?? 'TBC'}</div>
                  <div className="small">{weekLabel(ms.startWeek)}{ms.endWeek !== ms.startWeek ? ` → ${weekLabel(ms.endWeek)}` : ''} · {formatDate(ms.startDate)} → {formatDate(ms.endDate)} · <b>{milestoneStatusText(ms, model.refWeek)}</b></div>
                </div>
                <EditOnly>
                  <div className="row">
                    <button className="btn sm" onClick={() => setEditing(true)}><Pencil size={13} /> Edit milestone</button>
                    <button className="btn sm primary" onClick={() => setAdding(true)}><ListPlus size={13} /> Add Task</button>
                  </div>
                </EditOnly>
              </div>

              {upcomingNoTasks && <Banner type="warn"><AlertTriangle size={14} /> This milestone is within the next {model.settings.nearMilestoneWeeks} weeks and has no tasks defined.</Banner>}

              <div className="stat-line" style={{ margin: '6px 0 12px' }}>
                <span>Tasks <b>{tasks.length}</b></span>
                <span>Estimated <b>{round2(total)} h</b></span>
                <span>Allocated to technicians <b>{round2(allocated)} h</b></span>
                <span>Unallocated <b style={{ color: total - allocated > 0 ? 'var(--warn)' : undefined }}>{round2(total - allocated)} h</b></span>
                <span>Completed <b>{eff?.completed ?? 0}/{tasks.length}</b></span>
              </div>

              <MilestoneTaskList tasks={tasks} milestone={ms} />

              {Object.keys(byTech).length > 0 && (
                <div className="mt">
                  <h3>Assignments</h3>
                  <div>{Object.entries(byTech).map(([id, h]) => <span className="chip" key={id}>{model.techById[id]?.displayName ?? id}: {round2(h)} h</span>)}</div>
                </div>
              )}
              <div className="mt"><a href={`#/allocation?m=${ms.id}`}>Open in Task Allocation →</a> · <a href={`#/projects?line=${line.id}`}>Open project →</a></div>
            </div>
          )}
        </div>
      </div>
      {adding && ms && <TaskForm milestone={ms} onClose={() => setAdding(false)} />}
      {editing && ms && <MilestoneForm line={line} milestone={ms} onClose={() => setEditing(false)} />}
    </>
  );
}
