const comparisonService = require("../services/comparison.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function compareRoutes(req, res, next) {
  try {
    const { graphId, originNodeId, destinationNodeId, routingContextIds } = req.body;
    const result = await comparisonService.compareRoutes(
      graphId,
      originNodeId,
      destinationNodeId,
      routingContextIds
    );
    return successResponse(res, {
      statusCode: 200,
      message: "Route comparison computed successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { compareRoutes };
