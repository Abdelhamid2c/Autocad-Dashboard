import { eopEndDate } from './eop.js';
import { PLAN_YEAR, weekEnd, weekRangeText, weekStart } from './weekCalendar.js';

export function normalizeWeeks(start, end) {
  return { startWeek: Number(start), endWeek: Number(end) };
}

/** Hard errors: the milestone cannot be saved. */
export function validateWeeks(startWeek, endWeek) {
  const errors = [];
  const ok = (n) => Number.isInteger(n) && n >= 1 && n <= 52;
  if (!ok(startWeek)) errors.push('Start week must be a whole number between 1 and 52.');
  if (!ok(endWeek)) errors.push('End week must be a whole number between 1 and 52.');
  if (ok(startWeek) && ok(endWeek) && startWeek > endWeek) errors.push('Start week must be ≤ end week.');
  return errors;
}

export function overlaps(a, b) {
  return a.startWeek <= b.endWeek && b.startWeek <= a.endWeek;
}

/** Ids of milestones on the line overlapping another milestone of the same line. */
export function overlappingIds(line) {
  const ids = new Set();
  const ms = line.milestones ?? [];
  for (let i = 0; i < ms.length; i++) {
    for (let j = i + 1; j < ms.length; j++) {
      if (overlaps(ms[i], ms[j])) {
        ids.add(ms[i].id);
        ids.add(ms[j].id);
      }
    }
  }
  return ids;
}

/** Soft warnings: allowed but flagged. `draft` is {id?, type, startWeek, endWeek}. */
export function milestoneWarnings(line, draft, year = PLAN_YEAR) {
  const warnings = [];
  const others = (line.milestones ?? []).filter((m) => m.id !== draft.id);
  const clash = others.filter((m) => overlaps(m, draft));
  if (clash.length) warnings.push(`Overlaps with ${clash.map((m) => `"${m.label}"`).join(', ')} on this line.`);
  if (!validateWeeks(draft.startWeek, draft.endWeek).length) {
    const endDate = weekEnd(draft.endWeek, year);
    const eopEnd = eopEndDate(line.eop);
    if (draft.type === 'EOP' && eopEnd && endDate > eopEnd) {
      warnings.push(`EOP milestone (${weekRangeText(draft.endWeek)}) falls after the line's EOP date (${line.eop.raw ?? eopEnd}).`);
    }
    if (line.eop?.year && line.eop.year < year) {
      warnings.push(`Line EOP year (${line.eop.year}) is earlier than the milestone year (${year}).`);
    }
  }
  return warnings;
}

/** All plan-integrity warnings of a line (used by planner badges and the data-quality panel). */
export function lineWarnings(line, year = PLAN_YEAR) {
  const out = [];
  for (const m of line.milestones ?? []) {
    for (const w of milestoneWarnings(line, m, year)) out.push({ milestoneId: m.id, text: `${m.label}: ${w}` });
  }
  return out;
}

export function milestoneDates(startWeek, endWeek, year = PLAN_YEAR) {
  return { startDate: weekStart(startWeek, year), endDate: weekEnd(endWeek, year) };
}
