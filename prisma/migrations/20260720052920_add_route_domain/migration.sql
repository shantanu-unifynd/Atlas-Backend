-- CreateEnum
CREATE TYPE "route_lifecycle_status" AS ENUM ('GENERATING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "routes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "graph_id" UUID NOT NULL,
    "origin_node_id" UUID NOT NULL,
    "destination_node_id" UUID NOT NULL,
    "status" "route_lifecycle_status" NOT NULL DEFAULT 'GENERATING',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_segments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "route_id" UUID NOT NULL,
    "source_node_id" UUID NOT NULL,
    "target_node_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_statistics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "route_id" UUID NOT NULL,
    "statistics" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "routes_graph_id_idx" ON "routes"("graph_id");

-- CreateIndex
CREATE INDEX "routes_origin_node_id_idx" ON "routes"("origin_node_id");

-- CreateIndex
CREATE INDEX "routes_destination_node_id_idx" ON "routes"("destination_node_id");

-- CreateIndex
CREATE INDEX "routes_status_idx" ON "routes"("status");

-- CreateIndex
CREATE INDEX "route_segments_route_id_idx" ON "route_segments"("route_id");

-- CreateIndex
CREATE UNIQUE INDEX "route_segments_route_id_sequence_key" ON "route_segments"("route_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "route_statistics_route_id_key" ON "route_statistics"("route_id");

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_graph_id_fkey" FOREIGN KEY ("graph_id") REFERENCES "navigation_graphs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_origin_node_id_fkey" FOREIGN KEY ("origin_node_id") REFERENCES "navigation_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_destination_node_id_fkey" FOREIGN KEY ("destination_node_id") REFERENCES "navigation_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_segments" ADD CONSTRAINT "route_segments_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_segments" ADD CONSTRAINT "route_segments_source_node_id_fkey" FOREIGN KEY ("source_node_id") REFERENCES "navigation_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_segments" ADD CONSTRAINT "route_segments_target_node_id_fkey" FOREIGN KEY ("target_node_id") REFERENCES "navigation_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_statistics" ADD CONSTRAINT "route_statistics_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
