-- Make Review.reviewerId nullable and change FK to SET NULL
-- Allows deleting a reviewer while preserving the review and its answers.
ALTER TABLE "reviews" ALTER COLUMN "reviewer_id" DROP NOT NULL;
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_reviewer_id_fkey";
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey"
  FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Make QuantScore.setBy nullable and change FK to SET NULL
ALTER TABLE "quant_scores" ALTER COLUMN "set_by" DROP NOT NULL;
ALTER TABLE "quant_scores" DROP CONSTRAINT "quant_scores_set_by_fkey";
ALTER TABLE "quant_scores" ADD CONSTRAINT "quant_scores_set_by_fkey"
  FOREIGN KEY ("set_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Make DepartmentQuantScore.setBy nullable and change FK to SET NULL
ALTER TABLE "department_quant_scores" ALTER COLUMN "set_by" DROP NOT NULL;
ALTER TABLE "department_quant_scores" DROP CONSTRAINT "department_quant_scores_set_by_fkey";
ALTER TABLE "department_quant_scores" ADD CONSTRAINT "department_quant_scores_set_by_fkey"
  FOREIGN KEY ("set_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
