class Floor {
  constructor({ id, buildingId, name, level, blueprint, status, createdAt }) {
    this.id = id;
    this.buildingId = buildingId;
    this.name = name;
    this.level = level;
    this.blueprint = blueprint;
    this.status = status;
    this.createdAt = createdAt;
  }
}

module.exports = Floor;
