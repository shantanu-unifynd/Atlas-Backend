class Asset {
  constructor({ id, floorId, originalName, mimeType, fileSize, uploadedAt, type }) {
    this.id = id;
    this.floorId = floorId;
    this.originalName = originalName;
    this.mimeType = mimeType;
    this.fileSize = fileSize;
    this.uploadedAt = uploadedAt;
    this.type = type;
  }
}

module.exports = Asset;
