import { Download, Upload } from 'lucide-react';
import { useState } from 'react';
import DataQualityPanel from '../components/DataQualityPanel.jsx';
import { Banner, Confirm, Field, PageHead } from '../components/ui.jsx';
import { A } from '../state/actions.js';
import { useStore } from '../state/store.jsx';
import { repository } from '../storage/repository.js';
import { selfTest } from '../utils/capacityCalculations.js';
import { downloadFile } from '../utils/csv.js';
import { uid } from '../utils/ids.js';
import { WD_CODES, formatDate } from '../utils/weekCalendar.js';

export default function SettingsData() {
  const { data, model, ui, dispatch, notify } = useStore();
  const s = data.settings;
  const [f, setF] = useState({
    dailyHours: s.dailyHours, workingDays: s.workingDays, available: s.thresholds.available, moderate: s.thresholds.moderate, high: s.thresholds.high,
    horizonWeeks: s.horizonWeeks, nearMilestoneWeeks: s.nearMilestoneWeeks, referenceDate: s.referenceDate ?? '',
  });
  const [absence, setAbsence] = useState({ technicianId: '', from: '', to: '', note: '' });
  const [dlg, setDlg] = useState(null);
  const [importErr, setImportErr] = useState('');
  const test = selfTest();
  const demoCount = data.tasks.filter((t) => t.origin === 'demo').length;
  const st = repository.getStatus();

  const errors = [];
  if (!(Number(f.dailyHours) > 0 && Number(f.dailyHours) <= 24)) errors.push('Daily hours must be between 0 and 24.');
  if (!f.workingDays.length) errors.push('Select at least one working day.');
  if (!(Number(f.available) < Number(f.moderate) && Number(f.moderate) <= Number(f.high))) errors.push('Thresholds must satisfy available < moderate ≤ high.');

  const saveSettings = () => {
    if (errors.length) return;
    dispatch(A.settingsUpdate({
      dailyHours: Number(f.dailyHours), workingDays: WD_CODES.filter((d) => f.workingDays.includes(d)),
      thresholds: { available: Number(f.available), moderate: Number(f.moderate), high: Number(f.high) },
      horizonWeeks: Number(f.horizonWeeks) || 12, nearMilestoneWeeks: Number(f.nearMilestoneWeeks) || 4, referenceDate: f.referenceDate || null,
    }));
    notify('Settings saved', 'ok');
  };
  const addAbsence = () => {
    if (!absence.technicianId || !absence.from || !absence.to || absence.from > absence.to) return notify('Choose a technician and a valid period.', 'err');
    dispatch(A.settingsUpdate({ absences: [...s.absences, { ...absence, id: uid('abs') }] }));
    setAbsence({ technicianId: '', from: '', to: '', note: '' });
  };

  const exportAll = () => downloadFile(`cad-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(repository.exportAll(), null, 2), 'application/json');
  const importBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const out = repository.importAll(JSON.parse(await file.text()));
      dispatch(A.importAll(out));
      setImportErr('');
      notify('Backup imported', 'ok');
    } catch (err) {
      setImportErr(err.message);
    }
    e.target.value = '';
  };

  return (
    <>
      <PageHead title="Settings & Data" subtitle="Capacity parameters, thresholds, backup / restore and data quality." />

      <div className="grid c2">
        <div className="card">
          <h2>Capacity &amp; planning settings</h2>
          <div className="form-grid">
            <Field label="Daily capacity (h)"><input type="number" step="0.5" value={f.dailyHours} onChange={(e) => setF({ ...f, dailyHours: e.target.value })} /></Field>
            <Field label="Weekly capacity (derived)"><input disabled value={`${(Number(f.dailyHours) || 0) * f.workingDays.length} h per technician`} /></Field>
            <div className="full row">Working days:
              {WD_CODES.map((d) => <label key={d} className="row"><input type="checkbox" checked={f.workingDays.includes(d)} onChange={(e) => setF({ ...f, workingDays: e.target.checked ? [...f.workingDays, d] : f.workingDays.filter((x) => x !== d) })} />{d}</label>)}
            </div>
            <Field label="Available below (%)"><input type="number" value={f.available} onChange={(e) => setF({ ...f, available: e.target.value })} /></Field>
            <Field label="Moderate below (%)"><input type="number" value={f.moderate} onChange={(e) => setF({ ...f, moderate: e.target.value })} /></Field>
            <Field label="High up to (%) · above = overloaded"><input type="number" value={f.high} onChange={(e) => setF({ ...f, high: e.target.value })} /></Field>
            <Field label="Dashboard horizon (weeks)"><input type="number" min="1" max="52" value={f.horizonWeeks} onChange={(e) => setF({ ...f, horizonWeeks: e.target.value })} /></Field>
            <Field label="“Upcoming milestone” window (weeks)"><input type="number" min="1" max="26" value={f.nearMilestoneWeeks} onChange={(e) => setF({ ...f, nearMilestoneWeeks: e.target.value })} /></Field>
            <Field label="Reference date" hint={`Empty = today if inside ${model.year}, else W01. Currently ${formatDate(model.refDate)}.`}><input type="date" value={f.referenceDate} onChange={(e) => setF({ ...f, referenceDate: e.target.value })} /></Field>
          </div>
          {errors.map((x) => <Banner key={x} type="err">{x}</Banner>)}
          <div className="row mt"><button className="btn primary" disabled={!!errors.length} onClick={saveSettings}>Save settings</button><span className="muted small">Per-technician capacity override: Organization page.</span></div>
          <Banner type={test.ok ? 'ok' : 'err'}><div>Self-test: {test.allocated} h of {test.capacity} h → remaining <b>{test.remaining} h</b>, utilization <b>{test.utilization} %</b> {test.ok ? '✔' : '✘ FAILED'}</div></Banner>
        </div>

        <div className="card">
          <h2>Absences</h2>
          <p className="muted small">A full-day absence sets that technician's capacity to 0 for the day.</p>
          <div className="form-grid">
            <Field label="Technician"><select value={absence.technicianId} onChange={(e) => setAbsence({ ...absence, technicianId: e.target.value })}><option value="">Select…</option>{model.techs.map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}</select></Field>
            <Field label="Note"><input value={absence.note} onChange={(e) => setAbsence({ ...absence, note: e.target.value })} /></Field>
            <Field label="From"><input type="date" value={absence.from} onChange={(e) => setAbsence({ ...absence, from: e.target.value })} /></Field>
            <Field label="To"><input type="date" value={absence.to} onChange={(e) => setAbsence({ ...absence, to: e.target.value })} /></Field>
          </div>
          <button className="btn mt" onClick={addAbsence}>Add absence</button>
          {s.absences.length > 0 && (
            <table className="t mt"><tbody>
              {s.absences.map((a) => <tr key={a.id}><td>{model.techById[a.technicianId]?.displayName ?? a.technicianId}</td><td>{a.from} → {a.to}</td><td>{a.note}</td><td><button className="btn sm danger" onClick={() => dispatch(A.settingsUpdate({ absences: s.absences.filter((x) => x.id !== a.id) }))}>Remove</button></td></tr>)}
            </tbody></table>
          )}
        </div>
      </div>

      <div className="card mt">
        <h2>Data &amp; backup (browser localStorage is the temporary database)</h2>
        {st.problems.length > 0 && <Banner type="warn">{st.problems.join(' ')}</Banner>}
        <p className="small muted">{ui.savedAt ? `Last saved locally ${new Date(ui.savedAt).toLocaleString()}.` : 'Nothing saved yet in this session.'} Keys: cad.v1.milestones · organization · tasks · assignments · settings · editLog.</p>
        <div className="row">
          <button className="btn" onClick={exportAll}><Download size={14} /> Export all (JSON backup)</button>
          <label className="btn"><Upload size={14} /> Import backup<input type="file" accept="application/json,.json" hidden onChange={importBackup} /></label>
          <button className="btn" onClick={() => { dispatch(A.demoLoad()); notify('Illustrative demo tasks loaded', 'ok'); }}>Load illustrative demo tasks</button>
          <button className="btn" disabled={!demoCount} onClick={() => setDlg('demo')}>Clear demo data ({demoCount})</button>
          <button className="btn danger" onClick={() => setDlg('plan')}>Reset milestone plan to source</button>
          <button className="btn danger" onClick={() => setDlg('org')}>Reset organization to source</button>
          <button className="btn danger" onClick={() => setDlg('all')}>Reset ALL to source data</button>
        </div>
        {importErr && <Banner type="err">{importErr}</Banner>}
        <p className="muted small mt">Demo tasks are illustrative only (origin “demo”, orange badge). Clearing them leaves your real milestones, tasks and organization untouched.</p>
      </div>

      <h2 className="mt">Data quality</h2>
      <DataQualityPanel />

      {dlg === 'demo' && <Confirm title="Clear demo data" confirmLabel="Clear demo data" message={`Remove the ${demoCount} illustrative demo tasks? Real data stays.`} onCancel={() => setDlg(null)} onConfirm={() => { dispatch(A.demoClear()); setDlg(null); notify('Demo data cleared', 'ok'); }} />}
      {dlg === 'plan' && <Confirm title="Reset milestone plan" danger confirmLabel="Reset plan" message="Restores milestones.json: all BU/line/milestone edits are lost (tasks of removed milestones become orphans)." onCancel={() => setDlg(null)} onConfirm={() => { dispatch(A.planReset()); setDlg(null); notify('Plan reset to source', 'ok'); }} />}
      {dlg === 'org' && <Confirm title="Reset organization" danger confirmLabel="Reset organization" message="Restores organization.json: names, added slots and capacity overrides are lost; tasks of removed technicians become unassigned." onCancel={() => setDlg(null)} onConfirm={() => { dispatch(A.orgReset()); setDlg(null); notify('Organization reset to source', 'ok'); }} />}
      {dlg === 'all' && <Confirm title="Reset ALL data" danger confirmLabel="Reset everything" message="Restores both source files and deletes every task, assignment, absence, setting and the edit log. Export a backup first if unsure." onCancel={() => setDlg(null)} onConfirm={() => { dispatch(A.resetAll()); setDlg(null); notify('All data reset to source', 'ok'); }} />}
    </>
  );
}
