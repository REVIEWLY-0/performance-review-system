# Backend — NestJS Intent Node

See root `CLAUDE.md` for system-wide invariants. This node covers backend-specific patterns.

## Multi-tenancy pattern (non-negotiable)

Every query must carry a `companyId` guard. Use the injected value from `TenantContextMiddleware`,
never trust the request body for the company scope.

```typescript
// CORRECT
prisma.user.findMany({ where: { companyId } })

// WRONG — never omit the company filter
prisma.user.findMany({ where: { email } })
```

`AuthGuard` + `TenantContextMiddleware` inject `companyId` into every authenticated request.
The `@CompanyId()` decorator extracts it in controllers.

## Module map

| Module | Purpose |
|--------|---------|
| `auth/` | Supabase Auth integration, signup/signin, two password-reset flows |
| `users/` | User CRUD, department assignment, avatar |
| `review-cycles/` | Cycle lifecycle (DRAFT→ACTIVE→COMPLETED), step config |
| `reviews/` | Review submission (self/manager/peer/downward) + received-reviews for reviewee |
| `scoring/` | Weighted final-score calculation (quant + qualitative with re-normalisation) |
| `score-weights/` | ScoreWeightConfig CRUD — admin-configurable weights + peer threshold |
| `goals/` | EmployeeGoal CRUD — **dormant on scoring path**; data kept for history |
| `department-quant-scores/` | DepartmentQuantScore CRUD — one score per department per cycle; employee quant = mean of their departments' scores (M2M) |
| `reviewer-assignments/` | Maps reviewers→employees per cycle |
| `questions/` | RATING/TEXT/TASK_LIST questions per review type |
| `notifications/` | Email (welcome, score-available, password-reset) via Nodemailer |
| `analytics/` | Completion stats, score distribution |
| `departments/` | Hierarchical departments |
| `rating-scale/` | Max rating (default 5) + custom labels |
| `org-chart/` | Visual org hierarchy nodes |
| `review-type-configs/` | Built-in + custom review type keys per company |
| `common/` | AuthGuard, RolesGuard, CurrentUser decorator, PrismaService, middleware |

## Review type semantics

| reviewType | reviewerId | employeeId | Direction | Attributed to reviewee? |
|------------|------------|------------|-----------|------------------------|
| SELF | employee | employee | — | yes |
| MANAGER | manager | report | downward | yes |
| DOWNWARD | manager | report | downward | yes |
| PEER | peer | subject | lateral | **no** (anonymous) |
| MANAGER (upward) | subordinate | manager | upward | **no** (anonymous) |

Upward detection: if `reviewer.managerId === employeeId`, the reviewer is a subordinate → treat as anonymous (same threshold as PEER).

## Anti-patterns

- Do NOT filter by email alone — always include `companyId`.
- Do NOT expose `reviewerId` / `reviewer.name` for PEER or upward reviews in any response that reaches the reviewee.
- Do NOT compute scores from non-SUBMITTED reviews (status filter is mandatory).
- Do NOT send score notifications for cycles that are not `COMPLETED`.
