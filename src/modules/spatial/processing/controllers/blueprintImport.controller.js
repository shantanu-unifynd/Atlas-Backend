const blueprintImportService = require("../services/blueprintImport.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function importBlueprint(req, res, next) {
  try {
    const blueprintImport = await blueprintImportService.importBlueprint(
      req.params.buildingId,
      req.params.floorId,
      req.file
    );
    return successResponse(res, {
      statusCode: 201,
      message: "Blueprint imported successfully",
      data: blueprintImport,
    });
  } catch (error) {
    next(error);
  }
}

async function getImports(req, res, next) {
  try {
    const imports = await blueprintImportService.getImportsByFloorId(
      req.params.buildingId,
      req.params.floorId
    );
    return successResponse(res, {
      statusCode: 200,
      message: "Blueprint imports fetched successfully",
      data: imports,
    });
  } catch (error) {
    next(error);
  }
}

async function getImportById(req, res, next) {
  try {
    const blueprintImport = await blueprintImportService.getImportById(
      req.params.buildingId,
      req.params.floorId,
      req.params.importId
    );
    return successResponse(res, {
      statusCode: 200,
      message: "Blueprint import fetched successfully",
      data: blueprintImport,
    });
  } catch (error) {
    next(error);
  }
}

// Deliberately bypasses the standard {success, message, data} JSON
// envelope — this endpoint serves the raw file bytes so the frontend can
// render them directly (e.g. an <img> or inline SVG), not JSON metadata.
// Cache-Control is safe to set as long-lived/immutable because each
// upload creates a new versioned import row — an importId's file content
// never changes after creation.
async function getImportFile(req, res, next) {
  try {
    const { buffer, mimeType, checksum } = await blueprintImportService.getImportFile(
      req.params.buildingId,
      req.params.floorId,
      req.params.importId
    );

    res.set("Content-Type", mimeType);
    res.set("Content-Length", buffer.length);
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    if (checksum) {
      res.set("ETag", `"${checksum}"`);
    }

    return res.send(buffer);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  importBlueprint,
  getImports,
  getImportById,
  getImportFile,
};
