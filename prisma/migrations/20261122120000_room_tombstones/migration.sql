-- "Remove room" soft-delete tombstones. Additive: new table only.
CREATE TABLE "room_tombstones" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "floor_id"      UUID NOT NULL,
  "room_id"       TEXT NOT NULL,
  "room_kind"     TEXT NOT NULL,
  "centroid_x"    DOUBLE PRECISION,
  "centroid_y"    DOUBLE PRECISION,
  "area"          DOUBLE PRECISION,
  "room_snapshot" JSONB NOT NULL,
  "reason"        TEXT,
  "deleted_by"    TEXT NOT NULL,
  "deleted_at"    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "restored_by"   TEXT,
  "restored_at"   TIMESTAMP,
  "created_at"    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP NOT NULL,
  CONSTRAINT "room_tombstones_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "room_tombstones"
  ADD CONSTRAINT "room_tombstones_floor_id_fkey"
  FOREIGN KEY ("floor_id") REFERENCES "floors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "room_tombstones_floor_id_idx" ON "room_tombstones"("floor_id");

-- At most one ACTIVE tombstone per (floor, room); restoring frees the room to be
-- removed again later (restored rows keep the history).
CREATE UNIQUE INDEX "room_tombstones_active_unique"
  ON "room_tombstones"("floor_id", "room_id")
  WHERE "restored_at" IS NULL;
