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
**IMPLEMENTED — BATCH P (2026-03-10)**
Root causes + fixes:
- **Supabase cloud latency**: `docker-compose.yml` provides local Postgres (port 5433) for dev; `.env.example` documents usage.
- **Auth middleware DB lookup on every request** (100-200ms each): Added 60s in-memory user cache in `TenantContextMiddleware` — cache hit skips Supabase JWT verification + `prisma.user.findUnique`. Added `invalidateUserTokenCache()` export. Cache auto-purges expired entries every 5 min.
- **`calculateAllEmployeeScores()` + `calculateEmployeeScore()` loading full question objects**: Replaced `include: { answers: { include: { question: true } } }` with `select: { answers: { select: { rating, question: { select: { type } } } } }` — fetches only the 2 fields `ratingAvgFromAnswers` needs, dramatically reducing query data volume.
- **Admin dashboard sequential requests**: Changed `loadData()` to `Promise.all([getCurrentUser(), reviewCyclesApi.getAll()])` — both requests fly in parallel, saving one full round-trip on every dashboard load.
- BATCH 14 (prior): 4 DB indexes, groupBy for getStats, removed redundant JOIN filters, getInsights cache.

---

#### 5) Active cycle “View” page needs detailed HR/Admin insights
**IMPLEMENTED — BATCH Q (2026-03-10)**
- Fixed department filter: `getInsights` now fetches `userDepartments` (multi-dept model from Batch G), not just legacy `department` string. `departments[]` field added to `EmployeeInsight` (backend + frontend type).
- Department column: replaced single string with department pills (indigo badge per department).
- Peer reviewer matrix: replaced X/N fraction with individual reviewer names + status pills, collapsing to “+N more” when > 3 peers.
- `CycleInsightsPanel.tsx`: full HR/Admin view for ACTIVE and COMPLETED cycles.
  - Stats cards: Total Employees, Fully Complete, In Progress, Not Started, Overdue (with progress bars + %).
  - Filters: department dropdown (now uses multi-dept model) + status dropdown + search.
  - Reviewer assignment matrix: both manager and peer reviews show individual names + status pills.
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

---

## 2026-03-10 — Post-BATCH R Fixes

### FIXED — BATCH R (2026-03-10)

#### 1) Admin dashboard Review Cycles overview card removed
- `admin/page.tsx`: Removed the entire "Review Cycles" overview card (status chips, recent cycles list, View all link) — redundant with the cycle selector dropdown already on the same page.
- Also removed unused imports: `Link`, `StatusBadge`, `formatDate`.

#### 2) Departments page crash ("reading properties of created departments")
- `departments/page.tsx`: Changed `dept._count !== undefined` to `dept._count != null` — covers null AND undefined, preventing a crash when `_count` is null.

#### 3) Add employees crashing + department pills crash
- Root cause: `mapUser()` in `users.service.ts` returned `[null, ...]` in departments array if any `UserDepartment.department` FK was null (data integrity issue after manual DB operations).
- `users.service.ts` `mapUser()`: Added `.filter(Boolean)` after mapping `ud.department` — drops nulls, prevents "Cannot read properties of null (reading 'id')" in `EmployeeList` and `EditEmployeeModal`.
- `DepartmentMultiSelect.tsx`: Added `d &&` guard in `.filter()` calls — defensive safety to match backend fix.

---

## 2026-03-10 — Post-BATCH R Follow-up Fixes (BATCH S)

### FIXED — BATCH S (2026-03-10)

#### 1) Review cycle edit fails with stale step-date validation error
- Root cause: `update()` in `review-cycles.service.ts` validated OLD step dates (still in DB) against the NEW cycle dates BEFORE `updateConfigs()` could replace them — causing a false "Step X dates must fall within cycle dates" error whenever the user changed both cycle dates and step dates together.
- Fix: Removed the config-date validation block from `update()`. The `updateConfigs()` call that immediately follows validates new step dates against the already-updated cycle dates, so the check in `update()` was redundant and harmful.

#### 2) Activate/delete/complete/edit cycle — list doesn't refresh without page reload
- Root cause: `activate()`, `complete()`, `delete()`, `update()`, `updateConfigs()` in `frontend/lib/review-cycles.ts` never called `invalidateCache('cycles:')`. When `onRefresh()` fired after a mutation, `getAll()` returned the 30s cached stale response.
- Fix: Added `invalidateCache('cycles:')` after each of the five mutation methods in `review-cycles.ts`.

---

## 2026-03-10 — E2E System Test Findings (BATCH T)

### E2E Test Summary
Full end-to-end API test: created company "Acme Tech", admin + manager + 3 employees, departments, questions (SELF/MANAGER/PEER), review cycle with 3 steps, reviewer assignments, activated cycle, submitted self/peer/manager reviews, verified scoring formula `(Self + Avg(Managers) + Avg(Peers)) / 3` = correct.

### Issues Found + Fixed

#### 1) CRITICAL: No RBAC guard on GET /analytics/admin/:cycleId — **FIXED BATCH T**
- `analytics.controller.ts` had `@UseGuards(AuthGuard)` at class level but no `@Roles` guard on `getAdminAnalytics`.
- Any authenticated EMPLOYEE token could call `GET /analytics/admin/:cycleId` and receive full company-wide data (completionRate, averageScore, topPerformers, reviewProgress).
- Fix: Added `@Roles('ADMIN') @UseGuards(RolesGuard)` to `getAdminAnalytics`.
- Also added `@Roles('ADMIN', 'MANAGER') @UseGuards(RolesGuard)` to `getManagerAnalytics` — employees should not access team analytics.

#### 2) MEDIUM: GET /reviewer-assignments had no auth guard — **FIXED BATCH T**
- `reviewer-assignments.controller.ts` had no `@UseGuards(AuthGuard)` at class level — unauthenticated requests could technically reach the endpoint.
- Write endpoints (POST/DELETE) had `@Roles('ADMIN') @UseGuards(RolesGuard)` correctly, but GET had neither guard.
- Fix: Added `@UseGuards(AuthGuard)` at class level + `@Roles('ADMIN') @UseGuards(RolesGuard)` on `findByCycle`.

#### 3) NOT A BUG: GET /notifications returns 404
- Frontend never calls `GET /notifications` (list endpoint) — confirmed by grep.
- The 404 in the E2E test was hitting a non-existent route. No action needed.

#### 4) NOTE: Employees receive invite email automatically — no gap
- Supabase `inviteUserByEmail()` is called on user creation — employees receive a password-setup email in Mailtrap. Confirmed by testing. No action needed.

---

## 2026-03-11 — RBAC Audit Follow-up (BATCH U)

### FIXED — BATCH U (2026-03-11)

#### 1) questions.controller.ts had no AuthGuard — unauthenticated access + potential data leak
- No `@UseGuards(AuthGuard)` anywhere on the controller.
- `@CompanyId()` resolves to `undefined` without a valid JWT → Prisma ignores the `companyId` filter → unauthenticated requests could read questions from ALL companies.
- Write endpoints (POST, PUT, DELETE, reorder, duplicate) had no auth or role guard.
- Fix: Added `@UseGuards(AuthGuard)` at class level. Added `@Roles('ADMIN') @UseGuards(RolesGuard)` to all write endpoints (create, update, delete, reorder, duplicate). GET endpoints remain open to all authenticated users (employees need to read questions during reviews).

#### 2) POST /notifications/test used soft role check instead of guard
- `notifications.controller.ts` `sendTestEmail()` returned `{ success: false }` with HTTP 200 for non-admins instead of 403.
- Fix: Removed soft check, added `@Roles('ADMIN') @UseGuards(RolesGuard)`.

#### 3) reviews.controller.ts — no gaps found
- `@UseGuards(AuthGuard)` correctly applied at class level.
- All endpoints use `user.id` to scope queries; service validates reviewer assignments before allowing access. No role guard needed — any authenticated user can be a reviewer.

---

## 2026-03-11 — HR Manager Feedback + Fixes

### Feature 1: Company Monogram (Tenant Branding)
Requirement:
- Admin defines a company monogram (e.g., "EY", "ACME", "HR") or simple initials.
- All employees must see it on their pages (dashboard header/sidebar and key pages).
- Must be company-scoped (company_id) and tenant-safe.

Acceptance criteria:
- Admin can set/update monogram in Settings (or Company Profile).
- Employees see monogram consistently across dashboards/pages.
- Stored in DB (Company model) and returned in existing "me/company" payload (or similar).

**IMPLEMENTED — BATCH W (2026-03-11)**
- DB: `monogram String? @map("monogram")` added to `Company` model. Migration: `20260311_add_company_monogram`.
- Backend: `PATCH /auth/company` (ADMIN only) → `updateCompany(companyId, dto)` in `auth.service.ts`. Monogram trimmed + uppercased before save. `companyMonogram` added to `signIn()` and `verifyToken()` responses.
- Frontend `lib/auth.ts`: `companyMonogram?: string | null` added to `User` interface. `updateCompany()` function added.
- Frontend `DashboardNav.tsx`: indigo badge with monogram text shown between separator and company name. Gracefully hidden when not set.
- Frontend `settings/page.tsx`: "Company Profile" card (ADMIN only) with monogram input (max 5 chars, auto-uppercased), live badge preview, Save button. Calls `updateCompany()` + `invalidateUserCache()` on save.

---

### Feature 2: Rating Scale Definition (Flexible scale + meaning per number)
Requirement:
- Admin defines rating scale meanings.
- Each rating value has:
  - title (short label)
  - description (what that rating means)
- Scale should be flexible, but for now implement:
  - min=1
  - max configurable up to 10 (1..10 maximum)
- Employees must see the meanings before selecting a rating (tooltip/modal/side panel).

Expected UX:
- Admin: configure scale in Settings or Review Config screen.
- Employee: when answering a rating question, they can view the scale definitions easily.

Acceptance criteria:
- Scale definitions saved per company_id.
- Rating questions use company's configured max (default to 5 if not configured, but allow up to 10).
- UI displays definitions (title+description) for all rating options shown.
- Validation prevents max > 10.

---

### Fix: Signup form fields prefilled from previous signup
Problem:
- Admin signup fields are prefilled from previous signup attempt.

Acceptance criteria:
- Signup form loads with empty fields every time you visit /signup (or /login?mode=signup).
- No persisted localStorage autofill from the app code.
- Ensure this is app-level prefill, not browser autofill (we can only control app).

**FIXED — BATCH V (2026-03-11)**
- Root cause: toggle button handler in `login/page.tsx` reset `fieldErrors` and `touched` but not `formData`. Switching from login→signup carried over previously typed email/password.
- Fix: Added `setFormData({ email: '', password: '', confirmPassword: '', name: '', companyName: '' })` to the toggle handler so all fields clear on mode switch.

---

### Feature 2: Rating Scale Definition (cont.)

**IMPLEMENTED — BATCH X (2026-03-11)**

---

## 2026-03-11 — Organogram + Sticky Nav (BATCH Y)

### 1. Sticky Navigation Header
**IMPLEMENTED — BATCH Y (2026-03-11)**
- Added `sticky top-0 z-50` to the `<nav>` element in `components/DashboardNav.tsx`.
- Nav bar remains fixed to the top of the viewport while scrolling on all dashboard pages.

---

### 2. Remove Monogram / Replace with Organogram (visual tree)

**SUPERSEDED by BATCH Y-2 below — see visual org chart implementation.**

### 3. Visual Position-Based Org Chart
**IMPLEMENTED — BATCH Y-2 (2026-03-11)**

#### Data model
- New `OrgChartNode` model: `id`, `companyId`, `title`, `parentId` (self-referential, cascade delete), `order`. Migration: `20260311_add_org_chart`.

#### Backend
- `GET /org-chart` — all authenticated users; returns flat list `{ id, title, parentId, order }`.
- `POST /org-chart` — ADMIN only; creates a position node.
- `PATCH /org-chart/:id` — ADMIN only; renames or re-parents a node.
- `DELETE /org-chart/:id` — ADMIN only; cascades to all descendants.
- All endpoints tenant-scoped via `@CompanyId()`.

#### Frontend
- `lib/org-chart.ts`: `OrgChartNode`, `OrgTreeNode`, `buildTree()`, `orgChartApi`.
- `/organogram` page rewritten as a proper visual org chart:
  - Top-down tree with boxes connected by CSS lines (vertical stem → horizontal bar → vertical drops per child).
  - Root boxes: indigo-tinted. Child boxes: white with gray border.
  - Horizontally scrollable canvas for wide trees.
  - **Edit mode** (admin only — toggle via ✎ Edit button):
    - "+ Add root position" button creates top-level nodes.
    - Hover any box → action bar: ✎ rename (inline), + add child, × delete.
    - Inline `<input>` with Save/Cancel for all text edits.
  - **Empty state**: friendly prompt directing admin to Edit → Add root position.
  - Single-root tree centered; multi-root trees laid out side-by-side.

### 2. Remove Monogram / Replace with Organogram
**IMPLEMENTED — BATCH Y (2026-03-11)**

#### Monogram Removed
- `backend/prisma/schema.prisma`: Removed `monogram String?` from `Company` model.
- Migration `20260311_drop_company_monogram`: `ALTER TABLE companies DROP COLUMN IF EXISTS monogram`.
- `backend/src/auth/auth.dto.ts`: Removed `UpdateCompanyDto`.
- `backend/src/auth/auth.service.ts`: Removed `updateCompany()`, removed `companyMonogram` from `signIn()` and `verifyToken()` responses.
- `backend/src/auth/auth.controller.ts`: Removed `PATCH /auth/company` endpoint and associated imports.
- `frontend/lib/auth.ts`: Removed `companyMonogram` from `User` interface, removed `updateCompany()`.
- `frontend/components/DashboardNav.tsx`: Removed monogram badge rendering.
- `frontend/app/(dashboard)/settings/page.tsx`: Removed all monogram state/handlers/UI (Company Profile card).

#### Organogram Added
- `backend/src/users/users.service.ts`: `getOrganogramData(companyId, requestingRole)` — fetches all company users, role-aware field filtering.
- `backend/src/users/users.controller.ts`: `GET /users/organogram` — all authenticated users, placed before `GET :id` to avoid route collision.
- `frontend/app/(dashboard)/organogram/page.tsx` — **NEW** full org chart page:
  - Access info banner for EMPLOYEE and MANAGER roles.
  - Search by name (highlights matching nodes + shows ancestor chain).
  - Department filter dropdown (MANAGER + ADMIN only).
  - Role-aware cards: EMPLOYEE sees name/role/dept; MANAGER sees + email; ADMIN sees + email + employeeId.
  - Recursive collapsible tree with CSS indent lines (`border-l-2 border-gray-200`).
  - Avatar initials circle, role badge, department pills per node.
  - Expand/collapse button per branch.
- Navigation links added to Quick Actions on admin, manager, and employee dashboards.

#### Verification
- Backend `npx tsc --noEmit` — clean
- Frontend `npx tsc --noEmit` — clean

#### Backend
- DB: `RatingScale` model added to `schema.prisma` — `companyId` (unique), `maxRating Int default 5`, `labels Json`. `Company` model gets `ratingScale RatingScale?` relation. Migration: `20260311_add_rating_scale`.
- Service `rating-scale.service.ts`: `findByCompany(companyId)` returns stored scale or computed default (maxRating:5, first 5 default labels — no auto-persist). `upsert(companyId, dto)` validates maxRating 1–10, fills missing label values from defaults.
- Controller `rating-scale.controller.ts`: `GET /rating-scale` (all authenticated users — needed during reviews), `PUT /rating-scale` (ADMIN only with RolesGuard).
- Module `rating-scale.module.ts` registered in `app.module.ts`.

#### Frontend
- `frontend/lib/rating-scale.ts`: `RatingScale` + `RatingScaleLabel` interfaces. `DEFAULT_SCALE` (5-point). `ALL_DEFAULT_LABELS` (10 entries). `ratingScaleApi.get()` (60s cache, falls back to DEFAULT_SCALE on error). `ratingScaleApi.update()` (PUT, invalidates cache).
- **Self review page** (`employee/reviews/self/page.tsx`): `ratingScale` state fetched via `Promise.all`. `QuestionCard` receives `ratingScale` prop — rating buttons use `Array.from({ length: maxRating })`, end-labels show `labels[0].title` / `labels[maxRating-1].title`. Collapsible `<details>/<summary>` panel shows all label definitions.
- **Peer review page** (`employee/reviews/peer/[employeeId]/page.tsx`): same pattern as self review.
- **Manager review page** (`manager/reviews/[employeeId]/page.tsx`): both `SelfReviewQuestionCard` (read-only) and `ManagerQuestionCard` (editable) receive `ratingScale` prop — dynamic buttons, end-labels, collapsible info panel on editable card.
- **Settings page** (`settings/page.tsx`): Rating Scale card (ADMIN only). `ratingScaleInput` state (default: `DEFAULT_SCALE`). Loaded in parallel via `Promise.all` in `loadData`. `handleMaxRatingChange()` — clamps 1–10, auto-fills missing label values from `ALL_DEFAULT_LABELS`. `handleLabelChange()` — updates title/description per value. `handleSaveRatingScale()` — calls `ratingScaleApi.update()`. UI: maxRating number input (1–10), grid of label rows (value badge + title input + description input), Save button.

#### Verification
- Backend `npx tsc --noEmit` — clean
- Frontend `npx tsc --noEmit` — clean


---

## 2026-03-12 — Post-testing Issues (Rating Scale + CSV Template Clarity)

### P0 — Rating Scale discoverability + stale UI range
1) Rating scale discoverability problem
- Users don’t naturally know they must go to Settings to define rating range.
Expected:
- Clear guidance in Question Builder when adding/editing rating questions:
  - show current scale (e.g., 1–5)
  - include a direct link/CTA: “Configure rating scale” (goes to Settings)
  - if not configured, show helper text explaining where to set it

2) Rating range updates don’t reflect in Question Builder
Repro:
- Go to Settings → change rating range from 1–5 to 1–7 → shows “successful”
- Go to Question Builder → still shows 1–5
Expected:
- Question Builder always reflects the latest saved rating range for the company (1–7).
Suspected:
- stale cached fetch / missing refetch / server component cache
- question builder reading a default instead of company setting

Acceptance criteria:
- After saving rating range, Question Builder shows the updated range without hard refresh.
- On page refresh, it still shows correct updated range.
- Rating questions render options matching the range consistently.

---

### P1 — CSV template download clarity
3) Template is confusing (required vs optional not obvious)
Expected:
- Downloaded CSV template should clearly indicate required vs optional fields.
- Reduce vagueness: include header comments (if supported) OR provide a README-style preview modal before download.

Acceptance criteria (choose one approach):
Option A (recommended):
- When clicking “Download template”, show a modal with:
  - Required fields list
  - Optional fields list
  - Example row
  - “Download template” button
- Template header includes only actual column names (no confusion).

Option B:
- Provide two templates:
  - minimal required template
  - full template with optional columns

---

### Requested QA pass
4) Run a system consistency audit
- Run checks across the system to confirm UI + backend align with business logic:
  - rating scale applied consistently (settings → question builder → review forms)
  - employee import uses same rules as create employee (required fields, department, employeeId, company email rules if enabled)
  - reviewer assignment respects tenant and department scoping
Output:
- short report: “OK / broken / needs attention”
- do not refactor, only identify mismatches and propose targeted fixes


---

## 2026-03-13 — Sidebar/Layout Polish Issues (Post Stitch Admin Shell)

### P1 — Sidebar styling mismatches + readability
1) Sidebar text color mismatch (light mode)
- Expected: sidebar nav labels look slightly greyed/muted (as in Stitch design)
- Actual: labels are black in light mode

2) Company name + “Reviewly” branding not visible enough (light mode)
- “Reviewly” line and company name are hard to see / not pronounced
- Expected: both should be bigger and more prominent in the sidebar/header area

3) Sidebar nav items too close to top
- Tabs (Dashboard, Reviews, etc.) are stuck too close to the top
- Expected: add a bit more spacing/padding above the nav list

4) Navbar/topbar height too small
- Expected: slightly taller topbar for better visual balance

### P0 — Broken sidebar link
5) “Reports” tab breaks navigation
- Expected: Reports should link to “View Reports” route (existing route or create placeholder page that doesn’t crash)
- Actual: clicking Reports breaks/throws/does nothing