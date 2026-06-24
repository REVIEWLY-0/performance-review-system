# Reviewly — Manual Testing Checklist

All testing below is against the **dev** environment only.
Start the stack with: `docker compose -f docker-compose.dev.yml --env-file .env.dev up --build`

---

## Pre-flight

- [ ] Stack starts without errors (`docker compose ... up --build`)
- [ ] `npx prisma migrate dev` runs the new migration without errors (creates `score_weight_configs`, `employee_goals`, `quant_scores` tables)
- [ ] Backend test suite: `npx jest --no-coverage` → **58 passed, 0 failed**
- [ ] Frontend compiles: `cd frontend && npx tsc --noEmit` → no errors

---

## Change 2 — Forgot Password

### Forgot-password flow (unauthenticated)

- [ ] Visit `/login`
- [ ] Click **Forgot password?** link below the password field
- [ ] Verify inline email form appears (Back to sign in link is shown)
- [ ] Submit a **registered** email → generic success banner appears (no mention of whether email was found)
- [ ] Submit an **unregistered** email → same generic success banner (anti-enumeration)
- [ ] Submit an **invalid email** (e.g. `not-email`) → validation error, no banner
- [ ] Submit **empty form** → validation error
- [ ] Click **Back to sign in** → forgot-password view is dismissed
- [ ] Check dev email inbox (Mailtrap) → password reset email received for registered address
- [ ] Click the link in the email → redirected to `/login?mode=set-password` (or Supabase callback flow)
- [ ] Set a new password → sign-in succeeds with new password

### Rate limiting
- [ ] Submit forgot-password endpoint 6+ times quickly → HTTP 429 on the 6th request (5 per 15 min limit)

---

## Change 1 — Configurable Scoring Weights

### Admin: Scoring Weights page

- [ ] Sign in as ADMIN → navigate to **Scoring** in the sidebar
- [ ] Page loads with current weights (defaults: Quant 50%, Manager 60%, Peer 30%, Self 10%, threshold 3)
- [ ] Move the **Quantitative weight** slider → Live Preview updates immediately
- [ ] Adjust Manager/Peer/Self sliders → Sum badge updates in real time
- [ ] Attempt to **Save** with qual weights not summing to 100 → Save button disabled
- [ ] Set valid weights (e.g. Quant=30, Manager=50, Peer=40, Self=10) → Save → success message
- [ ] Reload page → saved values are still shown

### Admin: Goals management

- [ ] Navigate to **Review Cycles** → open a cycle → click **Goals** tab (or `/admin/review-cycles/[id]/goals`)
- [ ] Select an employee from the dropdown
- [ ] Click **Add** with an empty title → nothing happens (button disabled)
- [ ] Enter a goal title → **Add** → goal appears in list
- [ ] Rate the goal 1–5 → rating persists after clicking away
- [ ] Delete a goal → disappears from list
- [ ] Enter a **Quant score fallback** (e.g. 3.5) → **Save** → no error
- [ ] Switch to a different employee → goals panel reloads for that employee

### Scoring formula verification

- [ ] Trigger score calculation for an employee with goals rated (e.g. average rating 4.0)
  - Expected: quant score = 4.0 (from goals avg)
- [ ] Trigger score calculation for an employee with a QuantScore override and no goals
  - Expected: quant score = the override value
- [ ] Trigger score calculation for an employee with neither goals nor QuantScore
  - Expected: qualWeight effectively 100% (quant component absent)
- [ ] Verify final score on `/admin/review-cycles/[id]/scores` reflects the weighted formula
- [ ] Re-normalisation: employee with no peer reviews → peer weight absorbed into manager+self proportionally

---

## Change 3 — Received Reviews

### Visibility gate

- [ ] Sign in as EMPLOYEE → navigate to **Received** in the nav
- [ ] Select a cycle with status **ACTIVE** → page shows "Reviews are locked…" message
- [ ] Select a cycle with status **COMPLETED** → reviews load

### PEER anonymity (server-side enforcement)

- [ ] With fewer than `minPeerThreshold` peer reviews submitted in a completed cycle:
  - [ ] Page shows "Peer reviews withheld" card with count/threshold info
  - [ ] Aggregate average rating shown (if any ratings exist)
  - [ ] No individual review entries visible
- [ ] With at or above threshold peer reviews:
  - [ ] Individual peer review entries shown (no reviewer name/email visible)
  - [ ] **Inspect network response** in DevTools → confirm `reviewer` field is **absent** (not null) from peer review objects
- [ ] Verify no `reviewerId` or `reviewer.name` appears in the API JSON for peer reviews

### MANAGER downward reviews (attributed)

- [ ] Manager reviews appear with **reviewer name and email** shown
- [ ] Confirm this reviewer info is visible to the reviewee

### Upward reviews (anonymous)

- [ ] Direct report submits a review of their manager (upward flow)
- [ ] Manager views **Received** tab → upward reviews appear in the **Upward Reviews** section
- [ ] Upward reviews show no reviewer name/email
- [ ] Below threshold → withheld with aggregate

### SELF review

- [ ] Self review appears attributed (employee's own name shown)

### Nav link

- [ ] **Received** nav item appears in employee/manager sidebar and bottom nav
- [ ] Active state highlights correctly when on `/employee/received-reviews`

---

## Security regression checks

- [ ] `GET /api/reviews/received?cycleId=X` without auth → 401
- [ ] `GET /api/reviews/received?cycleId=X` with a JWT from a different company → 0 results (multi-tenancy)
- [ ] `PUT /api/score-weights` as non-ADMIN → 403
- [ ] `POST /api/goals` as non-ADMIN non-MANAGER (EMPLOYEE) → 403
- [ ] Peer review API response: confirm no `reviewerId` field in payload at network level

---

## Regression: existing flows

- [ ] Employee self-review form loads and submits
- [ ] Manager downward review form loads and submits
- [ ] Peer review form loads and submits
- [ ] Admin score calculation (calculate-all) still works
- [ ] Admin review cycle CRUD (create / edit / status change) still works
- [ ] Sign-in and sign-out still work
- [ ] Sign-up still works (new company flow)
