-- Rename built-in DOWNWARD review type label: "Team Evaluation" → "Downward"
-- Display-only change. Behaviour, anonymity rules, and scoring are not affected.
UPDATE "review_type_configs"
SET "label" = 'Downward'
WHERE "key" = 'DOWNWARD'
  AND "is_built_in" = true
  AND "label" = 'Team Evaluation';
