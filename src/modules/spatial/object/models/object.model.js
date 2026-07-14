class SpatialObject {
  constructor({
    id,
    blueprintId,
    type,
    name,
    geometry,
    layer,
    properties,
    relationships,
    state,
    metadata,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.blueprintId = blueprintId;
    this.type = type;
    this.name = name;
    this.geometry = geometry;
    this.layer = layer;
    this.properties = properties;
    this.relationships = relationships;
    this.state = state;
    this.metadata = metadata;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = SpatialObject;
