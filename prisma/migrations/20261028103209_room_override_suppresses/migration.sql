-- AlterTable
ALTER TABLE "map_room_overrides" ADD COLUMN     "suppresses_room_ids" JSONB NOT NULL DEFAULT '[]';
