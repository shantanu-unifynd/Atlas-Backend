-- CreateEnum
CREATE TYPE "navigation_graph_lifecycle_status" AS ENUM ('CREATED', 'GENERATING', 'VALIDATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "graph_validation_status" AS ENUM ('VALID', 'VALID_WITH_WARNINGS', 'INVALID');

-- CreateTable
CREATE TABLE "semantic_navigation_graphs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "building_id" UUID NOT NULL,
    "floor_id" UUID,
    "status" "navigation_graph_lifecycle_status" NOT NULL DEFAULT 'CREATED',
    "pipeline_version" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "statistics" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semantic_navigation_graphs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semantic_navigation_nodes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "graph_id" UUID NOT NULL,
    "semantic_object_id" UUID NOT NULL,
    "node_type" TEXT NOT NULL,
    "position" JSONB NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semantic_navigation_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semantic_navigation_edges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "graph_id" UUID NOT NULL,
    "source_node_id" UUID NOT NULL,
    "target_node_id" UUID NOT NULL,
    "edge_type" TEXT NOT NULL,
    "length" DOUBLE PRECISION,
    "traversal_cost" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "accessibility" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semantic_navigation_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_validation_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "graph_id" UUID NOT NULL,
    "validation_status" "graph_validation_status",
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "errors" JSONB NOT NULL DEFAULT '[]',
    "statistics" JSONB NOT NULL DEFAULT '{}',
    "validated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "graph_validation_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "semantic_navigation_graphs_building_id_idx" ON "semantic_navigation_graphs"("building_id");

-- CreateIndex
CREATE INDEX "semantic_navigation_graphs_floor_id_idx" ON "semantic_navigation_graphs"("floor_id");

-- CreateIndex
CREATE INDEX "semantic_navigation_graphs_status_idx" ON "semantic_navigation_graphs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "semantic_navigation_nodes_semantic_object_id_key" ON "semantic_navigation_nodes"("semantic_object_id");

-- CreateIndex
CREATE INDEX "semantic_navigation_nodes_graph_id_idx" ON "semantic_navigation_nodes"("graph_id");

-- CreateIndex
CREATE INDEX "semantic_navigation_nodes_node_type_idx" ON "semantic_navigation_nodes"("node_type");

-- CreateIndex
CREATE INDEX "semantic_navigation_edges_graph_id_idx" ON "semantic_navigation_edges"("graph_id");

-- CreateIndex
CREATE INDEX "semantic_navigation_edges_source_node_id_idx" ON "semantic_navigation_edges"("source_node_id");

-- CreateIndex
CREATE INDEX "semantic_navigation_edges_target_node_id_idx" ON "semantic_navigation_edges"("target_node_id");

-- CreateIndex
CREATE INDEX "graph_validation_reports_graph_id_idx" ON "graph_validation_reports"("graph_id");

-- AddForeignKey
ALTER TABLE "semantic_navigation_graphs" ADD CONSTRAINT "semantic_navigation_graphs_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semantic_navigation_graphs" ADD CONSTRAINT "semantic_navigation_graphs_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semantic_navigation_nodes" ADD CONSTRAINT "semantic_navigation_nodes_graph_id_fkey" FOREIGN KEY ("graph_id") REFERENCES "semantic_navigation_graphs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semantic_navigation_nodes" ADD CONSTRAINT "semantic_navigation_nodes_semantic_object_id_fkey" FOREIGN KEY ("semantic_object_id") REFERENCES "semantic_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semantic_navigation_edges" ADD CONSTRAINT "semantic_navigation_edges_graph_id_fkey" FOREIGN KEY ("graph_id") REFERENCES "semantic_navigation_graphs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semantic_navigation_edges" ADD CONSTRAINT "semantic_navigation_edges_source_node_id_fkey" FOREIGN KEY ("source_node_id") REFERENCES "semantic_navigation_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semantic_navigation_edges" ADD CONSTRAINT "semantic_navigation_edges_target_node_id_fkey" FOREIGN KEY ("target_node_id") REFERENCES "semantic_navigation_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_validation_reports" ADD CONSTRAINT "graph_validation_reports_graph_id_fkey" FOREIGN KEY ("graph_id") REFERENCES "semantic_navigation_graphs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
