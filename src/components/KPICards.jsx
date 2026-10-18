import { href } from '../state/useRoute.js';
import { round2 } from '../utils/capacityCalculations.js';
import { dashboardStats, milestonesWithoutTasks, qualityWarningCount, upcomingMilestones } from '../utils/workloadAggregation.js';

function Kpi({ label, value, sub, tone, to }) {
  const body = (
    <div className={`kpi${tone ? ` ${tone}` : ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
  return to ? <a href={href(to)} style={{ color: 'inherit', textDecoration: 'none' }}>{body}</a> : body;
}

export default function KPICards({ model, horizon }) {
  const st = dashboardStats(model, horizon);
  const near = model.settings.nearMilestoneWeeks;
  const up = upcomingMilestones(model, near);
  const active = model.lines.filter((l) => l.eop?.year && l.eop.year >= model.year).length;
  const unknownEop = model.lines.filter((l) => !l.eop?.year).length;
  const noTasks = milestonesWithoutTasks(model).length;
  const dq = qualityWarningCount(model);
  const hasTasks = model.tasks.length > 0;
  return (
    <div className="grid kpis">
      <Kpi label="Active project lines" value={active} sub={`${model.lines.length} lines · ${unknownEop} with unknown EOP`} to="projects" />
      <Kpi label="Milestones" value={model.milestoneList.length} sub={`in ${model.year} plan`} to="planner" />
      <Kpi label={`Upcoming (${near} wk)`} value={up.length} sub={`from W${String(model.refWeek).padStart(2, '0')}`} to="planner" tone={up.length ? 'warn' : ''} />
      <Kpi label="Technicians" value={model.activeTechs.length} sub={`confirmed capacity · ${model.techs.length - model.activeTechs.length} TBC excluded`} to="technicians" />
      <Kpi label="Capacity vs allocated" value={`${round2(st.allocated)} / ${round2(st.capacity)} h`} sub={`W${String(st.w0).padStart(2, '0')}–W${String(st.w1).padStart(2, '0')}`} to="plants" />
      <Kpi label="Tasks unassigned" value={hasTasks ? st.unassigned : '—'} sub={hasTasks ? `${st.unscheduled} unscheduled` : 'no task defined yet'} tone={st.unassigned ? 'warn' : ''} to="allocation" />
      <Kpi label="Tasks in progress" value={hasTasks ? st.inProgress : '—'} to="designer" />
      <Kpi label="Tasks overdue" value={hasTasks ? st.overdue : '—'} tone={st.overdue ? 'bad' : ''} to="designer" />
      <Kpi label="Techs available" value={hasTasks ? st.classes.available : '—'} sub={`peak week < ${model.thresholds.available} %`} tone="ok" to="technicians" />
      <Kpi label="Techs at full capacity" value={hasTasks ? st.classes.high : '—'} sub={`peak week ${model.thresholds.moderate}–${model.thresholds.high} %`} tone={st.classes.high ? 'warn' : ''} to="technicians" />
      <Kpi label="Techs overloaded" value={hasTasks ? st.classes.overloaded : '—'} sub={`peak week > ${model.thresholds.high} %`} tone={st.classes.overloaded ? 'bad' : ''} to="technicians" />
      <Kpi label="Capacity conflicts" value={hasTasks ? st.conflicts : '—'} sub="technician-weeks over capacity" tone={st.conflicts ? 'bad' : ''} to="plants" />
      <Kpi label="Milestones without tasks" value={noTasks} sub={`of ${model.milestoneList.length}`} tone={noTasks ? 'warn' : ''} to="designer" />
      <Kpi label="Data-quality warnings" value={dq} sub="see Settings & Data" tone={dq ? 'warn' : ''} to="settings" />
    </div>
  );
}
