-- CreateEnum
CREATE TYPE "blueprint_import_status" AS ENUM ('UPLOADED', 'VALIDATING', 'FAILED');

-- CreateTable
CREATE TABLE "blueprint_imports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "building_id" UUID NOT NULL,
    "floor_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "original_filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "storage_provider" TEXT NOT NULL DEFAULT 'local',
    "storage_key" TEXT NOT NULL,
    "status" "blueprint_import_status" NOT NULL DEFAULT 'UPLOADED',
    "error_message" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blueprint_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blueprint_imports_building_id_idx" ON "blueprint_imports"("building_id");

-- CreateIndex
CREATE INDEX "blueprint_imports_floor_id_idx" ON "blueprint_imports"("floor_id");

-- CreateIndex
CREATE INDEX "blueprint_imports_status_idx" ON "blueprint_imports"("status");

-- CreateIndex
CREATE INDEX "blueprint_imports_checksum_idx" ON "blueprint_imports"("checksum");

-- CreateIndex
CREATE UNIQUE INDEX "blueprint_imports_floor_id_version_key" ON "blueprint_imports"("floor_id", "version");

-- AddForeignKey
ALTER TABLE "blueprint_imports" ADD CONSTRAINT "blueprint_imports_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blueprint_imports" ADD CONSTRAINT "blueprint_imports_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
