import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LOAD_STATUS, round2 } from '../utils/capacityCalculations.js';
import { isCompleted, isOverdue, TASK_STATUS } from '../utils/scheduling.js';
import { milestonesPerWeek, plantRange, techRange, totalWeek } from '../utils/workloadAggregation.js';

const H = 240;
const tip = { contentStyle: { fontSize: 12 } };

export function ChartCard({ title, subtitle, children }) {
  return (
    <div className="card">
      <div className="card-head"><h2 style={{ margin: 0 }}>{title}</h2>{subtitle && <span className="muted small">{subtitle}</span>}</div>
      <div style={{ width: '100%', height: H }}>{children}</div>
    </div>
  );
}

export function PlantWorkloadChart({ model, w0, w1 }) {
  const data = model.plants.map((p) => {
    const r = plantRange(model, p.id, w0, w1);
    return { plant: p.id, Allocated: round2(r.allocated), Demand: round2(r.demand), Capacity: round2(r.capacity) };
  });
  return (
    <ResponsiveContainer>
      <BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="plant" fontSize={11} /><YAxis fontSize={11} unit=" h" /><Tooltip {...tip} /><Legend />
        <Bar dataKey="Capacity" fill="#b9c2cf" /><Bar dataKey="Allocated" fill="#0f1e36" /><Bar dataKey="Demand" fill="#c8102e" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AllocVsAvailableChart({ model, w0, w1 }) {
  const data = model.plants.map((p) => {
    const r = plantRange(model, p.id, w0, w1);
    return { plant: p.id, Allocated: round2(Math.min(r.allocated, r.capacity)), Available: round2(Math.max(0, r.capacity - r.allocated)), Overload: round2(Math.max(0, r.allocated - r.capacity)) };
  });
  return (
    <ResponsiveContainer>
      <BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="plant" fontSize={11} /><YAxis fontSize={11} unit=" h" /><Tooltip {...tip} /><Legend />
        <Bar dataKey="Allocated" stackId="a" fill="#2e75b6" /><Bar dataKey="Available" stackId="a" fill="#9fd8b5" /><Bar dataKey="Overload" stackId="a" fill="#d0021b" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TechUtilChart({ model, w0, w1 }) {
  const data = model.activeTechs.map((t) => {
    const r = techRange(model, t.id, w0, w1);
    return { name: t.displayName.replace('CAD Technician ', 'T'), util: Math.round(r.util), status: r.status };
  });
  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={{ bottom: 30 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={10} angle={-40} textAnchor="end" interval={0} /><YAxis fontSize={11} unit="%" /><Tooltip {...tip} />
        <ReferenceLine y={100} stroke="#d0021b" strokeDasharray="4 4" />
        <Bar dataKey="util" name="Utilization %">{data.map((d) => <Cell key={d.name} fill={LOAD_STATUS[d.status].color} />)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TaskStatusChart({ model }) {
  const open = model.tasks.filter((t) => !isCompleted(t));
  const data = [
    { name: 'Unassigned', n: open.filter((t) => !t.technicianId).length, color: '#b9c2cf' },
    ...Object.entries(TASK_STATUS).map(([k, v]) => ({ name: v.label, n: model.tasks.filter((t) => t.status === k).length, color: v.color })),
    { name: 'Overdue', n: open.filter((t) => isOverdue(t, model.refDate)).length, color: '#d0021b' },
  ];
  return (
    <ResponsiveContainer>
      <BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip {...tip} />
        <Bar dataKey="n" name="Tasks">{data.map((d) => <Cell key={d.name} fill={d.color} />)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MilestonesPerWeekChart({ model }) {
  const data = milestonesPerWeek(model);
  return (
    <ResponsiveContainer>
      <BarChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" fontSize={9} interval={3} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip {...tip} />
        <ReferenceLine x={`W${String(model.refWeek).padStart(2, '0')}`} stroke="#c8102e" />
        <Bar dataKey="count" name="Milestones" fill="#2e75b6" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PeaksChart({ model, w0 = 1, w1 = 52 }) {
  const data = [];
  for (let w = w0; w <= w1; w++) {
    const t = totalWeek(model, w);
    data.push({ label: `W${String(w).padStart(2, '0')}`, Capacity: round2(t.capacity), Allocated: round2(t.allocated), Demand: round2(t.demand) });
  }
  return (
    <ResponsiveContainer>
      <ComposedChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" fontSize={9} interval={Math.max(0, Math.floor(data.length / 13))} /><YAxis fontSize={11} unit=" h" /><Tooltip {...tip} /><Legend />
        <Area type="monotone" dataKey="Allocated" fill="#2e75b655" stroke="#2e75b6" />
        <Line type="monotone" dataKey="Demand" stroke="#c8102e" dot={false} />
        <Line type="monotone" dataKey="Capacity" stroke="#0f1e36" strokeDasharray="5 4" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
