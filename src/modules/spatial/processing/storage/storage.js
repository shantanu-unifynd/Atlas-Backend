const localStorageProvider = require("./local-storage.provider");

// Storage abstraction: services depend only on this module's { save, getAbsolutePath, exists }
// contract, never on a specific backend. Adding S3/Azure/GCS later means adding a sibling
// provider file implementing the same contract and registering it below — no service or
// controller code changes.
const PROVIDERS = {
  local: localStorageProvider,
};

const ACTIVE_PROVIDER = process.env.BLUEPRINT_STORAGE_PROVIDER || "local";

if (!PROVIDERS[ACTIVE_PROVIDER]) {
  throw new Error(`Unsupported BLUEPRINT_STORAGE_PROVIDER: ${ACTIVE_PROVIDER}`);
}

module.exports = PROVIDERS[ACTIVE_PROVIDER];
