import { useState } from 'react';
import PlantCapacityMatrix from '../components/PlantCapacityMatrix.jsx';
import { Tabs, Banner, LoadBadge, PageHead } from '../components/ui.jsx';
import WhatIf from '../components/WhatIf.jsx';
import { ChartCard, PlantWorkloadChart } from '../components/WorkloadCharts.jsx';
import { useStore } from '../state/store.jsx';
import { fmtPct, round2 } from '../utils/capacityCalculations.js';
import { isCompleted } from '../utils/scheduling.js';
import { weekLabel } from '../utils/weekCalendar.js';
import { plantRange, plantTechs, plantWeek, techRange, techWeek, upcomingMilestones } from '../utils/workloadAggregation.js';

export default function PlantPlanning() {
  const { model } = useStore();
  const [w0, setW0] = useState(1);
  const [w1, setW1] = useState(52);
  const [mode, setMode] = useState('allocated');
  const [week, setWeek] = useState(model.refWeek);
  const upcoming = upcomingMilestones(model);

  const rows = model.plants.map((p) => {
    const r = plantRange(model, p.id, w0, w1);
    const techs = plantTechs(model, p.id);
    const lineIds = new Set(model.lines.filter((l) => l.plant === p.id).map((l) => l.id));
    for (const t of model.tasks) if (t.plant === p.id && t.lineId && !isCompleted(t)) lineIds.add(t.lineId);
    return {
      plant: p, r, techs: techs.length, projects: lineIds.size,
      upcoming: upcoming.filter((m) => m.plant === p.id).length,
      unassigned: model.tasks.filter((t) => t.plant === p.id && !t.technicianId && !isCompleted(t)).length,
      overloaded: techs.filter((t) => techRange(model, t.id, w0, w1).peakUtil > model.thresholds.high).length,
    };
  });
  const tbcLines = model.lines.filter((l) => !l.plant);
  const tbcUpcoming = upcoming.filter((m) => !m.plant).length;
  const tbcDemand = Object.values(model.load.plantDemandWeek.TBC ?? {}).reduce((s, v) => s + v, 0);

  // Week detail
  const detail = model.plants.map((p) => ({ p, s: plantWeek(model, p.id, week) }));
  const spare = detail.filter((d) => d.s.capacity > 0 && d.s.remaining >= model.settings.dailyHours);
  const short = detail.filter((d) => d.s.demand > d.s.capacity + 1e-6);
  const overTechs = model.activeTechs.filter((t) => techWeek(model, t.id, week).allocated > techWeek(model, t.id, week).capacity + 1e-6);

  return (
    <>
      <PageHead title="Plant Resource Planning" subtitle="Home plant of a technician and plant of a project are kept separate. Cross-plant reallocation is always an explicit decision." />
      <div className="toolbar">
        <label className="row">Weeks <input type="number" min="1" max="52" value={w0} style={{ width: 60 }} onChange={(e) => setW0(Math.min(w1, Math.max(1, Number(e.target.value) || 1)))} /> to <input type="number" min="1" max="52" value={w1} style={{ width: 60 }} onChange={(e) => setW1(Math.max(w0, Math.min(52, Number(e.target.value) || 52)))} /></label>
        <span className="muted small">Summary period {weekLabel(w0)}–{weekLabel(w1)}</span>
      </div>

      <div className="card flush table-wrap">
        <table className="t">
          <thead><tr><th>Plant</th><th className="num">Technicians</th><th className="num">Projects</th><th className="num">Milestones next {model.settings.nearMilestoneWeeks} wk</th><th className="num">Planned (alloc.)</th><th className="num">Capacity</th><th className="num">Remaining</th><th>Utilization</th><th className="num">Unassigned tasks</th><th className="num">Overloaded techs</th></tr></thead>
          <tbody>
            {rows.map(({ plant, r, techs, projects, upcoming: up, unassigned, overloaded }) => (
              <tr key={plant.id}>
                <td><b>{plant.id}</b></td>
                <td className="num">{techs || <span className="muted">0 (TBC)</span>}</td>
                <td className="num">{projects}</td><td className="num">{up}</td>
                <td className="num">{round2(r.allocated)} h</td><td className="num">{round2(r.capacity)} h</td><td className="num">{round2(r.remaining)} h</td>
                <td>{r.capacity > 0 ? <LoadBadge status={r.status} pct={r.util} /> : <span className="muted">no confirmed capacity</span>}</td>
                <td className="num">{unassigned}</td><td className="num" style={{ color: overloaded ? 'var(--bad)' : undefined }}>{overloaded}</td>
              </tr>
            ))}
            <tr>
              <td><b>TBC</b> <span className="muted small">(line plant not set)</span></td><td className="num">—</td><td className="num">{tbcLines.length}</td><td className="num">{tbcUpcoming}</td>
              <td className="num">—</td><td className="num">—</td><td className="num">—</td><td className="muted small">{round2(tbcDemand)} h of task demand without a plant</td><td className="num">—</td><td className="num">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid c2 mt">
        <ChartCard title="Plant comparison" subtitle="capacity · allocated (home plant) · demand (task plant)"><PlantWorkloadChart model={model} w0={w0} w1={w1} /></ChartCard>
        <div className="card">
          <h2>Spare capacity &amp; shortfalls — {weekLabel(week)}</h2>
          <p className="small"><b>Spare capacity (≥ 1 day):</b> {spare.length ? spare.map((d) => <span className="chip" key={d.p.id}>{d.p.id}: {round2(d.s.remaining)} h</span>) : <span className="muted">none</span>}</p>
          <p className="small"><b>Demand exceeds local capacity:</b> {short.length ? short.map((d) => <span className="chip" key={d.p.id} style={{ background: '#fde3e6' }}>{d.p.id}: {round2(d.s.demand)} h vs {round2(d.s.capacity)} h</span>) : <span className="muted">none</span>}</p>
          <p className="small"><b>Overloaded technicians:</b> {overTechs.length ? overTechs.map((t) => <span className="chip" key={t.id} style={{ background: '#fde3e6' }}>{t.displayName} ({t.plantId}) {fmtPct(techWeek(model, t.id, week).util)}</span>) : <span className="muted">none</span>}</p>
          {short.length > 0 && spare.length > 0 && <Banner type="info">Redistribution opportunity: {short.map((d) => d.p.id).join(', ')} could be relieved by {spare.map((d) => d.p.id).join(', ')}. Decide explicitly with the what-if tool below.</Banner>}
        </div>
      </div>

      <div className="card mt">
        <div className="card-head">
          <h2 style={{ margin: 0 }}>Weekly capacity matrix W01–W52</h2>
          <Tabs tabs={[{ id: 'allocated', label: 'Allocated ÷ capacity' }, { id: 'demand', label: 'Demand (task plant) ÷ capacity' }]} value={mode} onChange={setMode} />
        </div>
        <PlantCapacityMatrix model={model} plants={model.plants} mode={mode} selectedWeek={week} onSelect={setWeek} />
        <p className="muted small">Click a cell to select the week. “!” = demand with no confirmed capacity in that plant. Colours follow the utilization thresholds.</p>
      </div>

      <div className="card mt">
        <h2>Test an alternative assignment — {weekLabel(week)}</h2>
        <WhatIf week={week} />
      </div>
    </>
  );
}
