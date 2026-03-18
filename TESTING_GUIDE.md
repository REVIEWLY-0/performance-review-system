# 🧪 Reviewly - Comprehensive Testing Guide

Complete test scenarios, edge cases, and validation checklist for production readiness.

---

## 📋 Table of Contents

1. [Setup & Prerequisites](#setup--prerequisites)
2. [Authentication & Authorization](#authentication--authorization)
3. [User Management](#user-management)
4. [Review Cycles](#review-cycles)
5. [Reviews & Scoring](#reviews--scoring)
6. [Email Notifications](#email-notifications)
7. [Error Handling](#error-handling)
8. [Performance & Load Testing](#performance--load-testing)
9. [Security Testing](#security-testing)
10. [Edge Cases & Stress Testing](#edge-cases--stress-testing)

---

## Setup & Prerequisites

### Environment Setup

**Backend:**
```bash
cd backend
cp .env.example .env
# Configure all environment variables
npm install
npm run dev
```

**Frontend:**
```bash
cd frontend
cp .env.example .env.local
# Configure all environment variables
npm install
npm run dev
```

### Test Data Setup

```bash
# Run database migrations
cd backend
npx prisma migrate dev

# Seed test data
npx prisma db seed
```

### Test Accounts

Create these test accounts for comprehensive testing:

1. **Admin User:**
   - Email: `admin@testcompany.com`
   - Password: `Admin123!`
   - Role: ADMIN

2. **Manager User:**
   - Email: `manager@testcompany.com`
   - Password: `Manager123!`
   - Role: MANAGER

3. **Employee Users:**
   - Email: `employee1@testcompany.com` - `employee5@testcompany.com`
   - Password: `Employee123!`
   - Role: EMPLOYEE

---

## Authentication & Authorization

### Test Case 1: Sign Up Flow

**Steps:**
1. Navigate to `/login`
2. Click "Don't have an account? Sign up"
3. Fill in:
   - Full Name: "Test User"
   - Company Name: "Test Company"
   - Email: "test@example.com"
   - Password: "Test123!"
   - Confirm Password: "Test123!"
4. Click "Sign up"

**Expected:**
- ✅ Password strength bar shows "Good" or "Strong"
- ✅ Confirm password validates matching
- ✅ Success message appears
- ✅ Redirects to admin dashboard (first user is admin)
- ✅ Welcome email sent (check inbox or logs)

**Edge Cases:**
- ❌ **Weak password:** "test" → Shows "Weak" with red bar + requirements
- ❌ **Mismatched passwords:** Shows "Passwords do not match"
- ❌ **Invalid email:** "notemail" → Shows "Please enter a valid email address"
- ❌ **Duplicate email:** Shows error from backend
- ❌ **Empty fields:** Shows required field errors
- ❌ **XSS attempt:** `<script>alert('xss')</script>` in name → Sanitized

---

### Test Case 2: Sign In Flow

**Steps:**
1. Navigate to `/login`
2. Enter valid credentials
3. Click "Sign in"

**Expected:**
- ✅ Success message appears
- ✅ Redirects to role-appropriate dashboard
  - ADMIN → `/admin`
  - MANAGER → `/manager`
  - EMPLOYEE → `/employee`
- ✅ Session persists on page refresh

**Edge Cases:**
- ❌ **Wrong password:** Shows "Authentication failed"
- ❌ **Non-existent user:** Shows error
- ❌ **Empty fields:** Shows validation errors
- ❌ **SQL injection attempt:** `' OR '1'='1` → Safely handled
- ⏱️ **Slow network:** Loading state shows, no double-submit

---

### Test Case 3: Session Persistence & Retry Logic

**Steps:**
1. Sign in successfully
2. Refresh the page multiple times
3. Close browser and reopen
4. Navigate between pages

**Expected:**
- ✅ User stays logged in across refreshes
- ✅ Session persists across browser sessions
- ✅ Auto-retry on transient failures (3 attempts)
- ✅ 401 errors trigger auto sign-out → redirect to login

**Edge Cases:**
- 🔄 **Network failure during getCurrentUser:** Retries with exponential backoff
- 🔄 **Slow API response:** Shows loading state, doesn't timeout prematurely
- ❌ **Expired token:** Auto signs out, redirects to login
- ❌ **Corrupted session:** Clears session, redirects to login

---

### Test Case 4: Multi-Tenancy Isolation

**Steps:**
1. Create Company A with admin1@companyA.com
2. Create Company B with admin2@companyB.com
3. Admin A creates employees, review cycles
4. Admin B creates employees, review cycles

**Expected:**
- ✅ Admin A can ONLY see Company A data
- ✅ Admin B can ONLY see Company B data
- ✅ Employees in Company A cannot see Company B data
- ✅ API returns 404 for cross-company data access attempts

**Edge Cases:**
- ❌ **Direct API call with Company B ID from Company A user:** 404 or 403
- ❌ **Manipulated JWT with different companyId:** Token validation fails
- ❌ **URL parameter tampering:** `/admin/users?companyId=different` → Ignored

---

## User Management

### Test Case 5: Create Employee

**Steps:**
1. Login as Admin
2. Navigate to "Manage Employees"
3. Click "Add Employee"
4. Fill in:
   - Full Name: "Jane Doe"
   - Email: "jane@company.com"
   - Role: EMPLOYEE
   - Manager: (select from dropdown)
5. Click "Create Employee"

**Expected:**
- ✅ Employee created successfully
- ✅ Appears in employee list
- ✅ Manager relationship established
- ✅ Welcome email sent
- ✅ Validation works (name length, email format)

**Edge Cases:**
- ❌ **Duplicate email:** Shows "Email already exists"
- ❌ **Invalid email:** Real-time validation error
- ❌ **Name too short:** "A" → Shows "Full Name must be at least 2 characters"
- ❌ **Special characters in name:** Handles Unicode correctly (e.g., "José García")
- ❌ **No manager selected:** Creates employee without manager (valid)
- ⚠️ **Manager is from different company:** Should not appear in dropdown

---

### Test Case 6: Employee List & Stats

**Steps:**
1. Login as Admin
2. Navigate to "Manage Employees"
3. Observe stats and list

**Expected:**
- ✅ Total Employees count is accurate
- ✅ Admins count is accurate
- ✅ Managers count is accurate
- ✅ Employees count is accurate
- ✅ List shows all employees with roles
- ✅ Can edit/delete employees

**Edge Cases:**
- 📊 **0 employees:** Shows "0" in stats, not blank
- 📊 **Large dataset (100+ employees):** Pagination or scroll works
- 🔄 **Real-time updates:** Creating employee updates list without manual refresh

---

## Review Cycles

### Test Case 7: Create Review Cycle

**Steps:**
1. Login as Admin
2. Navigate to "Review Cycles"
3. Click "New Review Cycle"
4. Fill in:
   - Cycle Name: "Q1 2024 Performance Review"
   - Start Date: 2024-01-01
   - End Date: 2024-03-31
5. Add workflow steps:
   - Step 1: SELF review (Jan 1 - Jan 15)
   - Step 2: MANAGER review (Jan 16 - Jan 31)
   - Step 3: PEER review (Feb 1 - Feb 15)
6. Click "Create Review Cycle"

**Expected:**
- ✅ Cycle created with DRAFT status
- ✅ All 3 workflow steps saved
- ✅ Timeline preview shows correctly
- ✅ Appears in "Draft" tab

**Edge Cases:**
- ❌ **End date before start date:** Shows "Start date must be before end date"
- ❌ **Step dates outside cycle dates:** Shows error
- ❌ **Step end before step start:** Shows error
- ❌ **More than 3 steps:** Shows "Maximum 3 workflow steps allowed"
- ❌ **Duplicate SELF review:** Shows "Only one Self Review step allowed"
- ❌ **No workflow steps:** Shows "At least one workflow step is required"
- ❌ **Overlapping step dates:** Allowed (system handles it)
- ✅ **Gap between steps:** Allowed (valid use case)

---

### Test Case 8: Activate Review Cycle

**Steps:**
1. Create a draft review cycle
2. Click "View" on the cycle
3. Click "Activate"
4. Confirm activation

**Expected:**
- ✅ Status changes from DRAFT → ACTIVE
- ✅ Moves from "Draft" tab to "Active" tab
- ✅ "Edit" button no longer available
- ✅ "View" button shows read-only information
- ✅ Email notifications sent to all employees
- ✅ Review records auto-created for all employees

**Edge Cases:**
- ❌ **Activate cycle with 0 employees:** Succeeds but sends 0 emails
- ❌ **Activate cycle in the past:** Allowed (admin might backfill)
- ⚠️ **Activate second cycle while one is active:** Allowed (multiple active cycles possible)

---

### Test Case 9: View vs Edit Button Clarity

**Steps:**
1. Create 3 review cycles (DRAFT, ACTIVE, COMPLETED)
2. Navigate to "Review Cycles"
3. Switch between tabs

**Expected:**
- ✅ **DRAFT cycles:** Show "Edit" button (indigo/primary)
- ✅ **ACTIVE cycles:** Show "View" button (gray/secondary)
- ✅ **COMPLETED cycles:** Show "View" button (gray/secondary)
- ✅ Clicking "Edit" on DRAFT → Can modify and save
- ✅ Clicking "View" on ACTIVE → Read-only page with yellow warning
- ✅ Clicking "View" on COMPLETED → Read-only page

**Edge Cases:**
- ❌ **Try to edit ACTIVE cycle via URL manipulation:** Shows warning, no edit form
- ❌ **Try to edit COMPLETED cycle:** Shows warning, no edit form

---

## Reviews & Scoring

### Test Case 10: Self-Review Completion

**Steps:**
1. Login as Employee
2. Navigate to Dashboard
3. Click on active review cycle
4. Fill out self-review form:
   - Answer all RATING questions (1-5)
   - Answer all TEXT questions
   - Complete all TASK_LIST items
5. Click "Submit Review"

**Expected:**
- ✅ Progress bar shows 0% → 100% as questions answered
- ✅ Auto-save occurs every 30 seconds
- ✅ "Last saved" timestamp updates
- ✅ Submit button disabled until 100% complete
- ✅ After submit, review is read-only
- ✅ Status changes to SUBMITTED

**Edge Cases:**
- 💾 **Auto-save during typing:** Saves after 30s of last change
- 💾 **Browser crash/close:** Reopening loads draft from last save
- ❌ **Submit at 99% complete:** Button disabled, shows error
- ❌ **Submit without answering required question:** Validation error
- 🔄 **Network failure during submit:** Retries or shows error
- ✅ **Unicode characters in text answers:** Handles correctly
- ✅ **Very long text answer (10000 chars):** Saves and loads correctly

---

### Test Case 11: Manager Review

**Steps:**
1. Admin assigns manager to review employee
2. Login as Manager
3. Navigate to "My Reviews" or "Manager Reviews"
4. Click on assigned employee
5. Complete review form
6. Submit

**Expected:**
- ✅ Manager sees only assigned employees
- ✅ Can view employee's self-review (read-only)
- ✅ Can complete manager review
- ✅ Progress tracking works
- ✅ Auto-save works
- ✅ Submit validation works

**Edge Cases:**
- ❌ **Manager tries to review unassigned employee:** 404 or 403
- ❌ **Manager tries to review employee from different company:** 404
- ✅ **Manager has 0 assigned reviews:** Shows empty state

---

### Test Case 12: Peer Review

**Steps:**
1. Admin assigns peer reviewers
2. Login as peer reviewer (Employee)
3. Navigate to "Peer Reviews"
4. Complete peer review
5. Submit

**Expected:**
- ✅ Shows assigned peer reviews only
- ✅ Can complete review form
- ✅ Submit validation works
- ✅ Cannot see other peers' reviews

**Edge Cases:**
- ❌ **Peer tries to review self:** Should not be assigned
- ❌ **Circular peer reviews:** A reviews B, B reviews A → Allowed
- ✅ **Employee assigned multiple peer reviews:** Shows all in list

---

### Test Case 13: Score Calculation

**Steps:**
1. Employee completes self-review (avg rating: 4.0)
2. Manager completes review (avg rating: 3.5)
3. 2 Peers complete reviews (avg ratings: 4.0, 4.5)
4. All reviews submitted
5. Check employee score

**Expected:**
- ✅ Score = (Self + Avg(Managers) + Avg(Peers)) / 3
- ✅ Score = (4.0 + 3.5 + 4.25) / 3 = 3.92
- ✅ Score visible in admin analytics
- ✅ Score visible in employee dashboard
- ✅ Email sent to employee when score available

**Edge Cases:**
- ⚠️ **Only self-review completed:** Score = self average only
- ⚠️ **No peer reviews:** Score = (self + manager) / 2
- ⚠️ **Multiple manager reviews:** Averages all manager reviews
- ✅ **Fractional scores:** Displayed to 2 decimal places

---

## Email Notifications

### Test Case 14: Welcome Email

**Steps:**
1. Admin creates new employee
2. Check email inbox (or backend logs if EMAIL_SERVICE_KEY not set)

**Expected:**
- ✅ Email sent to new employee
- ✅ Subject: "Welcome to {CompanyName}'s Reviewly!"
- ✅ Contains user name, company name
- ✅ Contains dashboard link
- ✅ Both HTML and plain-text versions

**Edge Cases:**
- 📧 **No EMAIL_SERVICE_KEY:** Logs email to console instead
- 📧 **Invalid email address:** Resend returns error, logged
- 📧 **Email bounce:** Check Resend dashboard

---

### Test Case 15: Review Cycle Started Email

**Steps:**
1. Admin activates review cycle
2. Check employee inboxes

**Expected:**
- ✅ Email sent to ALL employees in company
- ✅ Subject: "New Review Cycle: {CycleName}"
- ✅ Contains cycle name, end date
- ✅ Contains dashboard link
- ✅ Both HTML and plain-text

**Edge Cases:**
- 📧 **100 employees:** All receive email (check Resend limits)
- 📧 **Employee has email notifications disabled:** Still receives? (Check preference logic)

---

### Test Case 16: Reminder Email (Cron Job)

**Steps:**
1. Create active cycle ending in 2 days
2. Employee has pending review
3. Wait for 9AM or manually trigger cron
4. Check employee inbox

**Expected:**
- ✅ Email sent to employees with pending reviews
- ✅ Subject: "Reminder: {N} Pending Reviews"
- ✅ Shows days left until deadline
- ✅ Shows pending count
- ✅ Both HTML and plain-text

**Edge Cases:**
- ⏰ **Cron runs at exactly 9AM:** Verify in logs
- ✅ **All reviews completed:** No reminder sent
- ✅ **Cycle ends in 4 days:** No reminder (only ≤3 days)
- ✅ **Multiple cycles ending soon:** Sends for all

---

### Test Case 17: Test Email (Admin Only)

**Steps:**
1. Login as Admin
2. Navigate to settings or notifications
3. Send test email via API:
   ```bash
   curl -X POST http://localhost:4000/api/notifications/test?email=admin@test.com \
     -H "Authorization: Bearer ADMIN_TOKEN"
   ```

**Expected:**
- ✅ Returns `{"success": true, "message": "..."}`
- ✅ Email received in inbox
- ✅ Shows configuration details
- ✅ Both HTML and plain-text

**Edge Cases:**
- ❌ **Non-admin tries test:** Returns error
- ❌ **No EMAIL_SERVICE_KEY:** Returns `{"success": false, "message": "Email service not configured"}`
- ✅ **Invalid email in query:** Resend validation error

---

### Test Case 18: Notification Preferences

**Steps:**
1. Login as any user
2. Navigate to `/settings`
3. Toggle off "Review assignment notifications"
4. Save preferences
5. Admin assigns review to user

**Expected:**
- ✅ Preferences load correctly
- ✅ Toggle switches work
- ✅ Save succeeds with success message
- ✅ Reload page → toggles persist
- ⚠️ **Preference respected?** Need to verify email sending logic checks preferences

**Edge Cases:**
- ✅ **All notifications disabled:** User gets no emails
- ✅ **Preferences reset to defaults:** All enabled
- 🔄 **Save fails (network error):** Shows error, doesn't update UI

---

## Error Handling

### Test Case 19: Frontend Error Boundary

**Steps:**
1. Trigger a React error:
   - Add broken component that throws
   - Or use browser console: `throw new Error('Test')`
2. Observe error boundary

**Expected:**
- ✅ Error boundary catches error
- ✅ Shows friendly error page
- ✅ "Try Again" button resets boundary
- ✅ "Go Home" button navigates to /
- ✅ Error logged to console with context
- ✅ In dev: Shows error message + stack trace
- ✅ In prod: Shows generic friendly message

**Edge Cases:**
- 🔄 **Click "Try Again":** Attempts re-render, may fail again or succeed
- 🏠 **Click "Go Home":** Navigates to root, clears error state
- 📊 **Error in child component:** Boundary catches, logs component stack

---

### Test Case 20: Global Error Handlers

**Steps:**
1. Open browser console
2. Trigger unhandled error: `throw new Error('Unhandled')`
3. Trigger promise rejection: `Promise.reject('Failed')`
4. Observe console logs

**Expected:**
- ✅ Unhandled error caught and logged
- ✅ Promise rejection caught and logged
- ✅ Logs include timestamp, context, error details
- ✅ Development: Errors visible in console
- ✅ Production: Errors logged (ready for tracking service)

**Edge Cases:**
- 🌐 **Network error:** Caught and logged
- ⚠️ **CORS error:** Caught and logged
- 🔒 **Security error:** Caught and logged

---

### Test Case 21: Form Validation Edge Cases

**Steps:**
Test each form with extreme inputs:

**Login/Signup:**
- Empty strings
- Whitespace only
- Very long strings (10000 chars)
- Unicode characters (emoji, Chinese, Arabic)
- HTML/XSS attempts: `<script>alert('xss')</script>`
- SQL injection: `' OR '1'='1`

**Expected:**
- ✅ Empty/whitespace: "Field is required"
- ✅ Too long: Truncated or validated
- ✅ Unicode: Handled correctly
- ✅ XSS: Sanitized, stored safely
- ✅ SQL injection: Parameterized queries safe

**Edge Cases:**
- 🎨 **Emoji in name:** Stored and displayed correctly
- 🌍 **RTL languages:** Display correctly
- ⚠️ **NULL bytes:** Rejected
- ⚠️ **Control characters:** Sanitized

---

## Performance & Load Testing

### Test Case 22: Dashboard Load Time

**Steps:**
1. Create company with 500 employees
2. Create active review cycle
3. Login as admin
4. Navigate to admin dashboard
5. Measure page load time

**Expected:**
- ✅ Initial load: < 3 seconds
- ✅ Analytics API: < 2 seconds
- ✅ Charts render smoothly
- ✅ No UI freezing

**Edge Cases:**
- 📊 **1000 employees:** Still loads < 5 seconds
- 📊 **10 active cycles:** Dropdown loads quickly
- 🔄 **Slow network (3G):** Shows loading states, no timeout

---

### Test Case 23: Concurrent Users

**Steps:**
1. Simulate 50 concurrent users
2. Each user:
   - Logs in
   - Navigates to dashboard
   - Completes a review
   - Logs out

**Expected:**
- ✅ All users can log in
- ✅ No race conditions
- ✅ No data corruption
- ✅ Rate limiting works (10 req/sec per IP)

**Tools:**
- Apache Bench: `ab -n 1000 -c 50 http://localhost:4000/api/health`
- k6, Artillery, or JMeter for complex scenarios

**Edge Cases:**
- ⚠️ **Rate limit exceeded:** 429 Too Many Requests
- ⚠️ **Database connection pool exhausted:** Queues requests
- 🔒 **Session collision:** Each user has unique session

---

### Test Case 24: Large Data Sets

**Steps:**
1. Create 1000 employees
2. Create 100 review cycles
3. Generate 10,000 reviews
4. Test various queries

**Expected:**
- ✅ Employee list loads (with pagination)
- ✅ Review cycles list loads
- ✅ Analytics calculates correctly
- ✅ Score calculation completes in < 5 seconds

**Edge Cases:**
- 📊 **Analytics with 10K reviews:** Uses indexes, loads < 5s
- 📊 **Search employees:** Indexed, fast response
- 💾 **Database size:** Monitors growth, backup strategy

---

## Security Testing

### Test Case 25: Authentication Bypass Attempts

**Steps:**
Try various auth bypass techniques:

1. **No token:** `curl http://localhost:4000/api/users`
2. **Invalid token:** `curl -H "Authorization: Bearer invalid"`
3. **Expired token:** Use old token
4. **Token from different company:** Use Company A token for Company B data

**Expected:**
- ❌ All attempts return 401 Unauthorized
- ❌ No data leaked
- ❌ Errors logged

---

### Test Case 26: SQL Injection

**Steps:**
Try SQL injection in:
- Email: `admin'--`
- Password: `' OR '1'='1`
- Search: `'; DROP TABLE users;--`

**Expected:**
- ✅ All safely handled with parameterized queries
- ✅ No database errors
- ✅ No data returned

---

### Test Case 27: XSS (Cross-Site Scripting)

**Steps:**
Try XSS in:
- Name: `<script>alert('xss')</script>`
- Email: `test+<script>@example.com`
- Review answers: `<img src=x onerror=alert('xss')>`

**Expected:**
- ✅ All sanitized on input or output
- ✅ Scripts don't execute
- ✅ Displayed safely

---

### Test Case 28: CSRF (Cross-Site Request Forgery)

**Steps:**
1. Login to app in Browser A
2. In Browser B, create malicious form:
   ```html
   <form action="http://localhost:4000/api/users" method="POST">
     <input name="email" value="hacker@evil.com">
   </form>
   ```
3. Submit form

**Expected:**
- ❌ Request blocked by CORS (different origin)
- ❌ No data created

---

### Test Case 29: Rate Limiting

**Steps:**
```bash
# Send 15 requests in 1 second
for i in {1..15}; do
  curl http://localhost:4000/api/health &
done
wait
```

**Expected:**
- ✅ First 10 succeed (200 OK)
- ❌ Next 5 fail (429 Too Many Requests)
- ✅ After 1 second, rate limit resets

---

### Test Case 30: Security Headers

**Steps:**
```bash
curl -I http://localhost:4000/api/health
```

**Expected:**
- ✅ `X-Content-Type-Options: nosniff`
- ✅ `X-Frame-Options: SAMEORIGIN` or `DENY`
- ✅ `Strict-Transport-Security` (production)
- ✅ `X-DNS-Prefetch-Control: off`
- ✅ CORS headers present and correct

---

## Edge Cases & Stress Testing

### Test Case 31: Database Failures

**Steps:**
1. Stop database
2. Try to login
3. Restart database
4. Try again

**Expected:**
- ❌ Login fails with error message
- ✅ Error logged in backend
- ✅ After restart, works normally
- ✅ No data corruption

---

### Test Case 32: Email Service Failures

**Steps:**
1. Set invalid `EMAIL_SERVICE_KEY`
2. Activate review cycle
3. Check logs

**Expected:**
- ⚠️ Email send fails
- ✅ Error logged
- ✅ Cycle still activates
- ✅ Doesn't crash server

---

### Test Case 33: Network Failures

**Steps:**
1. Disconnect network during:
   - Review submission
   - Login
   - Data fetch

**Expected:**
- ⚠️ Shows error message
- ✅ No data corruption
- ✅ Retry logic works
- ✅ Can recover after reconnection

---

### Test Case 34: Browser Compatibility

**Test in:**
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ⚠️ Mobile browsers (iOS Safari, Chrome Android)

**Expected:**
- ✅ All features work
- ✅ Responsive design works
- ✅ Forms submit correctly
- ✅ No console errors

---

### Test Case 35: Time Zone Handling

**Steps:**
1. Create review cycle with dates
2. View from different time zones
3. Check deadline calculations

**Expected:**
- ✅ Dates display correctly in user's timezone
- ✅ Deadlines calculated correctly
- ✅ No off-by-one-day errors

---

### Test Case 36: Special Characters & Unicode

**Steps:**
Test with names like:
- José García
- 王明 (Chinese)
- محمد (Arabic)
- Emoji: John 🎉 Doe

**Expected:**
- ✅ Stored correctly
- ✅ Displayed correctly
- ✅ Search works
- ✅ Emails display correctly

---

## 📊 Testing Checklist Summary

### Critical Path (Must Pass)
- [ ] Signup flow works
- [ ] Login flow works
- [ ] Session persists
- [ ] Multi-tenancy isolation works
- [ ] Create employee works
- [ ] Create review cycle works
- [ ] Activate cycle sends emails
- [ ] Complete review works
- [ ] Score calculation correct
- [ ] Error boundary catches errors

### Security (Must Pass)
- [ ] Auth bypass blocked
- [ ] SQL injection safe
- [ ] XSS prevented
- [ ] CSRF blocked
- [ ] Rate limiting works
- [ ] Security headers present

### Performance (Should Pass)
- [ ] Dashboard loads < 3s
- [ ] 50 concurrent users supported
- [ ] Large datasets handled

### Edge Cases (Nice to Have)
- [ ] Unicode handled correctly
- [ ] Network failures graceful
- [ ] Email failures don't crash
- [ ] Browser compatibility good

---

## 🚀 Automated Testing Commands

```bash
# Backend unit tests
cd backend
npm test

# Backend e2e tests
npm run test:e2e

# Frontend unit tests
cd frontend
npm test

# Frontend e2e tests (Playwright/Cypress)
npm run test:e2e

# Lint checks
npm run lint

# Type checks
npm run type-check

# Build verification
npm run build
```

---

## 📝 Bug Reporting Template

When you find issues, document them:

```
**Bug Title:** Brief description

**Severity:** Critical / High / Medium / Low

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens

**Screenshots/Logs:**
Attach if applicable

**Environment:**
- Browser: Chrome 120
- OS: macOS 14
- Backend: Node 20.x
- Database: PostgreSQL 15

**Additional Context:**
Any other relevant information
```

---

**Good luck with testing! 🧪**
