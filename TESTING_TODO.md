# Testing Checklist — Reviewly Deployment Readiness

Estimated time: 30–60 minutes.
Run this end-to-end before any release. All P0 items must pass.

**Setup:** Complete LOCAL_SETUP.md first. Have two browser windows ready — one for admin, one for an employee.

---

## Legend

- ✅ Expected result
- 🔍 Where to verify
- ⏱ Rough time per section

---

## P0 — Must Pass

---

### 1. Admin Signup & Login ⏱ 3 min

**Steps:**
1. Go to http://localhost:3000/signup
2. Fill in Name, Company Name, Email, Password (8+ chars, mixed case + number)
3. Click "Create account"
4. You should be redirected to `/admin`

**Expected:**
- ✅ Admin dashboard loads with your company name visible in the sidebar
- ✅ No console errors

**Then test login:**
1. Sign out (sidebar → Sign Out)
2. Go to http://localhost:3000/login
3. Sign in with the same credentials

- ✅ Redirects to `/admin` dashboard

🔍 Check backend terminal: `POST /api/auth/signup` and `POST /api/auth/signin` should return 200/201.

---

### 2. Create Departments ⏱ 2 min

**Steps:**
1. Admin → use the **Departments** link in the sidebar (route may vary)
2. Create 2 departments: `Engineering`, `Sales`

**Expected:**
- ✅ Both appear in the department list immediately
- ✅ No duplicate names allowed (try creating `Engineering` again — should error)

🔍 Adminer → Table `departments` — rows should exist with your `company_id`.

---

### 3. Create Employees ⏱ 5 min

**Steps (manual):**
1. Admin → Employees → "+ Add Employee"
2. Create a Manager: Name=`Alex Manager`, Role=`MANAGER`, Department=`Engineering`
3. Create an Employee: Name=`Sam Employee`, Role=`EMPLOYEE`, Manager=`Alex Manager`, Department=`Engineering`
4. Create a Peer: Name=`Pat Peer`, Role=`EMPLOYEE`, Department=`Engineering`

**Expected:**
- ✅ All three appear in the employee list with correct role badges
- ✅ Employee ID auto-generated (e.g. `EMP-XXXXXX`)
- ✅ Department pills shown in the row

**Steps (CSV import):**
1. Click "Import CSV"
2. Download the CSV template (or create a file with headers: `name,email,role,department,employeeId,managerEmail`)
3. Add 1–2 rows and upload

**Expected:**
- ✅ Imported users appear in the list
- ✅ Welcome email sent (check Mailtrap inbox or backend logs)

🔍 Backend logs: `POST /api/users` and `POST /api/users/import`.

---

### 4. Create Review Cycle + Workflow Steps ⏱ 5 min

**Steps:**
1. Admin → Review Cycles → "+ New Review Cycle"
2. Fill in: Name=`Q1 2026`, Start Date (today), End Date (30 days out)
3. Add at least 2 workflow steps, e.g.:
   - Step 1: `Self Assessment` — type: Self
   - Step 2: `Manager Review` — type: Manager
   - Step 3: `Peer Review` — type: Peer
4. Save

**Expected:**
- ✅ Cycle created with status `DRAFT`
- ✅ Steps appear in the correct order with names visible

🔍 Backend logs: `POST /api/review-cycles`.

---

### 5. Add Questions ⏱ 3 min

**Steps:**
1. Admin → Questions (or via the cycle detail)
2. Add at least 2 questions:
   - Q1: Type=`Rating`, Text=`How would you rate overall performance?`
   - Q2: Type=`Text`, Text=`What are this person's key strengths?`

**Expected:**
- ✅ Questions saved and listed

---

### 6. Activation Blocked Without Questions ⏱ 1 min

**Steps:**
1. Create a second cycle with NO questions assigned
2. Try to activate it

**Expected:**
- ✅ Activation is blocked — error message shown (e.g. "Cannot activate cycle without questions")

🔍 Backend logs: `POST /api/review-cycles/:id/activate` should return 4xx.

---

### 7. Activate Cycle ⏱ 1 min

**Steps:**
1. Go back to your `Q1 2026` cycle (which has questions)
2. Click "Activate"

**Expected:**
- ✅ Status changes from `DRAFT` → `ACTIVE`
- ✅ Notification emails sent to employees (check Mailtrap or backend logs for "cycle started" email)

🔍 Backend logs: email send attempt logged.

---

### 8. Assign Reviewers ⏱ 5 min

**Steps:**
1. Admin → Review Cycles → select `Q1 2026` → Reviewer Assignments
2. For `Sam Employee`:
   - Assign `Alex Manager` as manager reviewer
   - Assign `Pat Peer` as peer reviewer
3. Confirm department filtering works: only employees from the same company appear as options

**Expected:**
- ✅ Assignments saved
- ✅ No employees from other companies appear in dropdowns (tenant safety)
- ✅ Assignment email sent to reviewers (check Mailtrap)

🔍 Adminer → Table `reviewer_assignments` — check `company_id` matches.

---

### 9. Employee Completes Self Review ⏱ 5 min

**Steps:**
1. Open a new browser window (incognito) → http://localhost:3000/login
2. Sign in as `Sam Employee` (password: `password123` if seeded, or the password you set)
3. Navigate to the active review cycle → "Start Self Review"
4. Answer all questions and submit

**Expected:**
- ✅ All questions rendered with correct input types (Rating = buttons/slider, Text = textarea)
- ✅ Can save draft and return
- ✅ Submit button finalises the review
- ✅ Review status changes to `SUBMITTED`

🔍 Backend logs: `POST /api/reviews` or `PATCH /api/reviews/:id`.

---

### 10. Manager Completes Manager Review ⏱ 5 min

**Steps:**
1. Sign in as `Alex Manager` (incognito or different browser)
2. Navigate to Dashboard → assigned reviews
3. Open the review for `Sam Employee`
4. Answer all questions and submit

**Expected:**
- ✅ Manager sees `Sam Employee`'s name and the review form
- ✅ Cannot see other companies' employees
- ✅ Submission recorded

---

### 11. Peer Completes Peer Review ⏱ 5 min

**Steps:**
1. Sign in as `Pat Peer`
2. Navigate to Dashboard → assigned peer reviews
3. Complete and submit the review for `Sam Employee`

**Expected:**
- ✅ Peer review form loads correctly
- ✅ Submitted successfully

---

### 12. Score Visibility Rules ⏱ 3 min

**While reviews are still incomplete:**
1. Sign in as `Sam Employee`
2. Navigate to their review dashboard / score view

**Expected:**
- ✅ Score is **hidden** — message like "Score available once all reviews are complete"

**After all reviews submitted (self + manager + peer):**
1. Refresh as `Sam Employee`

**Expected:**
- ✅ Score is now **visible**
- ✅ Score formula: `(Self + Avg(Manager scores) + Avg(Peer scores)) / 3`

🔍 Backend: `GET /api/scoring/:cycleId/:userId` — check `allReviewsComplete` flag in response.

---

### 13. Reports & Score Overview ⏱ 2 min

**Steps:**
1. Sign in as Admin
2. Navigate to Reports → select `Q1 2026`
3. View the scores page

**Expected:**
- ✅ `Sam Employee` appears with a calculated score
- ✅ Scores display correctly with breakdown

---

### 14. Notifications & Preferences ⏱ 3 min

**Check emails triggered so far:**
1. Open Mailtrap → your sandbox inbox
2. Verify emails were received for:
   - Welcome email (on user creation)
   - Cycle activation
   - Reviewer assignment

**Check preferences are respected:**
1. Sign in as `Sam Employee` → Settings → Notifications
2. Turn off `Cycle Started` notifications
3. Admin: create and activate a new test cycle
4. Check Mailtrap — Sam should NOT receive the cycle started email

**Expected:**
- ✅ Emails arrive for opted-in events
- ✅ Emails do NOT arrive for opted-out events

🔍 Backend logs — grep for these exact lines:
- Successful send: `Email sent to <address>: <subject> (messageId: ...)`
- Opted-out skip: `Skipping cycle started email for <address> (opted out)`
- No Mailtrap configured: `[DEV MODE] Email to <address>` followed by `Subject: ...`

---

## Quick Smoke Tests (if time allows)

| Test | Pass? |
|------|-------|
| Dark mode toggle in navbar persists across page navigation | |
| Employee avatar upload in Settings → shows in employee list | |
| Admin can edit and delete an employee | |
| Rating scale change in Settings reflects in review form | |
| Organogram page loads at `/admin/organogram` | |
| Department management — archive a department | |
| Cycle with `COMPLETED` status cannot be re-activated | |
| Review form cannot be submitted twice (idempotent) | |

---

## Where to Check Logs

| What | Where |
|------|-------|
| Backend API calls | Terminal running `npm run start:dev` |
| Email delivery | Mailtrap inbox or backend logs (search: `nodemailer`) |
| DB state | Adminer at http://localhost:8080 |
| Frontend errors | Browser DevTools → Console |
| Network requests | Browser DevTools → Network tab |

> **Tip:** Keep Adminer open in a separate tab throughout testing. If a UI action appears to succeed but nothing shows up, refresh the relevant Adminer table to confirm whether the DB write actually happened. This quickly distinguishes a frontend rendering bug from a backend failure.

---

## Known Dev Limitations

- Auth tokens come from Supabase — if your Supabase project is paused, login will fail.
- Emails go to Mailtrap sandbox — not real inboxes. Check Mailtrap UI.
- Avatar images are stored locally in `backend/uploads/` — they won't persist if the backend process restarts and uploads dir is wiped.
