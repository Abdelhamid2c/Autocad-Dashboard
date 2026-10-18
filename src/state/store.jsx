import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { KEYS, repository } from '../storage/repository.js';
import { loadInitialData, seedValue } from '../storage/seed.js';
import { uid } from '../utils/ids.js';
import { computeModel } from '../utils/workloadAggregation.js';
import { A } from './actions.js';
import { applyOp } from './planOps.js';

const HISTORY_MAX = 20;
const LOG_MAX = 300;
const snap = (d) => ({ milestones: d.milestones, tasks: d.tasks, assignments: d.assignments, organization: d.organization });
const withLog = (log, desc) => [{ id: uid('log'), ts: new Date().toISOString(), desc }, ...log].slice(0, LOG_MAX);

function init() {
  const { data, status } = loadInitialData();
  return { data, past: [], future: [], ui: { presentation: false, toast: null, savedAt: status.lastSavedAt, storageProblems: status.problems, storagePersistent: status.persistent } };
}

function reducer(state, action) {
  switch (action.type) {
    case 'UI':
      return { ...state, ui: { ...state.ui, ...action.patch } };
    case 'UNDO': {
      const prev = state.past[state.past.length - 1];
      if (!prev) return state;
      return {
        ...state,
        data: { ...state.data, ...prev.snap, editLog: withLog(state.data.editLog, `Undo: ${prev.desc}`) },
        past: state.past.slice(0, -1),
        future: [{ snap: snap(state.data), desc: prev.desc }, ...state.future],
      };
    }
    case 'REDO': {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...state,
        data: { ...state.data, ...next.snap, editLog: withLog(state.data.editLog, `Redo: ${next.desc}`) },
        past: [...state.past, { snap: snap(state.data), desc: next.desc }].slice(-HISTORY_MAX),
        future: state.future.slice(1),
      };
    }
    case 'IMPORT_ALL':
      return { ...state, data: { ...state.data, ...action.data, editLog: withLog(action.data.editLog ?? state.data.editLog, 'Imported backup') }, past: [], future: [] };
    case 'RESET_ALL': {
      const data = {};
      for (const k of KEYS) data[k] = seedValue(k);
      data.editLog = withLog([], 'Reset all data to source');
      return { ...state, data, past: [], future: [] };
    }
    default: {
      const res = applyOp(state.data, action);
      if (!res) return state;
      const data = { ...state.data, ...res.changes, editLog: withLog(state.data.editLog, res.desc) };
      if (res.skipHistory) return { ...state, data };
      return { ...state, data, past: [...state.past, { snap: snap(state.data), desc: res.desc }].slice(-HISTORY_MAX), future: [] };
    }
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);
  const saved = useRef(state.data);

  // Debounced auto-save through the repository layer.
  useEffect(() => {
    const t = setTimeout(() => {
      let wrote = false;
      for (const k of KEYS) {
        if (state.data[k] !== saved.current[k]) {
          repository.save(k, state.data[k]);
          saved.current = { ...saved.current, [k]: state.data[k] };
          wrote = true;
        }
      }
      if (wrote) {
        const st = repository.getStatus();
        dispatch(A.ui({ savedAt: st.lastSavedAt ?? new Date(), storageProblems: st.problems, storagePersistent: st.persistent }));
      }
    }, 400);
    return () => clearTimeout(t);
  }, [state.data]);

  useEffect(() => {
    if (!state.ui.toast) return undefined;
    const t = setTimeout(() => dispatch(A.ui({ toast: null })), 4500);
    return () => clearTimeout(t);
  }, [state.ui.toast]);

  const model = useMemo(() => computeModel(state.data), [state.data]);
  const notify = useCallback((msg, type = 'info') => dispatch(A.ui({ toast: { id: uid('t'), msg, type } })), []);

  const value = useMemo(
    () => ({
      state, data: state.data, model, ui: state.ui, dispatch, notify,
      presentation: state.ui.presentation,
      canUndo: state.past.length > 0, canRedo: state.future.length > 0,
      undoDesc: state.past[state.past.length - 1]?.desc, redoDesc: state.future[0]?.desc,
    }),
    [state, model, notify],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
