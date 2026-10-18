## 1. Role and Objective

Act as a Senior ReactJS Developer, UI/UX Designer and Industrial Engineering Resource Planning Specialist.

Build a professional, interactive **ReactJS frontend-only** web application named:

**CAD WORKLOAD & RESOURCE MANAGEMENT**
*Multi-Plant Milestone Planning, Task Allocation & Technician Capacity Management*

**Purpose of this first draft:** to be *presented* to the PPC Director and plant management so they can **visualize the workload of the CAD department** across six plants: YMM1, YMM2, YMOK, YMK, YMOT and SATELLITES.

The central user is the **CAD Coordinator** (reports to the PPC Director). The coordinator can:

1. **Fill in and maintain the CAD Milestone plan dynamically** — by BU, Project, EOP, and milestone start week / end week (replacing the static Excel sheet `PPC CAD Milestone`).
2. Define the tasks required for each milestone.
3. Allocate tasks to technicians.
4. Monitor technician availability and plant capacity.
5. Anticipate workload peaks.

There is **no backend and no database**. **`localStorage` is the temporary database** of this draft (see section 9).

**Glossary (business definitions):**
- **EOP** = End of Production.
- **SOP** = Start of Production.
Other acronyms in the source (VS, DOC, TR, CF, PT, PP, TDS, MY…) must be kept **verbatim** — do not expand or reinterpret them.

## 2. Source Files (already analysed — use them as seed data)

Two verified JSON files are provided in the appendices and must be copied to `src/data/`:

| File | Extracted from | Content |
|---|---|---|
| `src/data/milestones.json` (Appendix A) | Excel `Milestones 2027 (YMM1 - YMM2 - YMOK).xlsx`, worksheet **`PPC CAD Milestone`** (the only worksheet) | 6 BUs, 71 project lines, 58 milestones, week calendar W01–W52, periods, data-quality notes |
| `src/data/organization.json` (Appendix B) | `CAD Organization Chart.pptx` | PPC Director, 3 sites, 6 plants, managers, CAD Responsibles, CAD Technician positions |

Rules:
- **Do not invent** project references, milestone dates, employee names or headcounts. Missing information is displayed as `TBC` or `Data Required`.
- The organization chart gives **positions and headcounts, not names**. Technicians are created as named slots (`CAD Technician 1 – YMM1`, …) with `name: null`; the coordinator can rename them in the app.
- Every record carries an `origin` field: `"source"` (from the files), `"user"` (created in the app) or `"demo"` (illustrative). Show the origin with a small badge and never mix them silently.
- Show the `meta.dataQuality` notes in a **Data Quality panel** (Settings & Data, and a warning counter on the dashboard). Notably: Mercedes (25 lines) has no EOP/milestones, Ford has no lines, the 'YMM1 & YMM2' lines do not say which plant they belong to, and XCB EOP cells are stored as a mis-formatted date (interpreted as 2029, status *Needs confirmation*).

## 3. Organizational Structure

Hierarchy (from the organization chart):

**PPC Director** → **Site** (Meknes: YMM1, YMM2 · Kenitra: YMOK, YMK · Tanger: YMOT, SATELLITES) → per plant: **Manager** → **CAD Responsible** → **CAD Technicians**.

Confirmed headcount from the chart: **13 CAD Technicians** (YMM1 2, YMM2 3, YMOK 3, YMK 2, YMOT 3), **4 CAD Responsibles** (YMM1, YMOK, YMK, YMOT). YMM2 Manager is **TBC**; SATELLITES CAD Responsible and Technicians are **TBC** (exclude them from capacity totals until confirmed, but let the coordinator add them). YMM2 has no CAD Responsible box; a connector suggests its technicians follow the YMM1 CAD Responsible (flag as *to be confirmed*).

The application is operated by **one CAD Coordinator** who sees all plants in one consolidated view, with per-plant filters. The chart contains no "CAD Coordinator" box: model the coordinator as the app user and the CAD Responsibles as plant leads. Do not create separate accounts or login.

Provide an **Organization page** with an org-chart visual (tree) driven by `organization.json` and editable (add/rename/remove a technician slot, set a name, set plant).

## 4. Working Calendar and Capacity Rules

- Working days: Monday to Friday. Saturday and Sunday are non-working.
- **Daily capacity: 8 hours.**
- **Weekly capacity: 40 hours per technician** (8 h × 5 days).
- Capacity parameters are stored in settings and must be configurable (daily hours, working days, per-technician override, absences).

Formulas:

- `Available Hours = Working Capacity − Allocated Task Hours`
- `Utilization (%) = Allocated Task Hours / Working Capacity × 100`

**Reference example (must be reproduced exactly by the app and shown in the documentation/test data):**
A technician has 40 h/week capacity and 22.5 h of assigned tasks → Allocated 22.5 h · **Remaining 17.5 h** · **Utilization 56.25 %**.

Detect assignments that exceed available capacity (per day and per week) and warn the coordinator before accepting them. Never count the same task twice in project workload and technician workload.

## 5. Navigation (sidebar)

1. Executive Dashboard
2. **Milestone Planner (PPC CAD Milestone)** — *new, see section 7*
3. Projects & Milestones
4. Milestone Task Designer
5. Task Allocation
6. Technician Availability
7. Plant Resource Planning
8. Project Assignments
9. Workload Calendar
10. Reports & Analytics
11. Organization
12. Settings & Data (capacity settings, thresholds, import/export, reset, data-quality panel)

## 6. Module 1 — Executive Dashboard

KPI cards (all computed live): active project lines · total milestones · upcoming milestones (next 4 weeks) · technicians (with confirmed capacity) · total capacity vs allocated hours · tasks unassigned / in progress / overdue · technicians available / at full capacity / overloaded · capacity conflicts · milestones without defined tasks · data-quality warnings.

Charts (Recharts): workload by plant · allocated vs available hours · utilization by technician · tasks by status · **milestones per week (W01–W52)** · workload peaks over the planning horizon.

Alerts: milestones approaching without tasks · unassigned tasks · technicians near/over capacity · overdue tasks · lines with missing data (EOP, plant).

Do not show fabricated metrics as real results. When demo data is active, display a visible **“DEMO DATA”** ribbon.

## 7. Module 2 — Milestone Planner (dynamic replacement of the Excel sheet)

This is a **key module**. It reproduces the layout of the worksheet `PPC CAD Milestone` as an **editable, dynamic grid** so the coordinator fills the milestone plan in the app instead of Excel.

### 7.1 Layout
- Left frozen columns: **BU | Project | EOP** (same as the Excel: columns B, C, D). Optional extra columns: Plant, Origin.
- Header: year (2027), **periods** (P86-2 = W01–W25, P87-1 = W26–W52), **months** and **weeks W01–W52** (from `meta`), with the current ISO week highlighted.
- Rows grouped by **BU** (collapsible), with the plant-group label (`YMM1 & YMM2`, `YMOK`) as in column A.
- Each milestone is a **horizontal bar** spanning from its **start week** to its **end week**, showing its label. Single-week milestones occupy one cell. Colours follow `meta.milestoneTypes` (EOP red, SOP green or navy with yellow text, VS/DOC/TR/Pre-Serial blue, CF yellow, other orange) and the stored `sourceColor`.
- Horizontal scroll with sticky headers; zoom toggle (week / month); filters by BU, plant, milestone type, period and text search.

### 7.2 Dynamic data entry (CRUD)
The coordinator must be able to, without code and with immediate effect:

1. **Add / rename / delete a BU** (BU name, plant group, optional plant).
2. **Add / edit / duplicate / delete a project line** under a BU: project name, **EOP** (month/year picker, or year only, or `TBC`), plant (YMM1, YMM2, YMOK, YMK, YMOT, SATELLITES or TBC), notes.
3. **Add / edit / delete a milestone** on a project line via a form or by **clicking an empty week cell**: label, type (EOP, SOP, VS, DOC, PRE_SERIAL, TR, CF, OTHER), **Start Week**, **End Week**, colour override, notes.
   - Week inputs are numbers 1–52 with their date range shown (e.g. `W15 → Mon 12 Apr 2027`).
   - Validation: start ≤ end; both within 1–52; warn on overlap of two milestones on the same line (allowed, but flagged); warn when an **EOP milestone falls after the line’s EOP date** or the line’s EOP year is earlier than the milestone year.
4. **Drag to move** a bar and **drag its edges to resize** (start/end week); show a tooltip with the new weeks; validate before applying.
5. **Inline edit** of project name and EOP directly in the grid cells.
6. Quick-add row at the end of each BU (“+ Add project line”) and quick-add milestone via double-click.
7. **Undo / redo** (last 20 actions) and an **edit log** (who/when is not needed — timestamp + description is enough).

### 7.3 Propagation (single source of truth)
- The milestone is the parent of tasks. Changing a milestone’s weeks moves its default planning window; tasks with their own explicit dates are **flagged for review**, not silently moved.
- Deleting a milestone or line that has tasks must ask for confirmation and offer: delete the tasks, or keep them as “orphan – needs milestone”.
- Everything (dashboard, calendar, plant planning, reports) is derived from the same store; no duplicated copies.

### 7.4 Import / export
- Export the plan as **JSON** (same schema as `milestones.json`) and **CSV** (BU, Project, EOP, Plant, Milestone, Type, Start Week, End Week, Start Date, End Date).
- Import a JSON/CSV file with validation and a preview of changes before applying.
- **Reset to source** restores `milestones.json` (after confirmation).

## 8. Module 3 — Projects & Milestones
List/filter project lines (BU, plant, EOP, period). A project detail page shows BU, project, plant, EOP, milestone timeline (from the Milestone Planner), tasks per milestone, assigned technicians, planned vs unassigned effort, completion status, upcoming deadlines and conflicts.

## 9. Persistence — `localStorage` as temporary database

- Use a **repository layer** (`src/storage/repository.js`) exposing `load(key)`, `save(key, value)`, `reset(key)`, `exportAll()`, `importAll(data)`; components never call `localStorage` directly. This keeps the app ready for a future backend/API.
- Keys (versioned): `cad.v1.milestones`, `cad.v1.organization`, `cad.v1.tasks`, `cad.v1.assignments`, `cad.v1.settings`, `cad.v1.editLog`.
- **First load:** seed from `milestones.json` and `organization.json`. **Next loads:** read from `localStorage`. Never overwrite user data with the seed unless the user clicks **Reset**.
- Wrap every read/write in `try/catch` (quota, private mode, corrupted JSON) and fall back to in-memory state with a visible warning.
- Store `schemaVersion`; add a small migration function for future changes.
- Auto-save on every change (debounced) and show a “Saved locally · hh:mm” indicator.
- Buttons: **Export all (JSON backup)**, **Import backup**, **Reset to source data**, **Clear demo data**.

## 10. Module 4 — Milestone Task Designer
**The coordinator clicks any milestone and defines its own task list.** Different milestones (EOP, SOP, VS, DOC…) need different tasks; never assume a standard list. An EOP milestone initially shows `No tasks defined for this milestone.` with an **Add Task** button.

Show: milestone name/type, BU, project, plant, weeks and dates, status, task list, total estimated hours, allocated vs unallocated hours, assignments.

Task form: name, description, estimated duration (h/min), optional start/end (default: a button **“Use milestone window”** sets them from the milestone’s start/end week), priority, status, required skills, plant, technician (optional), notes.

Actions: create, edit, delete (confirmation), duplicate, assign, change duration, change status. Task creation immediately updates milestone effort, technician availability, plant planning, dashboard and calendar. Warn when a milestone is approaching (next 4 weeks) and has no tasks.

Illustrative example (not data): *Project A · SOP* — Prepare CAD documentation 6 h (Technician A), Verify drawing consistency 3 h (Technician B), Finalize documentation 4 h (Unassigned) → total 13 h.

## 11. Module 5 — Task Allocation
Workspace: select project line → milestone → tasks → plant → candidate technicians → assign → review impact → confirm.

Candidate card: name/identifier, home plant, weekly capacity (40 h), hours already allocated **during the task period**, remaining hours, utilization, existing projects, skills, conflicts. Recommend technicians by available capacity **in the requested period** (not only overall weekly capacity), plant, skills and existing schedule. Cross-plant assignment only when explicitly allowed by the coordinator and flagged for review. Prevent double allocation of the same task.

## 12. Module 6 — Technician Availability
Directory with: name, plant, weekly capacity, planned workload, remaining availability, utilization, projects, tasks, current task, upcoming assignments; daily / weekly / monthly views.

Configurable default thresholds (planning thresholds, not company policy): Available < 70 %; Moderate 70 % to < 90 %; High 90–100 %; Overloaded > 100 %. Show exact hours next to percentages.
Example: Technician A — YMM1 — 40 h capacity, 28 h allocated → 12 h remaining · 70 % · Moderate workload.

## 13. Module 7 — Plant Resource Planning
For YMM1, YMM2, YMOK, YMK, YMOT, SATELLITES: technicians, projects, upcoming milestones, planned hours, capacity, remaining capacity, utilization, unassigned tasks, overloaded technicians, workload by week. Plant comparison chart, **weekly capacity matrix (W01–W52)**, identification of plants with spare capacity, periods where demand exceeds local capacity, and redistribution opportunities. Cross-plant reallocation is an explicit decision, never automatic. Keep a technician’s home plant separate from the project’s plant.

## 14. Module 8 — Project Assignments
Two views derived from task assignments (no duplicated data): **Project-centric** (Project · Plant · Milestone · Technician · Hours) and **Technician-centric** (Technician · Home plant · Projects · Hours · Availability). Filters: project, plant, technician, milestone, period. Highlight projects with insufficient resources.

## 15. Module 9 — Workload Calendar
Technicians as rows, weeks (or days) as columns; blocks for assigned, unassigned, completed and overdue tasks; milestone deadlines (from the Milestone Planner); conflicts; remaining capacity; non-working days greyed. Week navigation and date filters. Drag-and-drop rescheduling where practical, with capacity validation. A task is not “completed” just because its end date has passed.

## 16. Module 10 — Reports & Analytics
Workload by plant / technician / project; milestone task completion; unassigned workload; utilization; weekly capacity vs demand; forecast for upcoming milestones; resource conflicts and missing data. Filter by period and plant. CSV export. Distinguish **planned**, **actual** and **remaining estimated** hours.

## 17. Workload Calculation Engine
Reusable pure functions in `src/utils/` (with unit-testable examples):

- `dailyCapacity = 8`, `weeklyCapacity = 40` (from settings).
- Planned workload = sum of estimated hours of active tasks overlapping the period; spread across working days only (never Saturday/Sunday), max 8 h/day/technician.
- Remaining = capacity − allocated; Utilization = allocated / capacity × 100.
- Milestone effort = sum of its tasks; project effort = sum of tasks across its milestones. Count each task once.
- Tasks without dates = **unscheduled workload** (not placed in any week).
- Completed tasks stay in history but stop consuming future capacity.
- Week ↔ date helpers using `meta.weeks` (ISO-8601, W01 of 2027 = Monday 2027-01-04; this is an assumption stated in the UI).
- Self-test: the 22.5 h / 40 h example must return 17.5 h and 56.25 %.

## 18. Demo / Presentation Mode
- Because real tasks and technician names do not exist yet, provide a **“Load illustrative demo tasks”** action that generates sample tasks from real milestones (e.g. SOP, VS, DOC) and assigns them to technician slots. Every demo record has `origin: "demo"`, shows a DEMO badge, and can be removed with **Clear demo data**.
- A **Presentation mode** toggle hides editing controls, enlarges KPIs and keeps the dashboard, Milestone Planner, Plant Planning and Calendar readable on a projector.

## 19. UI/UX
Enterprise dashboard: light grey/white workspace, dark navy sidebar, restrained red accents (Yazaki-inspired), modern typography, compact KPI cards, readable dense tables, consistent status colours, responsive (desktop first, tablet/mobile supported). Lucide React icons, Recharts. Avoid unnecessary animation, oversized cards and generic template looks. UI language: English.

## 20. Technology and Structure
React functional components + Hooks, Vite, CSS Modules (or plain CSS), Recharts, lucide-react, client-side state (Context + reducer, or Zustand), `localStorage` via the repository layer. No backend, no authentication.

```
src/
  App.jsx
  data/            milestones.json  organization.json  (seed, read-only)
  storage/         repository.js  seed.js  migrations.js
  state/           store.js (context + reducer)  actions.js
  components/      Sidebar  Header  KPICards  MilestoneGrid  MilestoneBar  MilestoneForm
                   LineForm  BUForm  TaskForm  MilestoneTaskList  TaskAllocationBoard
                   TechnicianAvailability  PlantCapacityMatrix  ProjectAssignments
                   WorkloadCalendar  WorkloadCharts  OrgChart  DataQualityPanel
  pages/           Dashboard  MilestonePlanner  ProjectsMilestones  MilestoneTaskDesigner
                   TaskAllocation  Technicians  PlantPlanning  ProjectAssignmentsPage
                   Calendar  Reports  Organization  SettingsData
  utils/           capacityCalculations  scheduling  weekCalendar  workloadAggregation  csv
  styles/
```

## 21. Data Model (TypeScript-style, for reference)

```
BusinessUnit { id, name, plantGroup, plant|null, origin }
ProjectLine  { id, sourceRow|null, bu, project, plantGroup, plant|null,
               eop { raw, year|null, month|null, precision, status },
               milestones: Milestone[], origin, notes? }
Milestone    { id, label, type, startWeek(1-52), endWeek(1-52), startDate, endDate,
               sourceColor|null, origin, status?, notes? }
Task         { id, milestoneId, lineId, name, description, estimatedMinutes, priority,
               status, startDate?, endDate?, plant, technicianId|null, skills[], origin }
Person       { id, role, plantId, name|null, reportsTo, positionStatus, weeklyCapacityHours, skills[] }
```
Technician assignment lives **only** on `Task.technicianId`; everything else is derived.

## 22. Acceptance Criteria — workflows that must work end to end

**A. Fill the milestone plan dynamically.** Add a BU → add a project line with an EOP (e.g. `06/2028`) → add a milestone `SOP` with start week 20 and end week 22 → the bar appears on W20–W22 in the grid, in the Projects page and on the dashboard milestone-per-week chart; edit the weeks, drag the bar, undo.
**B. Define milestone activities.** Open a project → select its SOP → Add Task → save → milestone effort updates.
**C. Allocate a technician.** Open a task → pick plant → compare candidates → assign → available hours and utilization update (22.5 h of 40 h → 17.5 h, 56.25 %).
**D. Check availability.** Technician directory → select a technician → projects/tasks → daily/weekly availability → overlaps and conflicts.
**E. Manage projects.** Open a project → milestones, tasks, assigned technicians, total effort, unassigned tasks.
**F. Anticipate workload.** Select a week → compare plant demand vs capacity → find overloaded technicians/plants → test an alternative assignment.
**G. Persistence.** Create/edit a milestone and a task, assign a technician, navigate away, reload the browser → everything is still there; **Reset to source data** restores the original files.
**H. Presentation.** Load demo tasks → open Presentation mode → dashboard, Milestone Planner, Plant Planning and Calendar tell the workload story; Clear demo data returns to real data only.

## 23. Delivery Instructions
Deliver a complete runnable project: full source code, install and launch commands (`npm install`, `npm run dev`, `npm run build`), the two JSON seed files, a README with the source-data mapping (Excel columns B/C/D/E→BD → BU/Project/EOP/W01–W52; org-chart boxes → people), assumptions, missing data and data-quality warnings. No pseudocode. Prioritize working milestone entry, task management, allocation and accurate capacity calculations over decoration.

**Final objective:** one centralized tool that lets the CAD Coordinator maintain the milestone plan (BU, project, EOP, start/end week), define the work behind each milestone, assign it to technicians across the six plants, and make the CAD department workload visible to the PPC Director before peaks become problems.

Start by loading `milestones.json` and `organization.json`, build the store and repository layer, then the Milestone Planner, then the remaining modules.


---

# APPENDIX A — `src/data/milestones.json`

Shape: `{ meta, businessUnits, projectLines }`, condensed (one project line per row). Identical content to the standalone `milestones.json`.

```json
{"meta":{"source":{"file":"Milestones 2027 (YMM1 - YMM2 - YMOK).xlsx","sheet":"PPC CAD Milestone","preparedBy":"Nizar HESSINA","year":2027,"extractedOn":"2026-10-18"},"schemaVersion":1,"glossary":{"EOP":"End of Production","SOP":"Start of Production"},"periods":[{"id":"P86-2","startWeek":1,"endWeek":25},{"id":"P87-1","startWeek":26,"endWeek":52}],"months":[{"month":1,"label":"janv-27","startWeek":1,"endWeek":4},{"month":2,"label":"févr-27","startWeek":5,"endWeek":8},{"month":3,"label":"mars-27","startWeek":9,"endWeek":12},{"month":4,"label":"avr-27","startWeek":13,"endWeek":17},{"month":5,"label":"mai-27","startWeek":18,"endWeek":21},{"month":6,"label":"juin-27","startWeek":22,"endWeek":25},{"month":7,"label":"juil-27","startWeek":26,"endWeek":30},{"month":8,"label":"août-27","startWeek":31,"endWeek":34},{"month":9,"label":"sept-27","startWeek":35,"endWeek":39},{"month":10,"label":"oct-27","startWeek":40,"endWeek":43},{"month":11,"label":"nov-27","startWeek":44,"endWeek":47},{"month":12,"label":"déc-27","startWeek":48,"endWeek":52}],"milestoneTypes":[{"type":"EOP","label":"End of Production","color":"#FF0000","textColor":"#FFFFFF"},{"type":"SOP","label":"Start of Production","color":"#66FF33","textColor":"#000000","altColor":"#002060","altTextColor":"#FFFF00"},{"type":"VS","label":"VS (as labelled in source)","color":"#2E75B6","textColor":"#FFFFFF"},{"type":"DOC","label":"DOC (as labelled in source)","color":"#2E75B6","textColor":"#FFFFFF"},{"type":"PRE_SERIAL","label":"Pre Serial","color":"#2E75B6","textColor":"#FFFFFF"},{"type":"TR","label":"TR (as labelled in source)","color":"#2E75B6","textColor":"#FFFFFF"},{"type":"CF","label":"CF gate (Toyota, as labelled)","color":"#FFFF00","textColor":"#000000"},{"type":"OTHER","label":"Other (kept verbatim)","color":"#F4B183","textColor":"#000000"}],"weeks":[{"week":1,"id":"W01","isoWeek":"2027-W01","monday":"2027-01-04","friday":"2027-01-08"},{"week":2,"id":"W02","isoWeek":"2027-W02","monday":"2027-01-11","friday":"2027-01-15"},{"week":3,"id":"W03","isoWeek":"2027-W03","monday":"2027-01-18","friday":"2027-01-22"},{"week":4,"id":"W04","isoWeek":"2027-W04","monday":"2027-01-25","friday":"2027-01-29"},{"week":5,"id":"W05","isoWeek":"2027-W05","monday":"2027-02-01","friday":"2027-02-05"},{"week":6,"id":"W06","isoWeek":"2027-W06","monday":"2027-02-08","friday":"2027-02-12"},{"week":7,"id":"W07","isoWeek":"2027-W07","monday":"2027-02-15","friday":"2027-02-19"},{"week":8,"id":"W08","isoWeek":"2027-W08","monday":"2027-02-22","friday":"2027-02-26"},{"week":9,"id":"W09","isoWeek":"2027-W09","monday":"2027-03-01","friday":"2027-03-05"},{"week":10,"id":"W10","isoWeek":"2027-W10","monday":"2027-03-08","friday":"2027-03-12"},{"week":11,"id":"W11","isoWeek":"2027-W11","monday":"2027-03-15","friday":"2027-03-19"},{"week":12,"id":"W12","isoWeek":"2027-W12","monday":"2027-03-22","friday":"2027-03-26"},{"week":13,"id":"W13","isoWeek":"2027-W13","monday":"2027-03-29","friday":"2027-04-02"},{"week":14,"id":"W14","isoWeek":"2027-W14","monday":"2027-04-05","friday":"2027-04-09"},{"week":15,"id":"W15","isoWeek":"2027-W15","monday":"2027-04-12","friday":"2027-04-16"},{"week":16,"id":"W16","isoWeek":"2027-W16","monday":"2027-04-19","friday":"2027-04-23"},{"week":17,"id":"W17","isoWeek":"2027-W17","monday":"2027-04-26","friday":"2027-04-30"},{"week":18,"id":"W18","isoWeek":"2027-W18","monday":"2027-05-03","friday":"2027-05-07"},{"week":19,"id":"W19","isoWeek":"2027-W19","monday":"2027-05-10","friday":"2027-05-14"},{"week":20,"id":"W20","isoWeek":"2027-W20","monday":"2027-05-17","friday":"2027-05-21"},{"week":21,"id":"W21","isoWeek":"2027-W21","monday":"2027-05-24","friday":"2027-05-28"},{"week":22,"id":"W22","isoWeek":"2027-W22","monday":"2027-05-31","friday":"2027-06-04"},{"week":23,"id":"W23","isoWeek":"2027-W23","monday":"2027-06-07","friday":"2027-06-11"},{"week":24,"id":"W24","isoWeek":"2027-W24","monday":"2027-06-14","friday":"2027-06-18"},{"week":25,"id":"W25","isoWeek":"2027-W25","monday":"2027-06-21","friday":"2027-06-25"},{"week":26,"id":"W26","isoWeek":"2027-W26","monday":"2027-06-28","friday":"2027-07-02"},{"week":27,"id":"W27","isoWeek":"2027-W27","monday":"2027-07-05","friday":"2027-07-09"},{"week":28,"id":"W28","isoWeek":"2027-W28","monday":"2027-07-12","friday":"2027-07-16"},{"week":29,"id":"W29","isoWeek":"2027-W29","monday":"2027-07-19","friday":"2027-07-23"},{"week":30,"id":"W30","isoWeek":"2027-W30","monday":"2027-07-26","friday":"2027-07-30"},{"week":31,"id":"W31","isoWeek":"2027-W31","monday":"2027-08-02","friday":"2027-08-06"},{"week":32,"id":"W32","isoWeek":"2027-W32","monday":"2027-08-09","friday":"2027-08-13"},{"week":33,"id":"W33","isoWeek":"2027-W33","monday":"2027-08-16","friday":"2027-08-20"},{"week":34,"id":"W34","isoWeek":"2027-W34","monday":"2027-08-23","friday":"2027-08-27"},{"week":35,"id":"W35","isoWeek":"2027-W35","monday":"2027-08-30","friday":"2027-09-03"},{"week":36,"id":"W36","isoWeek":"2027-W36","monday":"2027-09-06","friday":"2027-09-10"},{"week":37,"id":"W37","isoWeek":"2027-W37","monday":"2027-09-13","friday":"2027-09-17"},{"week":38,"id":"W38","isoWeek":"2027-W38","monday":"2027-09-20","friday":"2027-09-24"},{"week":39,"id":"W39","isoWeek":"2027-W39","monday":"2027-09-27","friday":"2027-10-01"},{"week":40,"id":"W40","isoWeek":"2027-W40","monday":"2027-10-04","friday":"2027-10-08"},{"week":41,"id":"W41","isoWeek":"2027-W41","monday":"2027-10-11","friday":"2027-10-15"},{"week":42,"id":"W42","isoWeek":"2027-W42","monday":"2027-10-18","friday":"2027-10-22"},{"week":43,"id":"W43","isoWeek":"2027-W43","monday":"2027-10-25","friday":"2027-10-29"},{"week":44,"id":"W44","isoWeek":"2027-W44","monday":"2027-11-01","friday":"2027-11-05"},{"week":45,"id":"W45","isoWeek":"2027-W45","monday":"2027-11-08","friday":"2027-11-12"},{"week":46,"id":"W46","isoWeek":"2027-W46","monday":"2027-11-15","friday":"2027-11-19"},{"week":47,"id":"W47","isoWeek":"2027-W47","monday":"2027-11-22","friday":"2027-11-26"},{"week":48,"id":"W48","isoWeek":"2027-W48","monday":"2027-11-29","friday":"2027-12-03"},{"week":49,"id":"W49","isoWeek":"2027-W49","monday":"2027-12-06","friday":"2027-12-10"},{"week":50,"id":"W50","isoWeek":"2027-W50","monday":"2027-12-13","friday":"2027-12-17"},{"week":51,"id":"W51","isoWeek":"2027-W51","monday":"2027-12-20","friday":"2027-12-24"},{"week":52,"id":"W52","isoWeek":"2027-W52","monday":"2027-12-27","friday":"2027-12-31"}],"dataQuality":[{"id":"DQ-01","severity":"info","text":"The workbook contains a single worksheet, 'PPC CAD Milestone'. No 'PPC CAD P1' sheet exists."},{"id":"DQ-02","severity":"warning","lines":["LINE-R31","LINE-R32","LINE-R33"],"text":"EOP cells D31:D33 (XCB / Megane E-Tech) contain the number 2029 formatted as a date (displayed 'juil-05'). Interpreted as year 2029 — to be confirmed."},{"id":"DQ-03","severity":"warning","lines":["LINE-R59","LINE-R60","LINE-R61","LINE-R62","LINE-R63","LINE-R64","LINE-R65","LINE-R66","LINE-R67","LINE-R69","LINE-R70","LINE-R71","LINE-R72","LINE-R73","LINE-R74","LINE-R75","LINE-R76","LINE-R77","LINE-R79","LINE-R80","LINE-R81","LINE-R82","LINE-R83","LINE-R84","LINE-R85"],"text":"Mercedes (25 lines, YMOK): no EOP and no milestone in the source. Data Required."},{"id":"DQ-04","severity":"warning","text":"Ford (YMOK, B87:B94): BU label present but no project line, EOP or milestone. Data Required."},{"id":"DQ-05","severity":"warning","text":"The source does not say whether a 'YMM1 & YMM2' line belongs to YMM1 or YMM2. Plant is left null (TBC) and must be set in the app."},{"id":"DQ-06b","severity":"warning","lines":["LINE-R41","LINE-R42"],"text":"XHN Program: EOP 07/2030 appears on the first row only (row 40); rows 41–42 are blank in the source. They probably share it — to be confirmed, not assumed."},{"id":"DQ-06","severity":"warning","lines":["LINE-R54"],"text":"EOP is 'TBC' in the source."},{"id":"DQ-07","severity":"warning","lines":["LINE-R49","LINE-R53","LINE-R56"],"text":"EOP year earlier than 2027 (source values 2025/2026). Check whether these lines are still active in 2027; two of them carry an 'EOP' milestone in W01 2027."},{"id":"DQ-08","severity":"info","lines":["LINE-R06","LINE-R08","LINE-R16","LINE-R17","LINE-R18","LINE-R19","LINE-R25","LINE-R29","LINE-R31","LINE-R33","LINE-R34","LINE-R35","LINE-R40","LINE-R43","LINE-R47","LINE-R48","LINE-R51","LINE-R54","LINE-R56"],"text":"Lines with an EOP but no 2027 milestone in the grid (excluding Mercedes)."},{"id":"DQ-09","severity":"info","groups":[["LINE-R05","LINE-R06"],["LINE-R09","LINE-R10","LINE-R11","LINE-R12"],["LINE-R13","LINE-R14"],["LINE-R16","LINE-R17","LINE-R18","LINE-R19"],["LINE-R21","LINE-R22","LINE-R23"],["LINE-R25","LINE-R26","LINE-R27"],["LINE-R31","LINE-R32","LINE-R33"],["LINE-R35","LINE-R36","LINE-R37","LINE-R38"],["LINE-R41","LINE-R42"],["LINE-R43","LINE-R44","LINE-R45"],["LINE-R47","LINE-R48"],["LINE-R49","LINE-R53"]],"text":"Several rows share the same BU, project and EOP (e.g. G7x SP25 Serie 7 ×4). The source does not state what distinguishes them; rows are kept separate and identified by sourceRow."},{"id":"DQ-10","severity":"info","text":"Milestone types are inferred from label text (typeInferred=true). The source colours are kept in sourceColor. Only EOP (End of Production) and SOP (Start of Production) are defined by the business; other acronyms are kept verbatim."},{"id":"DQ-11","severity":"info","text":"Week numbers W01–W52 are taken from the sheet header. Calendar dates assume ISO-8601 weeks (W01 = Monday 2027-01-04); this mapping is an assumption."},{"id":"DQ-12","severity":"info","text":"Only two milestones span several weeks in the source: PU11-27 VS2 (W15–W19) and PU11-27 DOC (W27–W29). All others occupy one week (startWeek = endWeek)."}]},
"businessUnits":[{"id":"BMW","name":"BMW","plantGroup":"YMM1 & YMM2","plant":null,"origin":"source"},{"id":"TOYOTA","name":"TOYOTA","plantGroup":"YMM1 & YMM2","plant":null,"origin":"source"},{"id":"NISSAN","name":"NISSAN","plantGroup":"YMM1 & YMM2","plant":null,"origin":"source"},{"id":"RNBU","name":"RNBU","plantGroup":"YMM1 & YMM2","plant":null,"origin":"source"},{"id":"MERCEDES","name":"Mercedes","plantGroup":"YMOK","plant":null,"origin":"source"},{"id":"FORD","name":"Ford","plantGroup":"YMOK","plant":null,"origin":"source"}],
"projectLines":[
{"id":"LINE-R05","sourceRow":5,"bu":"BMW","project":"NCAR","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"10/2034","year":2034,"month":10,"precision":"month","status":"Source"},"milestones":[{"id":"M-R5-W15","label":"PU11-27 VS2","type":"VS","typeInferred":true,"startWeek":15,"endWeek":19,"startDate":"2027-04-12","endDate":"2027-05-14","sourceCell":"S5","sourceColor":"#2F5496","origin":"source"},{"id":"M-R5-W27","label":"PU11-27 DOC","type":"DOC","typeInferred":true,"startWeek":27,"endWeek":29,"startDate":"2027-07-05","endDate":"2027-07-23","sourceCell":"AE5","sourceColor":"#2F5496","origin":"source"},{"id":"M-R5-W38","label":"PU11-27 SOP","type":"SOP","typeInferred":true,"startWeek":38,"endWeek":38,"startDate":"2027-09-20","endDate":"2027-09-24","sourceCell":"AP5","sourceColor":"#2F5496","origin":"source"}],"origin":"source"},
{"id":"LINE-R06","sourceRow":6,"bu":"BMW","project":"NCAR","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"10/2034","year":2034,"month":10,"precision":"month","status":"Source"},"milestones":[],"origin":"source"},
{"id":"LINE-R07","sourceRow":7,"bu":"BMW","project":"G6x SP21","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"06/2027","year":2027,"month":6,"precision":"month","status":"Source"},"milestones":[{"id":"M-R7-W25","label":"EOP","type":"EOP","typeInferred":true,"startWeek":25,"endWeek":25,"startDate":"2027-06-21","endDate":"2027-06-25","sourceCell":"AC7","sourceColor":"#FF0000","origin":"source"}],"origin":"source"},
{"id":"LINE-R08","sourceRow":8,"bu":"BMW","project":"I20","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"06/2028","year":2028,"month":6,"precision":"month","status":"Source"},"milestones":[],"origin":"source"},
{"id":"LINE-R09","sourceRow":9,"bu":"BMW","project":"G7x SP25 Serie 7","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"10/2032","year":2032,"month":10,"precision":"month","status":"Source"},"milestones":[{"id":"M-R9-W23","label":"EOP PU03-26","type":"EOP","typeInferred":true,"startWeek":23,"endWeek":23,"startDate":"2027-06-07","endDate":"2027-06-11","sourceCell":"AA9","sourceColor":"#FF0000","origin":"source"}],"origin":"source","sourceProjectLabel":"G7x SP25\nSerie 7"},
{"id":"LINE-R10","sourceRow":10,"bu":"BMW","project":"G7x SP25 Serie 7","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"10/2032","year":2032,"month":10,"precision":"month","status":"Source"},"milestones":[{"id":"M-R10-W23","label":"EOP PU07-26","type":"EOP","typeInferred":true,"startWeek":23,"endWeek":23,"startDate":"2027-06-07","endDate":"2027-06-11","sourceCell":"AA10","sourceColor":"#FF0000","origin":"source"}],"origin":"source","sourceProjectLabel":"G7x SP25\nSerie 7"},
{"id":"LINE-R11","sourceRow":11,"bu":"BMW","project":"G7x SP25 Serie 7","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"10/2032","year":2032,"month":10,"precision":"month","status":"Source"},"milestones":[{"id":"M-R11-W02","label":"SOP PU03-27","type":"SOP","typeInferred":true,"startWeek":2,"endWeek":2,"startDate":"2027-01-11","endDate":"2027-01-15","sourceCell":"F11","sourceColor":"#002060","origin":"source"}],"origin":"source","sourceProjectLabel":"G7x SP25\nSerie 7"},
{"id":"LINE-R12","sourceRow":12,"bu":"BMW","project":"G7x SP25 Serie 7","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"10/2032","year":2032,"month":10,"precision":"month","status":"Source"},"milestones":[{"id":"M-R12-W02","label":"VS2 PU07-27","type":"VS","typeInferred":true,"startWeek":2,"endWeek":2,"startDate":"2027-01-11","endDate":"2027-01-15","sourceCell":"F12","sourceColor":"#2E75B6","origin":"source"},{"id":"M-R12-W23","label":"SOP PU03-27","type":"SOP","typeInferred":true,"startWeek":23,"endWeek":23,"startDate":"2027-06-07","endDate":"2027-06-11","sourceCell":"AA12","sourceColor":"#002060","origin":"source"}],"origin":"source","sourceProjectLabel":"G7x SP25\nSerie 7"},
{"id":"LINE-R13","sourceRow":13,"bu":"BMW","project":"G6x & G9x SP25 (serie 5)","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"06/2032","year":2032,"month":6,"precision":"month","status":"Source"},"milestones":[{"id":"M-R13-W04","label":"VS2","type":"VS","typeInferred":true,"startWeek":4,"endWeek":4,"startDate":"2027-01-25","endDate":"2027-01-29","sourceCell":"H13","sourceColor":"#2E75B6","origin":"source"},{"id":"M-R13-W13","label":"Pre Serial","type":"PRE_SERIAL","typeInferred":true,"startWeek":13,"endWeek":13,"startDate":"2027-03-29","endDate":"2027-04-02","sourceCell":"Q13","sourceColor":"#2E75B6","origin":"source"},{"id":"M-R13-W22","label":"SOP","type":"SOP","typeInferred":true,"startWeek":22,"endWeek":22,"startDate":"2027-05-31","endDate":"2027-06-04","sourceCell":"Z13","sourceColor":"#66FF33","origin":"source"}],"origin":"source","sourceProjectLabel":"G6x & G9x SP25\n(serie 5)"},
{"id":"LINE-R14","sourceRow":14,"bu":"BMW","project":"G6x & G9x SP25 (serie 5)","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"06/2032","year":2032,"month":6,"precision":"month","status":"Source"},"milestones":[{"id":"M-R14-W16","label":"VS1","type":"VS","typeInferred":true,"startWeek":16,"endWeek":16,"startDate":"2027-04-19","endDate":"2027-04-23","sourceCell":"T14","sourceColor":"#2E75B6","origin":"source"},{"id":"M-R14-W34","label":"VS2","type":"VS","typeInferred":true,"startWeek":34,"endWeek":34,"startDate":"2027-08-23","endDate":"2027-08-27","sourceCell":"AL14","sourceColor":"#2E75B6","origin":"source"},{"id":"M-R14-W41","label":"DOC","type":"DOC","typeInferred":true,"startWeek":41,"endWeek":41,"startDate":"2027-10-11","endDate":"2027-10-15","sourceCell":"AS14","sourceColor":"#2E75B6","origin":"source"}],"origin":"source","sourceProjectLabel":"G6x & G9x SP25\n(serie 5)"},
{"id":"LINE-R16","sourceRow":16,"bu":"TOYOTA","project":"YARIS","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"2029","year":2029,"month":null,"precision":"year","status":"Source"},"milestones":[],"origin":"source"},
{"id":"LINE-R17","sourceRow":17,"bu":"TOYOTA","project":"YARIS","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"2029","year":2029,"month":null,"precision":"year","status":"Source"},"milestones":[],"origin":"source"},
{"id":"LINE-R18","sourceRow":18,"bu":"TOYOTA","project":"YARIS","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"2029","year":2029,"month":null,"precision":"year","status":"Source"},"milestones":[],"origin":"source"},
{"id":"LINE-R19","sourceRow":19,"bu":"TOYOTA","project":"YARIS","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"2029","year":2029,"month":null,"precision":"year","status":"Source"},"milestones":[],"origin":"source"},
{"id":"LINE-R20","sourceRow":20,"bu":"TOYOTA","project":"AYGO","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"2029","year":2029,"month":null,"precision":"year","status":"Source"},"milestones":[{"id":"M-R20-W48","label":"SOP L5 +smalls","type":"SOP","typeInferred":true,"startWeek":48,"endWeek":48,"startDate":"2027-11-29","endDate":"2027-12-03","sourceCell":"AZ20","sourceColor":"#66FF33","origin":"source"}],"origin":"source"},
{"id":"LINE-R21","sourceRow":21,"bu":"TOYOTA","project":"corolla sedan","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"2034","year":2034,"month":null,"precision":"year","status":"Source"},"milestones":[{"id":"M-R21-W03","label":"CF2 (YOT-K)","type":"CF","typeInferred":true,"startWeek":3,"endWeek":3,"startDate":"2027-01-18","endDate":"2027-01-22","sourceCell":"G21","sourceColor":"#FFFF00","origin":"source"},{"id":"M-R21-W12","label":"CF2.5 (YMM)","type":"CF","typeInferred":true,"startWeek":12,"endWeek":12,"startDate":"2027-03-22","endDate":"2027-03-26","sourceCell":"P21","sourceColor":"#FFFF00","origin":"source"},{"id":"M-R21-W25","label":"CF3 / 1A","type":"CF","typeInferred":true,"startWeek":25,"endWeek":25,"startDate":"2027-06-21","endDate":"2027-06-25","sourceCell":"AC21","sourceColor":"#FFFF00","origin":"source"},{"id":"M-R21-W42","label":"CF4 / MPT-A","type":"CF","typeInferred":true,"startWeek":42,"endWeek":42,"startDate":"2027-10-18","endDate":"2027-10-22","sourceCell":"AT21","sourceColor":"#66FF33","origin":"source"}],"origin":"source"},
{"id":"LINE-R22","sourceRow":22,"bu":"TOYOTA","project":"corolla sedan","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"2034","year":2034,"month":null,"precision":"year","status":"Source"},"milestones":[{"id":"M-R22-W03","label":"CF2 (YOT-K)","type":"CF","typeInferred":true,"startWeek":3,"endWeek":3,"startDate":"2027-01-18","endDate":"2027-01-22","sourceCell":"G22","sourceColor":"#FFFF00","origin":"source"},{"id":"M-R22-W12","label":"CF2.5 (YMM)","type":"CF","typeInferred":true,"startWeek":12,"endWeek":12,"startDate":"2027-03-22","endDate":"2027-03-26","sourceCell":"P22","sourceColor":"#FFFF00","origin":"source"},{"id":"M-R22-W25","label":"CF3 / 1A","type":"CF","typeInferred":true,"startWeek":25,"endWeek":25,"startDate":"2027-06-21","endDate":"2027-06-25","sourceCell":"AC22","sourceColor":"#FFFF00","origin":"source"},{"id":"M-R22-W42","label":"CF4 / MPT-A","type":"CF","typeInferred":true,"startWeek":42,"endWeek":42,"startDate":"2027-10-18","endDate":"2027-10-22","sourceCell":"AT22","sourceColor":"#66FF33","origin":"source"}],"origin":"source"},
{"id":"LINE-R23","sourceRow":23,"bu":"TOYOTA","project":"corolla sedan","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"2034","year":2034,"month":null,"precision":"year","status":"Source"},"milestones":[{"id":"M-R23-W03","label":"CF2 (YOT-K)","type":"CF","typeInferred":true,"startWeek":3,"endWeek":3,"startDate":"2027-01-18","endDate":"2027-01-22","sourceCell":"G23","sourceColor":"#FFFF00","origin":"source"},{"id":"M-R23-W12","label":"CF2.5 (YMM)","type":"CF","typeInferred":true,"startWeek":12,"endWeek":12,"startDate":"2027-03-22","endDate":"2027-03-26","sourceCell":"P23","sourceColor":"#FFFF00","origin":"source"},{"id":"M-R23-W25","label":"CF3 / 1A","type":"CF","typeInferred":true,"startWeek":25,"endWeek":25,"startDate":"2027-06-21","endDate":"2027-06-25","sourceCell":"AC23","sourceColor":"#FFFF00","origin":"source"},{"id":"M-R23-W42","label":"CF4 / MPT-A","type":"CF","typeInferred":true,"startWeek":42,"endWeek":42,"startDate":"2027-10-18","endDate":"2027-10-22","sourceCell":"AT23","sourceColor":"#66FF33","origin":"source"}],"origin":"source"},
{"id":"LINE-R25","sourceRow":25,"bu":"NISSAN","project":"P33B Kashqai","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"07/2027","year":2027,"month":7,"precision":"month","status":"Source"},"milestones":[],"origin":"source","sourceProjectLabel":"P33B\nKashqai"},
{"id":"LINE-R26","sourceRow":26,"bu":"NISSAN","project":"P33B Kashqai","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"07/2027","year":2027,"month":7,"precision":"month","status":"Source"},"milestones":[{"id":"M-R26-W22","label":"EOP MY26","type":"EOP","typeInferred":true,"startWeek":22,"endWeek":22,"startDate":"2027-05-31","endDate":"2027-06-04","sourceCell":"Z26","sourceColor":"#FF0000","origin":"source"}],"origin":"source","sourceProjectLabel":"P33B\nKashqai"},
{"id":"LINE-R27","sourceRow":27,"bu":"NISSAN","project":"P33B Kashqai","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"07/2027","year":2027,"month":7,"precision":"month","status":"Source"},"milestones":[{"id":"M-R27-W03","label":"PT3 MY27","type":"OTHER","typeInferred":true,"startWeek":3,"endWeek":3,"startDate":"2027-01-18","endDate":"2027-01-22","sourceCell":"G27","sourceColor":"#F4B183","origin":"source"},{"id":"M-R27-W23","label":"SOP","type":"SOP","typeInferred":true,"startWeek":23,"endWeek":23,"startDate":"2027-06-07","endDate":"2027-06-11","sourceCell":"AA27","sourceColor":"#66FF33","origin":"source"}],"origin":"source","sourceProjectLabel":"P33B\nKashqai"},
{"id":"LINE-R29","sourceRow":29,"bu":"RNBU","project":"FlexVan","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"2030","year":2030,"month":null,"precision":"year","status":"Source"},"milestones":[],"origin":"source"},
{"id":"LINE-R31","sourceRow":31,"bu":"RNBU","project":"XCB (Megane E-Tech)","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"2029 (stored as date, displayed 'juil-05')","year":2029,"month":null,"precision":"year","status":"Needs confirmation","note":"Numeric cell 2029 formatted as mmm-yy in the source; interpreted as year 2029."},"milestones":[],"origin":"source","sourceProjectLabel":"XCB\n(Megane E-Tech)"},
{"id":"LINE-R32","sourceRow":32,"bu":"RNBU","project":"XCB (Megane E-Tech)","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"2029 (stored as date, displayed 'juil-05')","year":2029,"month":null,"precision":"year","status":"Needs confirmation","note":"Numeric cell 2029 formatted as mmm-yy in the source; interpreted as year 2029."},"milestones":[{"id":"M-R32-W14","label":"EOP MY26","type":"EOP","typeInferred":true,"startWeek":14,"endWeek":14,"startDate":"2027-04-05","endDate":"2027-04-09","sourceCell":"R32","sourceColor":"#FF0000","origin":"source"}],"origin":"source","sourceProjectLabel":"XCB\n(Megane E-Tech)"},
{"id":"LINE-R33","sourceRow":33,"bu":"RNBU","project":"XCB (Megane E-Tech)","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"2029 (stored as date, displayed 'juil-05')","year":2029,"month":null,"precision":"year","status":"Needs confirmation","note":"Numeric cell 2029 formatted as mmm-yy in the source; interpreted as year 2029."},"milestones":[],"origin":"source","sourceProjectLabel":"XCB\n(Megane E-Tech)"},
{"id":"LINE-R34","sourceRow":34,"bu":"RNBU","project":"XCB (Megane E-Tech)","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"09/2030","year":2030,"month":9,"precision":"month","status":"Source"},"milestones":[],"origin":"source","sourceProjectLabel":"XCB\n(Megane E-Tech)"},
{"id":"LINE-R35","sourceRow":35,"bu":"RNBU","project":"DZ110 (Alpine)","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"09/2030","year":2030,"month":9,"precision":"month","status":"Source"},"milestones":[],"origin":"source","sourceProjectLabel":"DZ110\n(Alpine)"},
{"id":"LINE-R36","sourceRow":36,"bu":"RNBU","project":"DZ110 (Alpine)","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"09/2030","year":2030,"month":9,"precision":"month","status":"Source"},"milestones":[{"id":"M-R36-W14","label":"EOP MY26","type":"EOP","typeInferred":true,"startWeek":14,"endWeek":14,"startDate":"2027-04-05","endDate":"2027-04-09","sourceCell":"R36","sourceColor":"#FF0000","origin":"source"}],"origin":"source","sourceProjectLabel":"DZ110\n(Alpine)"},
{"id":"LINE-R37","sourceRow":37,"bu":"RNBU","project":"DZ110 (Alpine)","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"09/2030","year":2030,"month":9,"precision":"month","status":"Source"},"milestones":[{"id":"M-R37-W12","label":"TR3","type":"TR","typeInferred":true,"startWeek":12,"endWeek":12,"startDate":"2027-03-22","endDate":"2027-03-26","sourceCell":"P37","sourceColor":"#2E75B6","origin":"source"},{"id":"M-R37-W14","label":"SOP TR3","type":"SOP","typeInferred":true,"startWeek":14,"endWeek":14,"startDate":"2027-04-05","endDate":"2027-04-09","sourceCell":"R37","sourceColor":"#002060","origin":"source"},{"id":"M-R37-W37","label":"TR9","type":"TR","typeInferred":true,"startWeek":37,"endWeek":37,"startDate":"2027-09-13","endDate":"2027-09-17","sourceCell":"AO37","sourceColor":"#2E75B6","origin":"source"},{"id":"M-R37-W39","label":"SOP TR9","type":"SOP","typeInferred":true,"startWeek":39,"endWeek":39,"startDate":"2027-09-27","endDate":"2027-10-01","sourceCell":"AQ37","sourceColor":"#002060","origin":"source"}],"origin":"source","sourceProjectLabel":"DZ110\n(Alpine)"},
{"id":"LINE-R38","sourceRow":38,"bu":"RNBU","project":"DZ110 (Alpine)","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"09/2030","year":2030,"month":9,"precision":"month","status":"Source"},"milestones":[{"id":"M-R38-W14","label":"EOP MY26","type":"EOP","typeInferred":true,"startWeek":14,"endWeek":14,"startDate":"2027-04-05","endDate":"2027-04-09","sourceCell":"R38","sourceColor":"#FF0000","origin":"source"}],"origin":"source","sourceProjectLabel":"DZ110\n(Alpine)"},
{"id":"LINE-R40","sourceRow":40,"bu":"RNBU","project":"XHN Program (Austral/New Kadjar)","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"07/2030","year":2030,"month":7,"precision":"month","status":"Source"},"milestones":[],"origin":"source","sourceProjectLabel":"XHN Program\n(Austral/New Kadjar)"},
{"id":"LINE-R41","sourceRow":41,"bu":"RNBU","project":"XHN Program (Austral/New Kadjar)","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[{"id":"M-R41-W21","label":"EOP MY26","type":"EOP","typeInferred":true,"startWeek":21,"endWeek":21,"startDate":"2027-05-24","endDate":"2027-05-28","sourceCell":"Y41","sourceColor":"#FF0000","origin":"source"}],"origin":"source","sourceProjectLabel":"XHN Program\n(Austral/New Kadjar)"},
{"id":"LINE-R42","sourceRow":42,"bu":"RNBU","project":"XHN Program (Austral/New Kadjar)","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[{"id":"M-R42-W08","label":"RT TR3 / VC MY28","type":"TR","typeInferred":true,"startWeek":8,"endWeek":8,"startDate":"2027-02-22","endDate":"2027-02-26","sourceCell":"L42","sourceColor":"#BF9000","origin":"source"},{"id":"M-R42-W13","label":"TDS","type":"OTHER","typeInferred":true,"startWeek":13,"endWeek":13,"startDate":"2027-03-29","endDate":"2027-04-02","sourceCell":"Q42","sourceColor":"#2E75B6","origin":"source"},{"id":"M-R42-W15","label":"PP Cars","type":"OTHER","typeInferred":true,"startWeek":15,"endWeek":15,"startDate":"2027-04-12","endDate":"2027-04-16","sourceCell":"S42","sourceColor":"#2E75B6","origin":"source"},{"id":"M-R42-W21","label":"SOP TR3","type":"SOP","typeInferred":true,"startWeek":21,"endWeek":21,"startDate":"2027-05-24","endDate":"2027-05-28","sourceCell":"Y42","sourceColor":"#002060","origin":"source"},{"id":"M-R42-W28","label":"RT TR9","type":"TR","typeInferred":true,"startWeek":28,"endWeek":28,"startDate":"2027-07-12","endDate":"2027-07-16","sourceCell":"AF42","sourceColor":"#2E75B6","origin":"source"},{"id":"M-R42-W33","label":"TDS","type":"OTHER","typeInferred":true,"startWeek":33,"endWeek":33,"startDate":"2027-08-16","endDate":"2027-08-20","sourceCell":"AK42","sourceColor":"#2E75B6","origin":"source"},{"id":"M-R42-W35","label":"PP Cars","type":"OTHER","typeInferred":true,"startWeek":35,"endWeek":35,"startDate":"2027-08-30","endDate":"2027-09-03","sourceCell":"AM42","sourceColor":"#2E75B6","origin":"source"},{"id":"M-R42-W40","label":"SOP TR9","type":"SOP","typeInferred":true,"startWeek":40,"endWeek":40,"startDate":"2027-10-04","endDate":"2027-10-08","sourceCell":"AR42","sourceColor":"#002060","origin":"source"}],"origin":"source","sourceProjectLabel":"XHN Program\n(Austral/New Kadjar)"},
{"id":"LINE-R43","sourceRow":43,"bu":"RNBU","project":"GSR2 LFF","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"12/2027","year":2027,"month":12,"precision":"month","status":"Source"},"milestones":[],"origin":"source"},
{"id":"LINE-R44","sourceRow":44,"bu":"RNBU","project":"GSR2 LFF","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"12/2027","year":2027,"month":12,"precision":"month","status":"Source"},"milestones":[{"id":"M-R44-W14","label":"EOP MY26","type":"EOP","typeInferred":true,"startWeek":14,"endWeek":14,"startDate":"2027-04-05","endDate":"2027-04-09","sourceCell":"R44","sourceColor":"#FF0000","origin":"source"}],"origin":"source"},
{"id":"LINE-R45","sourceRow":45,"bu":"RNBU","project":"GSR2 LFF","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"12/2027","year":2027,"month":12,"precision":"month","status":"Source"},"milestones":[{"id":"M-R45-W12","label":"TR3","type":"TR","typeInferred":true,"startWeek":12,"endWeek":12,"startDate":"2027-03-22","endDate":"2027-03-26","sourceCell":"P45","sourceColor":"#2E75B6","origin":"source"},{"id":"M-R45-W14","label":"SOP TR3","type":"SOP","typeInferred":true,"startWeek":14,"endWeek":14,"startDate":"2027-04-05","endDate":"2027-04-09","sourceCell":"R45","sourceColor":"#002060","origin":"source"},{"id":"M-R45-W52","label":"EOP","type":"EOP","typeInferred":true,"startWeek":52,"endWeek":52,"startDate":"2027-12-27","endDate":"2027-12-31","sourceCell":"BD45","sourceColor":"#FF0000","origin":"source"}],"origin":"source"},
{"id":"LINE-R47","sourceRow":47,"bu":"RNBU","project":"Batteries","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"03/2030","year":2030,"month":3,"precision":"month","status":"Source"},"milestones":[],"origin":"source"},
{"id":"LINE-R48","sourceRow":48,"bu":"RNBU","project":"Batteries","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"03/2030","year":2030,"month":3,"precision":"month","status":"Source"},"milestones":[],"origin":"source"},
{"id":"LINE-R49","sourceRow":49,"bu":"RNBU","project":"Batteries","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"2026","year":2026,"month":null,"precision":"year","status":"Source"},"milestones":[{"id":"M-R49-W01","label":"EOP","type":"EOP","typeInferred":true,"startWeek":1,"endWeek":1,"startDate":"2027-01-04","endDate":"2027-01-08","sourceCell":"E49","sourceColor":"#FF0000","origin":"source"}],"origin":"source"},
{"id":"LINE-R50","sourceRow":50,"bu":"RNBU","project":"Batteries","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"2027","year":2027,"month":null,"precision":"year","status":"Source"},"milestones":[{"id":"M-R50-W52","label":"EOP","type":"EOP","typeInferred":true,"startWeek":52,"endWeek":52,"startDate":"2027-12-27","endDate":"2027-12-31","sourceCell":"BD50","sourceColor":"#FF0000","origin":"source"}],"origin":"source"},
{"id":"LINE-R51","sourceRow":51,"bu":"RNBU","project":"Batteries","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"2033","year":2033,"month":null,"precision":"year","status":"Source"},"milestones":[],"origin":"source"},
{"id":"LINE-R52","sourceRow":52,"bu":"RNBU","project":"Batteries","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"2029","year":2029,"month":null,"precision":"year","status":"Source"},"milestones":[{"id":"M-R52-W06","label":"PPC Euro7","type":"OTHER","typeInferred":true,"startWeek":6,"endWeek":6,"startDate":"2027-02-08","endDate":"2027-02-12","sourceCell":"J52","sourceColor":"#2E75B6","origin":"source"},{"id":"M-R52-W11","label":"SOP BTA 1.5 Euro7","type":"SOP","typeInferred":true,"startWeek":11,"endWeek":11,"startDate":"2027-03-15","endDate":"2027-03-19","sourceCell":"O52","sourceColor":"#002060","origin":"source"}],"origin":"source"},
{"id":"LINE-R53","sourceRow":53,"bu":"RNBU","project":"Batteries","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"2026","year":2026,"month":null,"precision":"year","status":"Source"},"milestones":[{"id":"M-R53-W01","label":"EOP","type":"EOP","typeInferred":true,"startWeek":1,"endWeek":1,"startDate":"2027-01-04","endDate":"2027-01-08","sourceCell":"E53","sourceColor":"#FF0000","origin":"source"}],"origin":"source"},
{"id":"LINE-R54","sourceRow":54,"bu":"RNBU","project":"Batteries","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"TBC","year":null,"month":null,"precision":"unknown","status":"TBC"},"milestones":[],"origin":"source"},
{"id":"LINE-R55","sourceRow":55,"bu":"RNBU","project":"Batteries","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"2028","year":2028,"month":null,"precision":"year","status":"Source"},"milestones":[{"id":"M-R55-W21","label":"SOP MYC","type":"SOP","typeInferred":true,"startWeek":21,"endWeek":21,"startDate":"2027-05-24","endDate":"2027-05-28","sourceCell":"Y55","sourceColor":"#002060","origin":"source"},{"id":"M-R55-W40","label":"SOP MYC","type":"SOP","typeInferred":true,"startWeek":40,"endWeek":40,"startDate":"2027-10-04","endDate":"2027-10-08","sourceCell":"AR55","sourceColor":"#002060","origin":"source"}],"origin":"source"},
{"id":"LINE-R56","sourceRow":56,"bu":"RNBU","project":"Batteries","plantGroup":"YMM1 & YMM2","plant":null,"eop":{"raw":"2025","year":2025,"month":null,"precision":"year","status":"Source"},"milestones":[],"origin":"source"},
{"id":"LINE-R59","sourceRow":59,"bu":"Mercedes","project":"C174 Coc","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","visualBlock":1},
{"id":"LINE-R60","sourceRow":60,"bu":"Mercedes","project":"C178 Coc","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","visualBlock":1},
{"id":"LINE-R61","sourceRow":61,"bu":"Mercedes","project":"X174 Coc","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","visualBlock":1},
{"id":"LINE-R62","sourceRow":62,"bu":"Mercedes","project":"X178 Coc","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","visualBlock":1},
{"id":"LINE-R63","sourceRow":63,"bu":"Mercedes","project":"X244 Coc","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","visualBlock":1},
{"id":"LINE-R64","sourceRow":64,"bu":"Mercedes","project":"X248 Coc","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","visualBlock":1},
{"id":"LINE-R65","sourceRow":65,"bu":"Mercedes","project":"H244 Coc","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","visualBlock":1},
{"id":"LINE-R66","sourceRow":66,"bu":"Mercedes","project":"H248 Coc","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","visualBlock":1},
{"id":"LINE-R67","sourceRow":67,"bu":"Mercedes","project":"W244 Coc","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","visualBlock":1},
{"id":"LINE-R69","sourceRow":69,"bu":"Mercedes","project":"C174 MRA","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","sourceProjectLabel":"C174 MRA ","visualBlock":2},
{"id":"LINE-R70","sourceRow":70,"bu":"Mercedes","project":"X174 MRA","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","sourceProjectLabel":"X174  MRA","visualBlock":2},
{"id":"LINE-R71","sourceRow":71,"bu":"Mercedes","project":"X244 MRA","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","sourceProjectLabel":"X244  MRA","visualBlock":2},
{"id":"LINE-R72","sourceRow":72,"bu":"Mercedes","project":"H244 MRA","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","sourceProjectLabel":"H244  MRA","visualBlock":2},
{"id":"LINE-R73","sourceRow":73,"bu":"Mercedes","project":"W244 MRA","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","sourceProjectLabel":"W244  MRA","visualBlock":2},
{"id":"LINE-R74","sourceRow":74,"bu":"Mercedes","project":"C178 MRA","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","sourceProjectLabel":"C178  MRA","visualBlock":2},
{"id":"LINE-R75","sourceRow":75,"bu":"Mercedes","project":"X178 MRA","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","sourceProjectLabel":"X178  MRA","visualBlock":2},
{"id":"LINE-R76","sourceRow":76,"bu":"Mercedes","project":"X248 MRA","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","visualBlock":2},
{"id":"LINE-R77","sourceRow":77,"bu":"Mercedes","project":"H248 MRA","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","sourceProjectLabel":"H248  MRA","visualBlock":2},
{"id":"LINE-R79","sourceRow":79,"bu":"Mercedes","project":"C178 RBA","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","sourceProjectLabel":"C178  RBA","visualBlock":3},
{"id":"LINE-R80","sourceRow":80,"bu":"Mercedes","project":"X178 RBA","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","visualBlock":3},
{"id":"LINE-R81","sourceRow":81,"bu":"Mercedes","project":"X174 RBA","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","visualBlock":3},
{"id":"LINE-R82","sourceRow":82,"bu":"Mercedes","project":"C174 RBA","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","visualBlock":3},
{"id":"LINE-R83","sourceRow":83,"bu":"Mercedes","project":"H244 L4 RBA","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","visualBlock":3},
{"id":"LINE-R84","sourceRow":84,"bu":"Mercedes","project":"H244 L5 RBA","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","visualBlock":3},
{"id":"LINE-R85","sourceRow":85,"bu":"Mercedes","project":"H248 L2 (X4 Upgrade) RBA","plantGroup":"YMOK","plant":null,"eop":{"raw":null,"year":null,"month":null,"precision":"unknown","status":"Data Required"},"milestones":[],"origin":"source","visualBlock":3}
]}
```

---

# APPENDIX B — `src/data/organization.json`

```json
{
 "meta": {
  "source": {
   "file": "CAD Organization Chart.pptx",
   "slides": 1
  },
  "schemaVersion": 1,
  "extractedOn": "2026-10-18",
  "capacity": {
   "dailyHours": 8,
   "weeklyHours": 40,
   "workingDays": [
    "MON",
    "TUE",
    "WED",
    "THU",
    "FRI"
   ],
   "note": "Configurable. 8 h/day x 5 days = 40 h/week per technician."
  },
  "namingNote": "The source gives positions and headcounts only — no employee names. 'name' is null and must be entered in the app. Never invent names.",
  "legend": {
   "PPC_DIRECTOR": "PPC Director",
   "MANAGER": "Manager",
   "CAD_RESPONSIBLE": "CAD Responsible",
   "CAD_TECHNICIAN": "CAD Technician"
  },
  "headcountSummary": {
   "cadTechniciansConfirmed": 13,
   "cadResponsiblesConfirmed": 4,
   "managersTBC": [
    "MGR-YMM2"
   ],
   "plantsWithTBCHeadcount": [
    "SATELLITES"
   ]
  },
  "plannerNote": "The chart has no 'CAD Coordinator' box. The app's main user is the central CAD Coordinator/planner (reports to the PPC Director); CAD Responsibles are modelled as plant leads. Confirm this reading."
 },
 "director": {
  "id": "PPC-DIRECTOR",
  "role": "PPC_DIRECTOR",
  "name": null,
  "origin": "source"
 },
 "sites": [
  {
   "id": "MEKNES",
   "name": "Meknes",
   "plantIds": [
    "YMM1",
    "YMM2"
   ]
  },
  {
   "id": "KENITRA",
   "name": "Kenitra",
   "plantIds": [
    "YMOK",
    "YMK"
   ]
  },
  {
   "id": "TANGER",
   "name": "Tanger",
   "plantIds": [
    "YMOT",
    "SATELLITES"
   ]
  }
 ],
 "plants": [
  {
   "id": "YMM1",
   "name": "YMM1",
   "sourceLabel": "YMM1",
   "siteId": "MEKNES"
  },
  {
   "id": "YMM2",
   "name": "YMM2",
   "sourceLabel": "YMM2",
   "siteId": "MEKNES"
  },
  {
   "id": "YMOK",
   "name": "YMOK",
   "sourceLabel": "YMOK",
   "siteId": "KENITRA"
  },
  {
   "id": "YMK",
   "name": "YMK",
   "sourceLabel": "YMK",
   "siteId": "KENITRA"
  },
  {
   "id": "YMOT",
   "name": "YMOT",
   "sourceLabel": "YMOT",
   "siteId": "TANGER"
  },
  {
   "id": "SATELLITES",
   "name": "SATELLITES",
   "sourceLabel": "SATELLITES T",
   "siteId": "TANGER"
  }
 ],
 "people": [
  {
   "id": "MGR-YMM1",
   "role": "MANAGER",
   "plantId": "YMM1",
   "name": null,
   "reportsTo": "PPC-DIRECTOR",
   "positionStatus": "Position shown",
   "origin": "source"
  },
  {
   "id": "RESP-YMM1-01",
   "role": "CAD_RESPONSIBLE",
   "plantId": "YMM1",
   "name": null,
   "reportsTo": "MGR-YMM1",
   "positionStatus": "Confirmed position (headcount from org chart)",
   "origin": "source"
  },
  {
   "id": "TECH-YMM1-01",
   "role": "CAD_TECHNICIAN",
   "plantId": "YMM1",
   "name": null,
   "label": "CAD Technician 1 – YMM1",
   "reportsTo": "RESP-YMM1-01",
   "positionStatus": "Confirmed position (headcount from org chart)",
   "weeklyCapacityHours": 40,
   "skills": [],
   "origin": "source"
  },
  {
   "id": "TECH-YMM1-02",
   "role": "CAD_TECHNICIAN",
   "plantId": "YMM1",
   "name": null,
   "label": "CAD Technician 2 – YMM1",
   "reportsTo": "RESP-YMM1-01",
   "positionStatus": "Confirmed position (headcount from org chart)",
   "weeklyCapacityHours": 40,
   "skills": [],
   "origin": "source"
  },
  {
   "id": "MGR-YMM2",
   "role": "MANAGER",
   "plantId": "YMM2",
   "name": null,
   "reportsTo": "PPC-DIRECTOR",
   "positionStatus": "TBC",
   "origin": "source"
  },
  {
   "id": "TECH-YMM2-01",
   "role": "CAD_TECHNICIAN",
   "plantId": "YMM2",
   "name": null,
   "label": "CAD Technician 1 – YMM2",
   "reportsTo": "RESP-YMM1-01",
   "positionStatus": "Confirmed position (headcount from org chart)",
   "weeklyCapacityHours": 40,
   "skills": [],
   "origin": "source",
   "note": "YMM2 shows no CAD Responsible box; a connector links these technicians to the YMM1 CAD Responsible (reading of the chart — to be confirmed)."
  },
  {
   "id": "TECH-YMM2-02",
   "role": "CAD_TECHNICIAN",
   "plantId": "YMM2",
   "name": null,
   "label": "CAD Technician 2 – YMM2",
   "reportsTo": "RESP-YMM1-01",
   "positionStatus": "Confirmed position (headcount from org chart)",
   "weeklyCapacityHours": 40,
   "skills": [],
   "origin": "source",
   "note": "YMM2 shows no CAD Responsible box; a connector links these technicians to the YMM1 CAD Responsible (reading of the chart — to be confirmed)."
  },
  {
   "id": "TECH-YMM2-03",
   "role": "CAD_TECHNICIAN",
   "plantId": "YMM2",
   "name": null,
   "label": "CAD Technician 3 – YMM2",
   "reportsTo": "RESP-YMM1-01",
   "positionStatus": "Confirmed position (headcount from org chart)",
   "weeklyCapacityHours": 40,
   "skills": [],
   "origin": "source",
   "note": "YMM2 shows no CAD Responsible box; a connector links these technicians to the YMM1 CAD Responsible (reading of the chart — to be confirmed)."
  },
  {
   "id": "MGR-YMOK",
   "role": "MANAGER",
   "plantId": "YMOK",
   "name": null,
   "reportsTo": "PPC-DIRECTOR",
   "positionStatus": "Position shown",
   "origin": "source"
  },
  {
   "id": "RESP-YMOK-01",
   "role": "CAD_RESPONSIBLE",
   "plantId": "YMOK",
   "name": null,
   "reportsTo": "MGR-YMOK",
   "positionStatus": "Confirmed position (headcount from org chart)",
   "origin": "source"
  },
  {
   "id": "TECH-YMOK-01",
   "role": "CAD_TECHNICIAN",
   "plantId": "YMOK",
   "name": null,
   "label": "CAD Technician 1 – YMOK",
   "reportsTo": "RESP-YMOK-01",
   "positionStatus": "Confirmed position (headcount from org chart)",
   "weeklyCapacityHours": 40,
   "skills": [],
   "origin": "source"
  },
  {
   "id": "TECH-YMOK-02",
   "role": "CAD_TECHNICIAN",
   "plantId": "YMOK",
   "name": null,
   "label": "CAD Technician 2 – YMOK",
   "reportsTo": "RESP-YMOK-01",
   "positionStatus": "Confirmed position (headcount from org chart)",
   "weeklyCapacityHours": 40,
   "skills": [],
   "origin": "source"
  },
  {
   "id": "TECH-YMOK-03",
   "role": "CAD_TECHNICIAN",
   "plantId": "YMOK",
   "name": null,
   "label": "CAD Technician 3 – YMOK",
   "reportsTo": "RESP-YMOK-01",
   "positionStatus": "Confirmed position (headcount from org chart)",
   "weeklyCapacityHours": 40,
   "skills": [],
   "origin": "source"
  },
  {
   "id": "MGR-YMK",
   "role": "MANAGER",
   "plantId": "YMK",
   "name": null,
   "reportsTo": "PPC-DIRECTOR",
   "positionStatus": "Position shown",
   "origin": "source"
  },
  {
   "id": "RESP-YMK-01",
   "role": "CAD_RESPONSIBLE",
   "plantId": "YMK",
   "name": null,
   "reportsTo": "MGR-YMK",
   "positionStatus": "Confirmed position (headcount from org chart)",
   "origin": "source"
  },
  {
   "id": "TECH-YMK-01",
   "role": "CAD_TECHNICIAN",
   "plantId": "YMK",
   "name": null,
   "label": "CAD Technician 1 – YMK",
   "reportsTo": "RESP-YMK-01",
   "positionStatus": "Confirmed position (headcount from org chart)",
   "weeklyCapacityHours": 40,
   "skills": [],
   "origin": "source"
  },
  {
   "id": "TECH-YMK-02",
   "role": "CAD_TECHNICIAN",
   "plantId": "YMK",
   "name": null,
   "label": "CAD Technician 2 – YMK",
   "reportsTo": "RESP-YMK-01",
   "positionStatus": "Confirmed position (headcount from org chart)",
   "weeklyCapacityHours": 40,
   "skills": [],
   "origin": "source"
  },
  {
   "id": "MGR-YMOT",
   "role": "MANAGER",
   "plantId": "YMOT",
   "name": null,
   "reportsTo": "PPC-DIRECTOR",
   "positionStatus": "Position shown",
   "origin": "source"
  },
  {
   "id": "RESP-YMOT-01",
   "role": "CAD_RESPONSIBLE",
   "plantId": "YMOT",
   "name": null,
   "reportsTo": "MGR-YMOT",
   "positionStatus": "Confirmed position (headcount from org chart)",
   "origin": "source"
  },
  {
   "id": "TECH-YMOT-01",
   "role": "CAD_TECHNICIAN",
   "plantId": "YMOT",
   "name": null,
   "label": "CAD Technician 1 – YMOT",
   "reportsTo": "RESP-YMOT-01",
   "positionStatus": "Confirmed position (headcount from org chart)",
   "weeklyCapacityHours": 40,
   "skills": [],
   "origin": "source"
  },
  {
   "id": "TECH-YMOT-02",
   "role": "CAD_TECHNICIAN",
   "plantId": "YMOT",
   "name": null,
   "label": "CAD Technician 2 – YMOT",
   "reportsTo": "RESP-YMOT-01",
   "positionStatus": "Confirmed position (headcount from org chart)",
   "weeklyCapacityHours": 40,
   "skills": [],
   "origin": "source"
  },
  {
   "id": "TECH-YMOT-03",
   "role": "CAD_TECHNICIAN",
   "plantId": "YMOT",
   "name": null,
   "label": "CAD Technician 3 – YMOT",
   "reportsTo": "RESP-YMOT-01",
   "positionStatus": "Confirmed position (headcount from org chart)",
   "weeklyCapacityHours": 40,
   "skills": [],
   "origin": "source"
  },
  {
   "id": "MGR-SATELLITES",
   "role": "MANAGER",
   "plantId": "SATELLITES",
   "name": null,
   "reportsTo": "PPC-DIRECTOR",
   "positionStatus": "Position shown",
   "origin": "source"
  },
  {
   "id": "RESP-SATELLITES-TBC",
   "role": "CAD_RESPONSIBLE",
   "plantId": "SATELLITES",
   "name": null,
   "reportsTo": "MGR-SATELLITES",
   "positionStatus": "TBC",
   "origin": "source"
  },
  {
   "id": "TECH-SATELLITES-TBC",
   "role": "CAD_TECHNICIAN",
   "plantId": "SATELLITES",
   "name": null,
   "reportsTo": "RESP-SATELLITES-TBC",
   "positionStatus": "TBC",
   "weeklyCapacityHours": null,
   "origin": "source",
   "note": "Headcount TBC in the source; add technicians in the app once confirmed. Excluded from capacity totals while TBC."
  }
 ]
}
```
