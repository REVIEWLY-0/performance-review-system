-- Performance: add missing composite indexes on hot query paths

-- (companyId, role) on users — speeds up getManagers, getStats, role-based filters
CREATE INDEX IF NOT EXISTS "users_company_id_role_idx"
  ON "users"("company_id", "role");

-- (reviewCycleId, reviewType) on reviews — speeds up analytics counts per type
CREATE INDEX IF NOT EXISTS "reviews_review_cycle_id_review_type_idx"
  ON "reviews"("review_cycle_id", "review_type");

-- (reviewCycleId, reviewType, status) on reviews — speeds up pending/submitted counts per type
CREATE INDEX IF NOT EXISTS "reviews_review_cycle_id_review_type_status_idx"
  ON "reviews"("review_cycle_id", "review_type", "status");

-- (reviewCycleId, reviewerId, reviewerType) on reviewer_assignments — speeds up manager queries
CREATE INDEX IF NOT EXISTS "reviewer_assignments_cycle_reviewer_type_idx"
  ON "reviewer_assignments"("review_cycle_id", "reviewer_id", "reviewer_type");
