import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Banner, PageHead, Tabs } from '../components/ui.jsx';
import { ChartCard, PeaksChart } from '../components/WorkloadCharts.jsx';
import { useStore } from '../state/store.jsx';
import { fmtPct, round2 } from '../utils/capacityCalculations.js';
import { downloadFile, toCSV } from '../utils/csv.js';
import { PLANTS } from '../utils/milestoneStyle.js';
import { isCompleted, isOverdue, taskWindow } from '../utils/scheduling.js';
import { weekLabel, weekOfDate } from '../utils/weekCalendar.js';
import { liveQualityChecks, techRange } from '../utils/workloadAggregation.js';

function ReportTable({ title, headers, rows, filename, note }) {
  const exportCsv = () => downloadFile(`${filename}.csv`, toCSV(headers, rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]])))), 'text/csv');
  return (
    <div className="card mt">
      <div className="card-head"><h2 style={{ margin: 0 }}>{title}</h2><button className="btn sm" onClick={exportCsv}><Download size={13} /> CSV</button></div>
      {note && <p className="muted small">{note}</p>}
      <div className="table-wrap" style={{ maxHeight: 420 }}>
        <table className="t">
          <thead><tr>{headers.map((h, i) => <th key={h} className={i > 0 && typeof rows[0]?.[i] === 'number' ? 'num' : ''}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={typeof c === 'number' ? 'num' : ''}>{c}</td>)}</tr>)}</tbody>
        </table>
        {!rows.length && <p className="muted" style={{ padding: 10 }}>No data for this filter.</p>}
      </div>
    </div>
  );
}

function group(tasks, keyOf, labelOf) {
  const map = new Map();
  for (const t of tasks) {
    const k = keyOf(t);
    if (!map.has(k)) map.set(k, { label: labelOf(t), n: 0, planned: 0, actual: 0, remaining: 0 });
    const g = map.get(k);
    const est = t.estimatedMinutes / 60;
    const act = (t.actualMinutes || 0) / 60;
    g.n += 1;
    g.planned += est;
    g.actual += act;
    g.remaining += isCompleted(t) ? 0 : Math.max(0, est - act);
  }
  return [...map.values()].sort((a, b) => b.planned - a.planned).map((g) => [g.label, g.n, round2(g.planned), round2(g.actual), round2(g.remaining)]);
}

export default function Reports() {
  const { model } = useStore();
  const [tab, setTab] = useState('workload');
  const [w0, setW0] = useState(1);
  const [w1, setW1] = useState(52);
  const [plant, setPlant] = useState('');

  const tasks = useMemo(() => model.tasks.filter((t) => {
    if (plant && t.plant !== plant) return false;
    const w = taskWindow(t);
    if (!w) return true;
    const a = weekOfDate(w.start, model.year) ?? (w.start < `${model.year}` ? 1 : 52);
    const b = weekOfDate(w.end, model.year) ?? (w.end < `${model.year}` ? 1 : 52);
    return b >= w0 && a <= w1;
  }), [model, plant, w0, w1]);

  const hdr = ['Group', 'Tasks', 'Planned h', 'Actual h (logged)', 'Remaining est. h'];
  const techs = model.activeTechs.filter((t) => !plant || t.plantId === plant);
  const unassigned = tasks.filter((t) => !t.technicianId && !isCompleted(t));
  const upcoming = model.milestoneList.filter((m) => m.endWeek >= model.refWeek && m.startWeek <= model.refWeek + 11 && (!plant || m.plant === plant || (!m.plant && String(m.plantGroup).includes(plant))));
  const conflicts = model.conflicts.filter((c) => c.week >= w0 && c.week <= w1 && (!plant || model.techById[c.techId].plantId === plant));

  return (
    <>
      <PageHead title="Reports & Analytics" subtitle="Planned = estimated hours · Actual = hours logged on tasks · Remaining = estimate − actual for tasks not completed." />
      <div className="toolbar">
        <label className="row">Weeks <input type="number" min="1" max="52" style={{ width: 58 }} value={w0} onChange={(e) => setW0(Math.min(w1, Math.max(1, Number(e.target.value) || 1)))} /> – <input type="number" min="1" max="52" style={{ width: 58 }} value={w1} onChange={(e) => setW1(Math.max(w0, Math.min(52, Number(e.target.value) || 52)))} /></label>
        <select value={plant} onChange={(e) => setPlant(e.target.value)}><option value="">All plants</option>{PLANTS.map((p) => <option key={p}>{p}</option>)}</select>
        <span className="muted small">{tasks.length} tasks in scope · unscheduled tasks are always included</span>
      </div>
      {model.tasks.length === 0 && <Banner type="info">No task exists yet, so task-based reports are empty. Capacity, forecast and data-quality sections remain available.</Banner>}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'workload', label: 'Workload' }, { id: 'completion', label: 'Milestone completion' }, { id: 'utilization', label: 'Utilization' },
          { id: 'capacity', label: 'Capacity vs demand' }, { id: 'forecast', label: 'Forecast' }, { id: 'unassigned', label: 'Unassigned' }, { id: 'issues', label: 'Conflicts & missing data' },
        ]}
      />

      {tab === 'workload' && (
        <>
          <ReportTable title="Workload by plant" headers={['Plant', ...hdr.slice(1)]} filename="workload-by-plant" rows={group(tasks, (t) => t.plant ?? 'TBC', (t) => t.plant ?? 'TBC')} />
          <ReportTable title="Workload by technician" headers={['Technician', ...hdr.slice(1)]} filename="workload-by-technician" rows={group(tasks, (t) => t.technicianId ?? 'none', (t) => (t.technicianId ? model.techById[t.technicianId]?.displayName ?? t.technicianId : 'Unassigned'))} />
          <ReportTable title="Workload by project" headers={['Project', ...hdr.slice(1)]} filename="workload-by-project" rows={group(tasks, (t) => t.lineId ?? 'orphan', (t) => (t.lineId ? `${model.lineById[t.lineId]?.bu} · ${model.lineById[t.lineId]?.project}` : 'Orphan tasks'))} />
        </>
      )}
      {tab === 'completion' && (
        <ReportTable
          title="Milestone task completion"
          filename="milestone-completion"
          headers={['BU', 'Project', 'Milestone', 'Weeks', 'Tasks', 'Completed', 'Estimated h', 'Completed h', '% done (hours)']}
          rows={model.milestoneList.filter((m) => model.tasksByMs[m.id]?.length && (!plant || m.plant === plant)).map((m) => {
            const e = model.effortByMs[m.id];
            return [m.bu, m.project, m.label, `${weekLabel(m.startWeek)}–${weekLabel(m.endWeek)}`, e.count, e.completed, round2(e.minutes / 60), round2(e.completedMinutes / 60), e.minutes ? Math.round((e.completedMinutes / e.minutes) * 100) : 0];
          })}
        />
      )}
      {tab === 'utilization' && (
        <ReportTable
          title={`Utilization ${weekLabel(w0)}–${weekLabel(w1)}`}
          filename="utilization"
          headers={['Technician', 'Plant', 'Capacity h', 'Allocated h', 'Remaining h', 'Utilization', 'Peak week', 'Status']}
          rows={techs.map((t) => { const r = techRange(model, t.id, w0, w1); return [t.displayName, t.plantId, round2(r.capacity), round2(r.allocated), round2(r.remaining), fmtPct(r.util), fmtPct(r.peakUtil), r.status]; })}
        />
      )}
      {tab === 'capacity' && (
        <div className="mt"><ChartCard title="Weekly capacity vs demand" subtitle="all confirmed technicians"><PeaksChart model={model} w0={w0} w1={w1} /></ChartCard></div>
      )}
      {tab === 'forecast' && (
        <ReportTable
          title="Forecast — milestones in the next 12 weeks"
          filename="forecast"
          note="Effort is only what the coordinator has defined. A milestone with 0 h has no tasks yet — its real effort is unknown."
          headers={['BU', 'Project', 'Milestone', 'Type', 'Weeks', 'Tasks', 'Defined effort h', 'Unassigned h']}
          rows={upcoming.map((m) => { const e = model.effortByMs[m.id]; return [m.bu, m.project, m.label, m.type, `${weekLabel(m.startWeek)}–${weekLabel(m.endWeek)}`, e?.count ?? 0, round2((e?.minutes ?? 0) / 60), round2((e?.unassignedMinutes ?? 0) / 60)]; })}
        />
      )}
      {tab === 'unassigned' && (
        <ReportTable
          title={`Unassigned workload — ${round2(unassigned.reduce((s, t) => s + t.estimatedMinutes / 60, 0))} h`}
          filename="unassigned"
          headers={['Task', 'Project', 'Milestone', 'Plant', 'Hours', 'Period', 'Overdue']}
          rows={unassigned.map((t) => { const ms = t.milestoneId ? model.msById[t.milestoneId] : null; const w = taskWindow(t); return [t.name, ms?.project ?? 'orphan', ms?.label ?? '', t.plant ?? 'TBC', round2(t.estimatedMinutes / 60), w ? `${w.start} → ${w.end}` : 'unscheduled', isOverdue(t, model.refDate) ? 'yes' : '']; })}
        />
      )}
      {tab === 'issues' && (
        <>
          <ReportTable
            title="Resource conflicts (technician-weeks over capacity)"
            filename="conflicts"
            headers={['Technician', 'Plant', 'Week', 'Allocated h', 'Capacity h', 'Over by h']}
            rows={conflicts.map((c) => [model.techById[c.techId].displayName, model.techById[c.techId].plantId, weekLabel(c.week), round2(c.allocated), round2(c.capacity), round2(c.allocated - c.capacity)])}
          />
          <ReportTable
            title="Missing data & data quality"
            filename="data-quality"
            headers={['Severity', 'Check', 'Count']}
            rows={[...liveQualityChecks(model).map((c) => [c.severity, c.text, c.count]), ...(model.data.milestones.meta.dataQuality ?? []).map((d) => [d.severity, `${d.id}: ${d.text}`, d.lines?.length ?? ''])]}
          />
        </>
      )}
    </>
  );
}
