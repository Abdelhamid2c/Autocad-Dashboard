// ISO-8601 week helpers. Assumption (stated in the UI): W01 of 2027 = Monday 2027-01-04.
// All dates are 'YYYY-MM-DD' strings handled in UTC to avoid timezone drift.
const DAY = 86400000;
export const PLAN_YEAR = 2027;
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WD_CODES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export const pad = (n) => String(n).padStart(2, '0');

export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function toISO(dt) {
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
export function addDays(iso, n) {
  return toISO(new Date(parseISO(iso).getTime() + n * DAY));
}
export function diffDays(a, b) {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / DAY);
}
/** 0 = Monday … 6 = Sunday */
export function weekdayIndex(iso) {
  return (parseISO(iso).getUTCDay() + 6) % 7;
}
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function week1Monday(year = PLAN_YEAR) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dow = (jan4.getUTCDay() + 6) % 7;
  return toISO(new Date(jan4.getTime() - dow * DAY));
}
export const weekStart = (w, year = PLAN_YEAR) => addDays(week1Monday(year), (w - 1) * 7);
export const weekEnd = (w, year = PLAN_YEAR) => addDays(weekStart(w, year), 4); // Friday
export const weekLabel = (w) => `W${pad(w)}`;

/** Week number (1–52) of a date within the plan year, or null when outside. */
export function weekOfDate(iso, year = PLAN_YEAR) {
  const w = Math.floor(diffDays(week1Monday(year), iso) / 7) + 1;
  return w >= 1 && w <= 52 ? w : null;
}
/** Same but clamped to 1..52 (useful for drawing bars that start before/after the year). */
export function clampWeekOfDate(iso, year = PLAN_YEAR) {
  const w = Math.floor(diffDays(week1Monday(year), iso) / 7) + 1;
  return Math.min(52, Math.max(1, w));
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = parseISO(iso);
  return `${DAY_NAMES[weekdayIndex(iso)]} ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function formatShort(iso) {
  if (!iso) return '—';
  const d = parseISO(iso);
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}`;
}
/** e.g. "W15 → Mon 12 Apr 2027" */
export function weekRangeText(w) {
  if (!Number.isInteger(w) || w < 1 || w > 52) return '—';
  return `${weekLabel(w)} → ${formatDate(weekStart(w))}`;
}
export function weekSpanText(s, e) {
  if (s === e) return weekLabel(s);
  return `${weekLabel(s)}–${weekLabel(e)}`;
}

export function dateRange(startISO, endISO) {
  const out = [];
  if (!startISO || !endISO || startISO > endISO) return out;
  for (let d = startISO; d <= endISO; d = addDays(d, 1)) out.push(d);
  return out;
}

export function workingDayIndexes(settings) {
  const codes = settings?.workingDays ?? ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  return codes.map((c) => WD_CODES.indexOf(c)).filter((i) => i >= 0);
}
export function isWorkingDay(iso, settings) {
  return workingDayIndexes(settings).includes(weekdayIndex(iso));
}
export function workingDaysBetween(startISO, endISO, settings) {
  const idx = workingDayIndexes(settings);
  return dateRange(startISO, endISO).filter((d) => idx.includes(weekdayIndex(d)));
}
export function workingDaysOfWeek(w, settings, year = PLAN_YEAR) {
  return workingDaysBetween(weekStart(w, year), addDays(weekStart(w, year), 6), settings);
}

/** Reference date: user setting, else today when inside the plan year, else first Monday of the plan year. */
export function getReferenceDate(settings, year = PLAN_YEAR) {
  const ref = settings?.referenceDate;
  if (ref && /^\d{4}-\d{2}-\d{2}$/.test(ref)) return ref;
  const t = todayISO();
  return weekOfDate(t, year) ? t : week1Monday(year);
}
export function monthOfWeek(w, months) {
  const m = months?.find((x) => w >= x.startWeek && w <= x.endWeek);
  return m ? m.month : null;
}
