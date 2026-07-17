class NavigationGraph {
  constructor({
    id,
    buildingId,
    floorId,
    status,
    pipelineVersion,
    metadata,
    statistics,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.buildingId = buildingId;
    this.floorId = floorId ?? null;
    this.status = status;
    this.pipelineVersion = pipelineVersion;
    this.metadata = metadata;
    this.statistics = statistics;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = NavigationGraph;
