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

module.exports = {
  generateNodes,
  getNodes,
};
