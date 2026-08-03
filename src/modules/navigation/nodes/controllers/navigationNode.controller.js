const navigationNodeService = require("../services/navigationNode.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function generateNodes(req, res, next) {
  try {
    const result = await navigationNodeService.generateNodes(req.params.graphId);
    return successResponse(res, {
      statusCode: 201,
      message: "Navigation nodes generated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function getNodes(req, res, next) {
  try {
    const nodes = await navigationNodeService.getNodes(req.params.graphId);
    return successResponse(res, {
      statusCode: 200,
      message: "Navigation nodes fetched successfully",
      data: nodes,
    });
  } catch (error) {
    next(error);
  }
}

async function createManualNode(req, res, next) {
  try {
    const node = await navigationNodeService.createManualNode(req.params.graphId, req.body);
    return successResponse(res, {
      statusCode: 201,
      message: "Navigation node created successfully",
      data: node,
    });
  } catch (error) {
    next(error);
  }
}

async function updateManualNode(req, res, next) {
  try {
    const node = await navigationNodeService.updateManualNode(
      req.params.graphId,
      req.params.nodeId,
      req.body
    );
    return successResponse(res, {
      statusCode: 200,
      message: "Navigation node updated successfully",
      data: node,
    });
  } catch (error) {
    next(error);
  }
}

async function deleteManualNode(req, res, next) {
  try {
    await navigationNodeService.deleteManualNode(req.params.graphId, req.params.nodeId);
    return successResponse(res, {
      statusCode: 200,
      message: "Navigation node deleted successfully",
      data: null,
    });
  } catch (error) {
    next(error);
  }
}

async function importFromLabels(req, res, next) {
  try {
    const result = await navigationNodeService.importNodesFromLabels(req.params.graphId, req.body);
    return successResponse(res, {
      statusCode: 201,
      message: "Nodes imported from blueprint labels successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  generateNodes,
  getNodes,
  createManualNode,
  updateManualNode,
  deleteManualNode,
  importFromLabels,
};
