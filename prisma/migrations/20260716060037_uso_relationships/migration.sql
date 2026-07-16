-- CreateEnum
CREATE TYPE "uso_relationship_type" AS ENUM ('ADJACENT_TO', 'CONTAINS', 'WITHIN', 'BOUNDED_BY', 'CONNECTS', 'TOUCHES', 'INTERSECTS');

-- CreateTable
CREATE TABLE "uso_relationships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "geometry_model_id" UUID NOT NULL,
    "source_uso_id" UUID NOT NULL,
    "target_uso_id" UUID NOT NULL,
    "relationship_type" "uso_relationship_type" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uso_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "uso_relationships_geometry_model_id_idx" ON "uso_relationships"("geometry_model_id");

-- CreateIndex
CREATE INDEX "uso_relationships_source_uso_id_idx" ON "uso_relationships"("source_uso_id");

-- CreateIndex
CREATE INDEX "uso_relationships_target_uso_id_idx" ON "uso_relationships"("target_uso_id");

-- CreateIndex
CREATE INDEX "uso_relationships_relationship_type_idx" ON "uso_relationships"("relationship_type");

-- CreateIndex
CREATE UNIQUE INDEX "uso_relationships_source_uso_id_target_uso_id_relationship__key" ON "uso_relationships"("source_uso_id", "target_uso_id", "relationship_type");

-- AddForeignKey
ALTER TABLE "uso_relationships" ADD CONSTRAINT "uso_relationships_geometry_model_id_fkey" FOREIGN KEY ("geometry_model_id") REFERENCES "geometry_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uso_relationships" ADD CONSTRAINT "uso_relationships_source_uso_id_fkey" FOREIGN KEY ("source_uso_id") REFERENCES "universal_spatial_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uso_relationships" ADD CONSTRAINT "uso_relationships_target_uso_id_fkey" FOREIGN KEY ("target_uso_id") REFERENCES "universal_spatial_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
