// Map Presentation Model (MPM) — a render-ready, floor-scoped, versioned view
// that a client fetches and draws. MPM-01 establishes the framework only:
// metadata + version + floor reference + placeholders for rooms/walls/labels +
// the existing navigation graph output. Coordinate normalization, room/wall/
// label generation and manual editing are deliberately later stories.
class MapPresentationModel {
  constructor({ id, floorId, version, status, navigationGraphId, data, createdAt, updatedAt }) {
    this.id = id;
    this.floorId = floorId;
    this.version = version;
    this.status = status;
    this.navigationGraphId = navigationGraphId;
    this.data = data;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = MapPresentationModel;
