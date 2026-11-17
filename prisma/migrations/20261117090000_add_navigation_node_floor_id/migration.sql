-- Multi-floor navigation (M1, Option A): tag each navigation node with the floor
-- it sits on, so a single building-level graph can hold nodes from every floor and
-- a VERTICAL navigation_edges row can link a connector node across two floors.
-- Additive and backwards-compatible: the column is nullable with no default, so
-- existing single-floor graphs and all existing rows are unaffected.

-- AlterTable
ALTER TABLE "navigation_nodes" ADD COLUMN     "floor_id" UUID;

-- CreateIndex
CREATE INDEX "navigation_nodes_floor_id_idx" ON "navigation_nodes"("floor_id");

-- AddForeignKey
ALTER TABLE "navigation_nodes" ADD CONSTRAINT "navigation_nodes_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
