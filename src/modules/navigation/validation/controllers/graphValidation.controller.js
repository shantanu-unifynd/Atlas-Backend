const graphValidationService = require("../services/graphValidation.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function validateGraph(req, res, next) {
  try {
    const result = await graphValidationService.validateGraph(req.params.graphId);
    return successResponse(res, {
      statusCode: 201,
      message: "Navigation graph validated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function getValidation(req, res, next) {
  try {
    const report = await graphValidationService.getLatestValidation(req.params.graphId);
    return successResponse(res, {
      statusCode: 200,
      message: "Navigation graph validation report fetched successfully",
      data: report,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  validateGraph,
  getValidation,
};
