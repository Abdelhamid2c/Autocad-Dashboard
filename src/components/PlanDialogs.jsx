import { useState } from 'react';
import { A } from '../state/actions.js';
import { useStore } from '../state/store.jsx';
import { parsePlanImport } from '../utils/planIO.js';
import { Banner, Modal } from './ui.jsx';

export function PlanImportDialog({ onClose }) {
  const { data, dispatch, notify } = useStore();
  const [res, setRes] = useState(null);
  const [name, setName] = useState('');

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setName(f.name);
    setRes(parsePlanImport(await f.text(), f.name, data.milestones, data.tasks));
  };
  const apply = () => {
    dispatch(A.planReplace(res.plan, `Import plan from ${name}`));
    notify('Plan imported (Undo available)', 'ok');
    onClose();
  };
  const s = res?.summary;
  return (
    <Modal
      title="Import milestone plan (JSON or CSV)"
      onClose={onClose}
      wide
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!res?.ok} onClick={apply}>Apply import</button></>}
    >
      <p className="muted">JSON uses the same schema as <code>milestones.json</code>. CSV columns: BU, Project, EOP, Plant, Milestone, Type, Start Week, End Week (optional Line ID / Milestone ID). The import <b>replaces</b> the current plan; review the preview first.</p>
      <input type="file" accept=".json,.csv,application/json,text/csv" onChange={onFile} />
      {res && (
        <div className="mt">
          {res.errors.slice(0, 12).map((x) => <Banner key={x} type="err">{x}</Banner>)}
          {res.errors.length > 12 && <Banner type="err">…and {res.errors.length - 12} more errors.</Banner>}
          {res.warnings.slice(0, 8).map((x) => <Banner key={x} type="warn">{x}</Banner>)}
          {s && (
            <table className="t">
              <tbody>
                <tr><td>Business units</td><td className="num">{s.businessUnits}</td></tr>
                <tr><td>Project lines — added / kept / removed</td><td className="num">{s.linesAdded} / {s.linesKept} / {s.linesRemoved}</td></tr>
                <tr><td>Milestones — added / removed</td><td className="num">{s.milestonesAdded} / {s.milestonesRemoved}</td></tr>
                <tr><td>Tasks that become orphans (milestone no longer exists)</td><td className="num">{s.orphanedTasks}</td></tr>
              </tbody>
            </table>
          )}
          {res.ok && <Banner type="ok">File is valid. Nothing is applied until you click “Apply import”.</Banner>}
        </div>
      )}
    </Modal>
  );
}

export function EditLogPanel({ onClose }) {
  const { data } = useStore();
  return (
    <Modal title="Edit log" onClose={onClose} wide>
      {data.editLog.length === 0 ? <p className="muted">No edits yet.</p> : (
        <table className="t">
          <thead><tr><th>Time</th><th>Change</th></tr></thead>
          <tbody>
            {data.editLog.map((l) => (
              <tr key={l.id}><td className="nowrap">{new Date(l.ts).toLocaleString()}</td><td>{l.desc}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
