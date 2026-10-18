import { ArrowLeft, ListPlus, Pencil } from 'lucide-react';
import { useMemo, useState } from 'react';
import LineForm from '../components/LineForm.jsx';
import MilestoneTaskList from '../components/MilestoneTaskList.jsx';
import TaskForm from '../components/TaskForm.jsx';
import { Banner, EditOnly, Empty, OriginBadge, PageHead } from '../components/ui.jsx';
import { useStore } from '../state/store.jsx';
import { round2 } from '../utils/capacityCalculations.js';
import { formatEop } from '../utils/eop.js';
import { milestoneColors, PLANTS } from '../utils/milestoneStyle.js';
import { lineWarnings } from '../utils/planValidation.js';
import { isOverdue } from '../utils/scheduling.js';
import { formatDate, weekLabel, weekSpanText } from '../utils/weekCalendar.js';
import { lineMatchesPlant, linePlantLabel } from '../utils/workloadAggregation.js';
import { milestoneStatusText } from './MilestoneTaskDesigner.jsx';

function MiniTimeline({ line, types, refWeek }) {
  const cw = 16;
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ position: 'relative', width: 52 * cw, height: 30, backgroundImage: 'repeating-linear-gradient(to right, transparent 0, transparent 15px, #e6eaf0 15px, #e6eaf0 16px)', border: '1px solid var(--line)' }}>
        <div style={{ position: 'absolute', left: (refWeek - 1) * cw, width: cw, top: 0, bottom: 0, background: '#c8102e22' }} />
        {line.milestones.map((m) => {
          const c = milestoneColors(m, types);
          return <div key={m.id} title={`${m.label} ${weekSpanText(m.startWeek, m.endWeek)}`} style={{ position: 'absolute', left: (m.startWeek - 1) * cw, width: (m.endWeek - m.startWeek + 1) * cw - 1, top: 5, height: 20, background: c.bg, color: c.fg, fontSize: 9, overflow: 'hidden', whiteSpace: 'nowrap', borderRadius: 2, padding: '0 2px', lineHeight: '20px' }}>{m.label}</div>;
        })}
      </div>
      <div style={{ display: 'flex', width: 52 * cw, fontSize: 9, color: 'var(--muted)' }}>
        {Array.from({ length: 52 }, (_, i) => <span key={i} style={{ width: cw, textAlign: 'center' }}>{(i + 1) % 4 === 1 ? i + 1 : ''}</span>)}
      </div>
    </div>
  );
}

function LineDetail({ line, back }) {
  const { model, data } = useStore();
  const [addFor, setAddFor] = useState(null);
  const [editing, setEditing] = useState(false);
  const types = data.milestones.meta.milestoneTypes;
  const eff = model.effortByLine[line.id];
  const tasks = line.milestones.flatMap((m) => model.tasksByMs[m.id] ?? []);
  const byTech = {};
  for (const t of tasks) if (t.technicianId) byTech[t.technicianId] = (byTech[t.technicianId] ?? 0) + t.estimatedMinutes / 60;
  const upcoming = line.milestones.filter((m) => m.endWeek >= model.refWeek).sort((a, b) => a.startWeek - b.startWeek).slice(0, 3);
  const warnings = lineWarnings(line, model.year);
  const overloaded = Object.keys(byTech).filter((id) => model.conflicts.some((c) => c.techId === id));
  const overdue = tasks.filter((t) => isOverdue(t, model.refDate));
  const unassigned = tasks.filter((t) => !t.technicianId && t.status !== 'COMPLETED');

  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <button className="btn sm" onClick={back}><ArrowLeft size={14} /> All projects</button>
        <EditOnly><button className="btn sm" onClick={() => setEditing(true)}><Pencil size={13} /> Edit line</button></EditOnly>
        <a href="#/planner" className="small">Open in Milestone Planner</a>
      </div>
      <div className="card">
        <h2>{line.project} <OriginBadge origin={line.origin} /></h2>
        <div className="stat-line">
          <span>BU <b>{line.bu}</b></span><span>Plant <b>{linePlantLabel(line)}</b></span>
          <span>EOP <b>{formatEop(line.eop)}</b> <span className="muted">({line.eop?.status})</span></span>
          {line.sourceRow && <span className="muted">Source row {line.sourceRow}</span>}
        </div>
        {line.eop?.note && <p className="muted small mt">{line.eop.note}</p>}
        <div className="mt"><MiniTimeline line={line} types={types} refWeek={model.refWeek} /></div>
      </div>

      <div className="grid kpis mt">
        <div className="kpi"><div className="label">Milestones</div><div className="value">{line.milestones.length}</div></div>
        <div className="kpi"><div className="label">Planned effort</div><div className="value">{round2((eff?.minutes ?? 0) / 60)} h</div><div className="sub">{eff?.count ?? 0} tasks</div></div>
        <div className={`kpi${(eff?.unassignedMinutes ?? 0) > 0 ? ' warn' : ''}`}><div className="label">Unassigned effort</div><div className="value">{round2((eff?.unassignedMinutes ?? 0) / 60)} h</div></div>
        <div className="kpi ok"><div className="label">Completion</div><div className="value">{eff?.minutes ? Math.round((eff.completedMinutes / eff.minutes) * 100) : 0} %</div><div className="sub">{eff?.completed ?? 0}/{eff?.count ?? 0} tasks done</div></div>
      </div>

      <div className="grid c2 mt">
        <div className="card">
          <h2>Upcoming deadlines</h2>
          {upcoming.length ? upcoming.map((m) => <div key={m.id}><b>{m.label}</b> · {weekSpanText(m.startWeek, m.endWeek)} · {formatDate(m.endDate)} <span className="muted">({milestoneStatusText(m, model.refWeek)})</span></div>) : <span className="muted">No upcoming milestone in {model.year}.</span>}
          <h2 className="mt">Assigned technicians</h2>
          {Object.keys(byTech).length ? Object.entries(byTech).map(([id, h]) => <span className="chip" key={id}>{model.techById[id]?.displayName ?? id}: {round2(h)} h</span>) : <span className="muted">No technician assigned.</span>}
        </div>
        <div className="card">
          <h2>Conflicts &amp; checks</h2>
          {!warnings.length && !overloaded.length && !overdue.length && !unassigned.length && <span className="muted">No conflict detected.</span>}
          {warnings.map((w) => <div key={w.text} className="small">⚠ {w.text}</div>)}
          {overloaded.map((id) => <div key={id} className="small">⚠ {model.techById[id]?.displayName} has weeks over capacity (see Technician Availability).</div>)}
          {overdue.length > 0 && <div className="small">⚠ {overdue.length} overdue task(s).</div>}
          {unassigned.length > 0 && <div className="small">⚠ {unassigned.length} unassigned task(s).</div>}
        </div>
      </div>

      <div className="card mt">
        <h2>Milestones and tasks</h2>
        {line.milestones.length === 0 && <Empty>No milestone on this line in the plan (data may be required).</Empty>}
        {line.milestones.map((m) => {
          const e = model.effortByMs[m.id];
          const c = milestoneColors(m, types);
          return (
            <div key={m.id} style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
              <div className="row between">
                <div>
                  <span className="badge" style={{ background: c.bg, color: c.fg }}>{m.type}</span> <b>{m.label}</b> · {weekSpanText(m.startWeek, m.endWeek)} · {formatDate(m.startDate)}
                  <span className="muted small"> · {round2((e?.minutes ?? 0) / 60)} h planned, {round2((e?.unassignedMinutes ?? 0) / 60)} h unassigned</span>
                </div>
                <EditOnly><button className="btn sm" onClick={() => setAddFor(m)}><ListPlus size={13} /> Add task</button></EditOnly>
              </div>
              {(model.tasksByMs[m.id]?.length ?? 0) > 0 && <div className="mt"><MilestoneTaskList tasks={model.tasksByMs[m.id]} milestone={m} /></div>}
            </div>
          );
        })}
      </div>
      {addFor && <TaskForm milestone={addFor} onClose={() => setAddFor(null)} />}
      {editing && <LineForm line={line} onClose={() => setEditing(false)} />}
    </>
  );
}

export default function ProjectsMilestones({ params, navigate }) {
  const { model, data } = useStore();
  const [f, setF] = useState({ bu: '', plant: '', eopYear: '', period: '', q: '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const line = params.line ? model.lineById[params.line] : null;
  const periods = data.milestones.meta.periods;
  const years = useMemo(() => [...new Set(model.lines.map((l) => l.eop?.year).filter(Boolean))].sort(), [model.lines]);

  const rows = model.lines.filter((l) => {
    if (f.bu && l.bu !== f.bu) return false;
    if (f.plant && !lineMatchesPlant(l, f.plant)) return false;
    if (f.eopYear && String(l.eop?.year) !== f.eopYear) return false;
    const p = periods.find((x) => x.id === f.period);
    if (p && !l.milestones.some((m) => m.endWeek >= p.startWeek && m.startWeek <= p.endWeek)) return false;
    if (f.q && !`${l.project} ${l.bu}`.toLowerCase().includes(f.q.toLowerCase())) return false;
    return true;
  });

  if (line) return <LineDetail line={line} back={() => navigate('projects')} />;
  return (
    <>
      <PageHead title="Projects & Milestones" subtitle={`${rows.length} of ${model.lines.length} project lines. Milestones come from the Milestone Planner (single source of truth).`} />
      <div className="toolbar">
        <select value={f.bu} onChange={set('bu')}><option value="">All BUs</option>{data.milestones.businessUnits.map((b) => <option key={b.id}>{b.name}</option>)}</select>
        <select value={f.plant} onChange={set('plant')}><option value="">All plants</option>{PLANTS.map((p) => <option key={p}>{p}</option>)}</select>
        <select value={f.eopYear} onChange={set('eopYear')}><option value="">Any EOP year</option>{years.map((y) => <option key={y}>{y}</option>)}</select>
        <select value={f.period} onChange={set('period')}><option value="">All periods</option>{periods.map((p) => <option key={p.id} value={p.id}>{p.id}</option>)}</select>
        <input type="search" placeholder="Search…" value={f.q} onChange={set('q')} />
      </div>
      <div className="card flush table-wrap" style={{ maxHeight: 'calc(100vh - 230px)' }}>
        <table className="t">
          <thead><tr><th>BU</th><th>Project</th><th>Plant</th><th>EOP</th><th className="num">Milestones</th><th>Next milestone</th><th className="num">Tasks</th><th className="num">Effort (h)</th><th className="num">Unassigned (h)</th><th>Flags</th></tr></thead>
          <tbody>
            {rows.map((l) => {
              const e = model.effortByLine[l.id];
              const next = l.milestones.filter((m) => m.endWeek >= model.refWeek).sort((a, b) => a.startWeek - b.startWeek)[0];
              const w = lineWarnings(l, model.year).length;
              return (
                <tr key={l.id} className="clickable" onClick={() => navigate('projects', { line: l.id })}>
                  <td>{l.bu}</td>
                  <td><b>{l.project}</b> <OriginBadge origin={l.origin} /></td>
                  <td>{l.plant ?? <span className="muted">TBC</span>}</td>
                  <td className={l.eop?.year ? '' : 'muted'}>{formatEop(l.eop)}</td>
                  <td className="num">{l.milestones.length}</td>
                  <td>{next ? `${next.label} (${weekLabel(next.startWeek)})` : <span className="muted">—</span>}</td>
                  <td className="num">{e?.count ?? 0}</td>
                  <td className="num">{round2((e?.minutes ?? 0) / 60)}</td>
                  <td className="num">{round2((e?.unassignedMinutes ?? 0) / 60)}</td>
                  <td>{w > 0 && <span className="badge warn">⚠ {w}</span>} {!l.milestones.length && l.eop?.year && <span className="badge">no milestone</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <Banner type="info">No project line matches.</Banner>}
      </div>
    </>
  );
}
