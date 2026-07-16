// Stage 6 — Repository.
// A thin pipeline-stage adapter around the real repository (which owns all
// Prisma access, per the Repository Pattern established in Sprint 04). This
// file's only job is "persist, then return what was persisted" — it is not
// itself where Prisma queries live.
//
// Accepts an optional transaction client so the caller (the service) can
// run persistence inside a single database transaction — no partial
// persistence is allowed if any step fails.

const semanticModelRepository = require("../../../../repositories/semanticModel/semanticModel.repository");

async function persistSemanticModels(semanticModels, client) {
  if (semanticModels.length === 0) {
    return [];
  }

  await semanticModelRepository.createMany(semanticModels, client);

  return semanticModelRepository.findAllByUsoIds(semanticModels.map((model) => model.usoId), client);
}

module.exports = {
  persistSemanticModels,
};
