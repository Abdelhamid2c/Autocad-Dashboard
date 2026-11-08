import { describe, expect, it } from 'vitest';
import milestones from '../data/milestones.json';
import organization from '../data/organization.json';
import { applyOp } from '../state/planOps.js';
import { DEFAULT_SETTINGS, loadStatus, remainingHours, selfTest, utilizationPct } from './capacityCalculations.js';
import { generateDemoTasks } from './demoData.js';
import { buildLoadIndex } from './scheduling.js';
import { dashboardStats, computeModel, techWeek } from './workloadAggregation.js';
import { validateWeeks, milestoneWarnings } from './planValidation.js';
import { parseEop } from './eop.js';
import { weekStart, weekEnd, weekOfDate, weekRangeText } from './weekCalendar.js';
import { classNeedsSize, matrixTasksFor } from './taskMatrix.js';
import { CATEGORIES, WORK_CLASSES } from './milestoneStyle.js';

const base = () => ({ milestones: structuredClone(milestones), organization: structuredClone(organization), tasks: [], assignments: {}, settings: structuredClone(DEFAULT_SETTINGS), editLog: [] });

describe('capacity engine', () => {
  it('reference example: 22.5 h of 40 h → 17.5 h left, 56.25 %', () => {
    expect(remainingHours(40, 22.5)).toBe(17.5);
    expect(utilizationPct(22.5, 40)).toBe(56.25);
    expect(selfTest().ok).toBe(true);
  });
  it('threshold classes: 28/40 = 70 % → moderate', () => {
    expect(loadStatus(utilizationPct(28, 40))).toBe('moderate');
    expect(loadStatus(69.9)).toBe('available');
    expect(loadStatus(90)).toBe('high');
    expect(loadStatus(100)).toBe('high');
    expect(loadStatus(100.1)).toBe('overloaded');
  });
  it('week helpers follow ISO: W01 2027 = Mon 2027-01-04', () => {
    expect(weekStart(1)).toBe('2027-01-04');
    expect(weekEnd(15)).toBe('2027-04-16');
    expect(weekOfDate('2027-12-31')).toBe(52);
    expect(weekRangeText(15)).toBe('W15 → Mon 12 Apr 2027');
  });
  it('spreads a 40 h task over one working week without counting weekends and counts it once', () => {
    const data = base();
    const task = { id: 't1', milestoneId: null, name: 'x', estimatedMinutes: 22.5 * 60, status: 'NOT_STARTED', startDate: '2027-01-04', endDate: '2027-01-10', technicianId: 'TECH-YMM1-01', plant: 'YMM1' };
    const idx = buildLoadIndex([task], data.settings, '2027-01-04');
    expect(idx.techDay['TECH-YMM1-01']['2027-01-09']).toBeUndefined();
    expect(idx.techWeek['TECH-YMM1-01'][1]).toBeCloseTo(22.5);
    const model = computeModel({ ...data, tasks: [task] });
    const s = techWeek(model, 'TECH-YMM1-01', 1);
    expect(s.capacity).toBe(40);
    expect(s.remaining).toBe(17.5);
    expect(s.util).toBe(56.25);
  });
  it('completed tasks stop consuming future capacity', () => {
    const data = base();
    const task = { id: 't1', name: 'x', estimatedMinutes: 600, status: 'COMPLETED', startDate: '2027-02-01', endDate: '2027-02-05', technicianId: 'TECH-YMM1-01' };
    const idx = buildLoadIndex([task], data.settings, '2027-01-04');
    expect(idx.techWeek['TECH-YMM1-01']).toBeUndefined();
  });
});

describe('plan rules', () => {
  it('validates weeks and EOP', () => {
    expect(validateWeeks(5, 3).length).toBe(1);
    expect(validateWeeks(0, 3).length).toBe(1);
    expect(validateWeeks(20, 22)).toEqual([]);
    expect(parseEop('06/2028').month).toBe(6);
    expect(parseEop('2028').precision).toBe('year');
    expect(parseEop('TBC').status).toBe('TBC');
  });
  it('flags an EOP milestone after the line EOP', () => {
    const line = { eop: parseEop('06/2027'), milestones: [] };
    expect(milestoneWarnings(line, { type: 'EOP', startWeek: 30, endWeek: 30 }).length).toBe(1);
    expect(milestoneWarnings(line, { type: 'EOP', startWeek: 25, endWeek: 25 }).length).toBe(0);
  });
  it('workflow A: add BU → line → SOP W20–W22; propagation flags dated tasks', () => {
    let data = base();
    const apply = (a) => { const r = applyOp(data, a); data = { ...data, ...r.changes }; };
    apply({ type: 'BU_ADD', bu: { name: 'Test BU', plantGroup: 'YMOK' } });
    apply({ type: 'LINE_ADD', line: { id: 'L1', bu: 'Test BU', project: 'P', eop: parseEop('06/2028'), plant: 'YMOK' } });
    apply({ type: 'MS_ADD', lineId: 'L1', ms: { id: 'M1', label: 'SOP', type: 'SOP', startWeek: 20, endWeek: 22 } });
    const m = data.milestones.projectLines.find((l) => l.id === 'L1').milestones[0];
    expect(m.startDate).toBe('2027-05-17');
    expect(m.endDate).toBe('2027-06-04');
    apply({ type: 'TASK_SAVE', task: { name: 'T', milestoneId: 'M1', estimatedMinutes: 360, status: 'NOT_STARTED', startDate: '2027-05-17', endDate: '2027-05-21', plant: 'YMOK' } });
    apply({ type: 'MS_UPDATE', id: 'M1', patch: { startWeek: 21, endWeek: 23 } });
    expect(data.tasks[0].needsReview).toBe(true);
    apply({ type: 'MS_DELETE', id: 'M1', taskMode: 'orphan' });
    expect(data.tasks[0].orphan).toBe(true);
    expect(data.tasks[0].milestoneId).toBe(null);
  });
});

describe('task matrix', () => {
  const setup = (category) => {
    let data = base();
    const apply = (a) => { const r = applyOp(data, a); data = { ...data, ...r.changes }; };
    apply({ type: 'BU_ADD', bu: { name: 'Test BU', plantGroup: 'YMOK' } });
    apply({ type: 'LINE_ADD', line: { id: 'L1', bu: 'Test BU', project: 'P', eop: parseEop('06/2028'), plant: 'YMOK', category } });
    return { apply, get: () => data };
  };
  const hours = (d) => d.tasks.reduce((s, t) => s + t.estimatedMinutes / 60, 0);

  it('matrix column totals match the reference sheet (353 h overall)', () => {
    let sum = 0;
    for (const wc of WORK_CLASSES) {
      for (const size of classNeedsSize(wc) ? CATEGORIES : [null]) {
        sum += matrixTasksFor(wc, size).reduce((s, t) => s + t.hours, 0);
      }
    }
    expect(sum).toBe(353);
    expect(matrixTasksFor('First OT', 'Mega').reduce((s, t) => s + t.hours, 0)).toBe(108);
    expect(matrixTasksFor('MY Complex & OTOP & Ergono', 'UMS').reduce((s, t) => s + t.hours, 0)).toBe(36);
    expect(matrixTasksFor('ECOs complex').reduce((s, t) => s + t.hours, 0)).toBe(5);
  });
  it('generates, updates without duplicates, and switches class', () => {
    const { apply, get } = setup('UMS');
    apply({ type: 'MS_ADD', lineId: 'L1', ms: { id: 'M1', label: 'SOP', type: 'SOP', startWeek: 20, endWeek: 22, workClass: 'First OT' } });
    expect(get().tasks.length).toBe(4);
    expect(hours(get())).toBe(64);
    apply({ type: 'MS_UPDATE', id: 'M1', patch: { label: 'SOP', workClass: 'First OT' } });
    expect(get().tasks.length).toBe(4);
    apply({ type: 'MS_UPDATE', id: 'M1', patch: { workClass: 'MY Simple' } });
    expect(get().tasks.map((t) => t.matrixKey).sort()).toEqual(['T10', 'T9']);
    expect(hours(get())).toBe(6);
    apply({ type: 'LINE_UPDATE', id: 'L1', patch: { category: 'Mega' } });
    expect(hours(get())).toBe(9);
    apply({ type: 'MS_UPDATE', id: 'M1', patch: { workClass: 'ECOs Simple' } });
    expect(hours(get())).toBe(4);
  });
  it('keeps started tasks as manual and does nothing when the sub-category is missing', () => {
    const { apply, get } = setup(null);
    apply({ type: 'MS_ADD', lineId: 'L1', ms: { id: 'M1', label: 'SOP', type: 'SOP', startWeek: 20, endWeek: 22, workClass: 'First OT' } });
    expect(get().tasks.length).toBe(0);
    apply({ type: 'MS_UPDATE', id: 'M1', patch: { workClass: 'ECOs complex' } });
    expect(hours(get())).toBe(5);
    const id = get().tasks[0].id;
    apply({ type: 'TASK_PATCH', id, patch: { status: 'IN_PROGRESS' } });
    apply({ type: 'MS_UPDATE', id: 'M1', patch: { workClass: null } });
    expect(get().tasks.length).toBe(1);
    expect(get().tasks[0].origin).toBe('user');
  });
});

describe('demo data', () => {
  it('generates demo tasks with origin demo and plausible load', () => {
    const data = base();
    const { tasks, assignments } = generateDemoTasks(data);
    expect(tasks.length).toBeGreaterThan(20);
    expect(tasks.every((t) => t.origin === 'demo')).toBe(true);
    const model = computeModel({ ...data, tasks, assignments });
    const st = dashboardStats(model, 52);
    expect(st.classes.overloaded).toBeGreaterThan(0);
    expect(st.unassigned).toBeGreaterThan(0);
    expect(st.capacity).toBe(13 * 40 * 52);
  });
});
