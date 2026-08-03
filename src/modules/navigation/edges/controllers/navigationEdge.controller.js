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

async function createManualEdge(req, res, next) {
  try {
    const edge = await navigationEdgeService.createManualEdge(req.params.graphId, req.body);
    return successResponse(res, {
      statusCode: 201,
      message: "Navigation edge created successfully",
      data: edge,
    });
  } catch (error) {
    next(error);
  }
}

async function deleteManualEdge(req, res, next) {
  try {
    await navigationEdgeService.deleteManualEdge(req.params.graphId, req.params.edgeId);
    return successResponse(res, {
      statusCode: 200,
      message: "Navigation edge deleted successfully",
      data: null,
    });
  } catch (error) {
    next(error);
  }
}

async function autoConnect(req, res, next) {
  try {
    const result = await navigationEdgeService.autoConnectEdges(req.params.graphId, req.body);
    return successResponse(res, {
      statusCode: 201,
      message: "Edges auto-connected successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  generateEdges,
  getEdges,
  createManualEdge,
  deleteManualEdge,
  autoConnect,
};
