class GeometryModel {
  constructor({
    id,
    normalizedBlueprintId,
    metadata,
    primitives,
    cleanedGeometry,
    topology,
    candidateObjects,
    relationships,
    diagnostics,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.normalizedBlueprintId = normalizedBlueprintId;
    this.metadata = metadata;
    this.primitives = primitives;
    this.cleanedGeometry = cleanedGeometry;
    this.topology = topology;
    this.candidateObjects = candidateObjects;
    this.relationships = relationships;
    this.diagnostics = diagnostics;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = GeometryModel;
