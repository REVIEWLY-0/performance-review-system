# Testing Checklist — Reviewly Deployment Readiness

> **Last updated: 2026-03-28**
> Estimated time: 60–90 minutes for the full run.
> Complete this top to bottom before deployment begins. All P0 items must pass before you proceed.

---

## What's New Since the Last Test Session

Read this before starting so you know what changed and what to watch for.

### Bugs Fixed (verify these in Section 2)

| Bug | Severity |
|-----|----------|
| Score exceeds max rating scale (showed 10.00 / 5.00) | P0 |
| Manager scores page crashes with RangeError | P0 |
| Score email sent on every "View Detailed Scores" click | P1 |
| No exit prompt when leaving a partially-filled review | P1 |
| Score bar overflows container when cycle date is shortened | P1 |
| Deleting a manager with pending reviewer assignments failed silently | P1 |

### New Features Shipped (test these in Section 3)

| Area | What changed |
|------|-------------|
| **Auth security** | Login rate-limited: 10 attempts / 15 min per IP. Signup: 5 / 15 min. Returns HTTP 429 when exceeded. |
| **Avatar storage** | Avatars now stored in Supabase Storage — not on disk. Re-upload any existing test avatars. |
| **Error monitoring** | Sentry integrated. Disabled by default; activates when `SENTRY_DSN` env var is set. |
| **DB backup scripts** | `npm run db:backup` / `npm run db:restore` available in backend. |
| **Automated tests** | 33 backend tests (scoring formula, cycle activation guards, auth endpoints). Run `npm test` in backend. |

---

## Legend

- ✅ Expected result
- 🔍 Where to verify
- ⏱ Rough time per section

---

## Setup — Before You Start ⏱ 5 min

- [ ] Backend running at `http://localhost:4000` — confirm: `curl http://localhost:4000/api/health` → `{ "status": "ok" }`
- [ ] Frontend running at `http://localhost:3000` — page loads with no console errors
- [ ] **Mailtrap configured first** — set `MAILTRAP_HOST`, `MAILTRAP_PORT`, `MAILTRAP_USER`, `MAILTRAP_PASS` in `backend/.env` before creating any users. Emails will be missed otherwise.
- [ ] Supabase `avatars` bucket created in the **company Supabase project** (Storage → New bucket → name: `avatars` → set to **Public**) — required for avatar upload tests
- [ ] Two browser windows ready: one for admin, one for an employee (use incognito for the second)

> **Supabase credentials:** Use the **company** Supabase project — not any personal or dev account. Get the URL, service role key, and JWT secret from whoever owns the company Supabase account (Project Settings → API).

---

## Section 1 — Core E2E Flow (P0 — Must Pass)

---

### 1. Admin Signup & Login ⏱ 3 min

**Steps:**
1. Go to `http://localhost:3000/signup`
2. Fill in Name, Company Name, Email, Password (8+ chars, mixed case + number)
3. Click "Create account" → you should be redirected to `/admin`

**Expected:**
- ✅ Admin dashboard loads with your company name visible in the sidebar
- ✅ No console errors

**Test login:**
1. Sign out (sidebar → Sign Out)
2. Go to `http://localhost:3000/login` → sign in with same credentials

- ✅ Redirects to `/admin` dashboard

🔍 Backend terminal: `POST /api/auth/signup` and `POST /api/auth/signin` should return 200/201.

---

### 2. Create Departments ⏱ 2 min

**Steps:**
1. Admin sidebar → Departments
2. Create 2 departments: `Engineering`, `Sales`

**Expected:**
- ✅ Both appear in the list immediately
- ✅ Creating `Engineering` again should error (no duplicates)

🔍 Check DB → `departments` table — rows should exist with your `company_id`.

---

### 3. Create Employees ⏱ 5 min

**Manual creation:**
1. Admin → Employees → "+ Add Employee"
2. Create: Name=`Alex Manager`, Role=`MANAGER`, Department=`Engineering`
3. Create: Name=`Sam Employee`, Role=`EMPLOYEE`, Manager=`Alex Manager`, Department=`Engineering`
4. Create: Name=`Pat Peer`, Role=`EMPLOYEE`, Department=`Engineering`

**Expected:**
- ✅ All three appear with correct role badges
- ✅ Employee ID auto-generated (e.g. `EMP-XXXXXX`)
- ✅ Department pills shown per row

**CSV import:**
1. Click "Import CSV" → download template
2. Add 1–2 rows and upload

**Expected:**
- ✅ Imported users appear in the list
- ✅ Welcome/invite email sent — check Mailtrap inbox

🔍 Backend logs: `POST /api/users` and `POST /api/users/import`.

---

### 4. Create Review Cycle + Workflow Steps ⏱ 5 min

**Steps:**
1. Admin → Review Cycles → "+ New Review Cycle"
2. Fill in: Name=`Q1 2026`, Start Date (today), End Date (30 days out)
3. Add 3 workflow steps:
   - Step 1: `Self Assessment` — type: Self
   - Step 2: `Manager Review` — type: Manager
   - Step 3: `Peer Review` — type: Peer
4. Save

**Expected:**
- ✅ Cycle created with status `DRAFT`
- ✅ Steps appear in order with names visible

🔍 Backend logs: `POST /api/review-cycles`.

---

### 5. Add Questions ⏱ 3 min

**Steps:**
1. Admin → Questions
2. Add at least 2 questions:
   - Q1: Type=`Rating`, Text=`How would you rate overall performance?`
   - Q2: Type=`Text`, Text=`What are this person's key strengths?`

**Expected:**
- ✅ Questions saved and listed under the correct tab (Self / Manager / Peer)

---

### 6. Activation Blocked Without Questions ⏱ 1 min

**Steps:**
1. Create a second cycle with no questions
2. Try to activate it

**Expected:**
- ✅ Blocked — error message: "Add at least one question before activating this cycle"

🔍 Backend logs: `POST /api/review-cycles/:id/activate` should return 4xx.

---

### 7. Activate Cycle ⏱ 1 min

**Steps:**
1. Go back to `Q1 2026` (which has questions)
2. Click "Activate"

**Expected:**
- ✅ Status changes `DRAFT` → `ACTIVE`
- ✅ Cycle activation email sent — check Mailtrap

🔍 Backend logs: email send attempt logged.

---

### 8. Assign Reviewers ⏱ 5 min

**Steps:**
1. Admin → Review Cycles → `Q1 2026` → Reviewer Assignments
2. For `Sam Employee`: assign `Alex Manager` as manager reviewer, `Pat Peer` as peer reviewer
3. Confirm only employees from the same company appear in dropdowns

**Expected:**
- ✅ Assignments saved
- ✅ No users from other companies visible (tenant isolation)
- ✅ Assignment notification email sent to reviewers — check Mailtrap

🔍 DB → `reviewer_assignments` table — `company_id` should match yours.

---

### 9. Employee Completes Self Review ⏱ 5 min

**Steps:**
1. Incognito window → sign in as `Sam Employee`
2. Navigate to active cycle → "Start Self Review"
3. Fill in at least one answer — do NOT submit yet
4. Click the Back button

**Expected:**
- ✅ Browser confirmation dialog: "You have unsaved changes. Leave anyway?" (Bug 4 fix)
- ✅ Clicking Cancel keeps you on the page

5. Return to the review, answer all questions, and submit

**Expected:**
- ✅ All question types render correctly (Rating = buttons, Text = textarea)
- ✅ Review status changes to `SUBMITTED`

🔍 Backend logs: `POST /api/reviews` or `PATCH /api/reviews/:id`.

---

### 10. Manager Completes Manager Review ⏱ 5 min

**Steps:**
1. Sign in as `Alex Manager` (different incognito window)
2. Dashboard → assigned reviews → open review for `Sam Employee`
3. Answer all questions and submit

**Expected:**
- ✅ Manager sees Sam's name and the review form
- ✅ Cannot see other companies' employees
- ✅ Submission recorded

---

### 11. Peer Completes Peer Review ⏱ 5 min

**Steps:**
1. Sign in as `Pat Peer`
2. Dashboard → assigned peer reviews → complete and submit for `Sam Employee`

**Expected:**
- ✅ Peer review form loads correctly
- ✅ Submitted successfully

---

### 12. Score Visibility Rules ⏱ 3 min

**While reviews are incomplete:**
1. Sign in as `Sam Employee` → navigate to score view

**Expected:**
- ✅ Score is **hidden** — message: "Your score will appear once all required reviews are complete"

**After all reviews submitted:**
1. Refresh as `Sam Employee`

**Expected:**
- ✅ Score is now **visible**
- ✅ Score formula: `(Self avg + Avg(Manager scores) + Avg(Peer scores)) / 3`
- ✅ Score value does not exceed the configured max rating (Bug 1 fix)
- ✅ Score bar does not overflow its container (Bug 5 fix)

🔍 Backend: `GET /api/scoring/:cycleId/:userId` — check `allReviewsComplete` flag.

---

### 13. Reports & Score Overview ⏱ 2 min

**Steps:**
1. Sign in as Admin → Reports → select `Q1 2026`
2. View the scores page

**Expected:**
- ✅ `Sam Employee` appears with a calculated score
- ✅ Score breakdown shows Self / Manager / Peer components

---

### 14. Notifications & Preferences ⏱ 3 min

**Verify emails triggered so far (check Mailtrap):**
- Welcome/invite email (on user creation)
- Cycle activation email
- Reviewer assignment email

**Check score email fires only once (Bug 3 fix):**
1. Sign in as `Sam Employee` → click "View Detailed Scores"
2. Check Mailtrap — note how many emails arrived
3. Click "View Detailed Scores" again
4. Check Mailtrap again

**Expected:**
- ✅ Score email received exactly **once** — second click sends no new email

**Check notification preferences:**
1. Sign in as `Sam Employee` → Settings → Notifications
2. Turn off `Cycle Started` notifications
3. Admin: activate a new test cycle
4. Check Mailtrap — Sam should NOT receive a cycle-started email

🔍 Backend logs:
- Successful send: `Email sent to <address>: <subject>`
- Opted-out: `Skipping cycle started email for <address> (opted out)`

---

## Section 2 — Bug Regression Tests ⏱ 15 min

> Confirm each bug from the last test session is fixed. Don't skip these.

---

### Bug 1 — Score must not exceed max rating scale

1. Sign in as employee with a completed cycle
2. View "Performance Comparison" bar on the scores page

**Expected:** score ≤ configured max (e.g. 4.2 / 5.0 — never 10.00 / 5.00). Bar stays within its container.

---

### Bug 2 — Manager scores page must not crash

1. Sign in as a manager
2. Navigate to `/employee/scores`

**Expected:** page loads cleanly. No `RangeError: Invalid array length` crash.

---

### Bug 3 — Score email sent only once

*(Covered above in Test 14 — tick here once confirmed)*

- [ ] Score email arrived exactly once. Second click on "View Detailed Scores" sent no new email.

---

### Bug 4 — Exit prompt on partially-filled review

*(Covered above in Test 9 — tick here once confirmed)*

- [ ] Back button on self review showed confirm dialog with answers filled
- [ ] Browser tab close also showed "Changes may not be saved" warning

---

### Bug 5 — Score bar does not overflow after cycle date edit

1. Edit the `Q1 2026` cycle → shorten the end date significantly
2. Return to `Sam Employee`'s dashboard → check the score bar

**Expected:** bar width stays within its container (never > 100%).

---

### Bug 6 — Deleting a manager with pending assignments must fail clearly

1. Sign in as admin → Manage Employees
2. Find a manager who has an active reviewer assignment (assigned but not yet submitted)
3. Click Delete

**Expected:** blocked with error: "Cannot delete user with N pending reviewer assignment(s). Remove their reviewer assignments first."
**Expected:** manager is NOT deleted.

4. Remove the reviewer assignment, then retry delete

**Expected:** deletion succeeds.

---

## Section 3 — New Feature Tests ⏱ 20 min

---

### 3A — Auth Rate Limiting

1. Go to `/login`
2. Enter wrong credentials and submit — repeat at least 11 times within 2 minutes

**Expected:** after 10 failed attempts, error response with HTTP 429 (Too Many Requests)
**Expected:** waiting ~15 minutes and trying again allows login

---

### 3B — Avatar Upload (Supabase Storage)

1. Sign in as admin → Settings or employee profile → upload a JPG/PNG avatar
2. After upload, right-click the avatar → "Open image in new tab" → inspect the URL

**Expected:** URL contains `supabase.co/storage` — NOT `/uploads/`
**Expected:** image displays correctly

3. Upload a different avatar to the same user

**Expected:** new image replaces the old one (no duplicates)

---

### 3C — Organogram Page

1. Sign in as admin → navigate to `/organogram` → click Edit
2. Add a root position: "CEO"
3. Add a child: "CTO" under CEO
4. Add another child under CTO
5. Rename a position inline
6. Delete a leaf node

**Expected:** visual tree with connecting lines. Edit mode shows hover actions (rename / add child / delete). Deleting a parent removes its children. Page is horizontally scrollable for wide trees.

7. Sign in as employee → navigate to `/organogram`

**Expected:** chart visible, Edit button not shown

---

### 3D — Rating Scale Configuration

1. Sign in as admin → Settings → Rating Scale card
2. Change max rating from 5 to 7, fill in titles and descriptions for values 1–7 → Save

**Expected:** success confirmation shown

3. Go to Questions → edit a Rating question → check preview

**Expected:** preview shows 1–7 rating buttons (not 1–5)

4. Sign in as employee → open a self review with a rating question

**Expected:** rating buttons show 1–7. Collapsible "Rating Scale" panel shows all 7 label definitions.

---

### 3E — Dynamic Review Types

1. Sign in as admin → `/admin/review-types`
2. Verify built-in types: Self, Manager, Peer
3. Toggle "Required" on/off for a type
4. Create a custom type (e.g. "Skip-Level Feedback", base type: Manager)

**Expected:** custom type appears in list and is available in WorkflowStepBuilder

5. Toggle "Required" off for Peer reviews
6. Complete a cycle with only Self + Manager reviews submitted (no peer)

**Expected:** employee score is visible (Peer not required so gate passes)

---

### 3F — Departments Management

1. Sign in as admin → `/admin/departments`
2. Create: "Engineering", "Product"
3. Rename "Product" → "Product & Design"
4. Archive "Product & Design"

**Expected:** moves to archived section, not in active list

5. Restore it

**Expected:** returns to active list

6. Create an employee → assign to multiple departments

**Expected:** employee shows multiple department pills in the employee list

---

### 3G — Reviewer Assignment Emails (Re-run)

> This was marked Partial in the last session because Mailtrap was configured late. Re-run now that it's set up from the start.

1. Confirm Mailtrap credentials are in `.env`
2. Activate a cycle → assign a reviewer
3. Check Mailtrap inbox

**Expected:** reviewer receives the assignment notification email

---

## Section 4 — Edge Case & Guard Tests ⏱ 10 min

| Test | How to test | Expected |
|------|-------------|----------|
| Activate cycle without questions | Create empty cycle → activate | 400: "Add at least one question before activating" |
| Activate overlapping cycles | Two cycles same date range → activate second | 400: date overlap error |
| Admin analytics as employee | `GET /api/analytics/admin/:cycleId` with employee JWT | 403 Forbidden |
| Manager analytics as employee | `GET /api/analytics/manager/:cycleId` with employee JWT | 403 Forbidden |
| Unauthenticated questions access | `GET /api/questions` with no token | 401 Unauthorized |
| Score hidden mid-cycle | View score before all required reviews submitted | Score section hidden; placeholder shown |
| Score visible after required done | Complete all required reviews | Score section appears |
| Delete employee with submitted reviews | Try to delete employee who has submitted reviews | 400: "Cannot delete user who has submitted N review(s)" |
| Completed cycle cannot be reactivated | Mark cycle complete → try to activate again | Error: cycle already completed |

---

## Section 5 — Quick Smoke Tests

| Test | Pass? |
|------|-------|
| Dark mode toggle persists across page navigation | |
| Employee avatar upload → avatar appears in employee list with Supabase URL | |
| Admin can edit and delete an employee (no assignments) | |
| Rating scale change in Settings reflects in review form immediately | |
| Organogram page loads without error | |
| Department archive/restore works | |
| Review form cannot be submitted twice (submit button disabled after first submit) | |
| Automated tests pass: `cd backend && npm test` | |

---

## Section 6 — Pre-Deployment Checklist

> Complete every item before deployment starts. Do not skip.

### 6A — Environment & Secrets

- [ ] Copy `backend/.env.example` → `backend/.env` and fill in all values
- [ ] Copy `frontend/.env.example` → `frontend/.env.local` (or set in deployment platform)
- [ ] Required backend vars confirmed:
  - `DATABASE_URL`
  - `SUPABASE_URL`
  - `SUPABASE_JWT_SECRET`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `MAILTRAP_HOST`, `MAILTRAP_PORT`, `MAILTRAP_USER`, `MAILTRAP_PASS`
- [ ] `NODE_ENV=production` set in backend
- [ ] Optional: `SENTRY_DSN` (backend + frontend) — enables error tracking in production
- [ ] Optional: `CORS_ORIGIN` — set to the production frontend URL (e.g. `https://app.reviewly.com`)

### 6B — Supabase (Company Account)

> Use the **company Supabase project**. Do not use any personal or dev account. Get credentials from whoever owns the company Supabase account.

- [ ] Log in to the company Supabase dashboard
- [ ] `SUPABASE_URL` → Project Settings → API → Project URL
- [ ] `SUPABASE_SERVICE_ROLE_KEY` → Project Settings → API → Service Role key (keep secret — backend only)
- [ ] `SUPABASE_JWT_SECRET` → Project Settings → API → JWT Secret
- [ ] Paste all three into `backend/.env`
- [ ] Create `avatars` bucket: Storage → New bucket → name `avatars` → set to **Public**
- [ ] Double-check values are copy-pasted, not retyped

### 6C — Database

- [ ] Run migrations: `cd backend && npx prisma migrate deploy`
- [ ] Migration output shows no errors and all migrations applied
- [ ] Take a backup before go-live: `cd backend && npm run db:backup`

### 6D — Build & Tests

- [ ] `cd backend && npx tsc --noEmit` → zero errors
- [ ] `cd frontend && npx tsc --noEmit` → zero errors
- [ ] `cd backend && npm test` → all 33 tests pass

### 6E — Docker (if using containers)

- [ ] `docker compose -f docker-compose.prod.yml build` — both images build cleanly
- [ ] `docker compose -f docker-compose.prod.yml up -d` — all services start
- [ ] `curl http://localhost:4000/api/health` → `{ "status": "ok" }`
- [ ] Frontend loads at configured port with no console errors

### 6F — Post-Deploy Smoke Tests

Run these against the **deployed** environment immediately after deploy:

| # | Test | Expected |
|---|------|----------|
| 1 | `GET /api/health` | `{ "status": "ok" }` |
| 2 | Load `/login` | Reviewly branding, no JS errors |
| 3 | Admin signup | Redirected to `/admin` dashboard |
| 4 | Admin login | Company name visible in nav |
| 5 | Create employee | Dept pill + employeeId badge shown |
| 6 | Invite email | Received in Mailtrap with password-setup link |
| 7 | Upload avatar | URL contains `supabase.co/storage` |
| 8 | Create + activate review cycle | Status DRAFT → ACTIVE |
| 9 | Rate limit: 11th login attempt | HTTP 429 returned |
| 10 | Employee submits review | Confirm dialog on back; submission records |
| 11 | Delete manager with pending assignment | Descriptive 400 error, not deleted |
| 12 | View scores | Score ≤ max rating; bar does not overflow |

---

## Where to Check Logs

| What | Where |
|------|-------|
| Backend API calls | Terminal running `npm run start:dev` |
| Email delivery | Mailtrap inbox or backend logs (search: `nodemailer`) |
| DB state | Adminer at `http://localhost:8080` |
| Frontend errors | Browser DevTools → Console |
| Network requests | Browser DevTools → Network tab |

> **Tip:** Keep Adminer open throughout testing. If a UI action appears to succeed but nothing shows up, check the relevant Adminer table to confirm whether the DB write happened. This quickly distinguishes a frontend rendering bug from a backend failure.

---

## Known Limitations (Not Deployment Blockers)

- **Email domain verification** — not implemented. The system accepts any email format on signup. Flag for a future sprint.
- **Broken avatar images for locally-tested accounts** — user accounts created during local testing will have broken avatar images in the deployed environment (old disk-based URLs). This only affects test data — no real production users exist yet. Re-uploading the avatar on the deployed instance fixes it immediately.
