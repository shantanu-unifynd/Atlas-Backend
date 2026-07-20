const routingService = require("../services/routing.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function computeShortestPath(req, res, next) {
  try {
    const { originNodeId, destinationNodeId } = req.body;
    const result = await routingService.computeShortestPath(
      req.params.graphId,
      originNodeId,
      destinationNodeId
    );
    return successResponse(res, {
      statusCode: 200,
      message: "Shortest path computed successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  computeShortestPath,
};
