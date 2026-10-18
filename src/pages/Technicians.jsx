import TechnicianAvailability from '../components/TechnicianAvailability.jsx';
import { PageHead } from '../components/ui.jsx';

export default function Technicians() {
  return (
    <>
      <PageHead title="Technician Availability" subtitle="Capacity = 8 h/day · 40 h/week (configurable). Remaining = capacity − allocated; utilization = allocated ÷ capacity." />
      <TechnicianAvailability />
    </>
  );
}
