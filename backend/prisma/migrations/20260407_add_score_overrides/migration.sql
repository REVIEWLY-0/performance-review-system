-- Create score_overrides table (idempotent)
CREATE TABLE IF NOT EXISTS "score_overrides" (
  "id"          TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "cycle_id"    TEXT NOT NULL,
  "company_id"  TEXT,
  "score"       DOUBLE PRECISION NOT NULL,
  "note"        TEXT,
  "created_by"  TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "score_overrides_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "score_overrides_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "score_overrides_cycle_id_fkey"    FOREIGN KEY ("cycle_id")    REFERENCES "review_cycles"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "score_overrides_employee_id_cycle_id_key"
  ON "score_overrides"("employee_id", "cycle_id");

-- Add missing columns if the table was already created via ad-hoc SQL
ALTER TABLE "score_overrides" ADD COLUMN IF NOT EXISTS "company_id"  TEXT;
ALTER TABLE "score_overrides" ADD COLUMN IF NOT EXISTS "note"        TEXT;
ALTER TABLE "score_overrides" ADD COLUMN IF NOT EXISTS "created_by"  TEXT;
ALTER TABLE "score_overrides" ADD COLUMN IF NOT EXISTS "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
