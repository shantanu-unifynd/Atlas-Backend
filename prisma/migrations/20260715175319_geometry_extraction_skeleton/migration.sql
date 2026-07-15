-- CreateTable
CREATE TABLE "geometry_models" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "normalized_blueprint_id" UUID NOT NULL,
    "primitives" JSONB NOT NULL,
    "cleaned_geometry" JSONB NOT NULL,
    "topology" JSONB NOT NULL,
    "candidate_objects" JSONB NOT NULL,
    "relationships" JSONB NOT NULL DEFAULT '[]',
    "diagnostics" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geometry_models_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "geometry_models_normalized_blueprint_id_key" ON "geometry_models"("normalized_blueprint_id");

-- AddForeignKey
ALTER TABLE "geometry_models" ADD CONSTRAINT "geometry_models_normalized_blueprint_id_fkey" FOREIGN KEY ("normalized_blueprint_id") REFERENCES "normalized_blueprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
