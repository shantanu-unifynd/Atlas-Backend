-- AlterEnum
ALTER TYPE "blueprint_import_status" ADD VALUE 'NORMALIZED';

-- CreateTable
CREATE TABLE "normalized_blueprints" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blueprint_import_id" UUID NOT NULL,
    "source_format" TEXT NOT NULL,
    "coordinate_system" JSONB NOT NULL,
    "bounds" JSONB NOT NULL,
    "layers" JSONB NOT NULL,
    "elements" JSONB NOT NULL,
    "relationships" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "normalized_blueprints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "normalized_blueprints_blueprint_import_id_key" ON "normalized_blueprints"("blueprint_import_id");

-- AddForeignKey
ALTER TABLE "normalized_blueprints" ADD CONSTRAINT "normalized_blueprints_blueprint_import_id_fkey" FOREIGN KEY ("blueprint_import_id") REFERENCES "blueprint_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
