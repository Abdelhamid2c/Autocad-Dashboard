import OrgChart from '../components/OrgChart.jsx';
import { PageHead } from '../components/ui.jsx';

export default function Organization() {
  return (
    <>
      <PageHead title="Organization" subtitle="Click a box to name it, set capacity or skills; add or remove technician slots." />
      <OrgChart />
    </>
  );
}
