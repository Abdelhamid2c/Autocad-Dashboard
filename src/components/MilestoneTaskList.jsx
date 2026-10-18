import { Copy, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { A } from '../state/actions.js';
import { useStore } from '../state/store.jsx';
import { round2 } from '../utils/capacityCalculations.js';
import { isOverdue, TASK_STATUS, taskWindow } from '../utils/scheduling.js';
import { formatShort } from '../utils/weekCalendar.js';
import TaskForm from './TaskForm.jsx';
import { Confirm, Empty, OriginBadge } from './ui.jsx';

export default function MilestoneTaskList({ tasks, milestone, showContext }) {
  const { model, dispatch, notify, presentation } = useStore();
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  if (!tasks.length) return <Empty>No tasks defined for this milestone.</Empty>;

  const assign = (t, techId) => {
    const tech = model.techById[techId];
    if (tech && t.plant && tech.plantId !== t.plant) {
      notify('Cross-plant assignment needs an explicit decision: use Edit or Task Allocation.', 'warn');
      return;
    }
    dispatch(A.taskAssign(t.id, techId || null, false));
  };

  return (
    <>
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              {showContext && <th>Milestone</th>}
              <th>Task</th><th className="num">Hours</th><th>Period</th><th>Status</th><th>Technician</th><th>Priority</th><th />
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const w = taskWindow(t);
              const ms = showContext ? model.msById[t.milestoneId] : milestone;
              const candidates = model.activeTechs.filter((x) => !t.plant || x.plantId === t.plant);
              return (
                <tr key={t.id}>
                  {showContext && <td>{ms ? `${ms.project} · ${ms.label}` : <span className="badge warn">orphan</span>}</td>}
                  <td>
                    <b>{t.name}</b> <OriginBadge origin={t.origin} />
                    {t.needsReview && <span className="badge warn" title={t.reviewReason}>review</span>}
                    {model.assignments[t.id]?.crossPlant && <span className="badge warn" title="Cross-plant assignment flagged for review">cross-plant</span>}
                    {t.description && <div className="muted small">{t.description}</div>}
                  </td>
                  <td className="num">{round2(t.estimatedMinutes / 60)}</td>
                  <td className="nowrap">
                    {w ? `${formatShort(w.start)} → ${formatShort(w.end)}` : <span className="muted">unscheduled</span>}
                    {isOverdue(t, model.refDate) && <span className="badge bad">overdue</span>}
                  </td>
                  <td>
                    <select disabled={presentation} value={t.status} onChange={(e) => dispatch(A.taskPatch(t.id, { status: e.target.value }))}>
                      {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </td>
                  <td>
                    <select disabled={presentation} value={t.technicianId ?? ''} onChange={(e) => assign(t, e.target.value)}>
                      <option value="">Unassigned</option>
                      {candidates.map((x) => <option key={x.id} value={x.id}>{x.displayName}</option>)}
                      {t.technicianId && !candidates.some((x) => x.id === t.technicianId) && <option value={t.technicianId}>{model.techById[t.technicianId]?.displayName ?? t.technicianId}</option>}
                    </select>
                  </td>
                  <td>{t.priority}</td>
                  <td className="nowrap edit-only">
                    <button className="btn icon ghost sm" title="Edit" onClick={() => setEdit(t)}><Pencil size={13} /></button>
                    <button className="btn icon ghost sm" title="Duplicate" onClick={() => { dispatch(A.taskDuplicate(t.id)); notify('Task duplicated', 'ok'); }}><Copy size={13} /></button>
                    <button className="btn icon ghost sm" title="Delete" onClick={() => setDel(t)}><Trash2 size={13} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {edit && <TaskForm task={edit} milestone={milestone ?? model.msById[edit.milestoneId]} onClose={() => setEdit(null)} />}
      {del && (
        <Confirm title="Delete task" danger confirmLabel="Delete" message={`Delete “${del.name}” (${round2(del.estimatedMinutes / 60)} h)? Effort and workload are updated immediately.`} onCancel={() => setDel(null)} onConfirm={() => { dispatch(A.taskDelete(del.id)); setDel(null); notify('Task deleted', 'ok'); }} />
      )}
    </>
  );
}
