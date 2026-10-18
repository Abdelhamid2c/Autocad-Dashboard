import WorkloadCalendar from '../components/WorkloadCalendar.jsx';
import { PageHead } from '../components/ui.jsx';

export default function Calendar() {
  return (
    <>
      <PageHead title="Workload Calendar" subtitle="Technicians as rows, weeks or days as columns. Weekends are greyed; capacity conflicts are tinted red." />
      <WorkloadCalendar />
    </>
  );
}
