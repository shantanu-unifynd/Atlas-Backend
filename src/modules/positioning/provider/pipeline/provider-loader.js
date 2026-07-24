const MockPositionProvider = require("../providers/mock/mockPosition.provider");

// Stage 1 — Provider Loader. Resolves and instantiates the configured
// Position Provider. Only MOCK exists in Sprint 10 — BLE/WiFi/QR/UWB/
// VisualSLAM/GPS are registry entries for future stories to fill in, not
// implemented here.
const PROVIDERS = {
  MOCK: MockPositionProvider,
};

const DEFAULT_PROVIDER = "MOCK";

function loadProvider(providerName = DEFAULT_PROVIDER) {
  const ProviderClass = PROVIDERS[providerName];

  if (!ProviderClass) {
    const error = new Error(`Unsupported position provider '${providerName}'`);
    error.statusCode = 400;
    throw error;
  }

  return new ProviderClass();
}

module.exports = { loadProvider, PROVIDERS, DEFAULT_PROVIDER };
