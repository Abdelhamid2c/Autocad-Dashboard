import { CATEGORIES, WORK_CLASSES } from './milestoneStyle.js';

/**
 * Reference task/time matrix (hours). Work class = Category 1–5; sub-category = line category (SMALLS, UMS, Mega).
 * A number applies to every sub-category; an array is [SMALLS, UMS, Mega].
 */
const [ECO_SIMPLE, ECO_COMPLEX, MY_SIMPLE, MY_COMPLEX, FIRST_OT] = WORK_CLASSES;

export const MATRIX_TASKS = [
  { key: 'T1', no: 1, name: 'Receive board layouts from PTC and print drawings ( Jig & CCB )', hours: { [FIRST_OT]: [3, 5, 8] } },
  { key: 'T2', no: 2, name: 'Review quality reports, implement corrections, and print updated layouts ( Jig & CCB )', hours: { [FIRST_OT]: [2, 3, 4] } },
  { key: 'T3', no: 3, name: 'Create Visual Inspection documentation based on physical cable routing ( VI )', hours: { [FIRST_OT]: [16, 40, 64] } },
  { key: 'T4', no: 4, name: 'Review quality reports, implement corrections, and print updated layouts ( VI )', hours: { [FIRST_OT]: [8, 16, 32] } },
  { key: 'T5', no: 5, name: 'Implement ergonomic-related corrections ( Jig & CCB & VI )', hours: { [MY_COMPLEX]: [8, 16, 32] } },
  { key: 'T6', no: 6, name: 'Final review quality reports, validation, and printing of corrected layouts ( Jig & CCB & VI )', hours: { [MY_COMPLEX]: [4, 8, 16] } },
  { key: 'T7', no: 7, name: 'ECOs Change ( Simple & Complex ) / Jig, CCB, VI', hours: { [ECO_SIMPLE]: 2, [ECO_COMPLEX]: 3 } },
  { key: 'T8', no: 8, name: 'Review quality reports, implement corrections, and print updated layouts ( Jig & CCB & VI )', hours: { [ECO_SIMPLE]: 2, [ECO_COMPLEX]: 2 } },
  { key: 'T9', no: 9, name: 'MY Change ( Simple & Complex ) / Jig, CCB, VI', hours: { [MY_SIMPLE]: [2, 4, 6], [MY_COMPLEX]: [3, 8, 16] } },
  { key: 'T10', no: 10, name: 'Review quality reports, implement corrections, and print updated layouts ( Jig & CCB & VI )', hours: { [MY_SIMPLE]: [1, 2, 3], [MY_COMPLEX]: [2, 4, 8] } },
];

export const classNeedsSize = (workClass) => MATRIX_TASKS.some((t) => Array.isArray(t.hours[workClass]));

/**
 * Tasks the matrix defines for a work class and sub-category.
 * Returns [] when no work class is set, and null when the sub-category is required but missing.
 */
export function matrixTasksFor(workClass, size) {
  if (!workClass || !WORK_CLASSES.includes(workClass)) return [];
  const idx = CATEGORIES.indexOf(size);
  if (classNeedsSize(workClass) && idx < 0) return null;
  const label = classNeedsSize(workClass) ? `${workClass} / ${size}` : workClass;
  return MATRIX_TASKS.flatMap((t) => {
    const h = t.hours[workClass];
    if (h === undefined) return [];
    const hours = Array.isArray(h) ? h[idx] : h;
    return [{ key: t.key, name: t.name, description: `Matrix Task ${t.no} — ${label}`, hours, minutes: Math.round(hours * 60), size: classNeedsSize(workClass) ? size : null }];
  });
}
