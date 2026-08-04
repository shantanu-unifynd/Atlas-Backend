-- CreateTable
CREATE TABLE "map_presentation_models" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "floor_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "navigation_graph_id" UUID,
    "data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "map_presentation_models_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "map_presentation_models_floor_id_idx" ON "map_presentation_models"("floor_id");

-- CreateIndex
CREATE UNIQUE INDEX "map_presentation_models_floor_id_version_key" ON "map_presentation_models"("floor_id", "version");

-- AddForeignKey
ALTER TABLE "map_presentation_models" ADD CONSTRAINT "map_presentation_models_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
