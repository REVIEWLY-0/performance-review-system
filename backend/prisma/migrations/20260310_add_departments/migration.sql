-- CreateTable: departments
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: user_departments
CREATE TABLE "user_departments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_departments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_company_id_name_key" ON "departments"("company_id", "name");
CREATE INDEX "departments_company_id_idx" ON "departments"("company_id");
CREATE UNIQUE INDEX "user_departments_user_id_department_id_key" ON "user_departments"("user_id", "department_id");
CREATE INDEX "user_departments_user_id_idx" ON "user_departments"("user_id");
CREATE INDEX "user_departments_department_id_idx" ON "user_departments"("department_id");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_departments" ADD CONSTRAINT "user_departments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_departments" ADD CONSTRAINT "user_departments_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing User.department strings into Department rows (one row per unique company+name)
INSERT INTO "departments" ("id", "company_id", "name", "created_at", "updated_at")
SELECT
    gen_random_uuid()::text,
    u."company_id",
    u."department",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "users" u
WHERE u."department" IS NOT NULL AND u."department" != ''
GROUP BY u."company_id", u."department"
ON CONFLICT DO NOTHING;

-- Migrate existing users into UserDepartment join table
INSERT INTO "user_departments" ("id", "user_id", "department_id", "created_at")
SELECT
    gen_random_uuid()::text,
    u."id",
    d."id",
    CURRENT_TIMESTAMP
FROM "users" u
JOIN "departments" d ON d."company_id" = u."company_id" AND d."name" = u."department"
WHERE u."department" IS NOT NULL AND u."department" != ''
ON CONFLICT DO NOTHING;
