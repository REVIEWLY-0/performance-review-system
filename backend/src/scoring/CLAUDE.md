# Scoring — Intent Node

See `backend/src/CLAUDE.md` for review-type semantics and multi-tenancy rules.

## Formula

```
qualScore  = Σ(sourceAvg × effectiveWeight) for each present source
finalScore = (quantScore × quantWeight + qualScore × qualWeight) / 100
```

**Configured weights** (stored in `ScoreWeightConfig`, global per company, defaults 50/60/30/10):

| Setting | Default | Constraint |
|---------|---------|-----------|
| `quantWeight` | 50 | quantWeight + qualWeight = 100 |
| `qualWeight` | 50 | (derived: 100 − quantWeight) |
| `managerWeight` | 60 | manager + peer + self = 100 |
| `peerWeight` | 30 | |
| `selfWeight` | 10 | |

## Re-normalisation (mandatory)

When a source is absent (no reviews submitted), redistribute its weight proportionally
among the remaining active sources. **Never leave weight slack.**

Examples (defaults):
- Manager missing → peer effective = 30/(30+10) = 75%, self = 10/(30+10) = 25%
- Peer missing   → manager effective = 60/(60+10) ≈ 85.7%, self ≈ 14.3%
- Both missing   → self effective = 100%
- No quant score → qualWeight becomes 100% for that employee (quantWeight ignored)

## Quantitative score source

Quant score = **mean of the employee's departments' `DepartmentQuantScore.score` values** (multi-dept average via `UserDepartment` M2M). Computed in `DepartmentQuantScoresService.getEmployeeQuantScore` (single) or `buildEmployeeQuantMap` (bulk).

If the employee has no departments, or no `DepartmentQuantScore` rows exist for their departments in this cycle, quant is absent → `qualWeight` becomes 100%.

**Dormant (no longer on the scoring path):**
- `EmployeeGoal` table + Goals admin page (`/admin/review-cycles/[id]/goals`) — kept for historical data, not read by scoring.
- `QuantScore` table — kept dormant; previously a per-employee direct-entry fallback.

## Override precedence

`ScoreOverride.score` replaces `finalScore` entirely (admin use only). Logged in the override record.

## Visibility

`overall_score` is `null` in API responses until `ReviewCycle.status === 'COMPLETED'`.
The `calculateAllScores` admin endpoint shows real scores regardless of cycle status.

## Score notifications

Sent at most once per (employeeId, cycleId) pair. Dedup guard: `score_notifications` unique
constraint. Failures are caught and logged; they never block the score response.

## Key files

- `scoring.service.ts` — `calculateFinalScore`, `calculateAllScores`, `calculateScoreFromData` (pure)
- `scoring.service.spec.ts` — unit tests for pure calculation (no DB needed)
- `score-weights/score-weights.service.ts` — `getOrCreate`, `update`, weight validation
- `department-quant-scores/department-quant-scores.service.ts` — `getEmployeeQuantScore` (single), `buildEmployeeQuantMap` (bulk), `findByCycle` + `upsert` (admin HTTP endpoints)
