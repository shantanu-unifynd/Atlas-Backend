-- Recreate uso_lifecycle_status: Postgres cannot remove enum values in
-- place. The universal_spatial_objects table has no rows using the old
-- 'ACTIVE' value at the time of this migration, so this is a safe, direct
-- rename/recreate rather than a data-preserving migration.
ALTER TYPE "uso_lifecycle_status" RENAME TO "uso_lifecycle_status_old";

CREATE TYPE "uso_lifecycle_status" AS ENUM ('GENERATED', 'VALIDATED', 'PUBLISHED', 'DEPRECATED');

ALTER TABLE "universal_spatial_objects"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "uso_lifecycle_status" USING ("status"::text::"uso_lifecycle_status"),
  ALTER COLUMN "status" SET DEFAULT 'GENERATED';

DROP TYPE "uso_lifecycle_status_old";

-- AlterTable
ALTER TABLE "universal_spatial_objects" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
