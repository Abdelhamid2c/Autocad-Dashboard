// Action creators. Descriptions for the edit log are produced by the operations themselves.
export const A = {
  buAdd: (bu) => ({ type: 'BU_ADD', bu }),
  buUpdate: (id, patch) => ({ type: 'BU_UPDATE', id, patch }),
  buDelete: (id, taskMode = 'orphan') => ({ type: 'BU_DELETE', id, taskMode }),

  lineAdd: (line) => ({ type: 'LINE_ADD', line }),
  lineUpdate: (id, patch) => ({ type: 'LINE_UPDATE', id, patch }),
  lineDuplicate: (id) => ({ type: 'LINE_DUPLICATE', id }),
  lineDelete: (id, taskMode = 'orphan') => ({ type: 'LINE_DELETE', id, taskMode }),

  msAdd: (lineId, ms) => ({ type: 'MS_ADD', lineId, ms }),
  msUpdate: (id, patch) => ({ type: 'MS_UPDATE', id, patch }),
  msDelete: (id, taskMode = 'orphan') => ({ type: 'MS_DELETE', id, taskMode }),
  planReplace: (plan, desc) => ({ type: 'PLAN_REPLACE', plan, desc }),
  planReset: () => ({ type: 'PLAN_RESET' }),

  taskSave: (task, crossPlant = false) => ({ type: 'TASK_SAVE', task, crossPlant }),
  taskPatch: (id, patch) => ({ type: 'TASK_PATCH', id, patch }),
  taskDelete: (id) => ({ type: 'TASK_DELETE', id }),
  taskDuplicate: (id) => ({ type: 'TASK_DUPLICATE', id }),
  taskAssign: (id, technicianId, crossPlant = false) => ({ type: 'TASK_ASSIGN', id, technicianId, crossPlant }),
  taskReschedule: (id, startDate, endDate, technicianId, crossPlant) => ({ type: 'TASK_RESCHEDULE', id, startDate, endDate, technicianId, crossPlant }),
  demoLoad: () => ({ type: 'DEMO_LOAD' }),
  demoClear: () => ({ type: 'DEMO_CLEAR' }),

  personAdd: (plantId, name) => ({ type: 'PERSON_ADD', plantId, name }),
  personUpdate: (id, patch) => ({ type: 'PERSON_UPDATE', id, patch }),
  personDelete: (id) => ({ type: 'PERSON_DELETE', id }),
  orgReset: () => ({ type: 'ORG_RESET' }),

  settingsUpdate: (patch) => ({ type: 'SETTINGS_UPDATE', patch }),

  undo: () => ({ type: 'UNDO' }),
  redo: () => ({ type: 'REDO' }),
  importAll: (data) => ({ type: 'IMPORT_ALL', data }),
  resetAll: () => ({ type: 'RESET_ALL' }),
  ui: (patch) => ({ type: 'UI', patch }),
};
