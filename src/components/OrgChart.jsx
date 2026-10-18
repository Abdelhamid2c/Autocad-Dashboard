import { Plus, UserRound } from 'lucide-react';
import { useState } from 'react';
import { A } from '../state/actions.js';
import { useStore } from '../state/store.jsx';
import { isTechnician } from '../utils/capacityCalculations.js';
import { PLANTS } from '../utils/milestoneStyle.js';
import { Banner, Confirm, EditOnly, Field, Modal, OriginBadge } from './ui.jsx';

const ROLE = { MANAGER: 'Manager', CAD_RESPONSIBLE: 'CAD Responsible', CAD_TECHNICIAN: 'CAD Technician' };

function PersonForm({ person, onClose }) {
  const { model, dispatch, notify } = useStore();
  const tech = isTechnician(person);
  const [name, setName] = useState(person.name ?? '');
  const [plantId, setPlantId] = useState(person.plantId);
  const [cap, setCap] = useState(person.capacityOverride ?? '');
  const [skills, setSkills] = useState((person.skills ?? []).join(', '));
  const [confirmed, setConfirmed] = useState(String(person.positionStatus).toUpperCase() !== 'TBC');
  const [del, setDel] = useState(false);
  const taskCount = (model.tasksByTech[person.id] ?? []).length;

  const save = () => {
    const patch = { name: name.trim() || null };
    if (tech) {
      patch.plantId = plantId;
      patch.capacityOverride = cap === '' ? null : Number(cap);
      patch.skills = skills.split(',').map((s) => s.trim()).filter(Boolean);
      patch.positionStatus = confirmed ? (String(person.positionStatus).toUpperCase() === 'TBC' ? 'Confirmed by coordinator' : person.positionStatus) : 'TBC';
    } else {
      patch.positionStatus = confirmed ? (String(person.positionStatus).toUpperCase() === 'TBC' ? 'Confirmed by coordinator' : person.positionStatus) : 'TBC';
    }
    dispatch(A.personUpdate(person.id, patch));
    notify('Saved', 'ok');
    onClose();
  };

  return (
    <>
      <Modal
        title={`${ROLE[person.role]} — ${person.plantId}`}
        onClose={onClose}
        footer={<>{tech && <button className="btn danger" style={{ marginRight: 'auto' }} onClick={() => setDel(true)}>Remove slot</button>}<button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Save</button></>}
      >
        <div className="form-grid">
          <Field label="Name" hint="The org chart gives positions only, never names. Enter the real name here." className="full"><input autoFocus value={name} placeholder={person.label ?? ROLE[person.role]} onChange={(e) => setName(e.target.value)} /></Field>
          {tech && (
            <>
              <Field label="Home plant"><select value={plantId} onChange={(e) => setPlantId(e.target.value)}>{PLANTS.map((p) => <option key={p}>{p}</option>)}</select></Field>
              <Field label="Weekly capacity override (h)" hint={`Empty = default (${model.settings.dailyHours * model.settings.workingDays.length} h)`}><input type="number" min="0" max="80" step="0.5" value={cap} onChange={(e) => setCap(e.target.value)} /></Field>
              <Field label="Skills (comma separated)" className="full"><input value={skills} onChange={(e) => setSkills(e.target.value)} /></Field>
            </>
          )}
          <label className="row full"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> Position confirmed {tech && '(counts in capacity totals)'}</label>
        </div>
        {person.note && <Banner type="info">{person.note}</Banner>}
        {tech && taskCount > 0 && plantId !== person.plantId && <Banner type="warn">{taskCount} task(s) are assigned to this technician. Tasks for another plant will appear as cross-plant mismatches.</Banner>}
        <p className="muted small">Position status in source: {person.positionStatus} · <OriginBadge origin={person.origin} /></p>
      </Modal>
      {del && (
        <Confirm title="Remove technician slot" danger confirmLabel="Remove" message={`Remove "${person.name || person.label}"? ${taskCount ? `${taskCount} assigned task(s) become unassigned.` : ''}`} onCancel={() => setDel(false)} onConfirm={() => { dispatch(A.personDelete(person.id)); onClose(); notify('Technician slot removed (Undo available in the planner)', 'ok'); }} />
      )}
    </>
  );
}

function Node({ p, onClick }) {
  const tbc = String(p.positionStatus).toUpperCase() === 'TBC';
  return (
    <div className={`org-node small${tbc ? ' tbc' : ''}`} onClick={onClick} title="Click to edit">
      <div className="role">{ROLE[p.role]}{tbc ? ' · TBC' : ''}{p.origin === 'user' ? ' · added' : ''}</div>
      <div><UserRound size={11} /> {p.name || p.label || <span className="muted">name to enter</span>}</div>
    </div>
  );
}

export default function OrgChart() {
  const { model, dispatch, presentation } = useStore();
  const [edit, setEdit] = useState(null);
  const people = model.people;
  const confirmedTechs = model.activeTechs.length;
  const resps = people.filter((p) => p.role === 'CAD_RESPONSIBLE' && String(p.positionStatus).toUpperCase() !== 'TBC').length;

  return (
    <>
      <div className="stat-line" style={{ marginBottom: 10 }}>
        <span>Confirmed CAD Technicians <b>{confirmedTechs}</b></span>
        <span>Confirmed CAD Responsibles <b>{resps}</b></span>
        <span className="muted">The chart has no “CAD Coordinator” box: the coordinator is the app user (reports to the PPC Director); CAD Responsibles are plant leads.</span>
      </div>
      <div className="org-tree">
        <div className="org-node director"><div className="role">PPC Director</div><b>{model.data.organization.director?.name ?? 'name not in chart'}</b></div>
        <div className="org-sites">
          {model.sites.map((site) => (
            <div className="org-site" key={site.id}>
              <h3>{site.name}</h3>
              <div className="org-plants">
                {site.plantIds.map((pid) => {
                  const plant = model.plants.find((p) => p.id === pid);
                  const mgr = people.find((p) => p.role === 'MANAGER' && p.plantId === pid);
                  const resp = people.find((p) => p.role === 'CAD_RESPONSIBLE' && p.plantId === pid);
                  const techs = people.filter((p) => isTechnician(p) && p.plantId === pid);
                  return (
                    <div className="org-plant" key={pid}>
                      <h4>{plant.name}</h4>
                      {mgr && <Node p={mgr} onClick={() => !presentation && setEdit(mgr)} />}
                      {resp ? <Node p={resp} onClick={() => !presentation && setEdit(resp)} /> : <div className="org-node small tbc"><div className="role">CAD Responsible</div>No box in chart — technicians follow the YMM1 CAD Responsible (to be confirmed)</div>}
                      {techs.map((t) => <Node key={t.id} p={t} onClick={() => !presentation && setEdit(t)} />)}
                      <EditOnly><button className="btn sm" onClick={() => dispatch(A.personAdd(pid, null))}><Plus size={13} /> Add technician</button></EditOnly>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      {edit && <PersonForm key={edit.id} person={people.find((p) => p.id === edit.id) ?? edit} onClose={() => setEdit(null)} />}
    </>
  );
}
