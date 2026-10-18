import {
  capacityOn, isConfirmed, isTechnician, loadStatus, techDailyCapacity, techName, techWeeklyCapacity, utilizationPct,
} from './capacityCalculations.js';
import { buildLoadIndex, isCompleted, isOverdue, isScheduled, taskHours } from './scheduling.js';
import { lineWarnings } from './planValidation.js';
import { addDays, dateRange, getReferenceDate, PLAN_YEAR, weekOfDate, weekStart } from './weekCalendar.js';

const EPS = 1e-6;
const emptyEffort = () => ({ count: 0, minutes: 0, assignedMinutes: 0, unassignedMinutes: 0, completed: 0, completedMinutes: 0 });

export function lineMatchesPlant(line, plant) {
  if (!plant) return true;
  if (line.plant) return line.plant === plant;
  return String(line.plantGroup ?? '').split(/\s*&\s*/).includes(plant);
}
export const linePlantLabel = (line) => line.plant || (line.plantGroup ? `TBC (${line.plantGroup})` : 'TBC');

/** Builds every derived structure from the single store. Nothing here is persisted. */
export function computeModel(data) {
  const { milestones: plan, organization: org, tasks, assignments, settings } = data;
  const year = plan.meta?.source?.year ?? PLAN_YEAR;
  const refDate = getReferenceDate(settings, year);
  const refWeek = weekOfDate(refDate, year) ?? 1;

  const techs = org.people.filter(isTechnician).map((p) => ({
    ...p,
    displayName: techName(p),
    confirmed: isConfirmed(p),
    dailyCap: techDailyCapacity(p, settings),
    weeklyCap: techWeeklyCapacity(p, settings),
  }));
  const activeTechs = techs.filter((t) => t.confirmed);
  const techById = Object.fromEntries(techs.map((t) => [t.id, t]));
  const peopleById = Object.fromEntries(org.people.map((p) => [p.id, p]));

  const lines = plan.projectLines;
  const lineById = Object.fromEntries(lines.map((l) => [l.id, l]));
  const milestoneList = [];
  const msById = {};
  for (const l of lines) {
    for (const m of l.milestones) {
      const row = { ...m, lineId: l.id, bu: l.bu, project: l.project, plant: l.plant, plantGroup: l.plantGroup };
      milestoneList.push(row);
      msById[m.id] = row;
    }
  }

  const load = buildLoadIndex(tasks, settings, refDate, year);

  const effortByMs = {};
  const effortByLine = {};
  const tasksByMs = {};
  const tasksByTech = {};
  const orphanTasks = [];
  for (const t of tasks) {
    if (t.technicianId) (tasksByTech[t.technicianId] ??= []).push(t);
    const ms = t.milestoneId ? msById[t.milestoneId] : null;
    if (!ms) {
      orphanTasks.push(t);
      continue;
    }
    (tasksByMs[ms.id] ??= []).push(t);
    for (const [map, key] of [[effortByMs, ms.id], [effortByLine, ms.lineId]]) {
      const e = (map[key] ??= emptyEffort());
      e.count += 1;
      e.minutes += t.estimatedMinutes || 0;
      if (t.technicianId) e.assignedMinutes += t.estimatedMinutes || 0;
      else e.unassignedMinutes += t.estimatedMinutes || 0;
      if (isCompleted(t)) {
        e.completed += 1;
        e.completedMinutes += t.estimatedMinutes || 0;
      }
    }
  }

  const techWeekCap = {};
  for (const t of activeTechs) {
    const row = (techWeekCap[t.id] = {});
    for (let w = 1; w <= 52; w++) {
      const ws = weekStart(w, year);
      row[w] = dateRange(ws, addDays(ws, 6)).reduce((s, d) => s + capacityOn(t, d, settings), 0);
    }
  }

  const model = {
    data, year, refDate, refWeek, settings, thresholds: settings.thresholds,
    plants: org.plants, sites: org.sites, people: org.people, peopleById,
    techs, activeTechs, techById,
    lines, lineById, milestoneList, msById, tasks, assignments,
    tasksByMs, tasksByTech, orphanTasks, effortByMs, effortByLine,
    load, techWeekCap,
  };
  model.conflicts = computeConflicts(model);
  return model;
}

export function horizonRange(model, weeks) {
  const n = weeks ?? model.settings.horizonWeeks ?? 12;
  if (n >= 52) return [1, 52];
  const w0 = model.refWeek;
  return [w0, Math.min(52, w0 + n - 1)];
}

export function techWeek(model, techId, w) {
  const capacity = model.techWeekCap[techId]?.[w] ?? 0;
  const allocated = model.load.techWeek[techId]?.[w] ?? 0;
  const util = utilizationPct(allocated, capacity);
  return { capacity, allocated, remaining: capacity - allocated, util, status: loadStatus(util, model.thresholds) };
}
export function techRange(model, techId, w0, w1) {
  let capacity = 0;
  let allocated = 0;
  let peak = 0;
  for (let w = w0; w <= w1; w++) {
    const s = techWeek(model, techId, w);
    capacity += s.capacity;
    allocated += s.allocated;
    peak = Math.max(peak, s.util);
  }
  const util = utilizationPct(allocated, capacity);
  return { capacity, allocated, remaining: capacity - allocated, util, peakUtil: peak, status: loadStatus(util, model.thresholds), peakStatus: loadStatus(peak, model.thresholds) };
}

export function plantTechs(model, plantId) {
  return model.activeTechs.filter((t) => t.plantId === plantId);
}
export function plantWeek(model, plantId, w) {
  let capacity = 0;
  let allocated = 0;
  for (const t of plantTechs(model, plantId)) {
    capacity += model.techWeekCap[t.id][w];
    allocated += model.load.techWeek[t.id]?.[w] ?? 0;
  }
  const demand = model.load.plantDemandWeek[plantId]?.[w] ?? 0;
  return {
    capacity, allocated, demand, remaining: capacity - allocated,
    util: utilizationPct(allocated, capacity), demandUtil: utilizationPct(demand, capacity),
    status: loadStatus(utilizationPct(allocated, capacity), model.thresholds),
    demandStatus: loadStatus(utilizationPct(demand, capacity), model.thresholds),
  };
}
export function plantRange(model, plantId, w0, w1) {
  let capacity = 0;
  let allocated = 0;
  let demand = 0;
  for (let w = w0; w <= w1; w++) {
    const s = plantWeek(model, plantId, w);
    capacity += s.capacity;
    allocated += s.allocated;
    demand += s.demand;
  }
  return {
    capacity, allocated, demand, remaining: capacity - allocated,
    util: utilizationPct(allocated, capacity), demandUtil: utilizationPct(demand, capacity),
    status: loadStatus(utilizationPct(allocated, capacity), model.thresholds),
  };
}
export function totalWeek(model, w) {
  let capacity = 0;
  let allocated = 0;
  for (const t of model.activeTechs) {
    capacity += model.techWeekCap[t.id][w];
    allocated += model.load.techWeek[t.id]?.[w] ?? 0;
  }
  const demand = Object.values(model.load.plantDemandWeek).reduce((s, m) => s + (m[w] ?? 0), 0);
  return { capacity, allocated, demand, remaining: capacity - allocated };
}

function computeConflicts(model) {
  const out = [];
  for (const t of model.activeTechs) {
    for (let w = 1; w <= 52; w++) {
      const s = techWeek(model, t.id, w);
      if (s.allocated > s.capacity + EPS) out.push({ techId: t.id, week: w, allocated: s.allocated, capacity: s.capacity });
    }
  }
  return out;
}
export function techDayConflicts(model, techId) {
  const t = model.techById[techId];
  const days = model.load.techDay[techId] ?? {};
  return Object.entries(days)
    .map(([date, hours]) => ({ date, hours, cap: capacityOn(t, date, model.settings) }))
    .filter((d) => d.hours > d.cap + EPS)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function milestonesWithoutTasks(model) {
  return model.milestoneList.filter((m) => !model.tasksByMs[m.id]?.length);
}
export function upcomingMilestones(model, weeks = model.settings.nearMilestoneWeeks ?? 4) {
  const from = model.refWeek;
  const to = from + weeks - 1;
  return model.milestoneList.filter((m) => m.endWeek >= from && m.startWeek <= to).sort((a, b) => a.startWeek - b.startWeek);
}
export function milestonesPerWeek(model, filter = () => true) {
  const out = Array.from({ length: 52 }, (_, i) => ({ week: i + 1, label: `W${String(i + 1).padStart(2, '0')}`, count: 0 }));
  for (const m of model.milestoneList) {
    if (!filter(m)) continue;
    for (let w = m.startWeek; w <= m.endWeek; w++) out[w - 1].count += 1;
  }
  return out;
}
export function techProjects(model, techId) {
  const ids = new Set();
  for (const t of model.tasksByTech[techId] ?? []) if (t.lineId && !isCompleted(t)) ids.add(t.lineId);
  return [...ids].map((id) => model.lineById[id]).filter(Boolean);
}
export function taskContext(model, t) {
  const ms = t.milestoneId ? model.msById[t.milestoneId] : null;
  return { milestone: ms, line: ms ? model.lineById[ms.lineId] : null, tech: t.technicianId ? model.techById[t.technicianId] : null };
}

export function dashboardStats(model, weeks) {
  const [w0, w1] = horizonRange(model, weeks);
  let capacity = 0;
  let allocated = 0;
  for (const t of model.activeTechs) {
    const r = techRange(model, t.id, w0, w1);
    capacity += r.capacity;
    allocated += r.allocated;
  }
  const classes = { available: 0, moderate: 0, high: 0, overloaded: 0 };
  for (const t of model.activeTechs) classes[techRange(model, t.id, w0, w1).peakStatus] += 1;
  const tasks = model.tasks;
  const open = tasks.filter((t) => !isCompleted(t));
  return {
    w0, w1, capacity, allocated,
    classes,
    unassigned: open.filter((t) => !t.technicianId).length,
    inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    overdue: open.filter((t) => isOverdue(t, model.refDate)).length,
    conflicts: model.conflicts.filter((c) => c.week >= w0 && c.week <= w1).length,
    unscheduled: model.load.unscheduled.length,
  };
}

/** Live data-quality checks (computed from the current store) + notes carried by the source file. */
export function liveQualityChecks(model) {
  const out = [];
  const noEop = model.lines.filter((l) => !l.eop?.year);
  if (noEop.length) out.push({ id: 'LIVE-EOP', severity: 'warning', count: noEop.length, text: `${noEop.length} project line(s) have no EOP (TBC / Data Required).` });
  const noPlant = model.lines.filter((l) => !l.plant);
  if (noPlant.length) out.push({ id: 'LIVE-PLANT', severity: 'warning', count: noPlant.length, text: `${noPlant.length} project line(s) have no plant set (e.g. 'YMM1 & YMM2' lines). Plant planning shows them as TBC.` });
  const planWarn = model.lines.flatMap((l) => lineWarnings(l, model.year).map((w) => ({ ...w, text: `${l.bu} · ${l.project} (row ${l.sourceRow ?? 'new'}) — ${w.text}` })));
  if (planWarn.length) out.push({ id: 'LIVE-PLAN', severity: 'warning', count: planWarn.length, text: `${planWarn.length} milestone warning(s): overlaps, EOP milestone after line EOP, or EOP year before ${model.year}.`, items: planWarn.map((w) => w.text) });
  const upcomingNoTasks = upcomingMilestones(model).filter((m) => !model.tasksByMs[m.id]?.length);
  if (upcomingNoTasks.length) out.push({ id: 'LIVE-NOTASK', severity: 'warning', count: upcomingNoTasks.length, text: `${upcomingNoTasks.length} milestone(s) in the next ${model.settings.nearMilestoneWeeks} weeks have no tasks defined.` });
  if (model.orphanTasks.length) out.push({ id: 'LIVE-ORPHAN', severity: 'warning', count: model.orphanTasks.length, text: `${model.orphanTasks.length} task(s) are orphans (their milestone was deleted).` });
  const review = model.tasks.filter((t) => t.needsReview);
  if (review.length) out.push({ id: 'LIVE-REVIEW', severity: 'warning', count: review.length, text: `${review.length} task(s) flagged for review after a milestone window change.` });
  const tbc = model.techs.filter((t) => !t.confirmed);
  if (tbc.length) out.push({ id: 'LIVE-TBC', severity: 'info', count: tbc.length, text: `${tbc.length} technician position(s) are TBC and excluded from capacity totals.` });
  const unnamed = model.activeTechs.filter((t) => !t.name);
  if (unnamed.length) out.push({ id: 'LIVE-NAMES', severity: 'info', count: unnamed.length, text: `${unnamed.length} confirmed technician slot(s) have no name yet (the chart gives headcount only).` });
  const cross = Object.values(model.assignments).filter((a) => a?.crossPlant).length;
  if (cross) out.push({ id: 'LIVE-CROSS', severity: 'info', count: cross, text: `${cross} cross-plant assignment(s) flagged for review.` });
  return out;
}
export function qualityWarningCount(model) {
  const src = (model.data.milestones.meta.dataQuality ?? []).filter((d) => d.severity === 'warning').length;
  return src + liveQualityChecks(model).filter((c) => c.severity === 'warning').length;
}

export { isScheduled, taskHours };
