// Stage 3 — Response Builder. Assembles the final, transient validation
// response. No persistence — this is never written anywhere.
function build(comparisonResult, errors, warnings, routeOutcomes) {
  const { routes } = comparisonResult;

  const validatedRoutes = routeOutcomes.filter((outcome) => outcome.valid).length;
  const failedRoutes = routeOutcomes.filter((outcome) => !outcome.valid).length;
  const preferencesCompared = new Set(routes.map((route) => route.preference)).size;

  const totalCosts = routes.map((route) => route.totalCost);
  const totalHops = routes.map((route) => route.hopCount);

  const averageCost =
    totalCosts.length > 0 ? totalCosts.reduce((sum, value) => sum + value, 0) / totalCosts.length : null;
  const averageHopCount =
    totalHops.length > 0 ? totalHops.reduce((sum, value) => sum + value, 0) / totalHops.length : null;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    statistics: {
      validatedRoutes,
      failedRoutes,
      preferencesCompared,
      averageCost,
      averageHopCount,
    },
    validatedAt: new Date().toISOString(),
  };
}

module.exports = { build };
