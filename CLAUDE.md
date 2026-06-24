# Reviewly — root Intent Node

Multi-tenant SaaS performance review platform for Yala.
Stack: Next.js 14 + Tailwind (frontend) · NestJS + Prisma + PostgreSQL (backend) · Supabase Auth.

## INVARIANTS (enforce at all times)

1. **Multi-tenancy** — every Prisma query MUST include a `companyId` filter. No exceptions.
2. **Anonymity** — for any anonymous review (PEER, or upward MANAGER/DOWNWARD), reviewer-identifying
   data (id, name, email) MUST be stripped server-side before the response leaves the backend.
   The UI never decides what to hide; the backend never exposes it.
3. **Min-reviewer threshold** — anonymous peer / upward feedback is withheld (or aggregated
   without individual text) until the submission count reaches `ScoreWeightConfig.minPeerThreshold`
   (default 3). Enforced in `reviews.service.ts → getMyReceivedReviews`.
4. **Quant source** — employee quant score = mean of `DepartmentQuantScore.score` for their departments (M2M via `UserDepartment`). `EmployeeGoal` / `QuantScore` tables are dormant (kept, not read by scoring).
5. **Weight invariant** — `quantWeight + qualWeight = 100`.
   `managerWeight + peerWeight + selfWeight = 100` (within qualitative).
   Missing sources are re-normalised proportionally; they do NOT leave weight slack.
6. **Visibility gate** — reviewee-facing review content and final scores are locked until
   `ReviewCycle.status === 'COMPLETED'`. Never unlock earlier.
7. **Workflow** — review-cycle steps are configured via the `review_configs` table, not hard-coded.

## Sub-nodes (read for area-specific rules)

- Backend modules + multi-tenancy pattern → `backend/src/CLAUDE.md`
- Scoring formula, weights, quant/qual → `backend/src/scoring/CLAUDE.md`
- Anonymity enforcement, received-reviews → `backend/src/reviews/CLAUDE.md`
- Auth flows, password reset → `backend/src/auth/CLAUDE.md`
- Frontend route tree, component patterns → `frontend/app/CLAUDE.md`

## Tech stack quick-ref

| Layer | Key tech |
|-------|---------|
| Frontend | Next.js 14 App Router, TypeScript, Tailwind CSS |
| Backend | NestJS, Prisma ORM, PostgreSQL |
| Auth | Supabase Auth (JWT); service-role key on backend only |
| Email | Nodemailer via Mailtrap (dev) / Resend (prod) |
| Tests | Jest (backend unit), Playwright (frontend E2E) |

## Dev stack

```
docker compose -f docker-compose.dev.yml --env-file .env.dev up --build
```
Frontend: http://localhost:3000 · Backend: http://localhost:4000 · Adminer: http://localhost:8080
