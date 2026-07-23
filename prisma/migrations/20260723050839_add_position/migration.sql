-- CreateTable
CREATE TABLE "positions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "graph_id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "coordinates" JSONB NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "positions_graph_id_idx" ON "positions"("graph_id");

-- CreateIndex
CREATE INDEX "positions_source_idx" ON "positions"("source");

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_graph_id_fkey" FOREIGN KEY ("graph_id") REFERENCES "navigation_graphs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
