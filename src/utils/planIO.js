import { parseCSV, toCSV } from './csv.js';
import { formatEop, parseEop } from './eop.js';
import { uid } from './ids.js';
import { MILESTONE_TYPES } from './milestoneStyle.js';
import { milestoneDates, validateWeeks } from './planValidation.js';

export const CSV_HEADERS = ['BU', 'Project', 'EOP', 'Plant', 'Milestone', 'Type', 'Start Week', 'End Week', 'Start Date', 'End Date', 'Line ID', 'Milestone ID'];

export function exportPlanJSON(plan) {
  return JSON.stringify({ meta: plan.meta, businessUnits: plan.businessUnits, projectLines: plan.projectLines }, null, 2);
}

export function exportPlanCSV(plan) {
  const rows = [];
  for (const l of plan.projectLines) {
    const base = { BU: l.bu, Project: l.project, EOP: formatEop(l.eop), Plant: l.plant ?? 'TBC', 'Line ID': l.id };
    if (!l.milestones.length) rows.push(base);
    for (const m of l.milestones) {
      rows.push({
        ...base,
        Milestone: m.label,
        Type: m.type,
        'Start Week': m.startWeek,
        'End Week': m.endWeek,
        'Start Date': m.startDate,
        'End Date': m.endDate,
        'Milestone ID': m.id,
      });
    }
  }
  return toCSV(CSV_HEADERS, rows);
}

function normPlant(p) {
  const v = String(p ?? '').trim().toUpperCase();
  return !v || v === 'TBC' ? null : v;
}

function finalize(plan, current, tasks, errors, warnings) {
  const buNames = new Set(plan.businessUnits.map((b) => b.name));
  for (const l of plan.projectLines) {
    if (!buNames.has(l.bu)) {
      plan.businessUnits.push({ id: uid('BU'), name: l.bu, plantGroup: l.plantGroup ?? '', plant: null, origin: 'user' });
      buNames.add(l.bu);
    }
  }
  const curLines = new Map(current.projectLines.map((l) => [l.id, l]));
  const newLines = new Map(plan.projectLines.map((l) => [l.id, l]));
  const curMs = new Set(current.projectLines.flatMap((l) => l.milestones.map((m) => m.id)));
  const newMs = new Set(plan.projectLines.flatMap((l) => l.milestones.map((m) => m.id)));
  const orphaned = tasks.filter((t) => t.milestoneId && !newMs.has(t.milestoneId));
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    plan,
    summary: {
      linesAdded: [...newLines.keys()].filter((id) => !curLines.has(id)).length,
      linesRemoved: [...curLines.keys()].filter((id) => !newLines.has(id)).length,
      linesKept: [...newLines.keys()].filter((id) => curLines.has(id)).length,
      milestonesAdded: [...newMs].filter((id) => !curMs.has(id)).length,
      milestonesRemoved: [...curMs].filter((id) => !newMs.has(id)).length,
      businessUnits: plan.businessUnits.length,
      orphanedTasks: orphaned.length,
    },
  };
}

function normalizeMilestone(m, ctx, errors) {
  const startWeek = Number(m.startWeek);
  const endWeek = Number(m.endWeek ?? m.startWeek);
  const errs = validateWeeks(startWeek, endWeek);
  if (errs.length) {
    errors.push(`${ctx}: ${errs.join(' ')}`);
    return null;
  }
  const type = MILESTONE_TYPES.includes(m.type) ? m.type : 'OTHER';
  return { ...m, id: m.id || uid('M'), label: m.label ?? '', type, startWeek, endWeek, ...milestoneDates(startWeek, endWeek), origin: m.origin || 'user' };
}

export function parsePlanImport(text, filename, current, tasks) {
  const errors = [];
  const warnings = [];
  const isCsv = /\.csv$/i.test(filename) || !/^\s*[{[]/.test(text);
  try {
    if (!isCsv) {
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.projectLines)) throw new Error('JSON must contain a "projectLines" array.');
      const plan = { meta: current.meta, businessUnits: Array.isArray(data.businessUnits) ? data.businessUnits.map((b) => ({ origin: 'user', plant: null, plantGroup: '', ...b, id: b.id || uid('BU') })) : [], projectLines: [] };
      data.projectLines.forEach((l, i) => {
        const ctx = `Line ${i + 1} (${l.project ?? '?'})`;
        if (!l.bu || !l.project) {
          errors.push(`${ctx}: "bu" and "project" are required.`);
          return;
        }
        const eop = l.eop && typeof l.eop === 'object' ? l.eop : parseEop(l.eop) ?? parseEop(null);
        const milestones = (l.milestones ?? []).map((m) => normalizeMilestone(m, `${ctx} / ${m.label ?? '?'}`, errors)).filter(Boolean);
        plan.projectLines.push({ ...l, id: l.id || uid('LINE'), plantGroup: l.plantGroup ?? '', plant: normPlant(l.plant), eop, milestones, origin: l.origin || 'user' });
      });
      return finalize(plan, current, tasks, errors, warnings);
    }
    const rows = parseCSV(text);
    if (!rows.length) throw new Error('CSV is empty.');
    for (const h of ['BU', 'Project']) if (!(h in rows[0])) throw new Error(`Missing CSV column "${h}".`);
    const buByName = new Map(current.businessUnits.map((b) => [b.name, b]));
    const lines = new Map();
    const usedMs = new Set();
    rows.forEach((r, i) => {
      const ctx = `CSV row ${i + 2}`;
      if (!r.BU || !r.Project) {
        errors.push(`${ctx}: BU and Project are required.`);
        return;
      }
      const key = r['Line ID'] || `${r.BU}|${r.Project}|${r.EOP}|${r.Plant}`;
      if (!lines.has(key)) {
        const eop = parseEop(r.EOP, 'User') ?? (warnings.push(`${ctx}: EOP "${r.EOP}" not understood, set to TBC.`), parseEop('TBC'));
        const bu = buByName.get(r.BU);
        lines.set(key, { id: r['Line ID'] || uid('LINE'), sourceRow: null, bu: r.BU, project: r.Project, plantGroup: bu?.plantGroup ?? '', plant: normPlant(r.Plant), eop, milestones: [], origin: 'user' });
      }
      if (r['Start Week'] || r.Milestone) {
        const id = r['Milestone ID'] && !usedMs.has(r['Milestone ID']) ? r['Milestone ID'] : uid('M');
        usedMs.add(id);
        const m = normalizeMilestone({ id, label: r.Milestone, type: (r.Type || 'OTHER').toUpperCase(), startWeek: r['Start Week'], endWeek: r['End Week'] || r['Start Week'] }, ctx, errors);
        if (m) lines.get(key).milestones.push(m);
      }
    });
    const plan = { meta: current.meta, businessUnits: current.businessUnits.map((b) => ({ ...b })), projectLines: [...lines.values()] };
    return finalize(plan, current, tasks, errors, warnings);
  } catch (e) {
    return { ok: false, errors: [e.message], warnings, plan: null, summary: null };
  }
}
