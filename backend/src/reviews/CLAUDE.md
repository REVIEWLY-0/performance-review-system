# Reviews — Intent Node

See `backend/src/CLAUDE.md` for review-type semantics and multi-tenancy rules.

## ANONYMITY INVARIANT (must never be violated)

Reviewer-identifying fields (`reviewerId`, `reviewer.id`, `reviewer.name`, `reviewer.email`)
**must not appear** in any response sent to the reviewee for anonymous review types.
Enforcement point: `reviews.service.ts → getMyReceivedReviews` serialisation.
The field is absent from the response object — not null, not redacted, absent.

Anonymous review types:
- `PEER` reviews — always anonymous to the reviewee
- Upward `MANAGER` reviews — when `reviewer.managerId === employeeId` (reviewer is a subordinate)

Attributed review types (reviewer name is included):
- `SELF` — reviewee wrote it themselves
- `MANAGER` / `DOWNWARD` where reviewer is the subject's own manager — attributed

## Min-reviewer threshold

Source of truth: `ScoreWeightConfig.minPeerThreshold` (default 3).

For each anonymous set (peer, upward), check the submitted-review count:
- `count < threshold` → respond with `{ withheld: true, count, threshold, aggregated: { avgRating } }`
  — aggregate averages are safe below threshold; individual entries and text are not.
- `count >= threshold` → return anonymised individual entries (no reviewer fields).

## Visibility gate

`getMyReceivedReviews` returns `{ locked: true }` when `cycle.status !== 'COMPLETED'`.
Reviews are never exposed to the reviewee during DRAFT or ACTIVE cycles.

Managers and ADMIN role users get the attributed view from `getAdminEmployeeReviews`
regardless of cycle status.

## Review lifecycle

`NOT_STARTED → DRAFT → SUBMITTED` (one-way, SUBMITTED is immutable).
Only `SUBMITTED` reviews count for scoring and for received-reviews display.

## Key service methods

| Method | Who calls it | Returns |
|--------|-------------|---------|
| `findOrCreateSelfReview` | employee | their own self-review form |
| `findOrCreateManagerReview` | manager | review form for a direct report |
| `findOrCreateDownwardReview` | manager (DOWNWARD flow) | review form |
| `findOrCreatePeerReview` | peer | review form for assigned peer |
| `getMyReceivedReviews` | employee / manager | reviews written *about* them, anonymised |
| `getAdminEmployeeReviews` | admin | all reviews about an employee, attributed |
| `setScoreOverride` | admin | upsert manual score |
