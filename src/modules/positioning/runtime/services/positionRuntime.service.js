const navigationNodeRepository = require("../../../../repositories/navigationNode/navigationNode.repository");
const runtimeLoader = require("../pipeline/runtime-loader");
const nodeResolver = require("../pipeline/node-resolver");
const segmentResolver = require("../pipeline/segment-resolver");
const progressIntegration = require("../pipeline/progress-integration");
const originProgressBuilder = require("../pipeline/origin-progress-builder");
const responseBuilder = require("../pipeline/runtime-response-builder");
const progressValidator = require("../../../navigation/session/progress/pipeline/progress-validator");

// Sprint 10 Story 03 — Runtime Position Integration. Orchestration only:
// load -> resolve nearest node -> resolve current segment -> integrate
// progress (reusing Sprint 09's Progress Engine unchanged) -> build
// response. No database writes anywhere — Position/NavigationSession/
// Route are only ever read.
function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function internalError(message) {
  return new Error(message);
}

async function getRuntimeSnapshot(sessionId, providerName) {
  const { session, route, segments, statistics, provider, position } = await runtimeLoader.loadRuntimeContext(
    sessionId,
    providerName
  );

  if (position.graphId !== route.graphId) {
    throw validationError(
      `Position is outside this route's graph (position graphId '${position.graphId}' does not match route graphId '${route.graphId}')`
    );
  }

  const nodes = await navigationNodeRepository.findAllByGraphId(route.graphId);

  const resolved = nodeResolver.resolveNearestNode(position.coordinates, nodes);

  if (!resolved) {
    throw validationError("Nearest navigation node cannot be determined from the current position");
  }

  const { segment, completedSegmentCount } = segmentResolver.resolveCurrentSegment(
    resolved.node.id,
    route,
    segments
  );

  if (completedSegmentCount === null) {
    throw validationError("Current route segment cannot be resolved from the nearest node");
  }

  // completedSegmentCount === 0 (standing at the Route's origin) is a
  // boundary case Sprint 09's unchanged progress-engine.js/progress-
  // validator.js cannot represent (see origin-progress-builder.js) — it
  // never occurred under Sprint 09's own calling convention, only under
  // Story 04's walking simulation, which legitimately starts there.
  const progress =
    completedSegmentCount === 0
      ? originProgressBuilder.buildOriginProgress(route, segments, statistics)
      : progressIntegration.integrateProgress(session, route, segments, statistics, completedSegmentCount);

  if (completedSegmentCount !== 0) {
    const { errors } = progressValidator.validate(route, segments, statistics, progress);

    if (errors.length > 0) {
      throw internalError(`Runtime Position Integration produced invalid progress: ${errors.join(", ")}`);
    }
  }

  return responseBuilder.build(session, route, provider, position, resolved.node, segment, progress);
}

module.exports = { getRuntimeSnapshot };
