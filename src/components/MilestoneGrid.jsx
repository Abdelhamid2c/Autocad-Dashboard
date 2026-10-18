import { ChevronDown, ChevronRight, Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { A } from '../state/actions.js';
import { useStore } from '../state/store.jsx';
import { formatEop, parseEop } from '../utils/eop.js';
import { uid } from '../utils/ids.js';
import { milestoneColors } from '../utils/milestoneStyle.js';
import { milestoneWarnings, overlappingIds } from '../utils/planValidation.js';
import { MONTH_NAMES } from '../utils/weekCalendar.js';
import { lineMatchesPlant } from '../utils/workloadAggregation.js';
import BUForm from './BUForm.jsx';
import DeleteImpactDialog from './DeleteImpactDialog.jsx';
import LineForm from './LineForm.jsx';
import MilestoneBar from './MilestoneBar.jsx';
import MilestoneForm from './MilestoneForm.jsx';
import { OriginBadge } from './ui.jsx';

function InlineEdit({ value, display, onCommit, readOnly, className = '', title }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  if (readOnly) return <span className={className}>{display ?? value}</span>;
  if (!editing) {
    return (
      <span className={`inline-edit ${className}`} title={title ?? 'Click to edit'} onClick={(e) => { e.stopPropagation(); setV(value); setEditing(true); }}>
        {display ?? (value || '—')}
      </span>
    );
  }
  const done = (commit) => {
    setEditing(false);
    if (commit && v !== value) onCommit(v);
  };
  return (
    <input
      className="inline-input"
      autoFocus
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => done(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') done(true);
        if (e.key === 'Escape') done(false);
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

/** Greedy lane stacking so overlapping milestones of one line never hide each other. */
function layout(milestones) {
  const sorted = [...milestones].sort((a, b) => a.startWeek - b.startWeek || a.endWeek - b.endWeek);
  const laneEnds = [];
  const out = new Map();
  for (const m of sorted) {
    let lane = laneEnds.findIndex((end) => end < m.startWeek);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = m.endWeek;
    out.set(m.id, lane);
  }
  return { lanes: Math.max(1, laneEnds.length), laneOf: out };
}

export default function MilestoneGrid({ filters, zoom }) {
  const { data, model, dispatch, notify, presentation } = useStore();
  const plan = data.milestones;
  const types = plan.meta.milestoneTypes;
  const cw = zoom === 'month' ? 14 : 36;
  const readOnly = presentation;
  const [collapsed, setCollapsed] = useState({});
  const [form, setForm] = useState(null); // {kind:'ms', lineId, milestoneId, defaults} | {kind:'line', lineId, bu} | {kind:'bu', buId}
  const [del, setDel] = useState(null);
  const scroller = useRef(null);
  const clickTimer = useRef(null);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = Math.max(0, (model.refWeek - 4) * cw);
  }, [cw, model.refWeek]);

  const period = plan.meta.periods.find((p) => p.id === filters.period);
  const q = filters.q.trim().toLowerCase();
  const lineFilterActive = !!(filters.plant || filters.type || filters.period || q || filters.onlyWithMs);
  const lineVisible = (l) => {
    if (filters.bu && l.bu !== filters.bu) return false;
    if (filters.plant && !lineMatchesPlant(l, filters.plant)) return false;
    if (filters.type && !l.milestones.some((m) => m.type === filters.type)) return false;
    if (period && !l.milestones.some((m) => m.endWeek >= period.startWeek && m.startWeek <= period.endWeek)) return false;
    if (filters.onlyWithMs && !l.milestones.length) return false;
    if (q && !`${l.project} ${l.bu} ${l.milestones.map((m) => m.label).join(' ')}`.toLowerCase().includes(q)) return false;
    return true;
  };

  const groups = useMemo(() => {
    return plan.businessUnits
      .filter((b) => !filters.bu || b.name === filters.bu)
      .map((bu) => ({ bu, lines: plan.projectLines.filter((l) => l.bu === bu.name && lineVisible(l)) }))
      .filter((g) => g.lines.length || !lineFilterActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, filters]);

  const ref = model.refWeek;
  const weekCells = Array.from({ length: 52 }, (_, i) => i + 1);

  const openMs = (line, ms) => setForm({ kind: 'ms', lineId: line.id, milestoneId: ms.id });
  const timeClick = (ev, line) => {
    if (readOnly) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    const w = Math.min(52, Math.max(1, Math.floor((ev.clientX - rect.left) / cw) + 1));
    clearTimeout(clickTimer.current);
    if (ev.detail >= 2) {
      const id = uid('M');
      dispatch(A.msAdd(line.id, { id, label: 'New milestone', type: 'OTHER', startWeek: w, endWeek: w }));
      setForm({ kind: 'ms', lineId: line.id, milestoneId: id });
      return;
    }
    clickTimer.current = setTimeout(() => setForm({ kind: 'ms', lineId: line.id, milestoneId: null, defaults: { startWeek: w, endWeek: w } }), 230);
  };

  const commitEop = (line, text) => {
    const eop = parseEop(text);
    if (!eop) return notify('EOP must be MM/YYYY, YYYY or TBC.', 'err');
    dispatch(A.lineUpdate(line.id, { eop }));
  };
  const commitDrag = (line, ms, patch) => {
    const warns = milestoneWarnings(line, { ...ms, ...patch }, model.year);
    dispatch(A.msUpdate(ms.id, patch));
    notify(warns.length ? `Moved with warning: ${warns[0]}` : `${ms.label} updated (Undo available)`, warns.length ? 'warn' : 'ok');
  };

  const taskCountForLines = (lines) => lines.reduce((s, l) => s + l.milestones.reduce((a, m) => a + (model.tasksByMs[m.id]?.length ?? 0), 0), 0);

  const formLine = form?.lineId ? model.lineById[form.lineId] : null;
  const formMs = form?.milestoneId && formLine ? formLine.milestones.find((m) => m.id === form.milestoneId) : null;

  return (
    <>
      <div ref={scroller} className={`pl ${zoom === 'month' ? 'month' : ''}`} style={{ '--cw': `${cw}px` }}>
        <div className="pl-inner">
          {/* header: year + periods, months, weeks */}
          <div className="pl-row pl-head-row" style={{ top: 0, minHeight: 22 }}>
            <div className="pl-left"><div style={{ width: 420, fontWeight: 700 }}>{plan.meta.source?.year} · PPC CAD Milestone</div></div>
            <div className="pl-time pl-hline">
              {plan.meta.periods.map((p) => (
                <span key={p.id} className="pl-cell-h" style={{ width: (p.endWeek - p.startWeek + 1) * cw, fontWeight: 700, justifyContent: 'flex-start', paddingLeft: 8 }}>{p.id} (W{String(p.startWeek).padStart(2, '0')}–W{String(p.endWeek).padStart(2, '0')})</span>
              ))}
            </div>
          </div>
          <div className="pl-row pl-head-row" style={{ top: 22, minHeight: 22 }}>
            <div className="pl-left"><div style={{ width: 420 }} className="muted small">Months</div></div>
            <div className="pl-time pl-hline">
              {plan.meta.months.map((m) => (
                <span key={m.month} className="pl-cell-h" style={{ width: (m.endWeek - m.startWeek + 1) * cw }}>{MONTH_NAMES[m.month - 1]}-{String(plan.meta.source?.year).slice(2)}</span>
              ))}
            </div>
          </div>
          <div className="pl-row pl-head-row" style={{ top: 44, minHeight: 24 }}>
            <div className="pl-left">
              <div className="c-bu"><b>BU</b></div><div className="c-proj"><b>Project</b></div><div className="c-eop"><b>EOP</b></div><div className="c-plant"><b>Plant</b></div>
            </div>
            <div className="pl-time pl-hline" style={{ height: 24 }}>
              {weekCells.map((w) => (
                <span key={w} className={`pl-cell-h${w === ref ? ' cur' : ''}`} style={{ width: cw }} title={w === ref ? 'Reference week' : undefined}>{zoom === 'week' ? String(w).padStart(2, '0') : ''}</span>
              ))}
            </div>
          </div>

          {groups.length === 0 && <div className="empty" style={{ margin: 12 }}>No project lines match the filters.</div>}

          {groups.map(({ bu, lines }) => {
            const isCollapsed = collapsed[bu.id];
            const msCount = lines.reduce((s, l) => s + l.milestones.length, 0);
            return (
              <div key={bu.id}>
                <div className="pl-row pl-bu" onClick={() => setCollapsed((c) => ({ ...c, [bu.id]: !c[bu.id] }))}>
                  <div className="pl-left" style={{ background: '#e8edf5' }}>
                    <div style={{ width: 420 }}>
                      {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      <span>{bu.name}</span>
                      <span className="badge">{bu.plantGroup || 'no plant group'}</span>
                      <span className="muted small">{lines.length} lines · {msCount} milestones</span>
                      <OriginBadge origin={bu.origin} />
                      {!readOnly && (
                        <span className="hover-actions" style={{ display: 'flex' }} onClick={(e) => e.stopPropagation()}>
                          <button className="btn icon ghost sm" title="Rename / edit BU" onClick={() => setForm({ kind: 'bu', buId: bu.id })}><Pencil size={13} /></button>
                          <button className="btn icon ghost sm" title="Add project line" onClick={() => setForm({ kind: 'line', bu: bu.name })}><Plus size={13} /></button>
                          <button className="btn icon ghost sm" title="Delete BU" onClick={() => setDel({ kind: 'bu', bu, lines: plan.projectLines.filter((l) => l.bu === bu.name) })}><Trash2 size={13} /></button>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="pl-time" style={{ background: '#e8edf5' }} />
                </div>

                {!isCollapsed && lines.map((line) => {
                  const { lanes, laneOf } = layout(line.milestones);
                  const overl = overlappingIds(line);
                  const eopBad = !line.eop?.year;
                  return (
                    <div className="pl-row" key={line.id} style={{ minHeight: lanes * 25 + 6 }}>
                      <div className="pl-left">
                        <div className="c-bu"><span className="muted small">{line.sourceRow ? `r${line.sourceRow}` : ''}</span></div>
                        <div className="c-proj">
                          <InlineEdit value={line.project} readOnly={readOnly} onCommit={(v) => v.trim() && dispatch(A.lineUpdate(line.id, { project: v }))} />
                          {line.origin !== 'source' && <OriginBadge origin={line.origin} />}
                          {!readOnly && (
                            <span className="hover-actions">
                              <button className="btn icon ghost sm" title="Edit line" onClick={() => setForm({ kind: 'line', lineId: line.id })}><Pencil size={12} /></button>
                              <button className="btn icon ghost sm" title="Add milestone" onClick={() => setForm({ kind: 'ms', lineId: line.id, milestoneId: null, defaults: { startWeek: Math.max(1, ref), endWeek: Math.max(1, ref) } })}><Plus size={12} /></button>
                              <button className="btn icon ghost sm" title="Duplicate line" onClick={() => { dispatch(A.lineDuplicate(line.id)); notify('Line duplicated', 'ok'); }}><Copy size={12} /></button>
                              <button className="btn icon ghost sm" title="Delete line" onClick={() => setDel({ kind: 'line', line })}><Trash2 size={12} /></button>
                            </span>
                          )}
                        </div>
                        <div className="c-eop" style={{ color: eopBad ? 'var(--warn)' : undefined }}>
                          <InlineEdit value={formatEop(line.eop)} readOnly={readOnly} onCommit={(v) => commitEop(line, v)} title={line.eop?.status === 'Needs confirmation' ? 'Needs confirmation (source cell mis-formatted)' : 'Click to edit: MM/YYYY, YYYY or TBC'} />
                          {line.eop?.status === 'Needs confirmation' && <span title="Needs confirmation">?</span>}
                        </div>
                        <div className="c-plant"><span className="small" style={{ color: line.plant ? undefined : 'var(--muted)' }}>{line.plant || 'TBC'}</span></div>
                      </div>
                      <div className="pl-time pl-grid" onClick={(e) => timeClick(e, line)}>
                        <div className="pl-curcol" style={{ left: (ref - 1) * cw, width: cw }} />
                        {line.milestones.map((m) => {
                          const warns = milestoneWarnings(line, m, model.year);
                          const dim = (filters.type && m.type !== filters.type) || (period && !(m.endWeek >= period.startWeek && m.startWeek <= period.endWeek));
                          return (
                            <MilestoneBar
                              key={m.id}
                              ms={m}
                              lane={laneOf.get(m.id)}
                              cw={cw}
                              colors={milestoneColors(m, types)}
                              dim={!!dim}
                              warning={warns.length ? warns.join(' · ') : overl.has(m.id) ? 'Overlap' : null}
                              readOnly={readOnly}
                              onOpen={() => openMs(line, m)}
                              onCommit={(patch) => commitDrag(line, m, patch)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {!isCollapsed && !readOnly && (
                  <div className="pl-row">
                    <div className="pl-left"><div style={{ width: 420 }}><button className="btn sm ghost" onClick={() => setForm({ kind: 'line', bu: bu.name })}><Plus size={13} /> Add project line</button></div></div>
                    <div className="pl-time" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {form?.kind === 'ms' && formLine && (
        <MilestoneForm key={form.milestoneId ?? 'new'} line={formLine} milestone={formMs} defaults={form.defaults} onClose={() => setForm(null)} />
      )}
      {form?.kind === 'line' && <LineForm line={form.lineId ? model.lineById[form.lineId] : null} bu={form.bu} onClose={() => setForm(null)} />}
      {form?.kind === 'bu' && <BUForm bu={plan.businessUnits.find((b) => b.id === form.buId)} onClose={() => setForm(null)} />}

      {del?.kind === 'line' && (
        <DeleteImpactDialog
          title="Delete project line"
          summary={`Delete “${del.line.project}” (${del.line.bu}) and its ${del.line.milestones.length} milestone(s)?`}
          taskCount={taskCountForLines([del.line])}
          onCancel={() => setDel(null)}
          onConfirm={(mode) => { dispatch(A.lineDelete(del.line.id, mode)); setDel(null); notify('Line deleted (Undo available)', 'ok'); }}
        />
      )}
      {del?.kind === 'bu' && (
        <DeleteImpactDialog
          title="Delete BU"
          summary={`Delete BU “${del.bu.name}” with ${del.lines.length} project line(s)?`}
          taskCount={taskCountForLines(del.lines)}
          onCancel={() => setDel(null)}
          onConfirm={(mode) => { dispatch(A.buDelete(del.bu.id, mode)); setDel(null); notify('BU deleted (Undo available)', 'ok'); }}
        />
      )}
    </>
  );
}
