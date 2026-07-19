class NavigationNode {
  constructor({
    id,
    graphId,
    candidateId,
    semanticObjectId,
    nodeType,
    position,
    metadata,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.graphId = graphId;
    this.candidateId = candidateId;
    this.semanticObjectId = semanticObjectId;
    this.nodeType = nodeType;
    this.position = position;
    this.metadata = metadata;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = NavigationNode;
