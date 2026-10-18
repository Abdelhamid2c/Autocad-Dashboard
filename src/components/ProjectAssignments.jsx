import { useMemo, useState } from 'react';
import { useStore } from '../state/store.jsx';
import { fmtPct, round2 } from '../utils/capacityCalculations.js';
import { PLANTS } from '../utils/milestoneStyle.js';
import { isCompleted, taskWindow } from '../utils/scheduling.js';
import { weekLabel, weekOfDate } from '../utils/weekCalendar.js';
import { techRange } from '../utils/workloadAggregation.js';
import { Empty, LoadBadge, Tabs, TaskStatusBadge } from './ui.jsx';

/** Both views are derived from Task.technicianId — no duplicated assignment data. */
export default function ProjectAssignments() {
  const { model } = useStore();
  const [view, setView] = useState('project');
  const [f, setF] = useState({ line: '', plant: '', tech: '', ms: '', w0: 1, w1: 52 });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const filtered = useMemo(() => model.tasks.filter((t) => {
    const ms = t.milestoneId ? model.msById[t.milestoneId] : null;
    if (f.line && ms?.lineId !== f.line) return false;
    if (f.plant && t.plant !== f.plant) return false;
    if (f.tech && t.technicianId !== f.tech) return false;
    if (f.ms && !(ms?.label ?? '').toLowerCase().includes(f.ms.toLowerCase())) return false;
    const w = taskWindow(t);
    if (w) {
      const a = weekOfDate(w.start, model.year) ?? (w.start < '2027' ? 1 : 52);
      const b = weekOfDate(w.end, model.year) ?? (w.end < '2027' ? 1 : 52);
      if (b < f.w0 || a > f.w1) return false;
    }
    return true;
  }), [model, f]);

  const byLine = useMemo(() => {
    const map = new Map();
    for (const t of filtered) {
      const ms = t.milestoneId ? model.msById[t.milestoneId] : null;
      const key = ms?.lineId ?? 'orphan';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    return [...map.entries()];
  }, [filtered, model]);

  const techRows = model.activeTechs
    .filter((t) => (!f.tech || t.id === f.tech) && (!f.plant || t.plantId === f.plant))
    .map((tech) => {
      const mine = filtered.filter((t) => t.technicianId === tech.id && !isCompleted(t));
      const lines = new Set(mine.map((t) => t.lineId).filter(Boolean));
      return { tech, r: techRange(model, tech.id, f.w0, f.w1), projects: [...lines].map((id) => model.lineById[id]?.project).filter(Boolean), tasks: mine.length };
    });

  return (
    <>
      <div className="toolbar">
        <Tabs tabs={[{ id: 'project', label: 'Project-centric' }, { id: 'tech', label: 'Technician-centric' }]} value={view} onChange={setView} />
      </div>
      <div className="toolbar">
        <select value={f.line} onChange={set('line')}><option value="">All projects</option>{model.lines.filter((l) => l.milestones.length).map((l) => <option key={l.id} value={l.id}>{l.bu} · {l.project} (r{l.sourceRow ?? 'new'})</option>)}</select>
        <select value={f.plant} onChange={set('plant')}><option value="">All plants</option>{PLANTS.map((p) => <option key={p}>{p}</option>)}</select>
        <select value={f.tech} onChange={set('tech')}><option value="">All technicians</option>{model.activeTechs.map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}</select>
        <input type="search" placeholder="Milestone…" value={f.ms} onChange={set('ms')} />
        <label className="row">Weeks <input type="number" min="1" max="52" style={{ width: 58 }} value={f.w0} onChange={(e) => setF((x) => ({ ...x, w0: Math.max(1, Number(e.target.value) || 1) }))} /> – <input type="number" min="1" max="52" style={{ width: 58 }} value={f.w1} onChange={(e) => setF((x) => ({ ...x, w1: Math.min(52, Number(e.target.value) || 52) }))} /></label>
      </div>

      {view === 'project' ? (
        byLine.length === 0 ? <Empty>No task matches. Tasks are created in the Milestone Task Designer (or load demo tasks in Settings &amp; Data).</Empty> : byLine.map(([key, tasks]) => {
          const line = model.lineById[key];
          const unassigned = tasks.filter((t) => !t.technicianId && !isCompleted(t));
          const overloadedTechs = [...new Set(tasks.map((t) => t.technicianId).filter(Boolean))].filter((id) => model.conflicts.some((c) => c.techId === id && c.week >= f.w0 && c.week <= f.w1));
          const insufficient = unassigned.length > 0 || overloadedTechs.length > 0;
          return (
            <div className="card mt" key={key} style={insufficient ? { borderLeft: '3px solid var(--bad)' } : undefined}>
              <div className="card-head">
                <h2 style={{ margin: 0 }}>{line ? `${line.bu} · ${line.project}` : 'Orphan tasks (milestone deleted)'}</h2>
                <span className="small">
                  {round2(tasks.reduce((s, t) => s + t.estimatedMinutes / 60, 0))} h total
                  {insufficient && <span className="badge bad" style={{ marginLeft: 6 }}>Insufficient resources: {unassigned.length} unassigned{overloadedTechs.length ? `, ${overloadedTechs.length} overloaded tech(s)` : ''}</span>}
                </span>
              </div>
              <table className="t">
                <thead><tr><th>Project</th><th>Plant</th><th>Milestone</th><th>Task</th><th>Technician</th><th className="num">Hours</th><th>Status</th></tr></thead>
                <tbody>
                  {tasks.map((t) => {
                    const ms = t.milestoneId ? model.msById[t.milestoneId] : null;
                    const tech = t.technicianId ? model.techById[t.technicianId] : null;
                    return (
                      <tr key={t.id}>
                        <td>{line?.project ?? t.orphanInfo?.project ?? '—'}</td><td>{t.plant ?? 'TBC'}</td>
                        <td>{ms ? `${ms.label} (${weekLabel(ms.startWeek)})` : <span className="badge warn">orphan</span>}</td>
                        <td>{t.name}</td>
                        <td>{tech ? <>{tech.displayName} <span className="muted small">({tech.plantId})</span></> : <span className="badge bad">Unassigned</span>}</td>
                        <td className="num">{round2(t.estimatedMinutes / 60)}</td><td><TaskStatusBadge status={t.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })
      ) : (
        <div className="card flush table-wrap">
          <table className="t">
            <thead><tr><th>Technician</th><th>Home plant</th><th>Projects</th><th className="num">Open tasks</th><th className="num">Hours (period)</th><th className="num">Available (h)</th><th>Utilization</th></tr></thead>
            <tbody>
              {techRows.map(({ tech, r, projects, tasks }) => (
                <tr key={tech.id}>
                  <td><b>{tech.displayName}</b></td><td>{tech.plantId}</td>
                  <td>{projects.length ? projects.map((p) => <span className="chip" key={p}>{p}</span>) : <span className="muted">—</span>}</td>
                  <td className="num">{tasks}</td><td className="num">{round2(r.allocated)}</td><td className="num">{round2(r.remaining)}</td>
                  <td><LoadBadge status={r.status} pct={r.util} /> <span className="muted small">peak {fmtPct(r.peakUtil)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
