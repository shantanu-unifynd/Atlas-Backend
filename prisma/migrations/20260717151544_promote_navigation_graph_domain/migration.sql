-- Sprint 06 Story 01 architectural refactor: promote the Semantic-Model-
-- derived Navigation Graph domain to Atlas's single canonical model, and
-- demote the Sprint 03 geometry-derived graph to an explicit legacy model.
-- All affected tables are empty at the time of this migration (verified via
-- psql before writing this file), so plain renames are used instead of
-- create+copy+drop.

-- 1. Drop the genuinely dead Sprint 03 GraphNode/GraphEdge tables.
--    Confirmed via code search: no service, controller, or route ever
--    creates or reads a row in either table (only dead repository
--    functions in src/repositories/spatial.repository.js referenced them).
DROP TABLE "graph_edges";
DROP TABLE "graph_nodes";

-- 2. Demote the Sprint 03 NavigationGraph container to LegacyNavigationGraph.
--    Still live via POST/GET /api/blueprints/:blueprintId/graph, so the
--    table is renamed (not dropped) and keeps all its data/constraints.
ALTER TABLE "navigation_graphs" RENAME TO "legacy_navigation_graphs";
ALTER TYPE "graph_status" RENAME TO "legacy_graph_status";

-- 3. Promote the Sprint 06 Story 01 Semantic* tables to the canonical names.
ALTER TABLE "semantic_navigation_graphs" RENAME TO "navigation_graphs";
ALTER TABLE "semantic_navigation_nodes" RENAME TO "navigation_nodes";
ALTER TABLE "semantic_navigation_edges" RENAME TO "navigation_edges";
