-- AddColumn: is_required on review_type_configs
ALTER TABLE "review_type_configs" ADD COLUMN "is_required" BOOLEAN NOT NULL DEFAULT false;

-- Set MANAGER built-in type to required by default for all companies
UPDATE "review_type_configs" SET "is_required" = true WHERE "key" = 'MANAGER' AND "is_built_in" = true;
