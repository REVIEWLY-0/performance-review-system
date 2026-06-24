-- Add isCeo flag to users table.
-- At most one user per company may have isCeo = true (enforced at the application layer).
ALTER TABLE "users" ADD COLUMN "is_ceo" BOOLEAN NOT NULL DEFAULT false;
