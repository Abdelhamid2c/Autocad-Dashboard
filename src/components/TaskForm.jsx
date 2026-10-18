import { useMemo, useState } from 'react';
import { A } from '../state/actions.js';
import { useStore } from '../state/store.jsx';
import { fmtPct, round2 } from '../utils/capacityCalculations.js';
import { PLANTS } from '../utils/milestoneStyle.js';
import { assignmentImpact, PRIORITIES, TASK_STATUS, taskWindow } from '../utils/scheduling.js';
import { formatDate, weekLabel, workingDaysBetween } from '../utils/weekCalendar.js';
import { Banner, Field, Modal } from './ui.jsx';

/**
 * Create / edit a task. Every save goes through the store, so milestone effort, technician availability,
 * plant planning, dashboard and calendar all update from the same record.
 */
export default function TaskForm({ task, milestone, onClose }) {
  const { model, dispatch, notify } = useStore();
  const isNew = !task;
  const ms = milestone ?? (task?.milestoneId ? model.msById[task.milestoneId] : null);
  const line = ms ? model.lineById[ms.lineId] : null;
  const est = task?.estimatedMinutes ?? 0;

  const [f, setF] = useState({
    name: task?.name ?? '',
    description: task?.description ?? '',
    hours: String(Math.floor(est / 60)),
    mins: String(est % 60),
    startDate: task?.startDate ?? '',
    endDate: task?.endDate ?? '',
    followsMilestone: task?.followsMilestone ?? false,
    priority: task?.priority ?? 'Medium',
    status: task?.status ?? 'NOT_STARTED',
    skills: (task?.skills ?? []).join(', '),
    plant: task ? task.plant ?? '' : line?.plant ?? '',
    technicianId: task?.technicianId ?? '',
    actualHours: task?.actualMinutes ? String(round2(task.actualMinutes / 60)) : '',
    notes: task?.notes ?? '',
    milestoneId: task?.milestoneId ?? milestone?.id ?? '',
  });
  const [cross, setCross] = useState(!!model.assignments[task?.id]?.crossPlant);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const minutes = (Number(f.hours) || 0) * 60 + (Number(f.mins) || 0);
  const tech = f.technicianId ? model.techById[f.technicianId] : null;
  const errors = [];
  if (!f.name.trim()) errors.push('Task name is required.');
  if (minutes <= 0) errors.push('Estimated duration must be greater than 0.');
  if ((f.startDate && !f.endDate) || (!f.startDate && f.endDate)) errors.push('Set both start and end dates, or neither (unscheduled).');
  if (f.startDate && f.endDate && f.startDate > f.endDate) errors.push('Start date must be ≤ end date.');
  if (f.startDate && f.endDate && f.startDate <= f.endDate && !workingDaysBetween(f.startDate, f.endDate, model.settings).length) errors.push('The period contains no working day.');

  const crossNeeded = !!(tech && f.plant && tech.plantId !== f.plant);
  if (crossNeeded && !cross) errors.push(`Technician's home plant (${tech.plantId}) differs from the task plant (${f.plant}). Tick "Allow cross-plant" to confirm this explicit decision.`);

  const draft = useMemo(
    () => ({ ...(task ?? {}), id: task?.id ?? '__new__', estimatedMinutes: minutes, status: f.status, startDate: f.startDate || null, endDate: f.endDate || null, technicianId: f.technicianId || null }),
    [task, minutes, f.status, f.startDate, f.endDate, f.technicianId],
  );
  const impact = useMemo(() => {
    if (!tech || !tech.confirmed || !taskWindow(draft) || minutes <= 0 || f.status === 'COMPLETED') return null;
    return assignmentImpact(tech, draft, model.tasks, model.settings, model.refDate, model.year);
  }, [tech, draft, minutes, f.status, model]);
  const over = impact && (impact.overDays.length > 0 || impact.overWeeks.length > 0);

  const useWindow = () => {
    if (!ms) return;
    setF((x) => ({ ...x, startDate: ms.startDate, endDate: ms.endDate, followsMilestone: true }));
  };

  const save = () => {
    if (errors.length) return;
    const body = {
      ...(task ?? {}),
      milestoneId: f.milestoneId || null,
      name: f.name.trim(),
      description: f.description,
      estimatedMinutes: minutes,
      actualMinutes: Math.round((Number(f.actualHours) || 0) * 60),
      priority: f.priority,
      status: f.status,
      startDate: f.startDate || null,
      endDate: f.endDate || null,
      followsMilestone: !!(f.startDate && f.followsMilestone),
      skills: f.skills.split(',').map((s) => s.trim()).filter(Boolean),
      plant: f.plant || null,
      technicianId: f.technicianId || null,
      notes: f.notes,
      needsReview: false,
      reviewReason: undefined,
    };
    dispatch(A.taskSave(body, cross && crossNeeded));
    notify(over ? 'Task saved — capacity exceeded, check the technician workload' : 'Task saved', over ? 'warn' : 'ok');
    onClose();
  };

  const orphanMs = task?.orphan && !f.milestoneId ? model.milestoneList : null;

  return (
    <Modal
      title={`${isNew ? 'Add task' : 'Edit task'}${ms ? ` — ${ms.label} · ${line?.project}` : ''}`}
      onClose={onClose}
      wide
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className={`btn ${over ? 'danger' : 'primary'}`} disabled={errors.length > 0} onClick={save}>{over ? 'Save anyway (exceeds capacity)' : 'Save task'}</button></>}
    >
      {task?.needsReview && <Banner type="warn">Flagged for review: {task.reviewReason}. Saving this task clears the flag.</Banner>}
      {task?.orphan && <Banner type="warn">Orphan task — its milestone was deleted{task.orphanInfo ? ` (${task.orphanInfo.label}, ${task.orphanInfo.project})` : ''}. Attach it to a milestone below or keep it as is.</Banner>}
      <div className="form-grid">
        <Field label="Task name" className="full"><input autoFocus value={f.name} onChange={set('name')} /></Field>
        <Field label="Description" className="full"><textarea value={f.description} onChange={set('description')} /></Field>
        {orphanMs && (
          <Field label="Attach to milestone" className="full">
            <select value={f.milestoneId} onChange={set('milestoneId')}>
              <option value="">— keep as orphan —</option>
              {orphanMs.map((m) => <option key={m.id} value={m.id}>{m.bu} / {m.project} / {m.label} ({weekLabel(m.startWeek)})</option>)}
            </select>
          </Field>
        )}
        <Field label="Estimated duration">
          <div className="row"><input type="number" min="0" style={{ width: 80 }} value={f.hours} onChange={set('hours')} /> h <input type="number" min="0" max="59" style={{ width: 70 }} value={f.mins} onChange={set('mins')} /> min <span className="muted small">= {round2(minutes / 60)} h</span></div>
        </Field>
        <Field label="Hours logged so far (actual)"><input type="number" min="0" step="0.5" value={f.actualHours} onChange={set('actualHours')} /></Field>
        <Field label="Start date"><input type="date" value={f.startDate} onChange={(e) => setF((x) => ({ ...x, startDate: e.target.value, followsMilestone: false }))} /></Field>
        <Field label="End date"><input type="date" value={f.endDate} onChange={(e) => setF((x) => ({ ...x, endDate: e.target.value, followsMilestone: false }))} /></Field>
        <div className="full row">
          {ms && <button type="button" className="btn sm" onClick={useWindow}>Use milestone window ({weekLabel(ms.startWeek)}{ms.endWeek !== ms.startWeek ? `–${weekLabel(ms.endWeek)}` : ''}, {formatDate(ms.startDate)})</button>}
          {f.followsMilestone && <span className="badge">follows milestone window</span>}
          {!f.startDate && <span className="muted small">No dates = unscheduled workload (not placed in any week).</span>}
        </div>
        <Field label="Priority"><select value={f.priority} onChange={set('priority')}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Status">
          <select value={f.status} onChange={set('status')}>{Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        </Field>
        <Field label="Plant" hint={line && !line.plant ? 'Line plant is TBC — choose the plant doing the work' : undefined}>
          <select value={f.plant} onChange={set('plant')}><option value="">TBC</option>{PLANTS.map((p) => <option key={p}>{p}</option>)}</select>
        </Field>
        <Field label="Technician (optional)">
          <select value={f.technicianId} onChange={set('technicianId')}>
            <option value="">Unassigned</option>
            {PLANTS.map((p) => {
              const list = model.activeTechs.filter((t) => t.plantId === p);
              return list.length ? <optgroup key={p} label={p}>{list.map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}</optgroup> : null;
            })}
          </select>
        </Field>
        <Field label="Required skills (comma separated)" className="full"><input value={f.skills} onChange={set('skills')} /></Field>
        <Field label="Notes" className="full"><textarea value={f.notes} onChange={set('notes')} /></Field>
      </div>

      {crossNeeded && (
        <label className="row mt"><input type="checkbox" checked={cross} onChange={(e) => setCross(e.target.checked)} /> Allow cross-plant assignment ({tech.plantId} → {f.plant}); flagged for review</label>
      )}
      {impact && (
        <div className="mt">
          <Banner type={over ? 'warn' : 'info'}>
            <div>
              <b>{tech.displayName}</b> during the task period: {round2(impact.allocatedBefore)} h of {round2(impact.capacity)} h allocated ({fmtPct(impact.utilBefore)}) → <b>{round2(impact.allocatedAfter)} h ({fmtPct(impact.utilAfter)})</b>, remaining {round2(impact.remainingAfter)} h.
              {impact.overDays.length > 0 && <div>⚠ Exceeds the daily capacity on {impact.overDays.length} day(s), e.g. {formatDate(impact.overDays[0].date)} ({round2(impact.overDays[0].after)} h of {impact.overDays[0].cap} h).</div>}
              {impact.overWeeks.length > 0 && <div>⚠ Exceeds the weekly capacity in {impact.overWeeks.map((w) => weekLabel(w.week)).join(', ')}.</div>}
            </div>
          </Banner>
        </div>
      )}
      {errors.map((x) => <Banner key={x} type="err">{x}</Banner>)}
    </Modal>
  );
}
