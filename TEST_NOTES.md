# Testing Session 


## 2026-02-25 — Post-fix Regression / UX Issues Found

### P0 — Must Fix (blocks trust / core flows)
1) Auth pages branding missing — **FIXED (prior batch)**
- Added Reviewly logo + name to /login and /signup pages.

2) Extremely slow navigation / page transitions — **FIXED (prior batch)**
- Added 30s session cache + 60s user cache in auth.ts; removed redundant refetches.

3) Analytics pie chart overlap when empty — **FIXED (prior batch)**
- Filters out zero-value slices; shows empty state when no data.

4) Reviewer assignment tenant leak / wrong users visible — **FIXED (prior batch)**
- `users.controller.ts`: `@CompanyId()` decorator enforces company scoping on all user queries.

### P1 — Should Fix (polish + correctness)
5) Company identity not visible enough — **FIXED (prior batch)**
- `DashboardNav.tsx`: displays "{CompanyName} — Reviewly" in nav header.

6) Manage Employees list not updating after create — **FIXED (prior batch)**
7) Manage Employees filters/search broken — **FIXED (prior batch)**
- `EmployeeList.tsx`: `useEffect` syncs from parent on prop change; role + search filters work reliably.

8) Questions UI tabs mismatch (Self/Peer/Manager) — **FIXED (prior batch)**
- `QuestionList.tsx`: uses `useEffect` to update displayed questions on tab change.

### P2 — Nice to Have / UX Improvements
9) Review Cycle create flow back navigation — **FIXED (prior batch)**
- New review cycle "Back" navigates to /admin dashboard.

10) Department feature request — **IMPLEMENTED — BATCH G + H (2026-03-10)**
- Full department model + multi-department membership, reviewer filtering by dept, manager≠peer enforcement.


--- 

## 2026-03-04 — Founder Demo Feedback (Must Address)

### P0 — Core Product Flexibility + Correctness

#### 1) Review Cycle Steps must be flexible (not limited to 3)
**ALREADY DONE — verified BATCH L (2026-03-10)**
- No max step limit exists in backend or frontend.
- `validateConfigDates()`: only enforces 1 SELF step, date ordering, steps within cycle bounds.
- `WorkflowStepBuilder.tsx`: `addStep()` has no count cap; container uses `max-h-[600px] overflow-y-auto` for scroll with many steps.
- Each step has reviewType (SELF/MANAGER/PEER/custom), name/label, startDate, endDate.
- Dynamic review types (custom keys) supported via `ReviewTypeConfig` table (Batch E).

---

#### 2) Peer reviewers count must be unlimited (not 3–5)
**DONE — BATCH L (2026-03-10)**
- Backend: no peer count limit; only enforces ≥1 manager via `managerCount === 0` check.
- Frontend: `hasValidAssignment = managerIds.length >= 1 && peerIds.length >= 1` (no upper limit).
- Fixed: `BulkUploadModal.tsx` instructional text changed from "3-5 peers" → "1+ peers".

---

#### 3) CSV template download for onboarding (and future imports)
**ALREADY DONE — verified BATCH L (2026-03-10)**
- `downloadCsvTemplate()` in `admin/employees/page.tsx`: downloads `employee_import_template.csv` with columns: name, email, role, department, manager_email, employee_id + 2 sample rows.
- `CsvImportModal.tsx`: parses all 6 columns, shows row warnings for missing department/email, shows import errors clearly.
- Department column is required (warns + skips on missing); employee_id optional (auto-generates).

---

#### 4) Performance is too slow locally — investigate Supabase vs local Postgres
**ALREADY DONE — verified BATCH N (2026-03-10)**
Root causes addressed:
- Supabase cloud latency: solved by `docker-compose.yml` local Postgres (port 5433) already in repo root.
- Query performance: BATCH 14 added 4 DB indexes, `groupBy` for getStats, removed redundant JOIN filters, `getInsights` cache.
- `backend/.env.example`: documented Option A (local Docker Postgres, recommended) vs Option B (Supabase staging/prod).
- Fixed `.env.example` port: changed `localhost:5432` → `localhost:5433` to match `docker-compose.yml` port mapping.

---

#### 5) Active cycle “View” page needs detailed HR/Admin insights
**ALREADY DONE — verified BATCH N (2026-03-10)**
- `CycleInsightsPanel.tsx`: full HR/Admin view for ACTIVE and COMPLETED cycles.
  - Stats cards: Total Employees, Fully Complete, In Progress, Not Started, Overdue (with progress bars + %).
  - Filters: department dropdown + status dropdown (All/Complete/In Progress/Not Started/Overdue) + search by name/email.
  - Employee table: completion status per row (self review, manager reviews with names, peer review X/N fraction), overdue row highlighting.
  - Reviewer assignment matrix: manager reviews show each reviewer name + pill status; peer reviews show submitted/total fraction.
  - Breadcrumb nav: Dashboard / Review Cycles / Cycle Name — both links work.

---

### P1 — Questions Builder & Preview Behavior

#### 6) TASK_LIST questions must allow defining tasks (not only question title)
**ALREADY DONE — verified BATCH M (2026-03-10)**
- `QuestionForm.tsx`: TASK_LIST section has add/remove/edit task items (label, optional description, required checkbox) + inline preview while editing.
- Backend (`questions.service.ts`): tasks persisted as `Prisma.InputJsonValue` JSON on the Question model; `create()` and `update()` both handle tasks.
- `QuestionPreview.tsx`: renders predefined tasks as checkboxes with label/description/required; falls back to free-form entry when no tasks defined.
- `QuestionForm` cleans empty labels before submit.

---

#### 7) “Show Preview” must be truly conditional (no stale content)
**ALREADY DONE — verified BATCH M (2026-03-10)**
- `questions/page.tsx`: `showPreview` starts `false` → placeholder shown initially.
- Tab switch: `useEffect([selectedTab])` calls `setShowPreview(false)` — preview always resets on tab change, forcing re-click.
- `QuestionPreview` receives `questions[selectedTab]` (live state) — always current content.
- After create/edit: `loadQuestions()` re-fetches; if preview visible it auto-refreshes from updated state.

---

### P2 — Department + Employee Identity + UI Enhancements

#### 8) Department must be REQUIRED + use Peel UI for department selection
**IMPLEMENTED — BATCH H (2026-03-10)**
Note: "Peel UI" requirement superseded by Spec 7's "no external assets required, pill/tag style" — satisfied by the custom DepartmentMultiSelect component (Batch G).
- Backend `create()`: throws `BadRequestException` if neither `department` nor `departmentIds` is provided.
- `importUsers()`: after creating each user via CSV, calls `findOrCreateDepartment` + creates `UserDepartment` record — imported users now appear correctly in department filters (AssignmentCard, etc.).
- Cannot create via UI without selecting department (frontend DepartmentMultiSelect validates `length === 0`).
- Cannot import without department column (CSV parser warns + skips rows with missing department).
- Department filtering in reviewer assignment: ✓ (Batch G).
- Prevent manager as peer: ✓ peerOptions filters `role === 'EMPLOYEE'` only.
- Strict company_id scoping: ✓ everywhere.

---

#### 9) Employee ID must be used to manage employees
**ALREADY DONE — prior batches**
- `employeeId String? @map("employee_id")` on User model with `@@unique([companyId, employeeId])`.
- Auto-generated as `EMP-XXXXXX` (uppercase alphanumeric) via `resolveEmployeeId()` if not provided.
- Visible in `EmployeeList.tsx` as a mono badge alongside role.
- Searchable: `employees/page.tsx` search box matches name, email, **and** `employeeId`.
- CSV template (`downloadCsvTemplate()`) includes `employee_id` column.
- CSV import: if `employee_id` column provided → validates uniqueness, throws if duplicate; if missing → auto-generates.
- EditEmployeeModal shows employeeId as read-only for reference.

---

#### 10) Employee page: reviewer status should show “Pending” not 0
**ALREADY DONE — BATCH 10 (prior session)**
- `employee/page.tsx`: manager/peer review badges show `”{count} received”` when > 0, `”Pending”` (orange badge) when 0 — never bare `”0”`.
- Peer/manager review pages: `getStatusBadge()` maps `NOT_STARTED → “Not Started”`, `DRAFT → “In Progress”`, `SUBMITTED → “Submitted”`.
- `CycleInsightsPanel`: uses `”Pending”`, `”In Progress”`, `”Submitted”`, `”Not assigned”` labels; `”Not assigned”` shown when no reviewers; fraction `0/3` is informational context only.

---

#### 11) Employee self-cycle score should be hidden until all reviews complete
**ALREADY DONE — BATCH 11 + BATCH F (prior sessions)**
- Backend (`analytics.service.ts`): `personalScore: allReviewsComplete ? personalScore : null` — returns `null` until gate passes.
- Gate is data-driven: reads `requiredTypeConfigs` from DB (BATCH F); only review types with `isRequired = true` block the score.
- Frontend (`employee/page.tsx`): score section gated on `analytics.personalScore !== null`; shows `"Your score will appear once all required reviews are complete."` while pending.
- Admin analytics always shows full data regardless of gate (separate `getAdminAnalytics` path).

---

---

## 2026-03-10 — New Issues After Latest Round of Testing

### Notes / Product Decision
#### A) Company name duplicates
Observation:
- Signup allows two companies with the same company name.
Decision:
- This is acceptable because company_id uniquely identifies tenants.
UX Improvement (optional):
- Warn user if company name already exists: "Name already used, you can still continue."
- Consider adding a unique company slug (auto-generated) for URLs, not for identity.

---

### P0 — Bugs / Broken Flows

#### 1) Manager dashboard inconsistent state (missing "Complete review", shows empty reviews)
**FIXED — BATCH A (2026-03-10)**
- Inlined analytics fetch into loadData() before setLoading(false) — same race fix as employee page
- Quick Actions now data-driven: "Complete Self Review" / "Complete Peer Reviews (N)" only appear when pending
- Added empty states for no-cycles and no-team-members

---

#### 2) Admin dashboard doesn’t clearly show existing cycles
**FIXED — BATCH D (2026-03-10)**
- Added "Review Cycles" overview card at top of admin dashboard (above KPI cards).
- Shows status count chips (Active/Draft/Completed), list of up to 4 recent cycles with StatusBadge + dates + Edit/View link.
- "View all →" link to /admin/review-cycles and "+ New Cycle" button always visible.
- Empty state: if no cycles exist, card explains what a review cycle is with a helpful description.
- Also fixed analytics loading race: inlined initial analytics fetch into loadData(), added analyticsLoading + handleCycleChange() for subsequent cycle changes.

---

#### 3) Cycle activation should be blocked unless questions are attached
**FIXED — BATCH C (2026-03-10)**
- Backend: `activate()` now queries `question.count({ where: { companyId } })` after the reviewConfigs check.
- If zero questions exist, throws `BadRequestException('Add at least one question before activating this cycle.')`.
- Frontend: existing `setError(err.message)` in `ReviewCycleList.tsx` surfaces the 400 message automatically — no UI changes needed.

---

#### 4) Peer review action visibility
**FIXED — BATCH B (2026-03-10)**
- Root cause: `analytics?.pendingTasks?.peerReviews && count > 0` short-circuits to
  the number `0` in React when count is 0, rendering literal “0” text beside the
  “Complete Self Review” button (the “0 badge”). Fixed to `(count ?? 0) > 0` guard.
- Loading race was already fixed in Batch A (employee page analytics inline load).
- Backend: added Math.max(0, ...) guard so counter never goes negative.

---

### P1 — Product Model Improvements (Needs Spec + Implementation)

#### 5) Review types should be dynamic (not fixed to SELF/PEER/MANAGER only)
**IMPLEMENTED — BATCH E (2026-03-10)**
- Added `ReviewTypeConfig` table (company-scoped): built-ins (SELF/MANAGER/PEER) + custom types.
- Custom types carry a `baseType` (SELF/MANAGER/PEER) for underlying system behavior.
- `customTypeKey String?` added to `ReviewConfig` schema + DTO.
- Backend: `review-type-configs` module — GET/POST/DELETE, built-ins seeded on signup, existing 6 companies backfilled.
- Frontend: `/admin/review-types` page for managing types; WorkflowStepBuilder fetches types from API.
- Admin dashboard Quick Actions has "Review Types" link.
- Backwards compatible: existing cycles unaffected.

---

#### 6) Only Manager should be compulsory; others depend on configured review types
**IMPLEMENTED — BATCH F (2026-03-10)**
- Added `isRequired Boolean` to `ReviewTypeConfig`; MANAGER defaults to `true`, SELF/PEER to `false`.
- `PATCH /review-type-configs/:id` endpoint to toggle `isRequired` (and rename custom types).
- `getEmployeeAnalytics`: `allReviewsComplete` gate now reads `requiredTypeConfigs` from DB; only required types block score visibility.
- Frontend: `/admin/review-types` shows Required toggle (pill badge + animated toggle switch) for all types including built-ins.
- Info callout on the page explains how “Required” affects score visibility.

---

#### 7) Departments management (not only on-the-fly) + multi-department membership
**IMPLEMENTED — BATCH G (2026-03-10)**
- Added `Department` model (company-scoped, with `archivedAt` soft-delete) + `UserDepartment` join table.
- Migration: creates both tables + migrates existing `User.department` strings to `Department` rows + `UserDepartment` records.
- Backend: `departments` module — `GET /departments`, `GET /departments/archived`, `POST /departments`, `PATCH /:id` (rename), `PATCH /:id/archive`, `PATCH /:id/restore`.
- Updated `users.service.ts`: accepts `departmentIds: string[]` in create/update; `syncUserDepartments()` validates company-scoping and replaces `UserDepartment` records; keeps `User.department` in sync with first dept name; `findAll`/`findOne` include departments array.
- Frontend: `/admin/departments` page with pill/tag UI (hover to rename/archive, inline rename input, archived section with restore).
- New `DepartmentMultiSelect` component: pill chips for selected depts, dropdown to add more.
- Updated `CreateEmployeeModal` + `EditEmployeeModal` to use `DepartmentMultiSelect` + `departmentIds`.
- Updated `AssignmentCard` to filter by `user.departments[]` (Department id comparison, not string).
- `EmployeeList` shows department pills per employee.
- Admin dashboard Quick Actions: added "Departments" button.
- `departmentsApi` in `frontend/lib/api.ts` with getAll/getArchived/create/update/archive/restore.
- `getDepartments()` in users service now queries `Department` model (with legacy fallback).

---

### Priority Order Suggestion
P0: (1) Manager dashboard inconsistency, (3) block activation without questions, (4) peer review visibility, (2) cycles visibility on admin dashboard
P1: dynamic review types + required config + department management + multi-department membership