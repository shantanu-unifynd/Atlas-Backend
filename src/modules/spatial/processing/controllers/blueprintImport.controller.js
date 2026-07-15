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

module.exports = {
  importBlueprint,
  getImports,
  getImportById,
};
