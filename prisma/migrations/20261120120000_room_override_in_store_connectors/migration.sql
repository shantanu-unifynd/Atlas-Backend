-- AlterTable
ALTER TABLE "map_room_overrides" ADD COLUMN     "in_store_connectors" JSONB NOT NULL DEFAULT '[]';
