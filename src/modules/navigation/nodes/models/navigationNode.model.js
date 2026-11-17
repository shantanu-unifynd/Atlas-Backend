class NavigationNode {
  constructor({
    id,
    graphId,
    candidateId,
    semanticObjectId,
    source,
    nodeType,
    position,
    floorId,
    metadata,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.graphId = graphId;
    this.candidateId = candidateId;
    this.semanticObjectId = semanticObjectId;
    this.source = source;
    // Which floor this node sits on (M1). Null for single-floor graphs; set on
    // the per-building transition graph's connector nodes so the client can
    // pair connectors across floors.
    this.floorId = floorId ?? null;
    this.nodeType = nodeType;
    this.position = position;
    this.metadata = metadata;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = NavigationNode;
