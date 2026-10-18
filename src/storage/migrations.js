import { DEFAULT_SETTINGS } from '../utils/capacityCalculations.js';

export const CURRENT_SCHEMA = 1;

/** Each entry upgrades stored data from version N to N+1. Add new steps here when the schema changes. */
const steps = {
  // 1: (key, data) => data,   // example: upgrade v1 → v2
};

export function migrate(key, envelope) {
  let version = envelope?.schemaVersion ?? 1;
  let data = envelope?.data ?? null;
  while (version < CURRENT_SCHEMA) {
    const step = steps[version];
    if (step) data = step(key, data);
    version += 1;
  }
  return normalize(key, data);
}

/** Cheap structural guards so a partially stored value never crashes the UI. */
function normalize(key, data) {
  switch (key) {
    case 'settings':
      return { ...DEFAULT_SETTINGS, ...(data ?? {}), thresholds: { ...DEFAULT_SETTINGS.thresholds, ...(data?.thresholds ?? {}) } };
    case 'tasks':
    case 'editLog':
      return Array.isArray(data) ? data : [];
    case 'assignments':
      return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    case 'milestones':
      return data && Array.isArray(data.projectLines) && Array.isArray(data.businessUnits) && data.meta ? data : null;
    case 'organization':
      return data && Array.isArray(data.people) && Array.isArray(data.plants) ? data : null;
    default:
      return data;
  }
}
