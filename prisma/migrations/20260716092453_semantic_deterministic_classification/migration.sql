/*
  Warnings:

  - You are about to drop the column `category` on the `semantic_models` table. All the data in the column will be lost.
  - You are about to drop the column `confidence` on the `semantic_models` table. All the data in the column will be lost.
  - Added the required column `confidence_reason` to the `semantic_models` table without a default value. This is not possible if the table is not empty.
  - Added the required column `confidence_source` to the `semantic_models` table without a default value. This is not possible if the table is not empty.
  - Added the required column `confidence_value` to the `semantic_models` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "semantic_models" DROP COLUMN "category",
DROP COLUMN "confidence",
ADD COLUMN     "classified_at" TIMESTAMP(3),
ADD COLUMN     "confidence_reason" TEXT NOT NULL,
ADD COLUMN     "confidence_source" TEXT NOT NULL,
ADD COLUMN     "confidence_value" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "rule_id" TEXT,
ADD COLUMN     "rule_version" INTEGER,
ADD COLUMN     "semantic_category" TEXT,
ADD COLUMN     "semantic_sub_category" TEXT;

-- CreateIndex
CREATE INDEX "semantic_models_semantic_category_idx" ON "semantic_models"("semantic_category");
