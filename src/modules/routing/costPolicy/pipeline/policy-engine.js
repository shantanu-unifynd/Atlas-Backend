// Stage 2 — Policy Engine. Pure function: NavigationEdges + a
// RoutingPreference in, [{edgeId, baseCost, effectiveCost}] out. No
// persistence, no Prisma writes, no Dijkstra — this only computes a
// number per edge.
//
// Sprint 08 Phase 1: every preference is an identity policy
// (effectiveCost = baseCost). This is intentional, not a placeholder bug —
// the real differentiating data doesn't exist yet:
//   - FASTEST needs a travel-speed model (not built).
//   - ACCESSIBLE needs accessibility metadata on NavigationEdge (not built).
//   - AVOID_STAIRS / PREFER_ELEVATORS need stair/elevator metadata on
//     NavigationEdge (not built).
// The registry below exists so a future story can replace one entry's
// function with a real policy without touching this engine's shape,
// the loader, the validator, or the response builder.
function identityPolicy(baseCost) {
  return baseCost;
}

const POLICIES = {
  SHORTEST: identityPolicy,
  FASTEST: identityPolicy,
  ACCESSIBLE: identityPolicy,
  AVOID_STAIRS: identityPolicy,
  PREFER_ELEVATORS: identityPolicy,
};

function computeEffectiveCosts(edges, preference) {
  const policy = POLICIES[preference];

  if (!policy) {
    throw new Error(`No policy registered for preference '${preference}'`);
  }

  return edges.map((edge) => ({
    edgeId: edge.id,
    baseCost: edge.traversalCost,
    effectiveCost: policy(edge.traversalCost, edge),
  }));
}

module.exports = { computeEffectiveCosts };
