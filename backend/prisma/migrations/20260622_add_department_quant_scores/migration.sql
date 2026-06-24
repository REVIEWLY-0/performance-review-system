-- CreateTable: department_quant_scores
-- Stores one quantitative score per department per review cycle.
-- Each employee's quant score is derived at calculation time as the mean of
-- their departments' scores (multi-dept average via UserDepartment M2M).
CREATE TABLE "department_quant_scores" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "set_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_quant_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: one score per department per cycle
CREATE UNIQUE INDEX "department_quant_scores_cycle_id_department_id_key"
    ON "department_quant_scores"("cycle_id", "department_id");

-- CreateIndex
CREATE INDEX "department_quant_scores_company_id_idx" ON "department_quant_scores"("company_id");

-- CreateIndex
CREATE INDEX "department_quant_scores_cycle_id_idx" ON "department_quant_scores"("cycle_id");

-- AddForeignKey
ALTER TABLE "department_quant_scores"
    ADD CONSTRAINT "department_quant_scores_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_quant_scores"
    ADD CONSTRAINT "department_quant_scores_cycle_id_fkey"
    FOREIGN KEY ("cycle_id") REFERENCES "review_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_quant_scores"
    ADD CONSTRAINT "department_quant_scores_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_quant_scores"
    ADD CONSTRAINT "department_quant_scores_set_by_fkey"
    FOREIGN KEY ("set_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
