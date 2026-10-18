import { useStore } from '../state/store.jsx';
import { liveQualityChecks } from '../utils/workloadAggregation.js';
import { Empty } from './ui.jsx';

const SEV = { warning: 'warn', info: '', error: 'bad' };

export default function DataQualityPanel() {
  const { model, data } = useStore();
  const live = liveQualityChecks(model);
  const src = data.milestones.meta.dataQuality ?? [];
  return (
    <div className="grid c2">
      <div className="card">
        <h2>Live checks (computed from current data)</h2>
        {live.length === 0 ? <Empty>No live warning.</Empty> : live.map((c) => (
          <div className="dq-item" key={c.id}>
            <span className={`badge sev ${SEV[c.severity]}`}>{c.severity}</span>
            <div>{c.text}{c.items && <details><summary className="small muted">details</summary><ul className="small">{c.items.slice(0, 30).map((x, i) => <li key={i}>{x}</li>)}</ul></details>}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>Notes carried by the source file (meta.dataQuality)</h2>
        {src.map((d) => (
          <div className="dq-item" key={d.id}>
            <span className={`badge sev ${SEV[d.severity]}`}>{d.severity}</span>
            <div><b>{d.id}</b> · {d.text}{d.lines && <span className="muted small"> ({d.lines.length} line(s))</span>}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
