import { useState } from 'react';
import { A } from '../state/actions.js';
import { useStore } from '../state/store.jsx';
import { MILESTONE_TYPES, milestoneColors, typeMeta } from '../utils/milestoneStyle.js';
import { milestoneWarnings, validateWeeks } from '../utils/planValidation.js';
import { weekRangeText } from '../utils/weekCalendar.js';
import DeleteImpactDialog from './DeleteImpactDialog.jsx';
import { Banner, Field, Modal } from './ui.jsx';

export default function MilestoneForm({ line, milestone, defaults, onClose, onDeleted }) {
  const { data, model, dispatch, notify } = useStore();
  const types = data.milestones.meta.milestoneTypes;
  const [label, setLabel] = useState(milestone?.label ?? '');
  const [type, setType] = useState(milestone?.type ?? 'OTHER');
  const [start, setStart] = useState(String(milestone?.startWeek ?? defaults?.startWeek ?? ''));
  const [end, setEnd] = useState(String(milestone?.endWeek ?? defaults?.endWeek ?? ''));
  const [override, setOverride] = useState(!!milestone?.colorOverride);
  const [color, setColor] = useState(milestone?.colorOverride ?? typeMeta(types, 'OTHER').color);
  const [notes, setNotes] = useState(milestone?.notes ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const s = Number(start);
  const e = Number(end);
  const errors = validateWeeks(s, e);
  if (!label.trim()) errors.unshift('Label is required.');
  const warnings = errors.length ? [] : milestoneWarnings(line, { id: milestone?.id, type, startWeek: s, endWeek: e }, model.year);
  const taskCount = milestone ? (model.tasksByMs[milestone.id]?.length ?? 0) : 0;
  const preview = milestoneColors({ type, sourceColor: override ? null : milestone?.sourceColor, colorOverride: override ? color : null }, types);

  const save = () => {
    if (errors.length) return;
    const body = { label, type, startWeek: s, endWeek: e, colorOverride: override ? color : null, notes };
    if (milestone) dispatch(A.msUpdate(milestone.id, body));
    else dispatch(A.msAdd(line.id, body));
    notify(warnings.length ? `Saved with ${warnings.length} warning(s)` : 'Milestone saved', warnings.length ? 'warn' : 'ok');
    onClose();
  };

  return (
    <>
      <Modal
        title={`${milestone ? 'Edit' : 'Add'} milestone — ${line.project} (${line.bu})`}
        onClose={onClose}
        footer={(
          <>
            {milestone && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={() => setConfirmDelete(true)}>Delete</button>}
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" disabled={!!errors.length} onClick={save}>Save</button>
          </>
        )}
      >
        <div className="form-grid">
          <Field label="Label" className="full"><input autoFocus value={label} onChange={(ev) => setLabel(ev.target.value)} placeholder="e.g. SOP, VS2, DOC" /></Field>
          <Field label="Type" hint={typeMeta(types, type).label}>
            <select value={type} onChange={(ev) => setType(ev.target.value)}>{MILESTONE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          </Field>
          <div />
          <Field label="Start week (1–52)" hint={weekRangeText(s)}><input type="number" min="1" max="52" value={start} onChange={(ev) => setStart(ev.target.value)} /></Field>
          <Field label="End week (1–52)" hint={weekRangeText(e)}><input type="number" min="1" max="52" value={end} onChange={(ev) => setEnd(ev.target.value)} /></Field>
          <div className="full row">
            <label className="row"><input type="checkbox" checked={override} onChange={(ev) => setOverride(ev.target.checked)} /> Colour override</label>
            {override && <input type="color" value={color} onChange={(ev) => setColor(ev.target.value)} />}
            <span className="badge" style={{ background: preview.bg, color: preview.fg }}>{label || 'Preview'}</span>
          </div>
          <Field label="Notes" className="full"><textarea value={notes} onChange={(ev) => setNotes(ev.target.value)} /></Field>
        </div>
        {errors.map((x) => <Banner key={x} type="err">{x}</Banner>)}
        {warnings.map((x) => <Banner key={x} type="warn">{x}</Banner>)}
        {milestone && taskCount > 0 && <Banner type="info">{taskCount} task(s) use this milestone. Changing the weeks moves tasks that follow the milestone window and flags other dated tasks for review.</Banner>}
      </Modal>
      {confirmDelete && (
        <DeleteImpactDialog
          title="Delete milestone"
          summary={`Delete “${milestone.label}” from ${line.project}?`}
          taskCount={taskCount}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={(mode) => {
            dispatch(A.msDelete(milestone.id, mode));
            notify('Milestone deleted (Undo available)', 'ok');
            onDeleted?.();
            onClose();
          }}
        />
      )}
    </>
  );
}
