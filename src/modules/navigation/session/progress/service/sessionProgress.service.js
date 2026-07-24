const progressLoader = require("../pipeline/progress-loader");
const progressValidator = require("../pipeline/progress-validator");
const responseBuilder = require("../pipeline/response-builder");
const navigationNodeRepository = require("../../../../../repositories/navigationNode/navigationNode.repository");
const providerLoader = require("../../../../positioning/provider/pipeline/provider-loader");
const providerEngine = require("../../../../positioning/provider/pipeline/provider-engine");
const nodeResolver = require("../../../../positioning/runtime/pipeline/node-resolver");
const segmentResolver = require("../../../../positioning/runtime/pipeline/segment-resolver");
const progressIntegration = require("../../../../positioning/runtime/pipeline/progress-integration");
const originProgressBuilder = require("../../../../positioning/runtime/pipeline/origin-progress-builder");

// Sprint 09 Story 03 — Route Progress Engine. Rewired in Sprint 10 Story
// 03: progress is now derived entirely from Position instead of the old
// in-memory `Map<sessionId, completedSegmentCount>` simulation counter,
// which has been removed completely (no simulated segment counter remains
// anywhere in Atlas). The pure computation (progress-engine.js via
// positioning/runtime's progress-integration adapter, progress-validator.js,
// response-builder.js below) is completely unchanged — only the SOURCE of
// `completedSegmentCount` changed, reusing Sprint 10 Story 02's provider
// pipeline and this story's own node/segment resolvers unchanged. Story 04
// (Event Engine) and Story 05 (Session Validation) call this exact
// function unchanged and are therefore Position-driven automatically.
function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function internalError(message) {
  return new Error(message);
}

async function resolveCompletedSegmentCount(session, route, segments) {
  const provider = providerLoader.loadProvider();
  const positionRequest = { graphId: route.graphId, sourceId: session.id };

  const position = await providerEngine.callProvider(provider, positionRequest);

  const { errors: shapeErrors } = providerEngine.validatePositionShape(position);

  if (shapeErrors.length > 0) {
    throw internalError(`Position Provider produced an invalid response: ${shapeErrors.join(", ")}`);
  }

  if (position.graphId !== route.graphId) {
    throw validationError("Position is outside this route's graph");
  }

  const nodes = await navigationNodeRepository.findAllByGraphId(route.graphId);

  const resolved = nodeResolver.resolveNearestNode(position.coordinates, nodes);

  if (!resolved) {
    throw validationError("Nearest navigation node cannot be determined from the current position");
  }

  const { completedSegmentCount } = segmentResolver.resolveCurrentSegment(resolved.node.id, route, segments);

  if (completedSegmentCount === null) {
    throw validationError("Current route segment cannot be resolved from the nearest node");
  }

  return completedSegmentCount;
}

async function computeProgress(sessionId) {
  const { session, route, segments, statistics } = await progressLoader.loadProgressContext(sessionId);

  const completedSegmentCount = await resolveCompletedSegmentCount(session, route, segments);

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
      throw internalError(`Route Progress Engine produced invalid output: ${errors.join(", ")}`);
    }
  }

  return responseBuilder.build(sessionId, route.id, progress);
}

module.exports = { computeProgress };
