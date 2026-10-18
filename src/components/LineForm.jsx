import { useState } from 'react';
import { A } from '../state/actions.js';
import { useStore } from '../state/store.jsx';
import { eopInputValue, formatEop, parseEop } from '../utils/eop.js';
import { PLANTS } from '../utils/milestoneStyle.js';
import { Field, Modal } from './ui.jsx';

export default function LineForm({ line, bu, onClose }) {
  const { data, dispatch, notify } = useStore();
  const e0 = line?.eop;
  const [project, setProject] = useState(line?.project ?? '');
  const [buName, setBuName] = useState(line?.bu ?? bu ?? data.milestones.businessUnits[0]?.name ?? '');
  const [mode, setMode] = useState(e0?.month ? 'month' : e0?.year ? 'year' : e0 ? 'tbc' : 'month');
  const [month, setMonth] = useState(eopInputValue(e0));
  const [year, setYear] = useState(e0?.year ? String(e0.year) : '');
  const [plant, setPlant] = useState(line?.plant ?? '');
  const [notes, setNotes] = useState(line?.notes ?? '');

  const buildEop = () => {
    if (mode === 'month') return month ? parseEop(month) : parseEop(null);
    if (mode === 'year') return /^\d{4}$/.test(year) ? parseEop(year) : null;
    return parseEop('TBC');
  };
  const eop = buildEop();
  const errors = [];
  if (!project.trim()) errors.push('Project name is required.');
  if (!eop) errors.push('Enter a 4-digit EOP year.');

  const save = () => {
    if (errors.length) return;
    // Keep the original EOP object (raw text, "Needs confirmation" status) when the coordinator did not change it.
    const unchanged = line && formatEop(line.eop) === formatEop(eop) && line.eop.year === eop.year;
    const finalEop = unchanged ? line.eop : eop;
    if (line) dispatch(A.lineUpdate(line.id, { project, bu: buName, eop: finalEop, plant: plant || null, notes }));
    else dispatch(A.lineAdd({ bu: buName, project, eop: finalEop, plant: plant || null, notes }));
    notify(line ? 'Project line updated' : 'Project line added', 'ok');
    onClose();
  };

  return (
    <Modal
      title={line ? 'Edit project line' : 'Add project line'}
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!!errors.length} onClick={save}>Save</button></>}
    >
      <div className="form-grid">
        <Field label="Project name" className="full"><input autoFocus value={project} onChange={(e) => setProject(e.target.value)} /></Field>
        <Field label="BU">
          <select value={buName} onChange={(e) => setBuName(e.target.value)}>
            {data.milestones.businessUnits.map((b) => <option key={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <Field label="Plant" hint="Leave TBC if the source does not say (e.g. “YMM1 & YMM2”)">
          <select value={plant} onChange={(e) => setPlant(e.target.value)}>
            <option value="">TBC</option>
            {PLANTS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="EOP (End of Production)" className="full" error={errors.find((x) => x.includes('EOP'))}>
          <div className="row">
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="month">Month / year</option>
              <option value="year">Year only</option>
              <option value="tbc">TBC</option>
            </select>
            {mode === 'month' && <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />}
            {mode === 'year' && <input type="number" min="2000" max="2100" placeholder="YYYY" value={year} onChange={(e) => setYear(e.target.value)} style={{ width: 100 }} />}
            {eop && <span className="muted small">→ {formatEop(eop)}</span>}
          </div>
        </Field>
        <Field label="Notes" className="full"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
