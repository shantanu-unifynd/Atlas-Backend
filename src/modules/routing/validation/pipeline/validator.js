const policyEngine = require("../../costPolicy/pipeline/policy-engine");

const COST_EPSILON = 1e-9;

// Stage 2 — Validator. Pure function: no Prisma, no repositories, no HTTP.
// Validates only Sprint 08 (preference-layer) concepts — never re-validates
// the Navigation Graph (Sprint 06 Story 05) or the Route domain (Sprint 07
// Story 05), both already complete and untouched. Reuses Sprint 08 Story
// 02's Policy Engine directly to recompute effective costs — no cost
// logic is duplicated here.
function validate(comparisonResult, edges, requestedContextIds) {
  const errors = [];
  const warnings = [];
  const routeOutcomes = [];

  const { originNodeId, destinationNodeId, routes } = comparisonResult;

  const edgeBySourceTarget = new Map(edges.map((edge) => [`${edge.sourceNodeId}->${edge.targetNodeId}`, edge]));
  const effectiveCostCacheByPreference = new Map();

  function effectiveCostsFor(preference) {
    if (!effectiveCostCacheByPreference.has(preference)) {
      effectiveCostCacheByPreference.set(
        preference,
        new Map(
          policyEngine
            .computeEffectiveCosts(edges, preference)
            .map((entry) => [entry.edgeId, entry.effectiveCost])
        )
      );
    }

    return effectiveCostCacheByPreference.get(preference);
  }

  const seenContextIds = new Set();
  const seenPreferences = new Set();

  for (const route of routes) {
    const routeErrors = [];

    // Rule 7 — required fields present.
    const hasRequiredFields =
      route.routingContextId &&
      route.preference &&
      Array.isArray(route.path) &&
      typeof route.totalCost === "number" &&
      typeof route.hopCount === "number";

    if (!hasRequiredFields) {
      routeErrors.push(
        `Comparison entry for context ${route.routingContextId} is missing a required field (context, preference, path, totalCost, or hopCount)`
      );
    }

    // Rule 1 — every returned route belongs to one supplied RoutingContext.
    if (!requestedContextIds.includes(route.routingContextId)) {
      routeErrors.push(
        `Route uses RoutingContext ${route.routingContextId}, which was not among the requested contexts`
      );
    }

    // Rule 2 — no duplicate RoutingContexts among the results.
    if (seenContextIds.has(route.routingContextId)) {
      routeErrors.push(`Duplicate RoutingContext ${route.routingContextId} in comparison results`);
    }

    seenContextIds.add(route.routingContextId);

    // Rule 8 — no duplicate preferences among the results.
    if (seenPreferences.has(route.preference)) {
      routeErrors.push(`Duplicate preference '${route.preference}' in comparison results`);
    }

    seenPreferences.add(route.preference);

    if (hasRequiredFields) {
      // Rule 3 / 4 — origin/destination anchoring.
      if (route.path[0] !== originNodeId) {
        routeErrors.push(`Route for context ${route.routingContextId} does not begin at the requested origin`);
      }

      if (route.path[route.path.length - 1] !== destinationNodeId) {
        routeErrors.push(
          `Route for context ${route.routingContextId} does not end at the requested destination`
        );
      }

      // Rule 5 — hopCount consistency.
      if (route.hopCount !== route.path.length - 1) {
        routeErrors.push(`Route for context ${route.routingContextId} has an inconsistent hopCount`);
      }

      // Rule 6 / 10 — recompute effective costs for this route's own
      // preference (via Story 02's Policy Engine) and confirm totalCost
      // equals their sum; confirm every effective cost used is positive
      // and finite.
      const effectiveCostByEdgeId = effectiveCostsFor(route.preference);
      let recomputedTotal = 0;
      let pathFullyResolved = true;

      for (let i = 0; i < route.path.length - 1; i += 1) {
        const key = `${route.path[i]}->${route.path[i + 1]}`;
        const edge = edgeBySourceTarget.get(key);

        if (!edge) {
          routeErrors.push(
            `Route for context ${route.routingContextId} traverses a hop with no corresponding NavigationEdge (${key})`
          );
          pathFullyResolved = false;
          continue;
        }

        const effectiveCost = effectiveCostByEdgeId.get(edge.id);

        if (
          typeof effectiveCost !== "number" ||
          Number.isNaN(effectiveCost) ||
          !Number.isFinite(effectiveCost) ||
          effectiveCost <= 0
        ) {
          routeErrors.push(
            `Edge ${edge.id} has a non-positive or non-finite effective cost (${effectiveCost}) under preference '${route.preference}'`
          );
          pathFullyResolved = false;
          continue;
        }

        recomputedTotal += effectiveCost;
      }

      if (pathFullyResolved && Math.abs(recomputedTotal - route.totalCost) > COST_EPSILON) {
        routeErrors.push(
          `Route for context ${route.routingContextId} totalCost (${route.totalCost}) does not match the sum of effective costs (${recomputedTotal})`
        );
      }
    }

    routeOutcomes.push({ routingContextId: route.routingContextId, valid: routeErrors.length === 0 });
    errors.push(...routeErrors);
  }

  // Rule 9 — comparison ordering is deterministic: the sequence of
  // RoutingContext IDs in the response must preserve the relative order
  // they were requested in (routes for contexts that failed to produce a
  // path — Story 04's own per-context 404 skip — are simply absent, not
  // out of order).
  const requestedOrderFiltered = requestedContextIds.filter((id) =>
    routes.some((route) => route.routingContextId === id)
  );
  const responseOrder = routes.map((route) => route.routingContextId);

  if (JSON.stringify(requestedOrderFiltered) !== JSON.stringify(responseOrder)) {
    errors.push("Comparison result ordering does not match the deterministic order of the request");
  }

  return { errors, warnings, routeOutcomes };
}

module.exports = { validate };
