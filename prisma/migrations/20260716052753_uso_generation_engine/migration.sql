-- CreateEnum
CREATE TYPE "uso_spatial_category" AS ENUM ('BOUNDARY', 'WALL', 'ENCLOSURE', 'OPENING', 'PASSAGE', 'VERTICAL_CONNECTION');

-- CreateEnum
CREATE TYPE "uso_lifecycle_status" AS ENUM ('ACTIVE');

-- CreateTable
CREATE TABLE "universal_spatial_objects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "geometry_model_id" UUID NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "candidate_type" TEXT NOT NULL,
    "spatial_category" "uso_spatial_category" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "uso_lifecycle_status" NOT NULL DEFAULT 'ACTIVE',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_from" TEXT NOT NULL,
    "geometry_reference" JSONB NOT NULL,
    "accessibility" JSONB NOT NULL,
    "relationships" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "universal_spatial_objects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "universal_spatial_objects_geometry_model_id_idx" ON "universal_spatial_objects"("geometry_model_id");

-- CreateIndex
CREATE INDEX "universal_spatial_objects_spatial_category_idx" ON "universal_spatial_objects"("spatial_category");

-- CreateIndex
CREATE UNIQUE INDEX "universal_spatial_objects_geometry_model_id_candidate_id_key" ON "universal_spatial_objects"("geometry_model_id", "candidate_id");

-- AddForeignKey
ALTER TABLE "universal_spatial_objects" ADD CONSTRAINT "universal_spatial_objects_geometry_model_id_fkey" FOREIGN KEY ("geometry_model_id") REFERENCES "geometry_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
