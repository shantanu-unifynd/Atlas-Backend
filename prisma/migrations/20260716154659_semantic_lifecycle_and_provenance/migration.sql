-- Recreate semantic_lifecycle_status: Postgres cannot remove enum values in
-- place. The semantic_models table has no rows using the old
-- UNCLASSIFIED/CLASSIFIED/VERIFIED values at the time of this migration, so
-- this is a safe, direct rename/recreate rather than a data-preserving one.
ALTER TYPE "semantic_lifecycle_status" RENAME TO "semantic_lifecycle_status_old";

CREATE TYPE "semantic_lifecycle_status" AS ENUM ('GENERATED', 'VALIDATED', 'PUBLISHED', 'DEPRECATED');

ALTER TABLE "semantic_models"
  ALTER COLUMN "lifecycle" DROP DEFAULT,
  ALTER COLUMN "lifecycle" TYPE "semantic_lifecycle_status" USING ("lifecycle"::text::"semantic_lifecycle_status"),
  ALTER COLUMN "lifecycle" SET DEFAULT 'GENERATED';

DROP TYPE "semantic_lifecycle_status_old";

-- AlterTable: version/provenance additions
ALTER TABLE "semantic_models"
  ADD COLUMN "classification_version" TEXT NOT NULL,
  ADD COLUMN "pipeline_version" TEXT NOT NULL,
  ADD COLUMN "engine_version" TEXT NOT NULL;
