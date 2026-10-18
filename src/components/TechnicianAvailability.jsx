import { useMemo, useState } from 'react';
import { useStore } from '../state/store.jsx';
import { capacityOn, fmtPct, isAbsent, LOAD_STATUS, loadStatus, round2, utilizationPct } from '../utils/capacityCalculations.js';
import { PLANTS } from '../utils/milestoneStyle.js';
import { isCompleted, taskWindow } from '../utils/scheduling.js';
import { addDays, dateRange, formatDate, formatShort, MONTH_NAMES, weekLabel, weekStart } from '../utils/weekCalendar.js';
import { techDayConflicts, techProjects, techRange, techWeek } from '../utils/workloadAggregation.js';
import { Empty, LoadBadge, TaskStatusBadge, UtilBar } from './ui.jsx';

export default function TechnicianAvailability() {
  const { model, data } = useStore();
  const [view, setView] = useState('weekly');
  const [week, setWeek] = useState(model.refWeek);
  const [plant, setPlant] = useState('');
  const [selId, setSelId] = useState('');

  const [w0, w1] = view === 'daily' ? [week, week] : view === 'weekly' ? [week, Math.min(52, week + 11)] : [1, 52];
  const rows = useMemo(() => model.activeTechs.filter((t) => !plant || t.plantId === plant).map((t) => {
    const r = techRange(model, t.id, w0, w1);
    const open = (model.tasksByTech[t.id] ?? []).filter((x) => !isCompleted(x));
    const current = open.find((x) => { const w = taskWindow(x); return w && w.start <= model.refDate && w.end >= model.refDate; });
    const upcoming = open.filter((x) => { const w = taskWindow(x); return w && w.start > model.refDate; }).sort((a, b) => taskWindow(a).start.localeCompare(taskWindow(b).start))[0];
    return { tech: t, ...r, projects: techProjects(model, t.id).length, openTasks: open.length, current, upcoming };
  }), [model, plant, w0, w1]);

  const sel = model.techById[selId] ?? null;
  const periodText = view === 'daily' ? weekLabel(week) : view === 'weekly' ? `${weekLabel(w0)}–${weekLabel(w1)}` : `W01–W52`;

  return (
    <>
      <div className="toolbar">
        <div className="row" role="group">
          {['daily', 'weekly', 'monthly'].map((v) => <button key={v} className={`btn sm${view === v ? ' primary' : ''}`} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}
        </div>
        {view !== 'monthly' && (
          <label className="row">From week <input type="number" min="1" max="52" value={week} style={{ width: 64 }} onChange={(e) => setWeek(Math.min(52, Math.max(1, Number(e.target.value) || 1)))} /></label>
        )}
        <select value={plant} onChange={(e) => setPlant(e.target.value)}><option value="">All plants</option>{PLANTS.map((p) => <option key={p}>{p}</option>)}</select>
        <span className="muted small">Period: {periodText} · thresholds: &lt;{model.thresholds.available} % available · &lt;{model.thresholds.moderate} % moderate · ≤{model.thresholds.high} % high · &gt;{model.thresholds.high} % overloaded</span>
      </div>

      <div className="card flush table-wrap">
        <table className="t">
          <thead><tr><th>Technician</th><th>Plant</th><th className="num">Capacity</th><th className="num">Planned</th><th className="num">Remaining</th><th>Utilization</th><th className="num">Peak week</th><th className="num">Projects</th><th className="num">Open tasks</th><th>Current task</th><th>Next assignment</th></tr></thead>
          <tbody>
            {rows.map(({ tech, capacity, allocated, remaining, util, status, peakUtil, projects, openTasks, current, upcoming }) => (
              <tr key={tech.id} className={`clickable${tech.id === selId ? ' sel' : ''}`} onClick={() => setSelId(tech.id)}>
                <td><b>{tech.displayName}</b></td>
                <td>{tech.plantId}</td>
                <td className="num">{round2(capacity)} h</td>
                <td className="num">{round2(allocated)} h</td>
                <td className="num">{round2(remaining)} h</td>
                <td style={{ minWidth: 190 }}><LoadBadge status={status} pct={util} /><UtilBar pct={util} status={status} height={5} /></td>
                <td className="num" style={{ color: LOAD_STATUS[loadStatus(peakUtil, model.thresholds)].color }}>{fmtPct(peakUtil)}</td>
                <td className="num">{projects}</td>
                <td className="num">{openTasks}</td>
                <td>{current ? current.name : <span className="muted">—</span>}</td>
                <td>{upcoming ? `${upcoming.name} (${formatShort(upcoming.startDate)})` : <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty>No confirmed technician for this filter.</Empty>}
      </div>
      {model.techs.some((t) => !t.confirmed) && <p className="muted small mt">Technician positions marked TBC (e.g. SATELLITES) are excluded until confirmed in Organization.</p>}

      {sel && <Detail tech={sel} view={view} week={week} months={data.milestones.meta.months} />}
    </>
  );
}

function Detail({ tech, view, week, months }) {
  const { model } = useStore();
  const tasks = model.tasksByTech[tech.id] ?? [];
  const projects = techProjects(model, tech.id);
  const conflicts = techDayConflicts(model, tech.id);
  const s = model.settings;

  let breakdown;
  if (view === 'daily') {
    const ws = weekStart(week, model.year);
    breakdown = dateRange(ws, addDays(ws, 6)).map((d) => {
      const cap = capacityOn(tech, d, s);
      const al = model.load.techDay[tech.id]?.[d] ?? 0;
      const u = utilizationPct(al, cap);
      return { key: d, label: formatDate(d), cap, al, util: u, note: cap === 0 ? (isAbsent(tech.id, d, s) ? 'Absent' : 'Non-working day') : '' };
    });
  } else if (view === 'weekly') {
    breakdown = Array.from({ length: Math.min(12, 53 - week) }, (_, i) => {
      const w = week + i;
      const x = techWeek(model, tech.id, w);
      return { key: w, label: `${weekLabel(w)} · ${formatShort(weekStart(w, model.year))}`, cap: x.capacity, al: x.allocated, util: x.util };
    });
  } else {
    breakdown = months.map((m) => {
      let cap = 0;
      let al = 0;
      for (let w = m.startWeek; w <= m.endWeek; w++) {
        const x = techWeek(model, tech.id, w);
        cap += x.capacity;
        al += x.allocated;
      }
      return { key: m.month, label: `${MONTH_NAMES[m.month - 1]} (${weekLabel(m.startWeek)}–${weekLabel(m.endWeek)})`, cap, al, util: utilizationPct(al, cap) };
    });
  }

  return (
    <div className="grid c2 mt">
      <div className="card">
        <h2>{tech.displayName} — {tech.plantId} <span className="muted small">({view} availability)</span></h2>
        <table className="t">
          <thead><tr><th>Period</th><th className="num">Capacity</th><th className="num">Allocated</th><th className="num">Remaining</th><th>Utilization</th></tr></thead>
          <tbody>
            {breakdown.map((r) => {
              const st = loadStatus(r.util, model.thresholds);
              return (
                <tr key={r.key} style={r.cap === 0 ? { background: '#f0f2f6', color: 'var(--muted)' } : undefined}>
                  <td>{r.label} {r.note && <span className="badge">{r.note}</span>}</td>
                  <td className="num">{round2(r.cap)} h</td><td className="num">{round2(r.al)} h</td><td className="num">{round2(r.cap - r.al)} h</td>
                  <td style={{ minWidth: 150 }}>{r.cap > 0 || r.al > 0 ? <><span style={{ color: LOAD_STATUS[st].color, fontWeight: 600 }}>{fmtPct(r.util)}</span><UtilBar pct={r.util} status={st} height={5} /></> : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="col">
        <div className="card">
          <h2>Projects &amp; tasks</h2>
          <p className="small">Projects: {projects.length ? projects.map((p) => <span className="chip" key={p.id}>{p.project}</span>) : <span className="muted">none</span>}</p>
          {tasks.length === 0 ? <span className="muted">No task assigned.</span> : (
            <div className="table-wrap" style={{ maxHeight: 260 }}>
              <table className="t"><tbody>
                {tasks.map((t) => {
                  const w = taskWindow(t);
                  const ms = t.milestoneId ? model.msById[t.milestoneId] : null;
                  return <tr key={t.id}><td><b>{t.name}</b><div className="muted small">{ms ? `${ms.project} · ${ms.label}` : 'orphan'}</div></td><td className="num">{round2(t.estimatedMinutes / 60)} h</td><td className="small">{w ? `${formatShort(w.start)} → ${formatShort(w.end)}` : 'unscheduled'}</td><td><TaskStatusBadge status={t.status} /></td></tr>;
                })}
              </tbody></table>
            </div>
          )}
        </div>
        <div className="card">
          <h2>Overlaps &amp; conflicts</h2>
          {conflicts.length === 0 ? <span className="muted">No day exceeds the daily capacity.</span> : (
            <>
              <p className="small" style={{ color: 'var(--bad)' }}>{conflicts.length} day(s) over capacity.</p>
              <div className="table-wrap" style={{ maxHeight: 180 }}>
                <table className="t"><tbody>
                  {conflicts.slice(0, 40).map((c) => <tr key={c.date}><td>{formatDate(c.date)}</td><td className="num">{round2(c.hours)} h / {round2(c.cap)} h</td></tr>)}
                </tbody></table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
