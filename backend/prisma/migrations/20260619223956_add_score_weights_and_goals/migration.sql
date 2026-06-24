-- DropForeignKey
ALTER TABLE "score_overrides" DROP CONSTRAINT "score_overrides_cycle_id_fkey";

-- DropForeignKey
ALTER TABLE "score_overrides" DROP CONSTRAINT "score_overrides_employee_id_fkey";

-- AlterTable
ALTER TABLE "score_overrides" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "score_weight_configs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "quant_weight" INTEGER NOT NULL DEFAULT 50,
    "manager_weight" INTEGER NOT NULL DEFAULT 60,
    "peer_weight" INTEGER NOT NULL DEFAULT 30,
    "self_weight" INTEGER NOT NULL DEFAULT 10,
    "min_peer_threshold" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "score_weight_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_goals" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "rating" INTEGER,
    "set_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quant_scores" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "set_by" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quant_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "score_weight_configs_company_id_key" ON "score_weight_configs"("company_id");

-- CreateIndex
CREATE INDEX "employee_goals_company_id_idx" ON "employee_goals"("company_id");

-- CreateIndex
CREATE INDEX "employee_goals_cycle_id_employee_id_idx" ON "employee_goals"("cycle_id", "employee_id");

-- CreateIndex
CREATE INDEX "quant_scores_company_id_idx" ON "quant_scores"("company_id");

-- CreateIndex
CREATE INDEX "quant_scores_cycle_id_idx" ON "quant_scores"("cycle_id");

-- CreateIndex
CREATE UNIQUE INDEX "quant_scores_cycle_id_employee_id_key" ON "quant_scores"("cycle_id", "employee_id");

-- AddForeignKey
ALTER TABLE "score_weight_configs" ADD CONSTRAINT "score_weight_configs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_goals" ADD CONSTRAINT "employee_goals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_goals" ADD CONSTRAINT "employee_goals_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "review_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_goals" ADD CONSTRAINT "employee_goals_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_goals" ADD CONSTRAINT "employee_goals_set_by_fkey" FOREIGN KEY ("set_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quant_scores" ADD CONSTRAINT "quant_scores_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quant_scores" ADD CONSTRAINT "quant_scores_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "review_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quant_scores" ADD CONSTRAINT "quant_scores_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quant_scores" ADD CONSTRAINT "quant_scores_set_by_fkey" FOREIGN KEY ("set_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_overrides" ADD CONSTRAINT "score_overrides_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_overrides" ADD CONSTRAINT "score_overrides_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "review_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
