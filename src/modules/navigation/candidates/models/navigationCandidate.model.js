class NavigationCandidate {
  constructor({
    id,
    graphId,
    semanticObjectId,
    candidateType,
    position,
    confidence,
    metadata,
    createdAt,
  }) {
    this.id = id;
    this.graphId = graphId;
    this.semanticObjectId = semanticObjectId;
    this.candidateType = candidateType;
    this.position = position;
    this.confidence = confidence;
    this.metadata = metadata;
    this.createdAt = createdAt;
  }
}

module.exports = NavigationCandidate;
