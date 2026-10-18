import { lazy, Suspense, useState } from 'react';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import { Banner } from './components/ui.jsx';
import { useStore } from './state/store.jsx';
import { useRoute } from './state/useRoute.js';

const pages = {
  dashboard: lazy(() => import('./pages/Dashboard.jsx')),
  planner: lazy(() => import('./pages/MilestonePlanner.jsx')),
  projects: lazy(() => import('./pages/ProjectsMilestones.jsx')),
  designer: lazy(() => import('./pages/MilestoneTaskDesigner.jsx')),
  allocation: lazy(() => import('./pages/TaskAllocation.jsx')),
  technicians: lazy(() => import('./pages/Technicians.jsx')),
  plants: lazy(() => import('./pages/PlantPlanning.jsx')),
  assignments: lazy(() => import('./pages/ProjectAssignmentsPage.jsx')),
  calendar: lazy(() => import('./pages/Calendar.jsx')),
  reports: lazy(() => import('./pages/Reports.jsx')),
  organization: lazy(() => import('./pages/Organization.jsx')),
  settings: lazy(() => import('./pages/SettingsData.jsx')),
};

export default function App() {
  const route = useRoute();
  const { ui, presentation } = useStore();
  const [menu, setMenu] = useState(false);
  const Page = pages[route.page] ?? pages.dashboard;
  const page = pages[route.page] ? route.page : 'dashboard';
  return (
    <div className={`app${presentation ? ' presentation' : ''}`}>
      <Sidebar page={page} open={menu} onNavigate={() => setMenu(false)} />
      <div className="main">
        <Header page={page} onMenu={() => setMenu((m) => !m)} />
        <main className="page">
          {ui.storageProblems?.length > 0 && (
            <Banner type="warn">
              <div>
                <b>{ui.storagePersistent === false ? 'Browser storage problem — working in memory only.' : 'Browser storage warning.'}</b> {ui.storageProblems.join(' ')} {ui.storagePersistent === false && 'Use Settings & Data → Export all (JSON backup) to keep your work.'}
              </div>
            </Banner>
          )}
          <Suspense fallback={<div className="muted">Loading…</div>}>
            <Page route={route} navigate={route.navigate} params={route.params} />
          </Suspense>
        </main>
        {ui.toast && <div className={`toast ${ui.toast.type}`} role="status">{ui.toast.msg}</div>}
      </div>
    </div>
  );
}
