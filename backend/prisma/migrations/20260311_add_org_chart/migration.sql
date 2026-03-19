CREATE TABLE "org_chart_nodes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "parent_id" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "org_chart_nodes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "org_chart_nodes_company_id_idx" ON "org_chart_nodes"("company_id");

ALTER TABLE "org_chart_nodes" ADD CONSTRAINT "org_chart_nodes_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "org_chart_nodes" ADD CONSTRAINT "org_chart_nodes_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "org_chart_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
