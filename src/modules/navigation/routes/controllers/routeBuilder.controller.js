const routeBuilderService = require("../services/routeBuilder.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function buildRoute(req, res, next) {
  try {
    const { graphId, originNodeId, destinationNodeId } = req.body;
    const route = await routeBuilderService.buildRoute(graphId, originNodeId, destinationNodeId);
    return successResponse(res, {
      statusCode: 201,
      message: "Route built successfully",
      data: route,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { buildRoute };
