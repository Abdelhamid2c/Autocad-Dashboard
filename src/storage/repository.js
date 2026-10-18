import { CURRENT_SCHEMA, migrate } from './migrations.js';

export const KEYS = ['milestones', 'organization', 'tasks', 'assignments', 'settings', 'editLog'];
const PREFIX = 'cad.v1.';
const memory = new Map();
const status = { persistent: true, problems: [], lastSavedAt: null };

function ls() {
  try {
    const s = window.localStorage;
    s.setItem('__cad_probe', '1');
    s.removeItem('__cad_probe');
    return s;
  } catch {
    return null;
  }
}
function problem(msg, fatal = true) {
  if (fatal) status.persistent = false;
  if (!status.problems.includes(msg)) status.problems.push(msg);
}

/** Repository layer: the only place that touches localStorage (ready to be swapped for an API). */
export const repository = {
  getStatus: () => ({ ...status, problems: [...status.problems] }),

  load(key) {
    const s = ls();
    if (!s) {
      problem('localStorage is unavailable (private mode or blocked): changes are kept in memory only.');
      return memory.has(key) ? memory.get(key) : null;
    }
    const raw = s.getItem(PREFIX + key);
    if (raw == null) return memory.has(key) ? memory.get(key) : null;
    try {
      const value = migrate(key, JSON.parse(raw));
      if (value == null) throw new Error('invalid structure');
      return value;
    } catch {
      problem(`Stored data "${key}" is corrupted and was ignored; source data was restored for it.`, false);
      return null;
    }
  },

  save(key, value) {
    memory.set(key, value);
    const s = ls();
    if (!s) {
      problem('localStorage is unavailable: changes are kept in memory only.');
      return false;
    }
    try {
      s.setItem(PREFIX + key, JSON.stringify({ schemaVersion: CURRENT_SCHEMA, savedAt: new Date().toISOString(), data: value }));
      status.lastSavedAt = new Date();
      return true;
    } catch {
      problem('Could not write to localStorage (quota exceeded?): changes are kept in memory only. Export a backup.');
      return false;
    }
  },

  reset(key) {
    memory.delete(key);
    try {
      ls()?.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  },

  exportAll() {
    const data = {};
    for (const k of KEYS) {
      const v = repository.load(k);
      if (v != null) data[k] = v;
    }
    return { app: 'cad-workload-resource-management', schemaVersion: CURRENT_SCHEMA, exportedAt: new Date().toISOString(), data };
  },

  /** Validates and stores a backup. Returns the normalized data or throws. */
  importAll(backup) {
    if (!backup || typeof backup !== 'object' || !backup.data) throw new Error('Not a CAD backup file (missing "data").');
    const out = {};
    for (const k of KEYS) {
      if (backup.data[k] === undefined) continue;
      const v = migrate(k, { schemaVersion: backup.schemaVersion ?? 1, data: backup.data[k] });
      if (v == null) throw new Error(`Backup section "${k}" is invalid.`);
      out[k] = v;
    }
    if (!out.milestones || !out.organization) throw new Error('Backup must contain "milestones" and "organization".');
    for (const k of Object.keys(out)) repository.save(k, out[k]);
    return out;
  },
};
