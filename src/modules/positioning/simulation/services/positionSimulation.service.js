const navigationNodeRepository = require("../../../../repositories/navigationNode/navigationNode.repository");
const simulationLoader = require("../pipeline/simulation-loader");
const walkingEngine = require("../engine/walking-engine");
const positionGenerator = require("../engine/position-generator");
const responseBuilder = require("../pipeline/simulation-response-builder");

// Sprint 10 Story 04 — Virtual User Walking Engine. Orchestration only:
// load -> advance one logical step -> resolve that step's node -> derive
// coordinates -> build the normalized Position. No writes anywhere —
// NavigationSession/Route/RouteSegments/NavigationNode are only ever read.
async function getSimulatedPosition(sessionId) {
  const { route, segments } = await simulationLoader.loadSimulationContext(sessionId);

  const orderedSegments = [...segments].sort((a, b) => a.sequence - b.sequence);
  const totalSegments = orderedSegments.length;

  const currentStep = walkingEngine.advanceStep(sessionId, totalSegments);

  const currentNodeId =
    currentStep === 0 ? route.originNodeId : orderedSegments[currentStep - 1].targetNodeId;

  const node = await navigationNodeRepository.findById(currentNodeId);

  const coordinates = positionGenerator.deriveCoordinatesForNode(node);

  return responseBuilder.build(route.graphId, node, coordinates);
}

module.exports = { getSimulatedPosition };
