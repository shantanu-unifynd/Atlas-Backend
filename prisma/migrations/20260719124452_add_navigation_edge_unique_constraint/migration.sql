-- Sprint 06 Story 04 — defense-in-depth: prevent duplicate directed edges
-- between the same node pair within a graph at the DB level, mirroring the
-- application-level dedup already performed by the edge generator/validator.
-- navigation_edges is empty at this point (verified via psql).
CREATE UNIQUE INDEX "navigation_edges_graph_id_source_node_id_target_node_id_key"
  ON "navigation_edges"("graph_id", "source_node_id", "target_node_id");
