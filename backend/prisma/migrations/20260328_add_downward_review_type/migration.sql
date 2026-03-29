-- Add DOWNWARD to ReviewType enum
-- Downward: manager evaluating team member (distinct from MANAGER = upward: employee evaluating their manager)
ALTER TYPE "ReviewType" ADD VALUE IF NOT EXISTS 'DOWNWARD';
