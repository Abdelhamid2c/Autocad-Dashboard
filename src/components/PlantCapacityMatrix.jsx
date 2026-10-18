import { LOAD_STATUS, fmtPct, round2 } from '../utils/capacityCalculations.js';
import { weekLabel } from '../utils/weekCalendar.js';
import { plantWeek } from '../utils/workloadAggregation.js';

/** Weekly capacity matrix W01–W52: rows = plants. mode "allocated" uses technicians' home plant; "demand" uses the task plant (incl. unassigned). */
export default function PlantCapacityMatrix({ model, plants, mode, selectedWeek, onSelect, w0 = 1, w1 = 52 }) {
  const weeks = Array.from({ length: w1 - w0 + 1 }, (_, i) => w0 + i);
  return (
    <div className="table-wrap" style={{ maxHeight: 360 }}>
      <table className="matrix">
        <thead>
          <tr>
            <th className="lab">Plant ({mode === 'demand' ? 'demand ÷ capacity' : 'allocated ÷ capacity'})</th>
            {weeks.map((w) => <th key={w} style={w === model.refWeek ? { background: '#fde3e6' } : undefined}>{String(w).padStart(2, '0')}</th>)}
          </tr>
        </thead>
        <tbody>
          {plants.map((p) => (
            <tr key={p.id}>
              <td className="lab">{p.id}</td>
              {weeks.map((w) => {
                const s = plantWeek(model, p.id, w);
                const val = mode === 'demand' ? s.demand : s.allocated;
                const util = mode === 'demand' ? s.demandUtil : s.util;
                const st = mode === 'demand' ? s.demandStatus : s.status;
                let bg = '#f6f8fb';
                let label = '';
                if (s.capacity === 0 && val > 0) { bg = '#f9c7ce'; label = '!'; }
                else if (s.capacity > 0 && (val > 0 || s.capacity > 0)) { bg = val === 0 ? '#f6f8fb' : LOAD_STATUS[st].bg; label = val === 0 ? '' : Math.round(util); }
                return (
                  <td
                    key={w}
                    className={`cellc${selectedWeek === w ? ' sel' : ''}`}
                    style={{ background: bg, color: val > 0 && s.capacity > 0 ? LOAD_STATUS[st].color : undefined, fontWeight: 600 }}
                    title={`${p.id} ${weekLabel(w)}: ${round2(val)} h ${mode === 'demand' ? 'demand' : 'allocated'} / ${round2(s.capacity)} h capacity${s.capacity > 0 ? ` (${fmtPct(util)})` : ' — no confirmed capacity'}`}
                    onClick={() => onSelect?.(w)}
                  >
                    {label}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
