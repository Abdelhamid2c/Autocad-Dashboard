import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { A } from '../state/actions.js';
import { useStore } from '../state/store.jsx';
import { capacityOn, fmtPct, LOAD_STATUS, loadStatus, round2, utilizationPct } from '../utils/capacityCalculations.js';
import { PLANTS } from '../utils/milestoneStyle.js';
import { assignmentImpact, isCompleted, isOverdue, taskHours, taskWindow } from '../utils/scheduling.js';
import { addDays, diffDays, formatShort, MONTH_NAMES, parseISO, weekEnd, weekLabel, weekOfDate, weekStart, weekdayIndex } from '../utils/weekCalendar.js';
import { lineMatchesPlant, techRange, techWeek } from '../utils/workloadAggregation.js';
import { Banner, Confirm, TaskStatusBadge } from './ui.jsx';

const LABEL_W = 190;

function lanes(items) {
  const ends = [];
  const out = new Map();
  for (const it of [...items].sort((a, b) => a.a - b.a || a.b - b.b)) {
    let lane = ends.findIndex((e) => e < it.a);
    if (lane < 0) { lane = ends.length; ends.push(0); }
    ends[lane] = it.b;
    out.set(it.id, lane);
  }
  return { count: Math.max(1, ends.length), of: out };
}

export default function WorkloadCalendar() {
  const { model, dispatch, notify, presentation } = useStore();
  const [mode, setMode] = useState('weeks');
  const [startWeek, setStartWeek] = useState(Math.max(1, model.refWeek - 1));
  const [plant, setPlant] = useState('');
  const [pending, setPending] = useState(null);
  const dragRef = useRef(null);
  const s = model.settings;

  const n = mode === 'weeks' ? 12 : 21;
  const cw = mode === 'weeks' ? 78 : 38;
  const first = mode === 'weeks' ? weekStart(startWeek, model.year) : weekStart(Math.min(startWeek, 50), model.year);
  const winStartWeek = mode === 'weeks' ? startWeek : Math.min(startWeek, 50);

  const cols = useMemo(() => Array.from({ length: n }, (_, i) => {
    if (mode === 'weeks') {
      const w = startWeek + i;
      return { key: w, w, label: w <= 52 ? weekLabel(w) : '', sub: w <= 52 ? formatShort(weekStart(w, model.year)) : '', cur: w === model.refWeek, weekend: false, valid: w <= 52 };
    }
    const d = addDays(first, i);
    const wd = weekdayIndex(d);
    return { key: d, date: d, label: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][wd], sub: String(parseISO(d).getUTCDate()), cur: d === model.refDate, weekend: wd >= 5, valid: true, head: wd === 0 ? `${weekLabel(weekOfDate(d, model.year) ?? 0)} · ${MONTH_NAMES[parseISO(d).getUTCMonth()]}` : '' };
  }), [mode, n, startWeek, first, model]);

  const colOf = (iso) => (mode === 'weeks' ? (weekOfDate(iso, model.year) ?? (iso < first ? -1 : 99)) - startWeek : diffDays(first, iso));
  const placeTask = (t) => {
    const w = taskWindow(t);
    if (!w) return null;
    const a = colOf(w.start);
    const b = colOf(w.end);
    if (b < 0 || a > n - 1) return null;
    return { id: t.id, a: Math.max(0, a), b: Math.min(n - 1, b), t };
  };

  const techs = model.activeTechs.filter((t) => !plant || t.plantId === plant);
  const openUnassigned = model.tasks.filter((t) => !t.technicianId && !isCompleted(t) && (!plant || t.plant === plant));
  const unscheduled = openUnassigned.filter((t) => !taskWindow(t));
  const msByCol = {};
  for (const m of model.milestoneList) {
    if (plant && !lineMatchesPlant(m, plant)) continue;
    const c = colOf(m.endDate);
    if (c >= 0 && c < n) (msByCol[c] ??= []).push(m);
  }

  // ---- drag & drop rescheduling ----
  const onDragStart = (e, t, barLeft) => {
    const off = Math.floor((e.clientX - barLeft) / cw);
    dragRef.current = { taskId: t.id, off: Math.max(0, off) };
    e.dataTransfer.setData('text/plain', t.id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDrop = (e, techId) => {
    e.preventDefault();
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const task = model.tasks.find((x) => x.id === d.taskId);
    if (!task) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const targetCol = Math.floor((e.clientX - rect.left) / cw);
    const targetWeek = startWeek + targetCol - d.off;
    if (targetWeek < 1 || targetWeek > 52) return;
    const w = taskWindow(task);
    let startDate;
    let endDate;
    if (w) {
      const curWeek = weekOfDate(w.start, model.year) ?? 1;
      const shift = (targetWeek - curWeek) * 7;
      startDate = addDays(w.start, shift);
      endDate = addDays(w.end, shift);
    } else {
      const weeksNeeded = Math.max(1, Math.ceil(taskHours(task) / (model.settings.dailyHours * model.settings.workingDays.length)));
      startDate = weekStart(targetWeek, model.year);
      endDate = weekEnd(Math.min(52, targetWeek + weeksNeeded - 1), model.year);
    }
    const tech = techId ? model.techById[techId] : null;
    const moved = { ...task, startDate, endDate, technicianId: techId };
    const impact = tech ? assignmentImpact(tech, moved, model.tasks, model.settings, model.refDate, model.year) : null;
    const cross = !!(tech && task.plant && tech.plantId !== task.plant);
    const unchanged = startDate === w?.start && endDate === w?.end && techId === (task.technicianId ?? null);
    if (unchanged) return;
    const needsConfirm = cross || (impact && (impact.overDays.length || impact.overWeeks.length));
    const req = { task, startDate, endDate, techId, cross, impact, tech };
    if (needsConfirm) setPending(req);
    else apply(req);
  };
  const apply = (req) => {
    dispatch(A.taskReschedule(req.task.id, req.startDate, req.endDate, req.techId, req.cross));
    notify(`${req.task.name} → ${formatShort(req.startDate)}–${formatShort(req.endDate)}${req.tech ? ` · ${req.tech.displayName}` : ' · unassigned'}`, 'ok');
    setPending(null);
  };
  const dnd = mode === 'weeks' && !presentation;

  const renderBar = (p, lane, top0, kind) => {
    const t = p.t;
    const done = isCompleted(t);
    const od = isOverdue(t, model.refDate);
    const cls = kind === 'unassigned' ? 'unassigned' : done ? 'completed' : od ? 'overdue' : 'assigned';
    return (
      <div
        key={p.id}
        className={`cal-block ${cls}${t.needsReview ? ' review' : ''}`}
        draggable={dnd}
        onDragStart={(e) => onDragStart(e, t, e.currentTarget.getBoundingClientRect().left)}
        style={{ left: p.a * cw + 2, width: (p.b - p.a + 1) * cw - 4, top: top0 + lane * 22 }}
        title={`${t.name} · ${round2(taskHours(t))} h · ${t.status}${od ? ' · OVERDUE' : ''}${t.technicianId ? '' : ' · unassigned'}${t.needsReview ? ' · needs review' : ''}`}
      >
        {t.name} · {round2(taskHours(t))}h
      </div>
    );
  };

  const trackW = n * cw;
  const colBg = (c, i) => (
    <div key={`bg${i}`} className="cal-cellbg" style={{ left: i * cw, width: cw, background: c.weekend ? '#e9ecf1aa' : c.cur ? '#fde3e688' : 'transparent', borderRight: '1px solid #eef1f5' }} />
  );

  return (
    <>
      <div className="toolbar">
        <div className="row">
          <button className={`btn sm${mode === 'weeks' ? ' primary' : ''}`} onClick={() => setMode('weeks')}>Weeks</button>
          <button className={`btn sm${mode === 'days' ? ' primary' : ''}`} onClick={() => setMode('days')}>Days</button>
        </div>
        <button className="btn icon sm" onClick={() => setStartWeek((w) => Math.max(1, w - (mode === 'weeks' ? 4 : 1)))} aria-label="Previous"><ChevronLeft size={14} /></button>
        <label className="row">From week <input type="number" min="1" max="52" value={startWeek} style={{ width: 60 }} onChange={(e) => setStartWeek(Math.min(52, Math.max(1, Number(e.target.value) || 1)))} /></label>
        <button className="btn icon sm" onClick={() => setStartWeek((w) => Math.min(52, w + (mode === 'weeks' ? 4 : 1)))} aria-label="Next"><ChevronRight size={14} /></button>
        <button className="btn sm" onClick={() => setStartWeek(Math.max(1, model.refWeek - 1))}>Reference week</button>
        <select value={plant} onChange={(e) => setPlant(e.target.value)}><option value="">All plants</option>{PLANTS.map((p) => <option key={p}>{p}</option>)}</select>
        <div className="legend">
          <span><i style={{ background: '#2e75b6' }} />Assigned</span><span><i style={{ background: '#b9c2cf' }} />Unassigned</span>
          <span><i style={{ background: '#2e9e5b' }} />Completed</span><span><i style={{ background: '#d0021b' }} />Overdue</span><span>◆ milestone deadline</span>
        </div>
      </div>
      {dnd && <p className="muted small">Drag a task block to another week or technician row to reschedule / reassign; capacity and cross-plant rules are checked before it is applied.</p>}

      <div className="cal">
        <div style={{ width: LABEL_W + trackW }}>
          <div className="cal-head">
            <div className="cal-label"><b>Technician</b><span className="muted small">{mode === 'weeks' ? 'alloc / capacity per week' : 'allocated h per day'}</span></div>
            <div style={{ display: 'flex' }}>
              {cols.map((c) => (
                <div key={c.key} className={`cal-colh${c.weekend ? ' weekend' : ''}${c.cur ? ' cur' : ''}`} style={{ width: cw }}>
                  {c.head && <div style={{ fontSize: 9, whiteSpace: 'nowrap', textAlign: 'left', paddingLeft: 2 }}>{c.head}</div>}
                  <div>{c.label}</div><div className="muted" style={{ fontSize: 9 }}>{c.sub}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="cal-row" style={{ minHeight: 28 }}>
            <div className="cal-label"><b>Milestone deadlines</b></div>
            <div className="cal-track" style={{ width: trackW }}>
              {cols.map(colBg)}
              {Object.entries(msByCol).map(([c, list]) => (
                <div key={c} title={list.map((m) => `${m.project}: ${m.label}`).join('\n')} style={{ position: 'absolute', left: Number(c) * cw, width: cw, top: 4, textAlign: 'center', fontSize: 11, color: 'var(--red)', fontWeight: 700, cursor: 'help' }}>◆ {list.length}</div>
              ))}
            </div>
          </div>

          {(() => {
            const placed = openUnassigned.map(placeTask).filter(Boolean);
            const L = lanes(placed);
            return (
              <div className="cal-row" style={{ minHeight: L.count * 22 + 8 }}>
                <div className="cal-label"><b>Unassigned tasks</b><span className="muted small">{openUnassigned.length} open · {unscheduled.length} unscheduled</span></div>
                <div className="cal-track" style={{ width: trackW, height: L.count * 22 + 8 }} onDragOver={(e) => dnd && e.preventDefault()} onDrop={(e) => dnd && onDrop(e, null)}>
                  {cols.map(colBg)}
                  {placed.map((p) => renderBar(p, L.of.get(p.id), 4, 'unassigned'))}
                </div>
              </div>
            );
          })()}

          {techs.map((tech) => {
            const placed = (model.tasksByTech[tech.id] ?? []).map(placeTask).filter(Boolean);
            const L = lanes(placed);
            const range = techRange(model, tech.id, winStartWeek, Math.min(52, winStartWeek + (mode === 'weeks' ? 11 : 2)));
            return (
              <div className="cal-row" key={tech.id} style={{ minHeight: 20 + L.count * 22 + 6 }}>
                <div className="cal-label">
                  <b>{tech.displayName}</b>
                  <span className="small" style={{ color: LOAD_STATUS[range.status].color }}>{tech.plantId} · {round2(range.allocated)}/{round2(range.capacity)} h · {fmtPct(range.util)}</span>
                </div>
                <div className="cal-track" style={{ width: trackW, height: 20 + L.count * 22 + 6 }} onDragOver={(e) => dnd && e.preventDefault()} onDrop={(e) => dnd && onDrop(e, tech.id)}>
                  {cols.map((c, i) => {
                    let alloc = 0;
                    let cap = 0;
                    if (mode === 'weeks') {
                      if (c.valid) { const x = techWeek(model, tech.id, c.w); alloc = x.allocated; cap = x.capacity; }
                    } else {
                      alloc = model.load.techDay[tech.id]?.[c.date] ?? 0;
                      cap = capacityOn(tech, c.date, s);
                    }
                    const st = loadStatus(utilizationPct(alloc, cap), model.thresholds);
                    const conflict = alloc > cap + 1e-6;
                    const tint = c.weekend && alloc === 0 ? '#e9ecf1aa' : conflict ? '#fbd0d5' : alloc > 0 ? `${LOAD_STATUS[st].bg}` : c.cur ? '#fde3e688' : 'transparent';
                    return (
                      <div key={c.key} className="cal-cellbg" style={{ left: i * cw, width: cw, background: tint, borderRight: '1px solid #eef1f5' }} title={`${round2(alloc)} h allocated / ${round2(cap)} h capacity → ${round2(cap - alloc)} h remaining${conflict ? ' — CONFLICT' : ''}`}>
                        <div style={{ fontSize: 10, textAlign: 'center', color: conflict ? 'var(--bad)' : '#44546a', fontWeight: conflict ? 700 : 400 }}>
                          {mode === 'weeks' ? (cap || alloc ? `${round2(alloc)}/${round2(cap)}` : '') : alloc > 0 ? round2(alloc) : ''}
                        </div>
                      </div>
                    );
                  })}
                  {placed.map((p) => renderBar(p, L.of.get(p.id), 20, 'assigned'))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {unscheduled.length > 0 && (
        <div className="card mt">
          <h3>Unscheduled workload ({unscheduled.length} tasks · {round2(unscheduled.reduce((x, t) => x + taskHours(t), 0))} h)</h3>
          <p className="muted small">Not placed in any week because they have no dates. {dnd ? 'Drag one onto a technician row to schedule and assign it.' : ''}</p>
          <div className="row">
            {unscheduled.map((t) => <span key={t.id} className="chip" draggable={dnd} onDragStart={(e) => onDragStart(e, t, e.currentTarget.getBoundingClientRect().left)} style={{ cursor: dnd ? 'grab' : 'default' }}>{t.name} · {round2(taskHours(t))} h</span>)}
          </div>
        </div>
      )}

      {pending && (
        <Confirm
          title="Confirm reschedule"
          confirmLabel="Apply anyway"
          danger={!!(pending.impact && (pending.impact.overDays.length || pending.impact.overWeeks.length))}
          onCancel={() => setPending(null)}
          onConfirm={() => apply(pending)}
        >
          <p><b>{pending.task.name}</b> → {formatShort(pending.startDate)} – {formatShort(pending.endDate)}{pending.tech ? ` · ${pending.tech.displayName}` : ' · unassigned'}</p>
          {pending.cross && <Banner type="warn">Cross-plant: {pending.tech.displayName} is a {pending.tech.plantId} technician; the task is for {pending.task.plant}. It will be flagged for review.</Banner>}
          {pending.impact?.overWeeks.length > 0 && <Banner type="err">Weekly capacity exceeded in {pending.impact.overWeeks.map((w) => weekLabel(w.week)).join(', ')}.</Banner>}
          {pending.impact?.overDays.length > 0 && <Banner type="err">Daily capacity (8 h) exceeded on {pending.impact.overDays.length} day(s).</Banner>}
        </Confirm>
      )}
      <TaskStatusLegend />
    </>
  );
}

function TaskStatusLegend() {
  return <p className="muted small mt">A task is “completed” only when its status says so — an end date in the past alone does not complete it (it shows as overdue). Completed tasks no longer consume future capacity. <TaskStatusBadge status="COMPLETED" /></p>;
}
