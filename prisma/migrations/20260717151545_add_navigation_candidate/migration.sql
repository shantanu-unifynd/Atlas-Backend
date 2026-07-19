-- CreateEnum
CREATE TYPE "navigation_candidate_type" AS ENUM ('ROOM_ENTRY', 'CORRIDOR_INTERSECTION', 'DEAD_END', 'VERTICAL_CONNECTOR', 'BUILDING_ENTRY');

-- AlterTable
ALTER TABLE "legacy_navigation_graphs" RENAME CONSTRAINT "navigation_graphs_pkey" TO "legacy_navigation_graphs_pkey";

-- AlterTable
ALTER TABLE "navigation_edges" RENAME CONSTRAINT "semantic_navigation_edges_pkey" TO "navigation_edges_pkey";

-- AlterTable
ALTER TABLE "navigation_graphs" RENAME CONSTRAINT "semantic_navigation_graphs_pkey" TO "navigation_graphs_pkey";

-- AlterTable
ALTER TABLE "navigation_nodes" RENAME CONSTRAINT "semantic_navigation_nodes_pkey" TO "navigation_nodes_pkey";

-- CreateTable
CREATE TABLE "navigation_candidates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "graph_id" UUID NOT NULL,
    "semantic_object_id" UUID NOT NULL,
    "candidate_type" "navigation_candidate_type" NOT NULL,
    "position" JSONB NOT NULL DEFAULT '{}',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "navigation_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "navigation_candidates_graph_id_idx" ON "navigation_candidates"("graph_id");

-- CreateIndex
CREATE INDEX "navigation_candidates_candidate_type_idx" ON "navigation_candidates"("candidate_type");

-- CreateIndex
CREATE UNIQUE INDEX "navigation_candidates_graph_id_semantic_object_id_key" ON "navigation_candidates"("graph_id", "semantic_object_id");

-- RenameForeignKey
ALTER TABLE "legacy_navigation_graphs" RENAME CONSTRAINT "navigation_graphs_blueprint_id_fkey" TO "legacy_navigation_graphs_blueprint_id_fkey";

-- RenameForeignKey
ALTER TABLE "navigation_edges" RENAME CONSTRAINT "semantic_navigation_edges_graph_id_fkey" TO "navigation_edges_graph_id_fkey";

-- RenameForeignKey
ALTER TABLE "navigation_edges" RENAME CONSTRAINT "semantic_navigation_edges_source_node_id_fkey" TO "navigation_edges_source_node_id_fkey";

-- RenameForeignKey
ALTER TABLE "navigation_edges" RENAME CONSTRAINT "semantic_navigation_edges_target_node_id_fkey" TO "navigation_edges_target_node_id_fkey";

-- RenameForeignKey
ALTER TABLE "navigation_graphs" RENAME CONSTRAINT "semantic_navigation_graphs_building_id_fkey" TO "navigation_graphs_building_id_fkey";

-- RenameForeignKey
ALTER TABLE "navigation_graphs" RENAME CONSTRAINT "semantic_navigation_graphs_floor_id_fkey" TO "navigation_graphs_floor_id_fkey";

-- RenameForeignKey
ALTER TABLE "navigation_nodes" RENAME CONSTRAINT "semantic_navigation_nodes_graph_id_fkey" TO "navigation_nodes_graph_id_fkey";

-- RenameForeignKey
ALTER TABLE "navigation_nodes" RENAME CONSTRAINT "semantic_navigation_nodes_semantic_object_id_fkey" TO "navigation_nodes_semantic_object_id_fkey";

-- AddForeignKey
ALTER TABLE "navigation_candidates" ADD CONSTRAINT "navigation_candidates_graph_id_fkey" FOREIGN KEY ("graph_id") REFERENCES "navigation_graphs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_candidates" ADD CONSTRAINT "navigation_candidates_semantic_object_id_fkey" FOREIGN KEY ("semantic_object_id") REFERENCES "semantic_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "navigation_graphs_blueprint_id_key" RENAME TO "legacy_navigation_graphs_blueprint_id_key";

-- RenameIndex
ALTER INDEX "navigation_graphs_status_idx" RENAME TO "legacy_navigation_graphs_status_idx";

-- RenameIndex
ALTER INDEX "semantic_navigation_edges_graph_id_idx" RENAME TO "navigation_edges_graph_id_idx";

-- RenameIndex
ALTER INDEX "semantic_navigation_edges_source_node_id_idx" RENAME TO "navigation_edges_source_node_id_idx";

-- RenameIndex
ALTER INDEX "semantic_navigation_edges_target_node_id_idx" RENAME TO "navigation_edges_target_node_id_idx";

-- RenameIndex
ALTER INDEX "semantic_navigation_graphs_building_id_idx" RENAME TO "navigation_graphs_building_id_idx";

-- RenameIndex
ALTER INDEX "semantic_navigation_graphs_floor_id_idx" RENAME TO "navigation_graphs_floor_id_idx";

-- RenameIndex
ALTER INDEX "semantic_navigation_graphs_status_idx" RENAME TO "navigation_graphs_status_idx";

-- RenameIndex
ALTER INDEX "semantic_navigation_nodes_graph_id_idx" RENAME TO "navigation_nodes_graph_id_idx";

-- RenameIndex
ALTER INDEX "semantic_navigation_nodes_node_type_idx" RENAME TO "navigation_nodes_node_type_idx";

-- RenameIndex
ALTER INDEX "semantic_navigation_nodes_semantic_object_id_key" RENAME TO "navigation_nodes_semantic_object_id_key";
