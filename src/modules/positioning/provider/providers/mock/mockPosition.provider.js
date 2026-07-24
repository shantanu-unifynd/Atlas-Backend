const PositionProvider = require("../../contracts/positionProvider.contract");
const { deriveCoordinates } = require("../../../simulation/utils/deterministicHash");
const positionSimulationService = require("../../../simulation/services/positionSimulation.service");

const PROVIDER_NAME = "MOCK";

// Sprint 10 Story 04 — the provider now DELEGATES to the Virtual User
// Walking Engine (positioning/simulation) rather than owning any walking
// logic itself, exactly as the Provider contract intends: it remains
// responsible only for exposing a Position, never for deciding how that
// Position is computed.
//
// `sourceId` is tried first as a real NavigationSession id (Sprint 10
// Story 03's calling convention: sourceId === sessionId). If it resolves,
// the walking engine deterministically advances that session's simulated
// position by one route segment per call. If it does NOT resolve to a
// real session (a 404 from the simulation pipeline) — e.g. Sprint 10
// Story 02's own generic, session-agnostic callers passing an arbitrary
// device identifier — this falls back to the ORIGINAL static deterministic
// hash of (graphId, sourceId), preserving Story 02's endpoint contract
// completely unchanged.
class MockPositionProvider extends PositionProvider {
  async getCurrentPosition({ graphId, sourceId = "default" }) {
    try {
      return await positionSimulationService.getSimulatedPosition(sourceId);
    } catch (error) {
      if (error.statusCode === 404) {
        return {
          graphId,
          source: PROVIDER_NAME,
          coordinates: deriveCoordinates(`${graphId}:${sourceId}`),
          recordedAt: new Date().toISOString(),
          metadata: {},
        };
      }

      throw error;
    }
  }

  getProviderName() {
    return PROVIDER_NAME;
  }
}

module.exports = MockPositionProvider;
