-- Part 3D — two-floor shops. Link rooms across floors into one unit.
ALTER TABLE "map_room_overrides" ADD COLUMN "unit_id" TEXT;
ALTER TABLE "map_room_overrides" ADD COLUMN "linked_room_ids" JSONB NOT NULL DEFAULT '[]';
