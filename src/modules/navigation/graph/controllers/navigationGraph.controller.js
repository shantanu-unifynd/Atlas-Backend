const navigationGraphService = require("../services/navigationGraph.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function createNavigationGraph(req, res, next) {
  try {
    const graph = await navigationGraphService.createNavigationGraph(req.body);
    return successResponse(res, {
      statusCode: 201,
      message: "Navigation Graph created successfully",
      data: graph,
    });
  } catch (error) {
    next(error);
  }
}

async function getNavigationGraphs(req, res, next) {
  try {
    const graphs = await navigationGraphService.getAllNavigationGraphs(req.query);
    return successResponse(res, {
      statusCode: 200,
      message: "Navigation Graphs fetched successfully",
      data: graphs,
    });
  } catch (error) {
    next(error);
  }
}

async function getNavigationGraphById(req, res, next) {
  try {
    const graph = await navigationGraphService.getNavigationGraphById(req.params.id);
    return successResponse(res, {
      statusCode: 200,
      message: "Navigation Graph fetched successfully",
      data: graph,
    });
  } catch (error) {
    next(error);
  }
}

async function deleteNavigationGraph(req, res, next) {
  try {
    await navigationGraphService.deleteNavigationGraph(req.params.id);
    return successResponse(res, {
      statusCode: 200,
      message: "Navigation Graph deleted successfully",
      data: null,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createNavigationGraph,
  getNavigationGraphs,
  getNavigationGraphById,
  deleteNavigationGraph,
};
