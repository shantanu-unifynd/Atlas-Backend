// Maps the flat database row into the documented Semantic Model shape.
// References the USO by id (sourceUSO) — never embeds or duplicates the
// USO's own geometry, spatial category, or accessibility fields.
class SemanticModel {
  constructor({
    id,
    usoId,
    geometryModelId,
    semanticVersion,
    lifecycle,
    semanticCategory,
    semanticSubCategory,
    classificationSource,
    ruleId,
    ruleVersion,
    confidenceValue,
    confidenceSource,
    confidenceReason,
    classifiedAt,
    metadata,
    createdAt,
    updatedAt,
  }) {
    this.semanticId = id;
    this.semanticVersion = semanticVersion;
    this.lifecycle = lifecycle;
    this.classification = {
      semanticCategory,
      semanticSubCategory,
      source: classificationSource,
      ruleId,
      ruleVersion,
    };
    this.confidence = {
      value: confidenceValue,
      source: confidenceSource,
      reason: confidenceReason,
    };
    this.classifiedAt = classifiedAt;
    this.metadata = metadata;
    this.sourceUSO = {
      usoId,
      geometryModelId,
    };
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = SemanticModel;
