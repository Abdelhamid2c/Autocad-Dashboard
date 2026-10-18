import { loadStatus } from './capacityCalculations.js';
import { assignmentImpact, isCompleted, taskWindow } from './scheduling.js';
import { weekEnd, weekStart } from './weekCalendar.js';

/** Period used to evaluate candidates: task dates, else its milestone window, else the reference week. */
export function evaluationWindow(model, task) {
  const w = taskWindow(task);
  if (w) return { ...w, source: 'task dates' };
  const ms = task.milestoneId ? model.msById[task.milestoneId] : null;
  if (ms) return { start: ms.startDate, end: ms.endDate, source: 'milestone window (task has no dates)' };
  return { start: weekStart(model.refWeek, model.year), end: weekEnd(model.refWeek, model.year), source: 'reference week (task has no dates)' };
}

/**
 * Ranks technicians for one task by capacity available *in the requested period*, then plant and skills.
 * Technicians of other plants are only listed when the coordinator allows cross-plant.
 */
export function rankCandidates(model, task, { plant, includeCrossPlant }) {
  const win = evaluationWindow(model, task);
  const probe = { ...task, startDate: win.start, endDate: win.end };
  const required = (task.skills ?? []).map((s) => s.toLowerCase());
  const rows = model.activeTechs
    .filter((t) => includeCrossPlant || !plant || t.plantId === plant)
    .map((tech) => {
      const imp = assignmentImpact(tech, probe, model.tasks, model.settings, model.refDate, model.year);
      const others = model.tasksByTech[tech.id] ?? [];
      const projects = new Set();
      for (const o of others) {
        const ow = taskWindow(o);
        if (o.id === task.id || isCompleted(o) || !ow || !o.lineId) continue;
        if (ow.start <= win.end && ow.end >= win.start) projects.add(o.lineId);
      }
      const have = (tech.skills ?? []).map((s) => s.toLowerCase());
      const skillMatch = required.filter((s) => have.includes(s)).length;
      const crossPlant = !!(plant && tech.plantId !== plant);
      const overloaded = imp.overDays.length > 0 || imp.overWeeks.length > 0;
      return {
        tech, impact: imp, projects: [...projects].map((id) => model.lineById[id]).filter(Boolean),
        skillMatch, skillsRequired: required.length, crossPlant, overloaded,
        current: task.technicianId === tech.id,
        weeklyCap: tech.weeklyCap,
        utilBefore: imp.utilBefore, utilAfter: imp.utilAfter,
        statusAfter: loadStatus(imp.utilAfter, model.thresholds),
      };
    });
  rows.sort((a, b) => (a.overloaded - b.overloaded) || (a.crossPlant - b.crossPlant) || (b.skillMatch - a.skillMatch) || (b.impact.remainingAfter - a.impact.remainingAfter));
  const rec = rows.find((r) => !r.overloaded && !r.crossPlant);
  if (rec) rec.recommended = true;
  return { window: win, rows };
}
