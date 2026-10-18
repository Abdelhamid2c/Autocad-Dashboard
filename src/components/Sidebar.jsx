import { BarChart3, CalendarDays, CalendarRange, ClipboardList, Factory, FolderKanban, LayoutDashboard, ListChecks, Network, Settings, UserCheck, Users } from 'lucide-react';

export const NAV = [
  { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
  { id: 'planner', label: 'Milestone Planner', icon: CalendarRange },
  { id: 'projects', label: 'Projects & Milestones', icon: FolderKanban },
  { id: 'designer', label: 'Milestone Task Designer', icon: ListChecks },
  { id: 'allocation', label: 'Task Allocation', icon: UserCheck },
  { id: 'technicians', label: 'Technician Availability', icon: Users },
  { id: 'plants', label: 'Plant Resource Planning', icon: Factory },
  { id: 'assignments', label: 'Project Assignments', icon: ClipboardList },
  { id: 'calendar', label: 'Workload Calendar', icon: CalendarDays },
  { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
  { id: 'organization', label: 'Organization', icon: Network },
  { id: 'settings', label: 'Settings & Data', icon: Settings },
];

export default function Sidebar({ page, open, onNavigate }) {
  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="brand">
        <span className="logo" />
        <b>CAD WORKLOAD &amp; RESOURCE MANAGEMENT</b>
        <span>Multi-plant milestone planning</span>
      </div>
      <nav className="nav">
        {NAV.map((n) => (
          <a key={n.id} href={`#/${n.id}`} className={page === n.id ? 'active' : ''} onClick={() => onNavigate?.()}>
            <n.icon size={16} /> {n.label}
          </a>
        ))}
      </nav>
      <div className="sidebar-foot">Frontend-only draft · data stored in this browser (localStorage)</div>
    </aside>
  );
}
