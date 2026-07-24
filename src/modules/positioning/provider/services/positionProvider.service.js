const providerLoader = require("../pipeline/provider-loader");
const providerEngine = require("../pipeline/provider-engine");
const responseBuilder = require("../pipeline/response-builder");

// Sprint 10 Story 02 — Position Provider Framework. Orchestration only:
// load the configured provider -> call it -> build the normalized
// response. No database, no runtime, no movement, no progress — nothing
// is ever persisted here.
function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function internalError(message) {
  return new Error(message);
}

async function getCurrentPosition({ graphId, sourceId, providerName }) {
  const { errors: requestErrors } = providerEngine.validateRequest({ graphId });

  if (requestErrors.length > 0) {
    throw validationError(requestErrors.join(", "));
  }

  const provider = providerLoader.loadProvider(providerName);

  const position = await providerEngine.callProvider(provider, { graphId, sourceId });

  const { errors: shapeErrors } = providerEngine.validatePositionShape(position);

  if (shapeErrors.length > 0) {
    throw internalError(`Position Provider produced an invalid response: ${shapeErrors.join(", ")}`);
  }

  return responseBuilder.build(position, provider.getProviderName());
}

module.exports = { getCurrentPosition };
