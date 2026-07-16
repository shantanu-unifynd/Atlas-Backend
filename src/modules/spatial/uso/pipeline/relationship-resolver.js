// Stage 4 — Relationship Resolver.
// Phase B: derives deterministic USO-to-USO relationships purely from
// Phase C's already-computed candidate-level relationships (geometry +
// topology derived, GeometryModel.relationships) — never from names,
// metadata, AI, or heuristics. Every mapping below is a direct, fixed
// translation table; nothing is guessed, and a candidate relationship that
// can't be confidently translated is simply dropped.
//
// USO ids don't exist yet at this point in the pipeline (they're assigned
// by Postgres at insert time), so this stage resolves relationships in
// terms of candidateId pairs. The service performs the final candidateId
// -> real usoId translation once persistence has happened.

const TRAVERSABLE_CATEGORIES = new Set(["OPENING", "PASSAGE", "ENCLOSURE", "VERTICAL_CONNECTION"]);

// Returns { type, from, to } — from/to may be swapped from the candidate
// relationship's original direction, to normalize an asymmetric type (e.g.
// BOUNDED_BY should always read "Boundary bounded by Wall", regardless of
// which side Phase C happened to record as "from").
function resolveType(candidateType, from, to, fromCategory, toCategory) {
  if (candidateType === "CONTAINS") {
    if (fromCategory === "BOUNDARY" && toCategory === "WALL") return { type: "BOUNDED_BY", from, to };
    if (toCategory === "BOUNDARY" && fromCategory === "WALL") return { type: "BOUNDED_BY", from: to, to: from };
    return { type: "CONTAINS", from, to };
  }

  if (candidateType === "ADJACENT") {
    return { type: "ADJACENT_TO", from, to };
  }

  if (candidateType === "TOUCHES") {
    if (TRAVERSABLE_CATEGORIES.has(fromCategory) && TRAVERSABLE_CATEGORIES.has(toCategory)) {
      return { type: "CONNECTS", from, to };
    }

    if (fromCategory === "WALL" && toCategory === "WALL") {
      return { type: "ADJACENT_TO", from, to };
    }

    // A boundary literally traced by wall segments touches those walls at
    // their shared endpoints — the same deterministic fact as the CONTAINS
    // case above, just arriving via topology instead of a bounding box.
    if (fromCategory === "BOUNDARY" && toCategory === "WALL") return { type: "BOUNDED_BY", from, to };
    if (toCategory === "BOUNDARY" && fromCategory === "WALL") return { type: "BOUNDED_BY", from: to, to: from };

    return { type: "TOUCHES", from, to };
  }

  if (candidateType === "INTERSECTS") {
    return { type: "INTERSECTS", from, to };
  }

  // Unknown candidate relationship type — no confident mapping, don't guess.
  return null;
}

function resolveRelationships(usos, candidateRelationships) {
  const categoryByCandidateId = new Map(usos.map((uso) => [uso.candidateId, uso.spatialCategory]));

  const pendingRelationships = [];
  const warnings = [];

  for (const candidateRelationship of candidateRelationships || []) {
    const fromCategory = categoryByCandidateId.get(candidateRelationship.from);
    const toCategory = categoryByCandidateId.get(candidateRelationship.to);

    if (!fromCategory || !toCategory) {
      // One (or both) sides didn't survive candidate validation into a USO —
      // insufficient basis to create a relationship, so it's skipped rather
      // than guessed.
      continue;
    }

    const resolved = resolveType(
      candidateRelationship.type,
      candidateRelationship.from,
      candidateRelationship.to,
      fromCategory,
      toCategory
    );

    if (!resolved) {
      warnings.push(
        `Unrecognized candidate relationship type '${candidateRelationship.type}' between '${candidateRelationship.from}' and '${candidateRelationship.to}'; skipped`
      );
      continue;
    }

    pendingRelationships.push({
      sourceCandidateId: resolved.from,
      targetCandidateId: resolved.to,
      relationshipType: resolved.type,
      confidence: 1.0,
    });
  }

  return { usos, pendingRelationships, warnings };
}

module.exports = {
  resolveRelationships,
};
