import { isWorkingDay } from './weekCalendar.js';

export const DEFAULT_SETTINGS = {
  dailyHours: 8,
  workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  thresholds: { available: 70, moderate: 90, high: 100 },
  referenceDate: null,
  absences: [],
  horizonWeeks: 12,
  nearMilestoneWeeks: 4,
};

export const LOAD_STATUS = {
  available: { label: 'Available', color: '#2e9e5b', bg: '#e3f5ea' },
  moderate: { label: 'Moderate', color: '#2e75b6', bg: '#e1edf8' },
  high: { label: 'High', color: '#d98a00', bg: '#fdf0d5' },
  overloaded: { label: 'Overloaded', color: '#d0021b', bg: '#fde3e6' },
};

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export const weeklyCapacity = (settings) => settings.dailyHours * settings.workingDays.length;
export const remainingHours = (capacity, allocated) => capacity - allocated;
export function utilizationPct(allocated, capacity) {
  if (capacity > 0) return (allocated / capacity) * 100;
  return allocated > 0 ? 999 : 0;
}

/** Planning thresholds (configurable): <70 Available · 70–<90 Moderate · 90–100 High · >100 Overloaded */
export function loadStatus(pct, th = DEFAULT_SETTINGS.thresholds) {
  const p = round2(pct);
  if (p > th.high) return 'overloaded';
  if (p >= th.moderate) return 'high';
  if (p >= th.available) return 'moderate';
  return 'available';
}

export const isTechnician = (p) => p.role === 'CAD_TECHNICIAN';
/** A technician counts in capacity totals only when the position is confirmed. */
export function isConfirmed(p) {
  return isTechnician(p) && String(p.positionStatus ?? '').toUpperCase() !== 'TBC';
}
export const techName = (p) => (p ? p.name || p.label || p.id : '—');

export function techDailyCapacity(tech, settings) {
  if (tech?.capacityOverride != null && tech.capacityOverride !== '') {
    return Number(tech.capacityOverride) / Math.max(1, settings.workingDays.length);
  }
  return settings.dailyHours;
}
export const techWeeklyCapacity = (tech, settings) => techDailyCapacity(tech, settings) * settings.workingDays.length;

export function isAbsent(techId, iso, settings) {
  return (settings.absences ?? []).some((a) => a.technicianId === techId && iso >= a.from && iso <= a.to);
}
/** Capacity (h) of a technician on one date: 0 on non-working days and absences. */
export function capacityOn(tech, iso, settings) {
  if (!isWorkingDay(iso, settings)) return 0;
  if (isAbsent(tech.id, iso, settings)) return 0;
  return techDailyCapacity(tech, settings);
}

/** Reference example required by the brief: 22.5 h on a 40 h week → 17.5 h left, 56.25 %. */
export function selfTest() {
  const capacity = 40;
  const allocated = 22.5;
  const remaining = remainingHours(capacity, allocated);
  const utilization = utilizationPct(allocated, capacity);
  return { capacity, allocated, remaining, utilization, ok: remaining === 17.5 && utilization === 56.25 };
}

export const fmtH = (h) => `${round2(h)} h`;
export const fmtPct = (p) => (p >= 999 ? '>999 %' : `${round2(p)} %`);
