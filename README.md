# CAD WORKLOAD & RESOURCE MANAGEMENT

Multi-plant milestone planning, task allocation and technician capacity management for the CAD department
(YMM1 · YMM2 · YMOK · YMK · YMOT · SATELLITES). First draft to be presented to the PPC Director.

**Frontend only** — React 18 + Vite, Recharts, lucide-react, plain CSS. No backend, no login. The browser
`localStorage` is the temporary database, behind a repository layer that can be swapped for an API later.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm test           # unit tests of the calculation engine (vitest)
```

## What the coordinator can do

| Page | Purpose |
|---|---|
| Executive Dashboard | Live KPIs, alerts, 6 charts (workload by plant, allocated vs available, utilization, task status, milestones per week W01–W52, workload peaks). Horizon selectable. |
| **Milestone Planner** | Editable replacement of the Excel sheet `PPC CAD Milestone`: BU / Project / EOP / Plant + W01–W52 grid with periods, months, current-week column, collapsible BUs, week/month zoom, filters. Add/rename/delete BU, add/edit/duplicate/delete project lines, add/edit/delete milestones (form, click an empty week, double-click quick add), **drag to move / drag edges to resize**, inline edit of project and EOP, undo/redo (20), edit log, JSON/CSV export, JSON/CSV import with preview, reset to source. |
| Projects & Milestones | Filterable list + project detail (timeline, tasks per milestone, technicians, planned vs unassigned effort, completion, deadlines, conflicts). |
| Milestone Task Designer | Click a milestone, define *its own* tasks (nothing is assumed). Task form with "Use milestone window", capacity warning before saving. |
| Task Allocation | Line → milestone → task → plant → ranked candidates (capacity **in the task period**) → impact review → confirm. Cross-plant only when explicitly allowed. |
| Technician Availability | Directory with daily / weekly / monthly breakdown, projects, tasks, conflicts, thresholds. |
| Plant Resource Planning | Plant table, comparison chart, weekly capacity matrix W01–W52 (allocated or demand), spare capacity / shortfalls, **what-if reallocation** (explicit apply). |
| Project Assignments | Project-centric and technician-centric views derived from the tasks; flags projects with insufficient resources. |
| Workload Calendar | Technicians × weeks/days, task blocks, milestone deadlines, weekends greyed, conflicts tinted; drag blocks to reschedule/reassign (capacity + cross-plant checks). |
| Reports & Analytics | Planned / actual / remaining by plant, technician, project; completion; utilization; capacity vs demand; forecast; unassigned; conflicts & missing data; CSV export. |
| Organization | Editable org tree from the chart (name a slot, capacity override, skills, add/remove technician slots, confirm TBC positions). |
| Settings & Data | Capacity settings, thresholds, reference date, absences, backup export/import, demo data, resets, Data Quality panel, self-test (22.5 h / 40 h). |

**Presentation mode** (header) hides editing controls and enlarges KPIs. **Load illustrative demo tasks**
(Settings & Data, or the dashboard banner) generates `origin: "demo"` tasks from real SOP/VS/DOC/TR/CF/PRE_SERIAL
milestones; a **DEMO DATA** ribbon shows while any exist; **Clear demo data** removes only them.

## Calculation rules (`src/utils/`)

* Capacity: 8 h/day, Mon–Fri → 40 h/week per technician (configurable; per-technician override; absences).
* `Remaining = Capacity − Allocated`; `Utilization % = Allocated / Capacity × 100`.
  Reference example (unit-tested and shown in Settings): 22.5 h of 40 h → **17.5 h remaining · 56.25 %**.
* Thresholds (planning defaults, configurable): Available < 70 % · Moderate 70–<90 % · High 90–100 % · Overloaded > 100 %.
* A task's estimate is spread evenly over the **working days** of its window (never Sat/Sun). Each task is counted once.
  Tasks without dates are *unscheduled workload* (listed, not placed in any week).
* Completed tasks stay in history but no longer consume capacity from the reference date onward.
  A task is **not** completed because its end date passed — it shows as *overdue*.
* Technician assignment lives only in `Task.technicianId`; project, plant, calendar and report views are derived.
* Milestone weeks changed → tasks flagged "follows milestone window" move with it; other dated tasks are flagged for review.
* Deleting a milestone/line/BU with tasks asks: delete the tasks or keep them as *orphan – needs milestone*.

## Persistence

`src/storage/repository.js` exposes `load / save / reset / exportAll / importAll`; components never touch `localStorage`.
Keys: `cad.v1.milestones`, `.organization`, `.tasks`, `.assignments`, `.settings`, `.editLog` (each stored as
`{schemaVersion, savedAt, data}`; `migrations.js` upgrades old versions). First load seeds from `src/data/*.json`;
later loads read the browser; the seed never overwrites user data unless you press a **Reset**. All reads/writes are in
`try/catch` — if storage fails the app keeps working in memory and shows a warning banner. Auto-save is debounced
(header shows "Saved locally · hh:mm"). Use **Export all (JSON backup)** before clearing browser data.

## Source-data mapping

Excel `Milestones 2027 (YMM1 - YMM2 - YMOK).xlsx`, worksheet **`PPC CAD Milestone`** → `src/data/milestones.json`

| Excel | App |
|---|---|
| Column A | `plantGroup` of the BU (`YMM1 & YMM2`, `YMOK`) |
| Column B | BU (`businessUnits`, `projectLines[].bu`) |
| Column C | Project (`projectLines[].project`) |
| Column D | EOP (`eop`: raw / year / month / precision / status) |
| Columns E → BD | Weeks W01 → W52; each coloured cell run = one milestone (`startWeek`/`endWeek`, label, `sourceColor`) |
| Header rows | Year 2027, periods P86-2 (W01–W25) and P87-1 (W26–W52), months |

`CAD Organization Chart.pptx` → `src/data/organization.json`: PPC Director → Sites (Meknes, Kenitra, Tanger) → 6 plants →
Manager → CAD Responsible → CAD Technician slots (13 technicians, 4 responsibles confirmed). Positions and headcounts only —
**no names**; slots are `CAD Technician n – PLANT` with `name: null`.

Every record has an `origin` badge: **source**, **user** or **demo**.

## Assumptions

* ISO-8601 weeks, **W01 2027 = Monday 2027-01-04** (stated in the UI); milestone dates = Monday of start week → Friday of end week.
* **Reference date**: "upcoming", "overdue" and the dashboard horizon use today when it falls inside 2027, otherwise W01 2027
  (changeable in Settings). Today (Oct 2026) is outside the plan, so the app opens on W01.
* The coordinator is the app user (reports to the PPC Director); CAD Responsibles are plant leads. The chart has no "CAD Coordinator" box.
* The YMM2 technicians follow the YMM1 CAD Responsible (connector on the chart) — flagged *to be confirmed*.
* Milestone types are inferred from labels (`typeInferred`); only EOP and SOP are business-defined. VS, DOC, TR, CF, PT, PP, TDS, MY… are kept verbatim.
* Plant planning separates the technician's **home plant** from the project's/task's **plant**.
  "Allocated" is by home plant; "demand" is by task plant (including unassigned tasks).

## Missing data and data-quality warnings

Shown in **Settings & Data → Data Quality** (source notes + live checks) and as a counter on the dashboard.

* Mercedes: 25 lines (YMOK) without EOP or milestones — *Data Required*. Ford: BU label only, no lines.
* Lines of `YMM1 & YMM2` do not say YMM1 or YMM2: plant is `TBC` until set in the app.
* XCB (Megane E-Tech) EOP cells hold the number 2029 formatted as a date (`juil-05`): interpreted as 2029, status *Needs confirmation*.
* XHN Program EOP 07/2030 appears only on the first row; rows 41–42 are blank (probably shared — not assumed).
* One EOP `TBC`; three lines with EOP year before 2027 (two carry an EOP milestone in W01 2027); 19 lines with an EOP but no 2027 milestone.
* Several rows share BU/project/EOP without stating what distinguishes them; they are kept separate (`sourceRow`).
* YMM2 Manager TBC; SATELLITES CAD Responsible and Technicians TBC — excluded from capacity totals until confirmed (add or confirm them in Organization).
* No technician names, skills, tasks or hour estimates exist in the sources — they are entered in the app (or shown as illustrative **demo** data).

## Project structure

```
src/
  App.jsx  main.jsx
  data/        milestones.json  organization.json   (seed, read-only)
  storage/     repository.js  seed.js  migrations.js
  state/       store.jsx (context + reducer, undo/redo, autosave)  actions.js  planOps.js  useRoute.js
  components/  Sidebar Header KPICards MilestoneGrid MilestoneBar MilestoneForm LineForm BUForm TaskForm
               MilestoneTaskList TaskAllocationBoard TechnicianAvailability PlantCapacityMatrix WhatIf
               ProjectAssignments WorkloadCalendar WorkloadCharts OrgChart DataQualityPanel PlanDialogs ui
  pages/       Dashboard MilestonePlanner ProjectsMilestones MilestoneTaskDesigner TaskAllocation Technicians
               PlantPlanning ProjectAssignmentsPage Calendar Reports Organization SettingsData
  utils/       capacityCalculations scheduling weekCalendar workloadAggregation csv   (+ eop, planValidation,
               planIO, allocation, demoData, milestoneStyle, ids; engine.test.js)
  styles/      index.css
```
