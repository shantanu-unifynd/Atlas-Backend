const preferenceRoutingService = require("../services/preferenceRouting.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function computeRoute(req, res, next) {
  try {
    const { graphId, originNodeId, destinationNodeId } = req.body;
    const result = await preferenceRoutingService.computeRoute(
      req.params.contextId,
      graphId,
      originNodeId,
      destinationNodeId
    );
    return successResponse(res, {
      statusCode: 200,
      message: "Preference-aware route computed successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { computeRoute };
