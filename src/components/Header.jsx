import { Menu, Monitor, Pencil } from 'lucide-react';
import { A } from '../state/actions.js';
import { useStore } from '../state/store.jsx';
import { formatDate, weekLabel } from '../utils/weekCalendar.js';
import { NAV } from './Sidebar.jsx';

export default function Header({ page, onMenu }) {
  const { ui, model, data, presentation, dispatch } = useStore();
  const title = NAV.find((n) => n.id === page)?.label ?? '';
  const hasDemo = data.tasks.some((t) => t.origin === 'demo');
  const time = ui.savedAt ? new Date(ui.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <header className="header">
      <button className="btn icon menu-btn" onClick={onMenu} aria-label="Menu"><Menu size={16} /></button>
      <div className="title">{title}</div>
      {hasDemo && <span className="ribbon" title="Illustrative tasks are loaded; they are not real data">DEMO DATA</span>}
      <span className="muted small" title="Reference date used for 'upcoming', 'overdue' and the dashboard horizon (Settings & Data)">
        Reference: {weekLabel(model.refWeek)} · {formatDate(model.refDate)}
      </span>
      <span className="muted small">{ui.storagePersistent === false ? <b style={{ color: 'var(--warn)' }}>Not saved to browser</b> : time ? `Saved locally · ${time}` : 'Loaded'}</span>
      <button className={`btn sm${presentation ? ' primary' : ''}`} onClick={() => dispatch(A.ui({ presentation: !presentation }))} title="Hide editing controls and enlarge KPIs for a projector">
        {presentation ? <Pencil size={14} /> : <Monitor size={14} />} {presentation ? 'Exit presentation' : 'Presentation mode'}
      </button>
    </header>
  );
}
