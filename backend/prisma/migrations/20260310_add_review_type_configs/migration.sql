-- CreateTable: review_type_configs
CREATE TABLE "review_type_configs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "base_type" "ReviewType" NOT NULL,
    "is_built_in" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_type_configs_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one key per company
CREATE UNIQUE INDEX "review_type_configs_company_id_key_key" ON "review_type_configs"("company_id", "key");

-- Index for tenant lookups
CREATE INDEX "review_type_configs_company_id_idx" ON "review_type_configs"("company_id");

-- Foreign key to companies
ALTER TABLE "review_type_configs" ADD CONSTRAINT "review_type_configs_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddColumn: custom_type_key on review_configs
ALTER TABLE "review_configs" ADD COLUMN "custom_type_key" TEXT;
