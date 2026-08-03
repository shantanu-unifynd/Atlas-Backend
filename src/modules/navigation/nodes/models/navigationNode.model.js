class NavigationNode {
  constructor({
    id,
    graphId,
    candidateId,
    semanticObjectId,
    source,
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
    this.source = source;
    this.nodeType = nodeType;
    this.position = position;
    this.metadata = metadata;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = NavigationNode;
