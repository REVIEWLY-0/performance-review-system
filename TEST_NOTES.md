# Testing Session 


## 2026-02-25 — Post-fix Regression / UX Issues Found

### P0 — Must Fix (blocks trust / core flows)
1) Auth pages branding missing
- Signup/Login pages do NOT show "Reviewly" name + logo (only browser tab title changes).
- Expected: Reviewly brand visible on /login and signup.

2) Extremely slow navigation / page transitions
- Clicking buttons that navigate to new pages is very slow (dashboard → employees, review cycles, etc.)
- Expected: fast transitions with loading states and reduced refetching.

3) Analytics pie chart overlap when empty
- When review progress is empty, "Draft" and "Submitted" labels overlap.
- Expected: proper empty state or hide labels when 0.

4) Reviewer assignment tenant leak / wrong users visible
- Assign reviewers shows error: "some users are not in the company"
- Users outside current company appear selectable (should never happen).
- Expected: user pickers filtered strictly by company_id (frontend + backend validation).

### P1 — Should Fix (polish + correctness)
5) Company identity not visible enough
- Company name not prominent; doesn’t feel like company-specific portal.
- Expected: show "{CompanyName} — Reviewly" clearly in dashboard nav/header.

6) Manage Employees list not updating after create
- After creating an employee, user must refresh to see them.
- Expected: list updates immediately (optimistic update or refetch after success).

7) Manage Employees filters/search broken
- Role filter does not filter results.
- Search field does not filter results.
- Expected: both should work reliably.

8) Questions UI tabs mismatch (Self/Peer/Manager)
- All questions display under all tabs even when adding within one tab.
- Preview shows correct questions per tab.
- Expected: tabs should display only their assigned questions (UI should match preview).

### P2 — Nice to Have / UX Improvements
9) Review Cycle create flow back navigation
- "Back" from Add Review Cycle returns to Review Cycles list.
- Expected: Back should return to dashboard (or provide explicit "Back to Dashboard" + separate link to Review Cycles).

10) Department feature request for better organization + reviewer selection
- Add Department for employees (e.g., Engineering/Sales/etc.)
- Group employees by department
- Manager selection should show only managers in same department
- Peer selection should show only employees in same department
- Prevent selecting a manager as a peer


--- 

## 2026-03-04 — Founder Demo Feedback (Must Address)

### P0 — Core Product Flexibility + Correctness

#### 1) Review Cycle Steps must be flexible (not limited to 3)
Problem:
- Workflow steps are currently limited (e.g., max 3).
Founder requirement:
- Admin should customize as many steps as needed.
- Steps should match reviewer roles and potentially repeated phases.

Expected:
- Remove max-step restriction.
- Allow any number of steps (1..N).
- Each step has: type (SELF / MANAGER / PEER / CUSTOM if needed), name/label, start/end date.
- Still enforce valid date logic (within cycle dates; step start < step end; cycle start < cycle end).
- UI should handle many steps cleanly (scroll/accordion).

Acceptance Criteria:
- Admin can add 1..N steps.
- No artificial max step limit.
- Dates validated correctly.
- Steps persist and render correctly in create/edit/preview/view.

---

#### 2) Peer reviewers count must be unlimited (not 3–5)
Problem:
- Peer reviewers currently limited to 3–5 per employee.

Expected:
- Allow any number of peer reviewers per employee per cycle.
- UI supports large lists (search, pagination/multi-select).
- Backend enforces tenant safety but does not enforce reviewer count limits.

Acceptance Criteria:
- Assign 1, 2, 10, 30 peers successfully.
- No validation blocks due to peer count.
- Strict company_id scoping.

---

#### 3) CSV template download for onboarding (and future imports)
Problem:
- Admin needs downloadable CSV template to edit then upload.

Expected:
- On /admin/employees:
  - "Download CSV Template" button
  - template includes required columns + a sample row
- Template format documented in UI and README.

Template columns (proposal):
- employee_id (required OR auto-generated if missing; see item 9)
- full_name (required)
- email (required)
- role (EMPLOYEE / MANAGER)
- department (REQUIRED - see department section)
- manager_employee_id OR manager_email (optional; choose one standard)
Notes:
- Enforce company email rules (see Auth/email domain rules if implemented).
- Dedupe by email within company.

Acceptance Criteria:
- Template downloads successfully.
- Uploading edited template imports users correctly.
- Import errors are shown clearly with row numbers.

---

#### 4) Performance is too slow locally — investigate Supabase vs local Postgres
Problem:
- App feels slow even on localhost.
- Need decision: is Supabase latency the cause? Should we run local Postgres via Docker for dev?

Expected:
- Identify root cause of slowness (DB latency, unbounded queries, refetch loops, lack of caching, no pagination).
- Provide recommendation with evidence:
  A) Local Postgres via Docker for dev (keep Supabase for staging/prod)
  B) Tune queries/caching if Supabase isn’t the main issue

Acceptance Criteria:
- Report with evidence (timings/logs).
- Implement 1–2 high-impact performance fixes.
- If local Postgres chosen: add docker-compose + docs + env examples.

---

#### 5) Active cycle “View” page needs detailed HR/Admin insights
Problem:
- Active cycle view is not informative enough for HR/Admin.

Expected (Senior PM / HR Manager view):
- Cycle overview:
  - employee completion status (who completed self review, who hasn’t)
  - reviewer assignment matrix (who reviews who)
  - counts: pending/completed/overdue
  - filters: department, status
- Navigation:
  - “Back” and/or breadcrumb is clearly visible
  - Back should take to Dashboard (not just review cycles), and provide explicit link to Review Cycles too.

Acceptance Criteria:
- Active cycle view shows actionable details.
- Back navigation is clear and works.

---

### P1 — Questions Builder & Preview Behavior

#### 6) TASK_LIST questions must allow defining tasks (not only question title)
Problem:
- Task list questions allow setting the question but not defining tasks.

Expected:
- For TASK_LIST question type:
  - UI to add/edit/remove tasks (task label, optional description, required flag)
  - Persist tasks to backend model (Question or related model)
  - Tasks render in preview and actual review form.

Acceptance Criteria:
- Tasks can be created/edited/deleted.
- Tasks persist and display correctly everywhere.

---

#### 7) “Show Preview” must be truly conditional (no stale content)
Problem:
- Preview shows stale content / does not change when clicking show preview.

Expected:
- Preview only renders after clicking "Show Preview".
- Preview updates when switching tabs (Self/Peer/Manager) or editing questions.
- Before clicking preview: show placeholder/empty state.

Acceptance Criteria:
- Preview is empty/placeholder initially.
- Preview always matches current tab/type and current question list.

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
Problem:
- Need stable employee id for HR workflows.

Expected:
- Add employeeId (unique per company).
- Display employeeId in employee list/table.
- Search by employeeId.
- Include employeeId in CSV template/import:
  - If provided: validate uniqueness in company
  - If missing: auto-generate in a consistent format.

Acceptance Criteria:
- employeeId exists, unique per company, visible + searchable.
- Import supports employeeId safely.

---

#### 10) Employee page: reviewer status should show “Pending” not 0
Problem:
- Other reviewers status shows “0” (confusing).

Expected:
- Status labels: Pending / In Progress / Submitted / Not Assigned
- No numeric "0" shown for status.

Acceptance Criteria:
- Status UI uses readable labels everywhere.

---

#### 11) Employee self-cycle score should be hidden until all reviews complete
Problem:
- Employee should not see cycle score until all required reviews are completed.

Expected:
- Employee score visible only after:
  - required self + manager + peers (as configured) are complete for that cycle.
- Admin can still view progress/partial completion.

Acceptance Criteria:
- Employee cannot see score early.
- Score appears automatically when all required reviews complete.

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