import milestonesSeed from '../data/milestones.json';
import organizationSeed from '../data/organization.json';
import { DEFAULT_SETTINGS } from '../utils/capacityCalculations.js';
import { KEYS, repository } from './repository.js';

const clone = (v) => JSON.parse(JSON.stringify(v));

export function seedValue(key) {
  switch (key) {
    case 'milestones':
      return clone(milestonesSeed);
    case 'organization':
      return clone(organizationSeed);
    case 'tasks':
      return [];
    case 'assignments':
      return {};
    case 'settings':
      return clone(DEFAULT_SETTINGS);
    case 'editLog':
      return [];
    default:
      return null;
  }
}

/** First load seeds from the JSON files; later loads read localStorage. Seed never overwrites stored data. */
export function loadInitialData() {
  const data = {};
  for (const key of KEYS) {
    let v = repository.load(key);
    if (v == null) {
      v = seedValue(key);
      repository.save(key, v);
    }
    data[key] = v;
  }
  return { data, status: repository.getStatus() };
}
