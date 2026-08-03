-- CreateEnum
CREATE TYPE "navigation_node_source" AS ENUM ('AUTO', 'MANUAL');

-- AlterTable
ALTER TABLE "navigation_nodes" ADD COLUMN     "source" "navigation_node_source" NOT NULL DEFAULT 'AUTO',
ALTER COLUMN "semantic_object_id" DROP NOT NULL,
ALTER COLUMN "candidate_id" DROP NOT NULL;
