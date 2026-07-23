class Position {
  constructor({ id, graphId, source, coordinates, recordedAt, metadata, createdAt, updatedAt }) {
    this.id = id;
    this.graphId = graphId;
    this.source = source;
    this.coordinates = coordinates;
    this.recordedAt = recordedAt;
    this.metadata = metadata;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = Position;
