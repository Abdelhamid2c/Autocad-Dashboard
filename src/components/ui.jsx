import { X } from 'lucide-react';
import { useEffect } from 'react';
import { LOAD_STATUS, fmtPct } from '../utils/capacityCalculations.js';
import { TASK_STATUS } from '../utils/scheduling.js';
import { useStore } from '../state/store.jsx';

export function Modal({ title, onClose, children, footer, wide, xwide }) {
  useEffect(() => {
    const on = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal${wide ? ' wide' : ''}${xwide ? ' xwide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn icon ghost" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Confirm({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel, children }) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={(
        <>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </>
      )}
    >
      {message && <p>{message}</p>}
      {children}
    </Modal>
  );
}

export function OriginBadge({ origin }) {
  if (!origin) return null;
  return <span className={`badge origin-${origin}`} title={`Origin: ${origin}`}>{origin === 'demo' ? 'DEMO' : origin}</span>;
}

export function TaskStatusBadge({ status }) {
  const m = TASK_STATUS[status] ?? TASK_STATUS.NOT_STARTED;
  return <span className="badge" style={{ background: `${m.color}1f`, color: m.color }}>{m.label}</span>;
}

export function LoadBadge({ status, pct, hours }) {
  const m = LOAD_STATUS[status];
  return (
    <span className="badge" style={{ background: m.bg, color: m.color }}>
      {m.label}{pct != null ? ` · ${fmtPct(pct)}` : ''}{hours != null ? ` · ${hours}` : ''}
    </span>
  );
}

export function UtilBar({ pct, status, height = 8 }) {
  const m = LOAD_STATUS[status];
  return (
    <div className="utilbar" style={{ height }} title={fmtPct(pct)}>
      <div style={{ width: `${Math.min(100, pct)}%`, background: m.color }} />
    </div>
  );
}

export function Field({ label, error, hint, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function Banner({ type = 'info', children }) {
  return <div className={`banner ${type}`}>{children}</div>;
}
export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

/** Hidden in Presentation mode (read-only, projector friendly). */
export function EditOnly({ children }) {
  const { presentation } = useStore();
  return presentation ? null : children;
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={`tab${value === t.id ? ' active' : ''}`} onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}

export function PageHead({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}
