-- CreateTable
CREATE TABLE "map_room_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "floor_id" UUID NOT NULL,
    "name" TEXT,
    "category" TEXT,
    "polygon" JSONB NOT NULL,
    "area" DOUBLE PRECISION,
    "replaces_room_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "map_room_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "map_room_overrides_floor_id_idx" ON "map_room_overrides"("floor_id");

-- AddForeignKey
ALTER TABLE "map_room_overrides" ADD CONSTRAINT "map_room_overrides_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
