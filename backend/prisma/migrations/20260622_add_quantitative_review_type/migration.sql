-- Add QUANTITATIVE to ReviewType enum
-- Used as the review-type tag for department-level quantitative scoring steps.
-- Stored on DepartmentQuantScore rows; NOT used in the Review table survey flow.
ALTER TYPE "ReviewType" ADD VALUE IF NOT EXISTS 'QUANTITATIVE';
