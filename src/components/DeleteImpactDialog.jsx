import { useState } from 'react';
import { Confirm } from './ui.jsx';

/** Deletion that touches milestones: if tasks exist, the coordinator chooses to delete them or keep them as orphans. */
export default function DeleteImpactDialog({ title, summary, taskCount, onConfirm, onCancel }) {
  const [mode, setMode] = useState('orphan');
  return (
    <Confirm title={title} danger confirmLabel="Delete" onCancel={onCancel} onConfirm={() => onConfirm(mode)}>
      {summary && <p>{summary}</p>}
      {taskCount > 0 ? (
        <div className="col">
          <p><b>{taskCount} task(s)</b> are attached to what you are deleting. What should happen to them?</p>
          <label className="row"><input type="radio" checked={mode === 'orphan'} onChange={() => setMode('orphan')} /> Keep them as “orphan – needs milestone” (they keep their hours and technician)</label>
          <label className="row"><input type="radio" checked={mode === 'delete'} onChange={() => setMode('delete')} /> Delete the tasks as well</label>
        </div>
      ) : (
        <p className="muted">No tasks are attached. This can be undone with Undo.</p>
      )}
    </Confirm>
  );
}
