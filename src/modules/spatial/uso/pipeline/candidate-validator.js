// Stage 2 — Candidate Validator.
// Structural validation only: does candidate geometry exist at all, are the
// candidate collections present, are there duplicate ids within a
// collection, are references malformed or empty. No semantic validation —
// this stage has no opinion about whether a candidate "makes sense" as a
// wall or a room, only whether its data is structurally usable.

const CANDIDATE_COLLECTION_KEYS = [
  "candidateBoundaries",
  "candidateEnclosures",
  "candidateOpenings",
  "candidateWalls",
  "candidatePassages",
  "candidateVerticalConnections",
];

function hasGeometryReference(candidate) {
  if (Array.isArray(candidate.primitiveIds)) {
    return candidate.primitiveIds.length > 0;
  }

  if (typeof candidate.primitiveId === "string") {
    return candidate.primitiveId.length > 0;
  }

  // CandidateOpening references a gap between two topology nodes rather
  // than a primitive directly — still a valid, non-empty geometry reference.
  return Array.isArray(candidate.gapNodeIds) && candidate.gapNodeIds.length > 0;
}

function validateCandidates(loaded) {
  const warnings = [];
  const errors = [];

  if (!loaded.candidatesGeneratedAt) {
    const error = new Error(
      "Candidate geometry has not been generated yet for this geometry model"
    );
    error.statusCode = 400;
    throw error;
  }

  if (!loaded.candidateObjects || typeof loaded.candidateObjects !== "object") {
    const error = new Error("Candidate collections do not exist for this geometry model");
    error.statusCode = 400;
    throw error;
  }

  const validCandidateObjects = {};
  let skippedCandidates = 0;

  for (const key of CANDIDATE_COLLECTION_KEYS) {
    const collection = Array.isArray(loaded.candidateObjects[key]) ? loaded.candidateObjects[key] : [];
    const seenIds = new Set();
    const validEntries = [];

    for (const candidate of collection) {
      if (!candidate || typeof candidate.id !== "string" || candidate.id.length === 0) {
        warnings.push(`${key}: skipped a candidate with a missing or invalid id`);
        skippedCandidates += 1;
        continue;
      }

      if (seenIds.has(candidate.id)) {
        warnings.push(`${key}: skipped duplicate candidate id '${candidate.id}'`);
        skippedCandidates += 1;
        continue;
      }

      if (!hasGeometryReference(candidate)) {
        warnings.push(`${key}: skipped candidate '${candidate.id}' with an empty geometry reference`);
        skippedCandidates += 1;
        continue;
      }

      seenIds.add(candidate.id);
      validEntries.push(candidate);
    }

    validCandidateObjects[key] = validEntries;
  }

  return {
    geometryModelId: loaded.geometryModelId,
    candidateObjects: validCandidateObjects,
    skippedCandidates,
    warnings,
    errors,
  };
}

module.exports = {
  validateCandidates,
  CANDIDATE_COLLECTION_KEYS,
};
