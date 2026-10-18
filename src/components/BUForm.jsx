import { useState } from 'react';
import { A } from '../state/actions.js';
import { useStore } from '../state/store.jsx';
import { PLANTS } from '../utils/milestoneStyle.js';
import { Field, Modal } from './ui.jsx';

export default function BUForm({ bu, onClose }) {
  const { data, dispatch, notify } = useStore();
  const [name, setName] = useState(bu?.name ?? '');
  const [plantGroup, setPlantGroup] = useState(bu?.plantGroup ?? '');
  const [plant, setPlant] = useState(bu?.plant ?? '');
  const groups = [...new Set(data.milestones.businessUnits.map((b) => b.plantGroup).filter(Boolean))];
  const dup = data.milestones.businessUnits.some((b) => b.id !== bu?.id && b.name.toLowerCase() === name.trim().toLowerCase());
  const error = !name.trim() ? 'BU name is required.' : dup ? 'A BU with this name already exists.' : null;

  const save = () => {
    if (error) return;
    if (bu) dispatch(A.buUpdate(bu.id, { name, plantGroup, plant: plant || null }));
    else dispatch(A.buAdd({ name, plantGroup, plant: plant || null }));
    notify(bu ? 'BU updated' : 'BU added', 'ok');
    onClose();
  };
  return (
    <Modal
      title={bu ? 'Edit / rename BU' : 'Add BU'}
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!!error} onClick={save}>Save</button></>}
    >
      <div className="form-grid">
        <Field label="BU name" error={error} className="full"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Plant group" hint="Label shown in column A of the sheet, e.g. “YMM1 & YMM2”">
          <input list="plant-groups" value={plantGroup} onChange={(e) => setPlantGroup(e.target.value)} />
          <datalist id="plant-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
        </Field>
        <Field label="Plant (optional)">
          <select value={plant} onChange={(e) => setPlant(e.target.value)}>
            <option value="">TBC</option>
            {PLANTS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
}
