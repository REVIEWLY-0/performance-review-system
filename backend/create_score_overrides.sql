CREATE TABLE IF NOT EXISTS score_overrides (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cycle_id TEXT NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  score DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT score_overrides_employee_id_cycle_id_key UNIQUE(employee_id, cycle_id)
);