// Maps the flat, indexable database row into the documented nested USO
// shape (identity / representation / geometryReference / ...). The row's
// own primary key IS the USO's stable identity — future phases that enrich
// a USO must update this same row, never replace it.
class UniversalSpatialObject {
  constructor({
    id,
    geometryModelId,
    candidateId,
    candidateType,
    spatialCategory,
    version,
    revision,
    status,
    generatedAt,
    updatedAt,
    generatedFrom,
    geometryReference,
    accessibility,
    relationships,
    metadata,
  }) {
    this.identity = {
      usoId: id,
      geometryModelId,
    };
    this.representation = {
      version,
      revision,
      status,
      generatedAt,
      updatedAt,
      generatedFrom,
    };
    this.geometryReference = geometryReference;
    this.spatialCategory = spatialCategory;
    this.accessibility = accessibility;
    this.relationships = relationships;
    this.metadata = metadata;
  }
}

module.exports = UniversalSpatialObject;
