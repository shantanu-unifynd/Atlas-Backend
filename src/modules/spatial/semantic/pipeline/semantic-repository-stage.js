// Stage 6 — Repository.
// A thin pipeline-stage adapter around the real repository (which owns all
// Prisma access, per the Repository Pattern established in Sprint 04). This
// file's only job is "persist, then return what was persisted" — it is not
// itself where Prisma queries live.

const semanticModelRepository = require("../../../../repositories/semanticModel/semanticModel.repository");

async function persistSemanticModels(semanticModels) {
  if (semanticModels.length === 0) {
    return [];
  }

  await semanticModelRepository.createMany(semanticModels);

  return semanticModelRepository.findAllByUsoIds(semanticModels.map((model) => model.usoId));
}

module.exports = {
  persistSemanticModels,
};
