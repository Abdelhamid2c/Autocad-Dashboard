import { Download, History, Plus, Redo2, RotateCcw, Undo2, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import MilestoneGrid from '../components/MilestoneGrid.jsx';
import BUForm from '../components/BUForm.jsx';
import { EditLogPanel, PlanImportDialog } from '../components/PlanDialogs.jsx';
import { Confirm, EditOnly, PageHead } from '../components/ui.jsx';
import { A } from '../state/actions.js';
import { useStore } from '../state/store.jsx';
import { downloadFile } from '../utils/csv.js';
import { MILESTONE_TYPES, PLANTS, typeMeta } from '../utils/milestoneStyle.js';
import { exportPlanCSV, exportPlanJSON } from '../utils/planIO.js';

export default function MilestonePlanner() {
  const { data, model, dispatch, notify, canUndo, canRedo, undoDesc, redoDesc, presentation } = useStore();
  const plan = data.milestones;
  const [filters, setFilters] = useState({ bu: '', plant: '', type: '', period: '', q: '', onlyWithMs: false });
  const [zoom, setZoom] = useState('week');
  const [dlg, setDlg] = useState(null);
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  useEffect(() => {
    const on = (e) => {
      if (/input|textarea|select/i.test(e.target.tagName) || presentation) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); dispatch(e.shiftKey ? A.redo() : A.undo()); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); dispatch(A.redo()); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [dispatch, presentation]);

  const total = model.milestoneList.length;
  return (
    <>
      <PageHead title="Milestone Planner — PPC CAD Milestone" subtitle={`${plan.projectLines.length} project lines · ${total} milestones · ${plan.businessUnits.length} BUs. Click an empty week to add, double-click for a quick add, drag a bar to move, drag its edges to resize.`}>
        <EditOnly>
          <button className="btn sm" disabled={!canUndo} onClick={() => dispatch(A.undo())} title={undoDesc ? `Undo: ${undoDesc}` : 'Nothing to undo'}><Undo2 size={14} /> Undo</button>
          <button className="btn sm" disabled={!canRedo} onClick={() => dispatch(A.redo())} title={redoDesc ? `Redo: ${redoDesc}` : 'Nothing to redo'}><Redo2 size={14} /> Redo</button>
          <button className="btn sm" onClick={() => setDlg('log')}><History size={14} /> Edit log</button>
          <button className="btn sm primary" onClick={() => setDlg('bu')}><Plus size={14} /> Add BU</button>
        </EditOnly>
      </PageHead>

      <div className="toolbar">
        <select value={filters.bu} onChange={set('bu')} aria-label="BU"><option value="">All BUs</option>{plan.businessUnits.map((b) => <option key={b.id}>{b.name}</option>)}</select>
        <select value={filters.plant} onChange={set('plant')} aria-label="Plant"><option value="">All plants</option>{PLANTS.map((p) => <option key={p}>{p}</option>)}</select>
        <select value={filters.type} onChange={set('type')} aria-label="Type"><option value="">All types</option>{MILESTONE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        <select value={filters.period} onChange={set('period')} aria-label="Period"><option value="">All periods</option>{plan.meta.periods.map((p) => <option key={p.id} value={p.id}>{p.id} (W{p.startWeek}–W{p.endWeek})</option>)}</select>
        <input type="search" placeholder="Search project / milestone…" value={filters.q} onChange={set('q')} />
        <label className="row"><input type="checkbox" checked={filters.onlyWithMs} onChange={set('onlyWithMs')} /> Only lines with milestones</label>
        <span className="grow" />
        <div className="row" role="group" aria-label="Zoom">
          <button className={`btn sm${zoom === 'week' ? ' primary' : ''}`} onClick={() => setZoom('week')}>Week</button>
          <button className={`btn sm${zoom === 'month' ? ' primary' : ''}`} onClick={() => setZoom('month')}>Month</button>
        </div>
        <button className="btn sm" onClick={() => downloadFile('milestones-plan.json', exportPlanJSON(plan), 'application/json')}><Download size={14} /> JSON</button>
        <button className="btn sm" onClick={() => downloadFile('milestones-plan.csv', exportPlanCSV(plan), 'text/csv')}><Download size={14} /> CSV</button>
        <EditOnly>
          <button className="btn sm" onClick={() => setDlg('import')}><Upload size={14} /> Import</button>
          <button className="btn sm danger" onClick={() => setDlg('reset')}><RotateCcw size={14} /> Reset to source</button>
        </EditOnly>
      </div>

      <MilestoneGrid filters={filters} zoom={zoom} />

      <div className="legend mt">
        {plan.meta.milestoneTypes.map((t) => (
          <span key={t.type}><i style={{ background: t.color }} />{t.type}{t.altColor ? ' (SOP also navy)' : ''}</span>
        ))}
        <span><i style={{ background: '#fde3e6' }} />Reference week (W{String(model.refWeek).padStart(2, '0')})</span>
        <span>⚠ = overlap or EOP inconsistency · Calendar assumption: ISO weeks, W01 = Mon 2027-01-04</span>
      </div>

      {dlg === 'bu' && <BUForm onClose={() => setDlg(null)} />}
      {dlg === 'log' && <EditLogPanel onClose={() => setDlg(null)} />}
      {dlg === 'import' && <PlanImportDialog onClose={() => setDlg(null)} />}
      {dlg === 'reset' && (
        <Confirm
          title="Reset plan to source data"
          danger
          confirmLabel="Reset plan"
          message="This restores the plan from milestones.json and discards every BU, line and milestone you added or edited. Tasks whose milestone no longer exists become orphans. You can still use Undo."
          onCancel={() => setDlg(null)}
          onConfirm={() => { dispatch(A.planReset()); setDlg(null); notify('Plan reset to source data', 'ok'); }}
        />
      )}
    </>
  );
}
