-- Add optional name/label column to review_configs (workflow steps)
ALTER TABLE "review_configs" ADD COLUMN "name" TEXT;
