const blueprintImportRepository = require("../../../../repositories/blueprintImport/blueprintImport.repository");
const normalizedBlueprintRepository = require("../../../../repositories/normalizedBlueprint/normalizedBlueprint.repository");
const buildingRepository = require("../../../../repositories/building/building.repository");
const floorRepository = require("../../../../repositories/floor/floor.repository");
const storage = require("../../processing/storage/storage");
const { validateSvgContent } = require("../validators/svg.validator");
const { parseSvg } = require("../parsers/svg.parser");
const { normalizeToAcsm } = require("../normalizers/acsm.normalizer");
const NormalizedBlueprint = require("../models/normalizedBlueprint.model");

// Registry keyed by the BlueprintImport's stored mimeType. Adding DXF/DWG/IFC
// support later means adding an entry here plus a sibling parser/validator
// module in the same shape — normalizeBlueprintImport()'s own logic, and
// every downstream consumer of the ACSM it produces, never changes.
const PARSERS_BY_MIME_TYPE = {
  "image/svg+xml": {
    sourceFormat: "svg",
    validate: validateSvgContent,
    parse: parseSvg,
  },
};

function toNormalizedBlueprint(record, blueprintImport) {
  return new NormalizedBlueprint({
    id: record.id,
    blueprintImportId: record.blueprintImportId,
    sourceFormat: record.sourceFormat,
    metadata: {
      buildingId: blueprintImport.buildingId,
      floorId: blueprintImport.floorId,
      version: blueprintImport.version,
      originalFilename: blueprintImport.originalFilename,
      checksum: blueprintImport.checksum,
      uploadedAt: blueprintImport.createdAt,
    },
    coordinateSystem: record.coordinateSystem,
    bounds: record.bounds,
    layers: record.layers,
    elements: record.elements,
    relationships: record.relationships,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
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

async function getBlueprintImportOrThrow(buildingId, floorId, importId) {
  const blueprintImport = await blueprintImportRepository.findById(importId);

  if (
    !blueprintImport ||
    blueprintImport.floorId !== floorId ||
    blueprintImport.buildingId !== buildingId
  ) {
    const error = new Error("Blueprint import not found");
    error.statusCode = 404;
    throw error;
  }

  return blueprintImport;
}

async function readStoredFile(blueprintImport) {
  try {
    return await storage.read(blueprintImport.storageKey);
  } catch {
    const error = new Error("Blueprint file is not readable from storage");
    error.statusCode = 400;
    throw error;
  }
}

async function normalizeBlueprintImport(buildingId, floorId, importId) {
  await ensureBuildingExists(buildingId);
  await ensureFloorExists(buildingId, floorId);

  const blueprintImport = await getBlueprintImportOrThrow(buildingId, floorId, importId);

  const parserEntry = PARSERS_BY_MIME_TYPE[blueprintImport.mimeType];

  if (!parserEntry) {
    const error = new Error(
      `Unsupported file type for normalization: ${blueprintImport.mimeType}`
    );
    error.statusCode = 400;
    throw error;
  }

  await blueprintImportRepository.update(blueprintImport.id, { status: "VALIDATING" });

  try {
    const buffer = await readStoredFile(blueprintImport);
    const rawText = parserEntry.validate(buffer);
    const parsed = parserEntry.parse(rawText);
    const acsm = normalizeToAcsm(parsed);

    const record = await normalizedBlueprintRepository.create({
      blueprintImportId: blueprintImport.id,
      sourceFormat: parserEntry.sourceFormat,
      coordinateSystem: acsm.coordinateSystem,
      bounds: acsm.bounds,
      layers: acsm.layers,
      elements: acsm.elements,
      relationships: acsm.relationships,
    });

    await blueprintImportRepository.update(blueprintImport.id, {
      status: "NORMALIZED",
      errorMessage: null,
    });

    return toNormalizedBlueprint(record, blueprintImport);
  } catch (error) {
    await blueprintImportRepository.update(blueprintImport.id, {
      status: "FAILED",
      errorMessage: error.message,
    });

    throw error;
  }
}

async function getAcsm(buildingId, floorId, importId) {
  await ensureBuildingExists(buildingId);
  await ensureFloorExists(buildingId, floorId);

  const blueprintImport = await getBlueprintImportOrThrow(buildingId, floorId, importId);
  const record = await normalizedBlueprintRepository.findByBlueprintImportId(importId);

  if (!record) {
    const error = new Error("ACSM not found for this blueprint import");
    error.statusCode = 404;
    throw error;
  }

  return toNormalizedBlueprint(record, blueprintImport);
}

module.exports = {
  normalizeBlueprintImport,
  getAcsm,
};
