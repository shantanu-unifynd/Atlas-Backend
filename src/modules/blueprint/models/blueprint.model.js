class Blueprint {
  constructor({
    id,
    floorId,
    assetId,
    status,
    dimensions,
    calibration,
    coordinateSystem,
    layers,
    metadata,
    createdAt,
    updatedAt,
  }) {
    this.id = id;
    this.floorId = floorId;
    this.assetId = assetId;
    this.status = status;
    this.dimensions = dimensions;
    this.calibration = calibration;
    this.coordinateSystem = coordinateSystem;
    this.layers = layers;
    this.metadata = metadata;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = Blueprint;
