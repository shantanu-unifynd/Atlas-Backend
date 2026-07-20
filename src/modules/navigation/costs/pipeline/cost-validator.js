// Stage 3 — Cost Validator. Read-only: validates the Stage 2 output shape
// before persistence, never touches the database.
function validateCosts(edges, costAssignments) {
  const errors = [];

  const edgeIds = new Set(edges.map((edge) => edge.id));

  if (costAssignments.length !== edges.length) {
    errors.push(
      `Cost assignment count (${costAssignments.length}) does not match edge count (${edges.length})`
    );
  }

  for (const assignment of costAssignments) {
    if (!edgeIds.has(assignment.edgeId)) {
      errors.push(`Cost assigned to non-existent edge ${assignment.edgeId}`);
      continue;
    }

    const { traversalCost } = assignment;

    if (typeof traversalCost !== "number" || Number.isNaN(traversalCost)) {
      errors.push(`Edge ${assignment.edgeId} has a non-numeric or NaN traversal cost`);
      continue;
    }

    if (!Number.isFinite(traversalCost)) {
      errors.push(`Edge ${assignment.edgeId} has a non-finite (Infinity) traversal cost`);
      continue;
    }

    if (traversalCost <= 0) {
      errors.push(`Edge ${assignment.edgeId} has a non-positive traversal cost (${traversalCost})`);
    }
  }

  return { errors };
}

module.exports = { validateCosts };
