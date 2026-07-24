// Sprint 10 Story 02 — Position Provider contract. Every current and
// future positioning technology (Mock, BLE, Wi-Fi, UWB, QR, Visual SLAM,
// GPS) implements this same shape. The Runtime (Story 03) depends only on
// this contract, never on a concrete provider.
//
// A provider returns Position objects entirely IN MEMORY — it must never
// query/insert/update PostgreSQL and must never depend on
// PositionRepository. Story 01's `positions` table is a future
// persistence/history domain, not the source of live positioning.
class PositionProvider {
  // eslint-disable-next-line no-unused-vars
  async getCurrentPosition(request) {
    throw new Error("getCurrentPosition() must be implemented by a concrete Position Provider");
  }

  getProviderName() {
    throw new Error("getProviderName() must be implemented by a concrete Position Provider");
  }
}

module.exports = PositionProvider;
