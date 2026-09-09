const { Prisma } = require("@prisma/client");
const blueprintImportRepository = require("../../../../repositories/blueprintImport/blueprintImport.repository");
const normalizedBlueprintRepository = require("../../../../repositories/normalizedBlueprint/normalizedBlueprint.repository");
const buildingRepository = require("../../../../repositories/building/building.repository");
const floorRepository = require("../../../../repositories/floor/floor.repository");
const storage = require("../../processing/storage/storage");
const { validateSvgContent } = require("../validators/svg.validator");
const { parseSvg } = require("../parsers/svg.parser");
const { validateDxfContent } = require("../validators/dxf.validator");
const { parseDxf } = require("../parsers/dxf.parser");
const { validateIfcContent } = require("../validators/ifc.validator");
const { parseIfc } = require("../parsers/ifc.parser");
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
  // P1 — DXF (CAD). parseDxf emits the same { root, layers, elements }
  // intermediate as SVG, so normalizeToAcsm and downstream run unchanged.
  "image/vnd.dxf": { sourceFormat: "dxf", validate: validateDxfContent, parse: parseDxf },
  "application/dxf": { sourceFormat: "dxf", validate: validateDxfContent, parse: parseDxf },
  "image/x-dxf": { sourceFormat: "dxf", validate: validateDxfContent, parse: parseDxf },
  // P3 — IFC (BIM). validate returns the buffer (web-ifc needs bytes) and
  // parseIfc is async; the normalize flow awaits parse for all formats. .ifc
  // has no single registered mime type, so accept the common ones clients send.
  "application/x-ifc": { sourceFormat: "ifc", validate: validateIfcContent, parse: parseIfc },
  "application/ifc": { sourceFormat: "ifc", validate: validateIfcContent, parse: parseIfc },
  "model/ifc": { sourceFormat: "ifc", validate: validateIfcContent, parse: parseIfc },
  "application/step": { sourceFormat: "ifc", validate: validateIfcContent, parse: parseIfc },
  "application/p21": { sourceFormat: "ifc", validate: validateIfcContent, parse: parseIfc },
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

function conflictError() {
  const error = new Error("This blueprint import has already been normalized");
  error.statusCode = 409;
  return error;
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

  // Checked up front so a repeat call never touches blueprintImport's status
  // at all — the import already succeeded once; this is a conflict, not a
  // new failure of this attempt.
  const existing = await normalizedBlueprintRepository.findByBlueprintImportId(importId);

  if (existing) {
    throw conflictError();
  }

  await blueprintImportRepository.update(blueprintImport.id, { status: "VALIDATING" });

  try {
    const buffer = await readStoredFile(blueprintImport);
    // validate returns whatever parse consumes (raw text for SVG/DXF, the byte
    // buffer for IFC). parse may be async (IFC/web-ifc); awaiting a synchronous
    // return (SVG/DXF) resolves immediately, so this is safe for every format.
    const validated = parserEntry.validate(buffer);
    const parsed = await parserEntry.parse(validated);
    const acsm = normalizeToAcsm(parsed);

    let record;

    try {
      record = await normalizedBlueprintRepository.create({
        blueprintImportId: blueprintImport.id,
        sourceFormat: parserEntry.sourceFormat,
        coordinateSystem: acsm.coordinateSystem,
        bounds: acsm.bounds,
        layers: acsm.layers,
        elements: acsm.elements,
        relationships: acsm.relationships,
      });
    } catch (createError) {
      if (createError instanceof Prisma.PrismaClientKnownRequestError && createError.code === "P2002") {
        // Lost a race against a concurrent normalize call for the same
        // import — the other request already succeeded, so this is a
        // conflict too, not a failure of this attempt.
        throw conflictError();
      }

      throw createError;
    }

    await blueprintImportRepository.update(blueprintImport.id, {
      status: "NORMALIZED",
      errorMessage: null,
    });

    return toNormalizedBlueprint(record, blueprintImport);
  } catch (error) {
    if (error.statusCode === 409) {
      // Not a processing failure — leave blueprintImport's status untouched
      // (it is already correctly NORMALIZED from the original call).
      throw error;
    }

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
