import ProjectAssignments from '../components/ProjectAssignments.jsx';
import { PageHead } from '../components/ui.jsx';

export default function ProjectAssignmentsPage() {
  return (
    <>
      <PageHead title="Project Assignments" subtitle="Derived from task assignments — change an assignment in Task Allocation or the Task Designer and both views follow." />
      <ProjectAssignments />
    </>
  );
}
