const graphService = require("../services/graph.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function createGraph(req, res, next) {
  try {
    const graph = await graphService.createGraph(req.params.blueprintId);
    return successResponse(res, {
      statusCode: 201,
      message: "Navigation Graph created successfully",
      data: graph,
    });
  } catch (error) {
    next(error);
  }
}

async function getGraph(req, res, next) {
  try {
    const graph = await graphService.getGraphByBlueprintId(req.params.blueprintId);
    return successResponse(res, {
      statusCode: 200,
      message: "Navigation Graph fetched successfully",
      data: graph,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createGraph,
  getGraph,
};
