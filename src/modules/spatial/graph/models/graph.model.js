// Sprint 03 Story 03 legacy graph DTO (backs LegacyNavigationGraph). Renamed
// from NavigationGraph in the Sprint 06 Story 01 architectural refactor to
// remove ambiguity with the canonical NavigationGraph domain — this is a
// pure internal rename, JSON output is unchanged (JSON.stringify never
// serializes a class name).
class LegacyNavigationGraph {
  constructor({
    id,
    blueprintId,
    version,
    status,
    nodes,
    edges,
    metadata,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.blueprintId = blueprintId;
    this.version = version;
    this.status = status;
    this.nodes = nodes;
    this.edges = edges;
    this.metadata = metadata;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = LegacyNavigationGraph;
