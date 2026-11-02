const autoExtractService = require("../services/autoExtract.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function autoExtract(req, res, next) {
  try {
    const result = await autoExtractService.autoExtractFloor(
      req.params.buildingId,
      req.params.floorId
    );
    return successResponse(res, {
      statusCode: 201,
      message: "Floor auto-extracted — review the flags, then publish",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { autoExtract };
