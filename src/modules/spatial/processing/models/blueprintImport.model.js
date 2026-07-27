class BlueprintImport {
  constructor({
    id,
    buildingId,
    floorId,
    version,
    originalFilename,
    mimeType,
    fileSize,
    checksum,
    storageProvider,
    status,
    errorMessage,
    metadata,
    createdAt,
    updatedAt,
    fileUrl,
  }) {
    this.id = id;
    this.buildingId = buildingId;
    this.floorId = floorId;
    this.version = version;
    this.originalFilename = originalFilename;
    this.mimeType = mimeType;
    this.fileSize = fileSize;
    this.checksum = checksum;
    this.storageProvider = storageProvider;
    this.status = status;
    this.errorMessage = errorMessage;
    this.metadata = metadata;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.fileUrl = fileUrl;
  }
}

module.exports = BlueprintImport;
