-- CreateEnum
CREATE TYPE "routing_preference" AS ENUM ('SHORTEST', 'FASTEST', 'ACCESSIBLE', 'AVOID_STAIRS', 'PREFER_ELEVATORS');

-- CreateTable
CREATE TABLE "routing_contexts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "graph_id" UUID NOT NULL,
    "preference" "routing_preference" NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routing_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "routing_contexts_graph_id_idx" ON "routing_contexts"("graph_id");

-- CreateIndex
CREATE INDEX "routing_contexts_preference_idx" ON "routing_contexts"("preference");

-- AddForeignKey
ALTER TABLE "routing_contexts" ADD CONSTRAINT "routing_contexts_graph_id_fkey" FOREIGN KEY ("graph_id") REFERENCES "navigation_graphs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
