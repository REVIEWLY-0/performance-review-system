-- Add HR employee_id column to users table (nullable, unique per company)
ALTER TABLE "users" ADD COLUMN "employee_id" TEXT;

-- Partial unique index: only enforces uniqueness when employee_id IS NOT NULL
CREATE UNIQUE INDEX "users_company_id_employee_id_key"
  ON "users"("company_id", "employee_id")
  WHERE "employee_id" IS NOT NULL;
