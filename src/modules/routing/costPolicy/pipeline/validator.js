// Stage 3 — Validator. Read-only: verifies the Policy Engine's own output
// before it's handed to the response builder. Never touches the database.
function validate(edges, effectiveCosts) {
  const errors = [];

  if (effectiveCosts.length !== edges.length) {
    errors.push(
      `Effective cost count (${effectiveCosts.length}) does not match edge count (${edges.length})`
    );
  }

  const edgeIds = new Set(edges.map((edge) => edge.id));
  const processedEdgeIds = new Set();

  for (const entry of effectiveCosts) {
    if (!edgeIds.has(entry.edgeId)) {
      errors.push(`Effective cost computed for non-existent edge ${entry.edgeId}`);
      continue;
    }

    processedEdgeIds.add(entry.edgeId);

    if (typeof entry.baseCost !== "number" || Number.isNaN(entry.baseCost)) {
      errors.push(`Edge ${entry.edgeId} has a non-numeric or NaN baseCost`);
    } else if (!Number.isFinite(entry.baseCost)) {
      errors.push(`Edge ${entry.edgeId} has a non-finite baseCost`);
    } else if (entry.baseCost <= 0) {
      errors.push(`Edge ${entry.edgeId} has a non-positive baseCost (${entry.baseCost})`);
    }

    if (typeof entry.effectiveCost !== "number" || Number.isNaN(entry.effectiveCost)) {
      errors.push(`Edge ${entry.edgeId} has a non-numeric or NaN effectiveCost`);
    } else if (!Number.isFinite(entry.effectiveCost)) {
      errors.push(`Edge ${entry.edgeId} has a non-finite effectiveCost`);
    } else if (entry.effectiveCost <= 0) {
      errors.push(`Edge ${entry.edgeId} has a non-positive effectiveCost (${entry.effectiveCost})`);
    }
  }

  for (const edge of edges) {
    if (!processedEdgeIds.has(edge.id)) {
      errors.push(`Edge ${edge.id} was not processed by the Policy Engine`);
    }
  }

  return { errors };
}

module.exports = { validate };
