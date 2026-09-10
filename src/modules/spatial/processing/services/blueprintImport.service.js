const crypto = require("crypto");
const path = require("path");
const { Prisma } = require("@prisma/client");
const BlueprintImport = require("../models/blueprintImport.model");
const blueprintImportRepository = require("../../../../repositories/blueprintImport/blueprintImport.repository");
const buildingRepository = require("../../../../repositories/building/building.repository");
const floorRepository = require("../../../../repositories/floor/floor.repository");
const storage = require("../storage/storage");

// Story 01 only ever produces UPLOADED rows. VALIDATING/FAILED are defined so
// the schema is ready for Story 02 (actual SVG validation) to transition into
// them; this story has no logic that reaches those states itself.
const SUPPORTED_MIME_TYPES = [
  "image/svg+xml",
  "image/vnd.dxf",
  "application/dxf",
  "image/x-dxf",
  // P3 — IFC (BIM). .ifc has no single registered mime type; accept the
  // common ones clients send. Kept in sync with normalization's registry.
  "application/x-ifc",
  "application/ifc",
  "model/ifc",
  "application/step",
  "application/p21",
];

// Browsers commonly send .dxf/.ifc uploads as application/octet-stream (neither
// has a reliable registered MIME type), which would fail the allowlist. When the
// browser-provided type isn't recognized, fall back to the file extension so a
// correctly-named file is still accepted and routed to the right parser.
const EXTENSION_MIME_TYPES = {
  ".svg": "image/svg+xml",
  ".dxf": "image/vnd.dxf",
  ".ifc": "application/x-ifc",
};

function resolveMimeType(file) {
  if (SUPPORTED_MIME_TYPES.includes(file.mimetype)) {
    return file.mimetype;
  }
  const ext = path.extname(file.originalname || "").toLowerCase();
  return EXTENSION_MIME_TYPES[ext] || file.mimetype;
}

function toBlueprintImport(record) {
  return new BlueprintImport({
    id: record.id,
    buildingId: record.buildingId,
    floorId: record.floorId,
    version: record.version,
    originalFilename: record.originalFilename,
    mimeType: record.mimeType,
    fileSize: record.fileSize,
    checksum: record.checksum,
    storageProvider: record.storageProvider,
    status: record.status,
    errorMessage: record.errorMessage,
    metadata: record.metadata,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    fileUrl: `/api/buildings/${record.buildingId}/floors/${record.floorId}/blueprint-imports/${record.id}/file`,
  });
}

async function ensureBuildingExists(buildingId) {
  const building = await buildingRepository.findById(buildingId);

  if (!building) {
    const error = new Error("Building not found");
    error.statusCode = 404;
    throw error;
  }

  return building;
}

async function ensureFloorExists(buildingId, floorId) {
  const floor = await floorRepository.findById(floorId);

  if (!floor || floor.buildingId !== buildingId) {
    const error = new Error("Floor not found");
    error.statusCode = 404;
    throw error;
  }

  return floor;
}

function ensureFileSupported(file) {
  if (!file) {
    const error = new Error("file is required");
    error.statusCode = 400;
    throw error;
  }

  if (!SUPPORTED_MIME_TYPES.includes(file.mimetype)) {
    const error = new Error(
      `Unsupported file type. Allowed formats: ${SUPPORTED_MIME_TYPES.join(", ")}`
    );
    error.statusCode = 400;
    throw error;
  }
}

async function importBlueprint(buildingId, floorId, file) {
  await ensureBuildingExists(buildingId);
  await ensureFloorExists(buildingId, floorId);
  if (file) {
    file.mimetype = resolveMimeType(file);
  }
  ensureFileSupported(file);

  const checksum = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const { storageProvider, storageKey } = await storage.save(file.buffer, file.originalname);

  try {
    const nextVersion = (await blueprintImportRepository.findLatestVersion(floorId)) + 1;

    const record = await blueprintImportRepository.create({
      buildingId,
      floorId,
      version: nextVersion,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      checksum,
      storageProvider,
      storageKey,
      status: "UPLOADED",
    });

    return toBlueprintImport(record);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const conflict = new Error("A blueprint version conflict occurred, please retry");
      conflict.statusCode = 409;
      throw conflict;
    }

    throw error;
  }
}

async function getImportsByFloorId(buildingId, floorId) {
  await ensureBuildingExists(buildingId);
  await ensureFloorExists(buildingId, floorId);

  const records = await blueprintImportRepository.findAllByFloorId(floorId);

  return records.map(toBlueprintImport);
}

async function getImportById(buildingId, floorId, importId) {
  await ensureBuildingExists(buildingId);
  await ensureFloorExists(buildingId, floorId);

  const record = await blueprintImportRepository.findById(importId);

  if (!record || record.floorId !== floorId) {
    const error = new Error("Blueprint import not found");
    error.statusCode = 404;
    throw error;
  }

  return toBlueprintImport(record);
}

async function getImportFile(buildingId, floorId, importId) {
  await ensureBuildingExists(buildingId);
  await ensureFloorExists(buildingId, floorId);

  const record = await blueprintImportRepository.findById(importId);

  if (!record || record.floorId !== floorId) {
    const error = new Error("Blueprint import not found");
    error.statusCode = 404;
    throw error;
  }

  const buffer = await storage.read(record.storageKey);

  return {
    buffer,
    mimeType: record.mimeType,
    filename: record.originalFilename,
    checksum: record.checksum,
  };
}

module.exports = {
  importBlueprint,
  getImportsByFloorId,
  getImportById,
  getImportFile,
};
