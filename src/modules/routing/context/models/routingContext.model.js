class RoutingContext {
  constructor({ id, graphId, preference, metadata, createdAt, updatedAt }) {
    this.id = id;
    this.graphId = graphId;
    this.preference = preference;
    this.metadata = metadata;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = RoutingContext;
