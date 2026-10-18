import { isConfirmed, isTechnician } from './capacityCalculations.js';
import { getReferenceDate, weekEnd, weekStart } from './weekCalendar.js';

// Illustrative templates only. Every generated record is flagged origin: "demo".
const TEMPLATES = {
  SOP: [['Prepare CAD documentation', 24, 'pre'], ['Verify drawing consistency', 12, 'pre'], ['Finalize documentation', 16, 'at']],
  VS: [['Update Layout', 20, 'pre'], ['Release drawings', 12, 'at']],
  DOC: [['Compile drawing package', 16, 'pre'], ['Check revision index', 8, 'at']],
  TR: [['Prepare drawings', 16, 'pre'], ['Drawing review', 8, 'at']],
  CF: [['Update CAD for gate review', 14, 'at']],
  PRE_SERIAL: [['Pre-serial drawing update', 20, 'pre'], ['Pre-serial release check', 8, 'at']],
};
const CROSS_PLANTS = ['YMK', 'YMOT', 'YMOK'];

export function generateDemoTasks(data) {
  const { milestones: plan, organization: org, settings } = data;
  const refDate = getReferenceDate(settings, plan.meta?.source?.year);
  const techs = org.people.filter((p) => isTechnician(p) && isConfirmed(p));
  const byPlant = (p) => techs.filter((t) => t.plantId === p);
  const rr = {};
  const tasks = [];
  const assignments = {};
  let n = 0;
  let lineIdx = 0;

  for (const line of plan.projectLines) {
    const withTpl = line.milestones.filter((m) => TEMPLATES[m.type]);
    if (!withTpl.length) continue;
    lineIdx += 1;
    const group = String(line.plantGroup ?? '').split(/\s*&\s*/).filter(Boolean);
    const plant = line.plant || (group.length ? group[lineIdx % group.length] : null);
    for (const m of withTpl) {
      for (const [name, baseHours, kind] of TEMPLATES[m.type]) {
        const hours = Math.round(baseHours * 1.6);
        n += 1;
        const startWeekN = kind === 'pre' ? Math.max(1, m.startWeek - 2) : m.startWeek;
        const endWeekN = kind === 'pre' ? Math.max(startWeekN, m.endWeek - 1) : m.endWeek;
        const startDate = weekStart(startWeekN);
        const endDate = weekEnd(endWeekN);
        let technicianId = null;
        let taskPlant = plant;
        const pool = byPlant(plant);
        if (pool.length && n % 6 !== 0) {
          rr[plant] = (rr[plant] ?? 0) + 1;
          technicianId = pool[rr[plant] % pool.length].id;
          if (n % 7 === 0) {
            const alt = CROSS_PLANTS.map((p) => byPlant(p)).flat();
            if (alt.length) {
              const t = alt[n % alt.length];
              technicianId = t.id;
              assignments[`DEMO-${n}`] = { crossPlant: true, flaggedForReview: true, note: 'Demo: cross-plant redistribution', origin: 'demo' };
            }
          }
        }
        let status = 'NOT_STARTED';
        let actualMinutes = 0;
        if (endDate < refDate) {
          status = n % 4 === 0 ? 'IN_PROGRESS' : 'COMPLETED';
          actualMinutes = status === 'COMPLETED' ? hours * 60 : Math.round(hours * 30);
        } else if (startDate <= refDate) {
          status = 'IN_PROGRESS';
          actualMinutes = Math.round(hours * 20);
        }
        tasks.push({
          id: `DEMO-${n}`, milestoneId: m.id, lineId: line.id, name: name, description: 'Illustrative demo task', estimatedMinutes: hours * 60,
          actualMinutes, priority: m.type === 'SOP' ? 'High' : 'Medium', status, startDate, endDate, plant: taskPlant,
          technicianId, skills: [], notes: '', followsMilestone: false, needsReview: false, origin: 'demo',
        });
      }
    }
  }
  return { tasks, assignments };
}
