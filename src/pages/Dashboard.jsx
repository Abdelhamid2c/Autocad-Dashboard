import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import KPICards from '../components/KPICards.jsx';
import { Banner, EditOnly, PageHead } from '../components/ui.jsx';
import { AllocVsAvailableChart, ChartCard, MilestonesPerWeekChart, PeaksChart, PlantWorkloadChart, TaskStatusChart, TechUtilChart } from '../components/WorkloadCharts.jsx';
import { A } from '../state/actions.js';
import { href } from '../state/useRoute.js';
import { useStore } from '../state/store.jsx';
import { fmtPct, round2 } from '../utils/capacityCalculations.js';
import { isCompleted, isOverdue } from '../utils/scheduling.js';
import { weekLabel } from '../utils/weekCalendar.js';
import { dashboardStats, milestonesWithoutTasks, techRange, upcomingMilestones } from '../utils/workloadAggregation.js';

function AlertBox({ title, tone = 'warn', items, to, empty }) {
  return (
    <div className="card">
      <div className="card-head"><h3><AlertTriangle size={13} style={{ verticalAlign: -2, color: tone === 'bad' ? 'var(--bad)' : 'var(--warn)' }} /> {title}</h3>{to && <a href={href(to)} className="small">Open →</a>}</div>
      {items.length ? <ul style={{ margin: 0, paddingLeft: 16 }}>{items.slice(0, 5).map((x, i) => <li key={i} className="small">{x}</li>)}{items.length > 5 && <li className="small muted">…and {items.length - 5} more</li>}</ul> : <span className="muted small">{empty ?? 'Nothing to report.'}</span>}
    </div>
  );
}

export default function Dashboard() {
  const { model, data, dispatch, notify } = useStore();
  const [horizon, setHorizon] = useState(model.settings.horizonWeeks ?? 12);
  const st = dashboardStats(model, horizon);
  const near = model.settings.nearMilestoneWeeks;
  const upNoTasks = upcomingMilestones(model, near).filter((m) => !model.tasksByMs[m.id]?.length);
  const open = model.tasks.filter((t) => !isCompleted(t));
  const unassigned = open.filter((t) => !t.technicianId);
  const overdue = open.filter((t) => isOverdue(t, model.refDate));
  const hot = model.activeTechs.map((t) => ({ t, r: techRange(model, t.id, st.w0, st.w1) })).filter((x) => x.r.peakUtil >= model.thresholds.moderate + 0);
  const noEop = model.lines.filter((l) => !l.eop?.year);
  const noPlant = model.lines.filter((l) => !l.plant);
  const noTaskTotal = milestonesWithoutTasks(model).length;

  return (
    <>
      <PageHead title="Executive Dashboard" subtitle={`CAD department workload across YMM1 · YMM2 · YMOK · YMK · YMOT · SATELLITES — all figures computed live from the store.`}>
        <label className="row">Horizon
          <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
            <option value={4}>Next 4 weeks</option><option value={12}>Next 12 weeks</option><option value={26}>Next 26 weeks</option><option value={52}>Full year</option>
          </select>
        </label>
        <span className="muted small">{weekLabel(st.w0)}–{weekLabel(st.w1)}</span>
      </PageHead>

      {model.tasks.length === 0 && (
        <Banner type="info">
          <div>
            <b>No task has been defined yet</b>, so workload, utilization and conflict figures are empty — they are never fabricated. Define tasks in the Milestone Task Designer
            <EditOnly> or <button className="btn sm" onClick={() => { dispatch(A.demoLoad()); notify('Illustrative demo tasks loaded', 'ok'); }}>Load illustrative demo tasks</button></EditOnly>.
          </div>
        </Banner>
      )}

      <KPICards model={model} horizon={horizon} />

      <div className="grid c3 mt">
        <AlertBox title="Milestones approaching without tasks" to="designer" items={upNoTasks.map((m) => `${m.project} · ${m.label} (${weekLabel(m.startWeek)})`)} empty={`No milestone in the next ${near} weeks lacks tasks. ${noTaskTotal} milestones overall have no tasks.`} />
        <AlertBox title="Unassigned tasks" to="allocation" items={unassigned.map((t) => `${t.name} (${round2(t.estimatedMinutes / 60)} h)`)} />
        <AlertBox title="Technicians near / over capacity" tone="bad" to="technicians" items={hot.map(({ t, r }) => `${t.displayName}: peak week ${fmtPct(r.peakUtil)}`)} />
        <AlertBox title="Overdue tasks" tone="bad" to="designer" items={overdue.map((t) => `${t.name} (due ${t.endDate})`)} />
        <AlertBox title="Lines with missing data" to="projects" items={[noEop.length && `${noEop.length} line(s) without EOP`, noPlant.length && `${noPlant.length} line(s) without plant`].filter(Boolean)} />
      </div>

      <div className="grid c2 mt">
        <ChartCard title="Workload by plant" subtitle={`${weekLabel(st.w0)}–${weekLabel(st.w1)}`}><PlantWorkloadChart model={model} w0={st.w0} w1={st.w1} /></ChartCard>
        <ChartCard title="Allocated vs available hours" subtitle="by plant (home plant of technicians)"><AllocVsAvailableChart model={model} w0={st.w0} w1={st.w1} /></ChartCard>
        <ChartCard title="Utilization by technician" subtitle="red line = 100 %"><TechUtilChart model={model} w0={st.w0} w1={st.w1} /></ChartCard>
        <ChartCard title="Tasks by status"><TaskStatusChart model={model} /></ChartCard>
        <ChartCard title="Milestones per week (W01–W52)" subtitle={`${data.milestones.meta.source?.year} plan`}><MilestonesPerWeekChart model={model} /></ChartCard>
        <ChartCard title="Workload peaks over the planning horizon" subtitle="capacity vs allocated vs demand"><PeaksChart model={model} /></ChartCard>
      </div>
    </>
  );
}
