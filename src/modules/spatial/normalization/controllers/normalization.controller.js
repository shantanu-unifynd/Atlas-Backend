const normalizationService = require("../services/normalization.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function normalize(req, res, next) {
  try {
    const acsm = await normalizationService.normalizeBlueprintImport(
      req.params.buildingId,
      req.params.floorId,
      req.params.importId
    );
    return successResponse(res, {
      statusCode: 201,
      message: "Blueprint normalized successfully",
      data: acsm,
    });
  } catch (error) {
    next(error);
  }
}

async function getAcsm(req, res, next) {
  try {
    const acsm = await normalizationService.getAcsm(
      req.params.buildingId,
      req.params.floorId,
      req.params.importId
    );
    return successResponse(res, {
      statusCode: 200,
      message: "ACSM fetched successfully",
      data: acsm,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  normalize,
  getAcsm,
};
