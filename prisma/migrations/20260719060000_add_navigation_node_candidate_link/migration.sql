-- Sprint 06 Story 03 — link NavigationNode to the NavigationCandidate it was
-- generated from (strict 1:1, enforced via a unique FK). navigation_nodes is
-- empty at this point (verified via psql), so a NOT NULL column with no
-- default is safe to add directly.
ALTER TABLE "navigation_nodes" ADD COLUMN "candidate_id" UUID NOT NULL;

CREATE UNIQUE INDEX "navigation_nodes_candidate_id_key" ON "navigation_nodes"("candidate_id");

ALTER TABLE "navigation_nodes" ADD CONSTRAINT "navigation_nodes_candidate_id_fkey"
  FOREIGN KEY ("candidate_id") REFERENCES "navigation_candidates"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
