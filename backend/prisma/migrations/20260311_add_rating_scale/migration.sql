-- CreateTable: rating_scales
CREATE TABLE "rating_scales" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "max_rating" INTEGER NOT NULL DEFAULT 5,
    "labels" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rating_scales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique company_id
CREATE UNIQUE INDEX "rating_scales_company_id_key" ON "rating_scales"("company_id");

-- AddForeignKey
ALTER TABLE "rating_scales" ADD CONSTRAINT "rating_scales_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
