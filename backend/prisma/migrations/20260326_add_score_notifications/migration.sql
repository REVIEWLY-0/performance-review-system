CREATE TABLE IF NOT EXISTS "score_notifications" (
  "id"          TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "cycle_id"    TEXT NOT NULL,
  "sent_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "score_notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "score_notifications_employee_id_cycle_id_key"
  ON "score_notifications"("employee_id", "cycle_id");
