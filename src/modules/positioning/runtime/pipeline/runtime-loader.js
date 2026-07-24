const progressLoader = require("../../../navigation/session/progress/pipeline/progress-loader");
const providerLoader = require("../../provider/pipeline/provider-loader");
const providerEngine = require("../../provider/pipeline/provider-engine");

// Stage 1 — Runtime Loader. Reuses Sprint 09 Story 03's loader completely
// unchanged for NavigationSession/Route/RouteSegments/RouteStatistics
// (same 404/409/400 preconditions), and Sprint 10 Story 02's provider
// pipeline completely unchanged to obtain the current Position. No
// loading logic is duplicated here.
function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function internalError(message) {
  return new Error(message);
}

async function loadRuntimeContext(sessionId, providerName) {
  const { session, route, segments, statistics } = await progressLoader.loadProgressContext(sessionId);

  const provider = providerLoader.loadProvider(providerName);

  const positionRequest = { graphId: route.graphId, sourceId: sessionId };

  const { errors: requestErrors } = providerEngine.validateRequest(positionRequest);

  if (requestErrors.length > 0) {
    throw validationError(requestErrors.join(", "));
  }

  const position = await providerEngine.callProvider(provider, positionRequest);

  const { errors: shapeErrors } = providerEngine.validatePositionShape(position);

  if (shapeErrors.length > 0) {
    throw internalError(`Position Provider produced an invalid response: ${shapeErrors.join(", ")}`);
  }

  return { session, route, segments, statistics, provider, position };
}

module.exports = { loadRuntimeContext };
