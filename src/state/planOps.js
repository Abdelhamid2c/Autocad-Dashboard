import { isTechnician } from '../utils/capacityCalculations.js';
import { uid } from '../utils/ids.js';
import { milestoneDates } from '../utils/planValidation.js';
import { generateDemoTasks } from '../utils/demoData.js';
import { weekEnd, weekSpanText, weekStart } from '../utils/weekCalendar.js';
import { seedValue } from '../storage/seed.js';

/**
 * Pure operations on the store data. Each returns { changes, desc } where `changes` is a partial data object,
 * or null when nothing changes. The reducer applies them, snapshots history and writes the edit log.
 */

const lineOfMs = (plan, msId) => plan.projectLines.find((l) => l.milestones.some((m) => m.id === msId));

function removeTasksOrOrphan(data, msInfo, mode) {
  // msInfo: Map msId -> { label, project, bu }
  let assignments = data.assignments;
  const tasks = [];
  for (const t of data.tasks) {
    if (!t.milestoneId || !msInfo.has(t.milestoneId)) {
      tasks.push(t);
      continue;
    }
    if (mode === 'delete') {
      if (assignments[t.id]) {
        assignments = { ...assignments };
        delete assignments[t.id];
      }
    } else {
      tasks.push({ ...t, milestoneId: null, lineId: null, orphan: true, orphanInfo: msInfo.get(t.milestoneId) });
    }
  }
  return { tasks, assignments };
}
const infoOf = (line, m) => ({ label: m.label, type: m.type, project: line.project, bu: line.bu });
const countTasks = (data, ids) => data.tasks.filter((t) => ids.has(t.milestoneId)).length;

// ---------- Business units ----------
function buAdd(data, { bu }) {
  const plan = data.milestones;
  if (plan.businessUnits.some((b) => b.name.toLowerCase() === bu.name.trim().toLowerCase())) return null;
  const row = { id: uid('BU'), name: bu.name.trim(), plantGroup: bu.plantGroup ?? '', plant: bu.plant || null, origin: 'user' };
  return { changes: { milestones: { ...plan, businessUnits: [...plan.businessUnits, row] } }, desc: `Add BU "${row.name}"` };
}
function buUpdate(data, { id, patch }) {
  const plan = data.milestones;
  const old = plan.businessUnits.find((b) => b.id === id);
  if (!old) return null;
  const next = { ...old, ...patch, name: (patch.name ?? old.name).trim(), plant: (patch.plant ?? old.plant) || null };
  const lines = plan.projectLines.map((l) => (l.bu === old.name ? { ...l, bu: next.name, plantGroup: next.plantGroup ?? l.plantGroup } : l));
  return {
    changes: { milestones: { ...plan, businessUnits: plan.businessUnits.map((b) => (b.id === id ? next : b)), projectLines: lines } },
    desc: old.name === next.name ? `Edit BU "${next.name}"` : `Rename BU "${old.name}" → "${next.name}"`,
  };
}
function buDelete(data, { id, taskMode }) {
  const plan = data.milestones;
  const bu = plan.businessUnits.find((b) => b.id === id);
  if (!bu) return null;
  const lines = plan.projectLines.filter((l) => l.bu === bu.name);
  const info = new Map(lines.flatMap((l) => l.milestones.map((m) => [m.id, infoOf(l, m)])));
  const t = removeTasksOrOrphan(data, info, taskMode);
  return {
    changes: {
      milestones: { ...plan, businessUnits: plan.businessUnits.filter((b) => b.id !== id), projectLines: plan.projectLines.filter((l) => l.bu !== bu.name) },
      ...t,
    },
    desc: `Delete BU "${bu.name}" (${lines.length} lines)`,
  };
}

// ---------- Project lines ----------
function lineAdd(data, { line }) {
  const plan = data.milestones;
  const bu = plan.businessUnits.find((b) => b.name === line.bu);
  const row = {
    id: line.id || uid('LINE'), sourceRow: null, bu: line.bu, project: line.project.trim(), plantGroup: bu?.plantGroup ?? '', plant: line.plant || null,
    eop: line.eop, milestones: [], origin: 'user', notes: line.notes || '',
  };
  return { changes: { milestones: { ...plan, projectLines: [...plan.projectLines, row] } }, desc: `Add project line "${row.project}" in ${row.bu}`, newId: row.id };
}
function lineUpdate(data, { id, patch }) {
  const plan = data.milestones;
  const old = plan.projectLines.find((l) => l.id === id);
  if (!old) return null;
  const next = { ...old, ...patch };
  if (patch.project !== undefined) next.project = patch.project.trim();
  if (patch.bu && patch.bu !== old.bu) next.plantGroup = plan.businessUnits.find((b) => b.name === patch.bu)?.plantGroup ?? next.plantGroup;
  return { changes: { milestones: { ...plan, projectLines: plan.projectLines.map((l) => (l.id === id ? next : l)) } }, desc: `Edit project line "${next.project}"` };
}
function lineDuplicate(data, { id }) {
  const plan = data.milestones;
  const i = plan.projectLines.findIndex((l) => l.id === id);
  if (i < 0) return null;
  const src = plan.projectLines[i];
  const copy = {
    ...src, id: uid('LINE'), sourceRow: null, origin: 'user', project: `${src.project} (copy)`,
    milestones: src.milestones.map((m) => ({ ...m, id: uid('M'), origin: 'user', sourceCell: undefined })),
  };
  const lines = [...plan.projectLines];
  lines.splice(i + 1, 0, copy);
  return { changes: { milestones: { ...plan, projectLines: lines } }, desc: `Duplicate project line "${src.project}"` };
}
function lineDelete(data, { id, taskMode }) {
  const plan = data.milestones;
  const line = plan.projectLines.find((l) => l.id === id);
  if (!line) return null;
  const t = removeTasksOrOrphan(data, new Map(line.milestones.map((m) => [m.id, infoOf(line, m)])), taskMode);
  return { changes: { milestones: { ...plan, projectLines: plan.projectLines.filter((l) => l.id !== id) }, ...t }, desc: `Delete project line "${line.project}"` };
}

// ---------- Milestones ----------
function msAdd(data, { lineId, ms }) {
  const plan = data.milestones;
  const line = plan.projectLines.find((l) => l.id === lineId);
  if (!line) return null;
  const row = {
    id: ms.id || uid('M'), label: ms.label.trim(), type: ms.type, startWeek: ms.startWeek, endWeek: ms.endWeek, ...milestoneDates(ms.startWeek, ms.endWeek),
    sourceColor: null, colorOverride: ms.colorOverride || null, notes: ms.notes || '', origin: 'user',
  };
  return {
    changes: { milestones: { ...plan, projectLines: plan.projectLines.map((l) => (l.id === lineId ? { ...l, milestones: [...l.milestones, row] } : l)) } },
    desc: `Add milestone "${row.label}" (${weekSpanText(row.startWeek, row.endWeek)}) on "${line.project}"`, newId: row.id,
  };
}
function msUpdate(data, { id, patch }) {
  const plan = data.milestones;
  const line = lineOfMs(plan, id);
  if (!line) return null;
  const old = line.milestones.find((m) => m.id === id);
  const next = { ...old, ...patch };
  if (patch.label !== undefined) next.label = patch.label.trim();
  if (patch.type && patch.type !== old.type) next.typeInferred = false;
  if (old.origin === 'source') next.modified = true;
  const weeksChanged = next.startWeek !== old.startWeek || next.endWeek !== old.endWeek;
  if (weeksChanged) Object.assign(next, milestoneDates(next.startWeek, next.endWeek));
  const changes = {
    milestones: { ...plan, projectLines: plan.projectLines.map((l) => (l.id === line.id ? { ...l, milestones: l.milestones.map((m) => (m.id === id ? next : m)) } : l)) },
  };
  if (weeksChanged) {
    const sd = weekStart(next.startWeek);
    const ed = weekEnd(next.endWeek);
    const reason = `Milestone window changed ${weekSpanText(old.startWeek, old.endWeek)} → ${weekSpanText(next.startWeek, next.endWeek)}`;
    changes.tasks = data.tasks.map((t) => {
      if (t.milestoneId !== id) return t;
      if (t.followsMilestone) return { ...t, startDate: sd, endDate: ed };
      if (t.startDate || t.endDate) return { ...t, needsReview: true, reviewReason: reason };
      return t;
    });
  }
  return { changes, desc: weeksChanged ? `Move/resize milestone "${next.label}" → ${weekSpanText(next.startWeek, next.endWeek)}` : `Edit milestone "${next.label}"` };
}
function msDelete(data, { id, taskMode }) {
  const plan = data.milestones;
  const line = lineOfMs(plan, id);
  if (!line) return null;
  const m = line.milestones.find((x) => x.id === id);
  const t = removeTasksOrOrphan(data, new Map([[id, infoOf(line, m)]]), taskMode);
  return {
    changes: { milestones: { ...plan, projectLines: plan.projectLines.map((l) => (l.id === line.id ? { ...l, milestones: l.milestones.filter((x) => x.id !== id) } : l)) }, ...t },
    desc: `Delete milestone "${m.label}" on "${line.project}"`,
  };
}
function planReplace(data, { plan, desc }) {
  const old = new Map(data.milestones.projectLines.flatMap((l) => l.milestones.map((m) => [m.id, infoOf(l, m)])));
  const keep = new Set(plan.projectLines.flatMap((l) => l.milestones.map((m) => m.id)));
  const gone = new Map([...old].filter(([id]) => !keep.has(id)));
  const t = removeTasksOrOrphan(data, gone, 'orphan');
  return { changes: { milestones: plan, ...t }, desc: desc ?? 'Replace milestone plan' };
}

// ---------- Tasks ----------
function normalizeTask(data, task, crossPlant) {
  const plan = data.milestones;
  const line = task.milestoneId ? lineOfMs(plan, task.milestoneId) : null;
  const tech = task.technicianId ? data.organization.people.find((p) => p.id === task.technicianId) : null;
  const t = { skills: [], origin: 'user', ...task, lineId: line ? line.id : task.lineId ?? null };
  if (!t.id) t.id = uid('T');
  if (t.milestoneId && line) {
    t.orphan = false;
    t.orphanInfo = undefined;
  }
  if (tech && !t.plant) t.plant = tech.plantId;
  if (!tech) t.technicianId = null;
  t.needsReview = !!task.needsReview;
  const assignments = { ...data.assignments };
  const cross = !!(tech && t.plant && tech.plantId !== t.plant);
  if (cross && crossPlant) assignments[t.id] = { crossPlant: true, flaggedForReview: true, note: `Home plant ${tech.plantId} ≠ task plant ${t.plant}`, decidedAt: new Date().toISOString() };
  else delete assignments[t.id];
  return { task: t, assignments };
}
function taskSave(data, { task, crossPlant }) {
  const { task: t, assignments } = normalizeTask(data, task, crossPlant);
  const exists = data.tasks.some((x) => x.id === t.id);
  const tasks = exists ? data.tasks.map((x) => (x.id === t.id ? t : x)) : [...data.tasks, t];
  return { changes: { tasks, assignments }, desc: `${exists ? 'Edit' : 'Add'} task "${t.name}"`, newId: t.id };
}
function taskPatch(data, { id, patch }) {
  const old = data.tasks.find((t) => t.id === id);
  if (!old) return null;
  const next = { ...old, ...patch };
  if (patch.startDate !== undefined || patch.endDate !== undefined) next.followsMilestone = false;
  return { changes: { tasks: data.tasks.map((t) => (t.id === id ? next : t)) }, desc: `Update task "${old.name}"` };
}
function taskDelete(data, { id }) {
  const old = data.tasks.find((t) => t.id === id);
  if (!old) return null;
  const assignments = { ...data.assignments };
  delete assignments[id];
  return { changes: { tasks: data.tasks.filter((t) => t.id !== id), assignments }, desc: `Delete task "${old.name}"` };
}
function taskDuplicate(data, { id }) {
  const old = data.tasks.find((t) => t.id === id);
  if (!old) return null;
  const copy = { ...old, id: uid('T'), name: `${old.name} (copy)`, technicianId: null, status: 'NOT_STARTED', actualMinutes: 0, origin: 'user', needsReview: false };
  return { changes: { tasks: [...data.tasks, copy] }, desc: `Duplicate task "${old.name}"` };
}
function taskAssign(data, { id, technicianId, crossPlant }) {
  const old = data.tasks.find((t) => t.id === id);
  if (!old) return null;
  const tech = data.organization.people.find((p) => p.id === technicianId);
  const { task: t, assignments } = normalizeTask(data, { ...old, technicianId: technicianId || null }, crossPlant);
  return {
    changes: { tasks: data.tasks.map((x) => (x.id === id ? t : x)), assignments },
    desc: technicianId ? `Assign task "${old.name}" → ${tech?.name || tech?.label || technicianId}` : `Unassign task "${old.name}"`,
  };
}
function taskReschedule(data, { id, startDate, endDate, technicianId, crossPlant }) {
  const old = data.tasks.find((t) => t.id === id);
  if (!old) return null;
  const { task: t, assignments } = normalizeTask(data, { ...old, startDate, endDate, followsMilestone: false, technicianId: technicianId === undefined ? old.technicianId : technicianId }, crossPlant ?? !!data.assignments[id]);
  return { changes: { tasks: data.tasks.map((x) => (x.id === id ? t : x)), assignments }, desc: `Reschedule task "${old.name}" → ${startDate}…${endDate}` };
}
function demoLoad(data) {
  const kept = data.tasks.filter((t) => t.origin !== 'demo');
  const keptAssign = Object.fromEntries(Object.entries(data.assignments).filter(([, a]) => a?.origin !== 'demo'));
  const { tasks, assignments } = generateDemoTasks(data);
  return { changes: { tasks: [...kept, ...tasks], assignments: { ...keptAssign, ...assignments } }, desc: `Load illustrative demo tasks (${tasks.length})` };
}
function demoClear(data) {
  const ids = new Set(data.tasks.filter((t) => t.origin === 'demo').map((t) => t.id));
  return {
    changes: { tasks: data.tasks.filter((t) => t.origin !== 'demo'), assignments: Object.fromEntries(Object.entries(data.assignments).filter(([k, a]) => !ids.has(k) && a?.origin !== 'demo')) },
    desc: `Clear demo data (${ids.size} tasks)`,
  };
}

// ---------- Organization ----------
function personAdd(data, { plantId, name }) {
  const org = data.organization;
  const same = org.people.filter((p) => isTechnician(p) && p.plantId === plantId);
  let n = same.length + 1;
  while (org.people.some((p) => p.id === `TECH-${plantId}-${String(n).padStart(2, '0')}`)) n += 1;
  const resp = org.people.find((p) => p.role === 'CAD_RESPONSIBLE' && p.plantId === plantId && String(p.positionStatus).toUpperCase() !== 'TBC');
  const row = {
    id: `TECH-${plantId}-${String(n).padStart(2, '0')}`, role: 'CAD_TECHNICIAN', plantId, name: name?.trim() || null, label: `CAD Technician ${n} – ${plantId}`,
    reportsTo: same.find((p) => p.reportsTo)?.reportsTo ?? resp?.id ?? null, positionStatus: 'Confirmed by coordinator', weeklyCapacityHours: null, capacityOverride: null, skills: [], origin: 'user',
  };
  return { changes: { organization: { ...org, people: [...org.people, row] } }, desc: `Add technician slot "${row.label}"` };
}
function personUpdate(data, { id, patch }) {
  const org = data.organization;
  const old = org.people.find((p) => p.id === id);
  if (!old) return null;
  const next = { ...old, ...patch };
  if (next.name !== undefined && typeof next.name === 'string') next.name = next.name.trim() || null;
  const changes = { organization: { ...org, people: org.people.map((p) => (p.id === id ? next : p)) } };
  // Moving a technician to another plant: keep tasks, but cross-plant flags must be re-evaluated explicitly.
  return { changes, desc: `Edit ${old.role === 'CAD_TECHNICIAN' ? 'technician' : 'position'} "${old.name || old.label || old.id}"` };
}
function personDelete(data, { id }) {
  const org = data.organization;
  const old = org.people.find((p) => p.id === id);
  if (!old || !isTechnician(old)) return null;
  const affected = new Set(data.tasks.filter((t) => t.technicianId === id).map((t) => t.id));
  const assignments = Object.fromEntries(Object.entries(data.assignments).filter(([k]) => !affected.has(k)));
  return {
    changes: { organization: { ...org, people: org.people.filter((p) => p.id !== id) }, tasks: data.tasks.map((t) => (t.technicianId === id ? { ...t, technicianId: null } : t)), assignments },
    desc: `Remove technician "${old.name || old.label}" (${affected.size} tasks unassigned)`,
  };
}
function settingsUpdate(data, { patch }) {
  return { changes: { settings: { ...data.settings, ...patch, thresholds: { ...data.settings.thresholds, ...(patch.thresholds ?? {}) } } }, desc: 'Update settings', skipHistory: true };
}

const OPS = {
  BU_ADD: buAdd, BU_UPDATE: buUpdate, BU_DELETE: buDelete,
  LINE_ADD: lineAdd, LINE_UPDATE: lineUpdate, LINE_DUPLICATE: lineDuplicate, LINE_DELETE: lineDelete,
  MS_ADD: msAdd, MS_UPDATE: msUpdate, MS_DELETE: msDelete, PLAN_REPLACE: planReplace,
  PLAN_RESET: (data) => planReplace(data, { plan: seedValue('milestones'), desc: 'Reset milestone plan to source data' }),
  TASK_SAVE: taskSave, TASK_PATCH: taskPatch, TASK_DELETE: taskDelete, TASK_DUPLICATE: taskDuplicate, TASK_ASSIGN: taskAssign, TASK_RESCHEDULE: taskReschedule,
  DEMO_LOAD: demoLoad, DEMO_CLEAR: demoClear,
  PERSON_ADD: personAdd, PERSON_UPDATE: personUpdate, PERSON_DELETE: personDelete,
  ORG_RESET: (data) => {
    const org = seedValue('organization');
    const ids = new Set(org.people.map((p) => p.id));
    const lost = new Set(data.tasks.filter((t) => t.technicianId && !ids.has(t.technicianId)).map((t) => t.id));
    return {
      changes: { organization: org, tasks: data.tasks.map((t) => (lost.has(t.id) ? { ...t, technicianId: null } : t)), assignments: Object.fromEntries(Object.entries(data.assignments).filter(([k]) => !lost.has(k))) },
      desc: 'Reset organization to source data',
    };
  },
  SETTINGS_UPDATE: settingsUpdate,
};

export function applyOp(data, action) {
  const fn = OPS[action.type];
  return fn ? fn(data, action) : null;
}
export const impactOfMilestone = (data, ids) => countTasks(data, new Set(ids));
