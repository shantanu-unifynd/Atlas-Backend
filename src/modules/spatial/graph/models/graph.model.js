class NavigationGraph {
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

module.exports = NavigationGraph;
