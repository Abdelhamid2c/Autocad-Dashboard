import { addDays, dateRange, weekOfDate, weekStart, workingDaysBetween, PLAN_YEAR } from './weekCalendar.js';
import { capacityOn, loadStatus, round2, utilizationPct } from './capacityCalculations.js';

export const TASK_STATUS = {
  NOT_STARTED: { label: 'Not started', color: '#6b7a90' },
  IN_PROGRESS: { label: 'In progress', color: '#2e75b6' },
  BLOCKED: { label: 'Blocked', color: '#d98a00' },
  COMPLETED: { label: 'Completed', color: '#2e9e5b' },
};
export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
export const isCompleted = (t) => t.status === 'COMPLETED';
export const taskHours = (t) => (t.estimatedMinutes || 0) / 60;

/** Task dates: a single date means a one-day window. Null when the task has no dates (unscheduled). */
export function taskWindow(t) {
  const s = t.startDate || t.endDate;
  const e = t.endDate || t.startDate;
  if (!s) return null;
  return s <= e ? { start: s, end: e } : { start: e, end: s };
}
export const isScheduled = (t) => !!taskWindow(t);

export function isOverdue(t, refDate) {
  const w = taskWindow(t);
  return !!w && !isCompleted(t) && w.end < refDate;
}

/**
 * Spreads the estimate evenly over working days of the task window (never weekends).
 * Completed tasks only count for days before the reference date (history), never for future capacity.
 */
export function taskDailyHours(task, settings, refDate) {
  const w = taskWindow(task);
  if (!w) return [];
  const days = workingDaysBetween(w.start, w.end, settings);
  if (!days.length) return [];
  const per = taskHours(task) / days.length;
  const kept = isCompleted(task) ? days.filter((d) => refDate && d < refDate) : days;
  return kept.map((date) => ({ date, hours: per }));
}

/**
 * One pass over all tasks produces every load view. Each task is counted exactly once per day.
 * techDay[techId][date], techWeek[techId][week], plantDemandWeek[plant][week] (by task plant, incl. unassigned).
 */
export function buildLoadIndex(tasks, settings, refDate, year = PLAN_YEAR) {
  const techDay = {};
  const techWeek = {};
  const plantDemandWeek = {};
  const unscheduled = [];
  for (const t of tasks) {
    if (!isScheduled(t)) {
      if (!isCompleted(t)) unscheduled.push(t);
      continue;
    }
    for (const { date, hours } of taskDailyHours(t, settings, refDate)) {
      const w = weekOfDate(date, year);
      if (t.technicianId) {
        (techDay[t.technicianId] ??= {})[date] = (techDay[t.technicianId][date] ?? 0) + hours;
        if (w) {
          const tw = (techWeek[t.technicianId] ??= {});
          tw[w] = (tw[w] ?? 0) + hours;
        }
      }
      if (w) {
        const pd = (plantDemandWeek[t.plant || 'TBC'] ??= {});
        pd[w] = (pd[w] ?? 0) + hours;
      }
    }
  }
  return { techDay, techWeek, plantDemandWeek, unscheduled };
}

export function sumRange(dayMap, start, end) {
  if (!dayMap) return 0;
  let s = 0;
  for (const d of dateRange(start, end)) s += dayMap[d] ?? 0;
  return s;
}
export function capacityRange(tech, start, end, settings) {
  let c = 0;
  for (const d of dateRange(start, end)) c += capacityOn(tech, d, settings);
  return c;
}

export function periodStats(tech, dayMap, start, end, settings) {
  const capacity = capacityRange(tech, start, end, settings);
  const allocated = sumRange(dayMap, start, end);
  const util = utilizationPct(allocated, capacity);
  return {
    capacity,
    allocated,
    remaining: capacity - allocated,
    util,
    status: loadStatus(util, settings.thresholds),
  };
}

/** Day-load map of one technician, optionally excluding one task (to evaluate a change of that task). */
export function techDayLoadExcluding(techId, tasks, settings, refDate, excludeTaskId) {
  const map = {};
  for (const t of tasks) {
    if (t.technicianId !== techId || t.id === excludeTaskId) continue;
    for (const { date, hours } of taskDailyHours(t, settings, refDate)) map[date] = (map[date] ?? 0) + hours;
  }
  return map;
}

/**
 * Impact of putting `task` on `tech`: per-day and per-week load before/after, over-capacity detection.
 */
export function assignmentImpact(tech, task, tasks, settings, refDate, year = PLAN_YEAR) {
  const base = techDayLoadExcluding(tech.id, tasks, settings, refDate, task.id);
  const added = {};
  for (const { date, hours } of taskDailyHours({ ...task, status: task.status === 'COMPLETED' ? 'COMPLETED' : task.status }, settings, refDate)) {
    added[date] = (added[date] ?? 0) + hours;
  }
  const dates = Object.keys(added).sort();
  const w = taskWindow(task);
  const overDays = [];
  for (const d of dates) {
    const cap = capacityOn(tech, d, settings);
    const after = (base[d] ?? 0) + added[d];
    if (after > cap + 1e-6) overDays.push({ date: d, before: base[d] ?? 0, after, cap });
  }
  const weeks = [...new Set(dates.map((d) => weekOfDate(d, year)).filter(Boolean))];
  const weekRows = weeks.map((wk) => {
    const ws = weekStart(wk, year);
    const days = dateRange(ws, addDays(ws, 6));
    const cap = days.reduce((s, d) => s + capacityOn(tech, d, settings), 0);
    const before = days.reduce((s, d) => s + (base[d] ?? 0), 0);
    const after = before + days.reduce((s, d) => s + (added[d] ?? 0), 0);
    return { week: wk, cap, before, after, over: after > cap + 1e-6 };
  });
  const capacity = w ? capacityRangeWorking(tech, w.start, w.end, settings) : 0;
  const allocBefore = w ? sumRange(base, w.start, w.end) : 0;
  const addedTotal = dates.reduce((s, d) => s + added[d], 0);
  return {
    hasPeriod: !!w,
    capacity,
    allocatedBefore: allocBefore,
    allocatedAfter: allocBefore + addedTotal,
    utilBefore: utilizationPct(allocBefore, capacity),
    utilAfter: utilizationPct(allocBefore + addedTotal, capacity),
    remainingAfter: capacity - allocBefore - addedTotal,
    overDays,
    weekRows,
    overWeeks: weekRows.filter((r) => r.over),
  };
}
function capacityRangeWorking(tech, s, e, settings) {
  return capacityRange(tech, s, e, settings);
}

export const hoursLabel = (h) => `${round2(h)} h`;
