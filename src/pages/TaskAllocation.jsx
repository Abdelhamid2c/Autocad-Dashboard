import TaskAllocationBoard from '../components/TaskAllocationBoard.jsx';
import { PageHead } from '../components/ui.jsx';

export default function TaskAllocation({ params, navigate }) {
  return (
    <>
      <PageHead title="Task Allocation" subtitle="Pick a task, compare candidates by capacity in the task period, review the impact, then confirm. A task has exactly one assignee." />
      <TaskAllocationBoard params={params} navigate={navigate} />
    </>
  );
}
