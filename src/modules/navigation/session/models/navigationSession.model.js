class NavigationSession {
  constructor({ id, routeId, state, metadata, createdAt, updatedAt }) {
    this.id = id;
    this.routeId = routeId;
    this.state = state;
    this.metadata = metadata;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = NavigationSession;
