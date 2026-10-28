class Building {
  constructor({ id, name, address, city, country, timezone, status, floorCount, createdAt }) {
    this.id = id;
    this.name = name;
    this.address = address;
    this.city = city;
    this.country = country;
    this.timezone = timezone;
    this.status = status;
    // Present on list responses (floors aggregate); omitted on single-building
    // reads where floors are loaded separately.
    if (floorCount !== undefined) this.floorCount = floorCount;
    this.createdAt = createdAt;
  }
}

module.exports = Building;
