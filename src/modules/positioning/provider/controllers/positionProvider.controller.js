const positionProviderService = require("../services/positionProvider.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function getCurrentPosition(req, res, next) {
  try {
    const { graphId, sourceId, provider } = req.query;
    const position = await positionProviderService.getCurrentPosition({
      graphId,
      sourceId,
      providerName: provider,
    });

    return successResponse(res, {
      statusCode: 200,
      message: "Current position retrieved successfully",
      data: position,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getCurrentPosition };
