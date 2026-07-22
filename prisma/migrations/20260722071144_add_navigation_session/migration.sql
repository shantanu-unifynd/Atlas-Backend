-- CreateEnum
CREATE TYPE "navigation_session_state" AS ENUM ('CREATED', 'READY', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "navigation_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "route_id" UUID NOT NULL,
    "state" "navigation_session_state" NOT NULL DEFAULT 'CREATED',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "navigation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "navigation_sessions_route_id_idx" ON "navigation_sessions"("route_id");

-- CreateIndex
CREATE INDEX "navigation_sessions_state_idx" ON "navigation_sessions"("state");

-- AddForeignKey
ALTER TABLE "navigation_sessions" ADD CONSTRAINT "navigation_sessions_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
