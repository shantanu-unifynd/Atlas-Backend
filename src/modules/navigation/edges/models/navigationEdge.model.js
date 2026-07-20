class NavigationEdge {
  constructor({
    id,
    graphId,
    sourceNodeId,
    targetNodeId,
    edgeType,
    length,
    traversalCost,
    accessibility,
    metadata,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.graphId = graphId;
    this.sourceNodeId = sourceNodeId;
    this.targetNodeId = targetNodeId;
    this.edgeType = edgeType;
    this.length = length;
    this.traversalCost = traversalCost;
    this.accessibility = accessibility;
    this.metadata = metadata;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = NavigationEdge;
