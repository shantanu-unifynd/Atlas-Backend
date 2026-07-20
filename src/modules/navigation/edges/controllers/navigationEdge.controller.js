const navigationEdgeService = require("../services/navigationEdge.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function generateEdges(req, res, next) {
  try {
    const result = await navigationEdgeService.generateEdges(req.params.graphId);
    return successResponse(res, {
      statusCode: 201,
      message: "Navigation edges generated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function getEdges(req, res, next) {
  try {
    const edges = await navigationEdgeService.getEdges(req.params.graphId);
    return successResponse(res, {
      statusCode: 200,
      message: "Navigation edges fetched successfully",
      data: edges,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  generateEdges,
  getEdges,
};
