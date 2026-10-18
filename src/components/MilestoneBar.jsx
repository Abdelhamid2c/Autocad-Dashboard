import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { weekEnd, weekLabel, weekStart, formatShort } from '../utils/weekCalendar.js';

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

/**
 * One milestone as a horizontal bar. Drag the body to move, drag the edges to resize.
 * `onCommit({startWeek,endWeek})` is only called for validated, changed weeks.
 */
export default function MilestoneBar({ ms, lane, cw, colors, dim, warning, readOnly, onOpen, onCommit }) {
  const [preview, setPreview] = useState(null);
  const [tip, setTip] = useState(null);
  const drag = useRef(null);

  const s = preview?.s ?? ms.startWeek;
  const e = preview?.e ?? ms.endWeek;
  const text = `${weekLabel(s)}${s !== e ? `–${weekLabel(e)}` : ''} · ${formatShort(weekStart(s))} – ${formatShort(weekEnd(e))}`;

  const down = (ev) => {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    if (readOnly) return;
    const mode = ev.target.dataset.h === 'l' ? 'left' : ev.target.dataset.h === 'r' ? 'right' : 'move';
    ev.currentTarget.setPointerCapture(ev.pointerId);
    drag.current = { mode, x0: ev.clientX, s0: ms.startWeek, e0: ms.endWeek, moved: false, s: ms.startWeek, e: ms.endWeek };
  };
  const move = (ev) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(ev.clientX - d.x0) > 3) d.moved = true;
    if (!d.moved) return;
    const dw = Math.round((ev.clientX - d.x0) / cw);
    let ns = d.s0;
    let ne = d.e0;
    if (d.mode === 'move') {
      const len = d.e0 - d.s0;
      ns = clamp(d.s0 + dw, 1, 52 - len);
      ne = ns + len;
    } else if (d.mode === 'left') ns = clamp(d.s0 + dw, 1, d.e0);
    else ne = clamp(d.e0 + dw, d.s0, 52);
    d.s = ns;
    d.e = ne;
    setPreview({ s: ns, e: ne });
    setTip({ x: ev.clientX + 12, y: ev.clientY + 14 });
  };
  const up = (ev) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    ev.currentTarget.releasePointerCapture?.(ev.pointerId);
    setPreview(null);
    setTip(null);
    if (!d.moved) {
      onOpen();
      return;
    }
    if (d.s === ms.startWeek && d.e === ms.endWeek) return;
    if (d.s >= 1 && d.e <= 52 && d.s <= d.e) onCommit({ startWeek: d.s, endWeek: d.e });
  };

  return (
    <>
      <div
        className={`pl-bar${dim ? ' dim' : ''}${preview ? ' ghost' : ''}`}
        style={{ left: (s - 1) * cw + 1, width: (e - s + 1) * cw - 2, top: 3 + lane * 25, background: colors.bg, color: colors.fg, cursor: readOnly ? 'pointer' : 'grab' }}
        title={`${ms.label} · ${ms.type} · ${text}${warning ? `\n⚠ ${warning}` : ''}${ms.notes ? `\n${ms.notes}` : ''}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onClick={(ev) => ev.stopPropagation()}
        onDoubleClick={(ev) => ev.stopPropagation()}
      >
        {!readOnly && <span className="h l" data-h="l" />}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ms.label}</span>
        {warning && <span className="flag">⚠</span>}
        {!readOnly && <span className="h r" data-h="r" />}
      </div>
      {tip && createPortal(<div className="pl-tip" style={{ left: tip.x, top: tip.y }}>{ms.label}: {text}</div>, document.body)}
    </>
  );
}
