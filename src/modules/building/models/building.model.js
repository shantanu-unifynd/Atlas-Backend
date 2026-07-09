class Building {
  constructor({ id, name, address, city, country, timezone, createdAt }) {
    this.id = id;
    this.name = name;
    this.address = address;
    this.city = city;
    this.country = country;
    this.timezone = timezone;
    this.createdAt = createdAt;
  }
}

module.exports = Building;
