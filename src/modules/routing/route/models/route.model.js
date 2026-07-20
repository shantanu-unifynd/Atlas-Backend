class Route {
  constructor({
    id,
    graphId,
    originNodeId,
    destinationNodeId,
    status,
    metadata,
    segments,
    statistics,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.graphId = graphId;
    this.originNodeId = originNodeId;
    this.destinationNodeId = destinationNodeId;
    this.status = status;
    this.metadata = metadata;
    this.segments = segments ?? [];
    this.statistics = statistics ?? null;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = Route;
