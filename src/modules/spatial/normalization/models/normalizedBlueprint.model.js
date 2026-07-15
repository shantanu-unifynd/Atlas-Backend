class NormalizedBlueprint {
  constructor({
    id,
    blueprintImportId,
    sourceFormat,
    metadata,
    coordinateSystem,
    bounds,
    layers,
    elements,
    relationships,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.blueprintImportId = blueprintImportId;
    this.sourceFormat = sourceFormat;
    this.metadata = metadata;
    this.coordinateSystem = coordinateSystem;
    this.bounds = bounds;
    this.layers = layers;
    this.elements = elements;
    this.relationships = relationships;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = NormalizedBlueprint;
