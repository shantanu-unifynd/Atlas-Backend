-- EnableExtension
-- Required for the geometry columns below. Already enabled by
-- docker/postgres/init.sql on this project's dev container, but declared
-- here too so this migration is self-sufficient against any fresh target
-- database (CI, staging, a teammate's clone without the docker bootstrap).
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateEnum
CREATE TYPE "spatial_object_category" AS ENUM ('ARCHITECTURE', 'NAVIGATION', 'ACCESSIBILITY', 'EMERGENCY', 'ANNOTATION', 'EVENTS', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "spatial_object_type" AS ENUM ('WALL', 'DOOR', 'WINDOW', 'ROOM', 'STORE', 'STAIR', 'ELEVATOR', 'ESCALATOR', 'WASHROOM', 'FIRE_EXIT', 'ATM', 'PARKING_SPACE', 'BEACON', 'AR_ANCHOR', 'POI', 'QUEUE_ZONE', 'KIOSK', 'COLUMN', 'RAMP');

-- CreateEnum
CREATE TYPE "geometry_type" AS ENUM ('POINT', 'LINE', 'POLYGON');

-- CreateEnum
CREATE TYPE "graph_status" AS ENUM ('DRAFT', 'BUILDING', 'READY', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "spatial_objects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blueprint_id" UUID NOT NULL,
    "category" "spatial_object_category" NOT NULL,
    "type" "spatial_object_type" NOT NULL,
    "subtype" TEXT,
    "name" TEXT,
    "code" TEXT,
    "geometry" geometry(Geometry, 0) NOT NULL,
    "geometry_type" "geometry_type" NOT NULL,
    "level" INTEGER NOT NULL,
    "z_index" INTEGER NOT NULL DEFAULT 0,
    "accessibility" BOOLEAN NOT NULL DEFAULT true,
    "navigable" BOOLEAN NOT NULL DEFAULT false,
    "searchable" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "spatial_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "navigation_graphs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blueprint_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "graph_status" NOT NULL DEFAULT 'DRAFT',
    "generated_at" TIMESTAMP(3),
    "generated_by" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "navigation_graphs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_nodes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "graph_id" UUID NOT NULL,
    "spatial_object_id" UUID,
    "geometry" geometry(Point, 0) NOT NULL,
    "node_type" TEXT NOT NULL,
    "floor_level" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "graph_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_edges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "graph_id" UUID NOT NULL,
    "from_node_id" UUID NOT NULL,
    "to_node_id" UUID NOT NULL,
    "geometry" geometry(LineString, 0) NOT NULL,
    "length" DOUBLE PRECISION,
    "estimated_time" DOUBLE PRECISION,
    "edge_type" TEXT NOT NULL,
    "accessible" BOOLEAN NOT NULL DEFAULT true,
    "one_way" BOOLEAN NOT NULL DEFAULT false,
    "stairs" BOOLEAN NOT NULL DEFAULT false,
    "elevator" BOOLEAN NOT NULL DEFAULT false,
    "weight" DOUBLE PRECISION DEFAULT 1,
    "cost" DOUBLE PRECISION,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "graph_edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "spatial_objects_blueprint_id_idx" ON "spatial_objects"("blueprint_id");

-- CreateIndex
CREATE INDEX "spatial_objects_category_idx" ON "spatial_objects"("category");

-- CreateIndex
CREATE INDEX "spatial_objects_type_idx" ON "spatial_objects"("type");

-- CreateIndex
CREATE INDEX "spatial_objects_level_idx" ON "spatial_objects"("level");

-- CreateIndex
CREATE INDEX "spatial_objects_geometry_idx" ON "spatial_objects" USING GIST ("geometry");

-- CreateIndex
CREATE UNIQUE INDEX "navigation_graphs_blueprint_id_key" ON "navigation_graphs"("blueprint_id");

-- CreateIndex
CREATE INDEX "navigation_graphs_status_idx" ON "navigation_graphs"("status");

-- CreateIndex
CREATE INDEX "graph_nodes_graph_id_idx" ON "graph_nodes"("graph_id");

-- CreateIndex
CREATE INDEX "graph_nodes_spatial_object_id_idx" ON "graph_nodes"("spatial_object_id");

-- CreateIndex
CREATE INDEX "graph_nodes_floor_level_idx" ON "graph_nodes"("floor_level");

-- CreateIndex
CREATE INDEX "graph_nodes_geometry_idx" ON "graph_nodes" USING GIST ("geometry");

-- CreateIndex
CREATE INDEX "graph_edges_graph_id_idx" ON "graph_edges"("graph_id");

-- CreateIndex
CREATE INDEX "graph_edges_from_node_id_idx" ON "graph_edges"("from_node_id");

-- CreateIndex
CREATE INDEX "graph_edges_to_node_id_idx" ON "graph_edges"("to_node_id");

-- CreateIndex
CREATE INDEX "graph_edges_geometry_idx" ON "graph_edges" USING GIST ("geometry");

-- AddForeignKey
ALTER TABLE "spatial_objects" ADD CONSTRAINT "spatial_objects_blueprint_id_fkey" FOREIGN KEY ("blueprint_id") REFERENCES "blueprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_graphs" ADD CONSTRAINT "navigation_graphs_blueprint_id_fkey" FOREIGN KEY ("blueprint_id") REFERENCES "blueprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_nodes" ADD CONSTRAINT "graph_nodes_graph_id_fkey" FOREIGN KEY ("graph_id") REFERENCES "navigation_graphs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_nodes" ADD CONSTRAINT "graph_nodes_spatial_object_id_fkey" FOREIGN KEY ("spatial_object_id") REFERENCES "spatial_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_graph_id_fkey" FOREIGN KEY ("graph_id") REFERENCES "navigation_graphs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_from_node_id_fkey" FOREIGN KEY ("from_node_id") REFERENCES "graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_to_node_id_fkey" FOREIGN KEY ("to_node_id") REFERENCES "graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
