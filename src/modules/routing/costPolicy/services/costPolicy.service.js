const loader = require("../pipeline/loader");
const policyEngine = require("../pipeline/policy-engine");
const validator = require("../pipeline/validator");
const responseBuilder = require("../pipeline/response-builder");

// Sprint 08 Story 02 — Edge Cost Policy Engine. Orchestration only. Pure
// in-memory computation: no Prisma writes anywhere in this call. Story 03
// will call this same computeEffectiveCosts function unmodified and feed
// its `effectiveCosts` directly into the existing Dijkstra engine as edge
// weights.
async function computeEffectiveCosts(contextId, graphId) {
  const { routingContext, edges } = await loader.load(graphId, contextId);

  const effectiveCosts = policyEngine.computeEffectiveCosts(edges, routingContext.preference);

  const { errors } = validator.validate(edges, effectiveCosts);

  if (errors.length > 0) {
    throw new Error(`Policy Engine produced invalid output: ${errors.join(", ")}`);
  }

  return responseBuilder.build(graphId, contextId, routingContext.preference, effectiveCosts);
}

module.exports = { computeEffectiveCosts };
