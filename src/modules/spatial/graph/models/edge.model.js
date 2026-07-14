class Edge {
  constructor({ id, graphId, fromNodeId, toNodeId, distance, metadata }) {
    this.id = id;
    this.graphId = graphId;
    this.fromNodeId = fromNodeId;
    this.toNodeId = toNodeId;
    this.distance = distance;
    this.metadata = metadata;
  }
}

module.exports = Edge;
