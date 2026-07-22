const routeRepository = require("../../../../repositories/route/route.repository");

// Stage 1 — Loader. Loads the Route a NavigationSession would belong to.
// No lifecycle, no progress, no event inspection — this story only needs
// to confirm the route exists.
async function loadRoute(routeId) {
  const route = await routeRepository.findById(routeId);

  if (!route) {
    const error = new Error("Route not found");
    error.statusCode = 404;
    throw error;
  }

  return { route };
}

module.exports = { loadRoute };
