import { pad } from './weekCalendar.js';

const UNKNOWN = (raw, status) => ({ raw, year: null, month: null, precision: 'unknown', status });

/** Parses user input: "06/2028", "2028-06", "2028", "TBC" or empty. Returns null when the text is not understood. */
export function parseEop(input, status = 'User') {
  const s = String(input ?? '').trim();
  if (!s) return UNKNOWN(null, 'Data Required');
  if (/^tbc$/i.test(s)) return UNKNOWN('TBC', 'TBC');
  let m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m && +m[1] >= 1 && +m[1] <= 12) return { raw: `${pad(+m[1])}/${m[2]}`, year: +m[2], month: +m[1], precision: 'month', status };
  m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return { raw: `${pad(+m[2])}/${m[1]}`, year: +m[1], month: +m[2], precision: 'month', status };
  m = s.match(/^(\d{4})$/);
  if (m) return { raw: m[1], year: +m[1], month: null, precision: 'year', status };
  return null;
}

export function formatEop(eop) {
  if (!eop) return 'Data Required';
  if (eop.year && eop.month) return `${pad(eop.month)}/${eop.year}`;
  if (eop.year) return String(eop.year);
  return eop.status === 'TBC' || eop.raw === 'TBC' ? 'TBC' : 'Data Required';
}

/** Last day (ISO) covered by the EOP: end of month, or 31 Dec for a year-only EOP. */
export function eopEndDate(eop) {
  if (!eop?.year) return null;
  const month = eop.month ?? 12;
  const last = new Date(Date.UTC(eop.year, month, 0)).getUTCDate();
  return `${eop.year}-${pad(month)}-${pad(last)}`;
}
export function eopInputValue(eop) {
  if (eop?.year && eop?.month) return `${eop.year}-${pad(eop.month)}`;
  return '';
}
