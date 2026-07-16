-- CreateEnum
CREATE TYPE "semantic_lifecycle_status" AS ENUM ('UNCLASSIFIED', 'CLASSIFIED', 'VERIFIED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "semantic_models" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "uso_id" UUID NOT NULL,
    "geometry_model_id" UUID NOT NULL,
    "semantic_version" INTEGER NOT NULL DEFAULT 1,
    "lifecycle" "semantic_lifecycle_status" NOT NULL DEFAULT 'UNCLASSIFIED',
    "category" TEXT,
    "classification_source" TEXT,
    "confidence" JSONB NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semantic_models_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "semantic_models_uso_id_key" ON "semantic_models"("uso_id");

-- CreateIndex
CREATE INDEX "semantic_models_geometry_model_id_idx" ON "semantic_models"("geometry_model_id");

-- CreateIndex
CREATE INDEX "semantic_models_lifecycle_idx" ON "semantic_models"("lifecycle");

-- AddForeignKey
ALTER TABLE "semantic_models" ADD CONSTRAINT "semantic_models_uso_id_fkey" FOREIGN KEY ("uso_id") REFERENCES "universal_spatial_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
