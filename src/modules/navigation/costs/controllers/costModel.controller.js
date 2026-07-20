const costModelService = require("../services/costModel.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function generateCostModel(req, res, next) {
  try {
    const summary = await costModelService.generateCostModel(req.params.graphId);
    return successResponse(res, {
      statusCode: 201,
      message: "Cost model generated successfully",
      data: summary,
    });
  } catch (error) {
    next(error);
  }
}

async function getCostSummary(req, res, next) {
  try {
    const summary = await costModelService.getCostSummary(req.params.graphId);
    return successResponse(res, {
      statusCode: 200,
      message: "Cost model summary fetched successfully",
      data: summary,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  generateCostModel,
  getCostSummary,
};
