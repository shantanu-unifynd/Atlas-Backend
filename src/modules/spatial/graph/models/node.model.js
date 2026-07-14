class Node {
  constructor({ id, graphId, spatialObjectId, position, metadata }) {
    this.id = id;
    this.graphId = graphId;
    this.spatialObjectId = spatialObjectId;
    this.position = position;
    this.metadata = metadata;
  }
}

module.exports = Node;
