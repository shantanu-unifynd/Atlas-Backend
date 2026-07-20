const routeValidationService = require("../services/routeValidation.service");
const { successResponse } = require("../../../../../common/utils/apiResponse");

async function validateRoute(req, res, next) {
  try {
    const result = await routeValidationService.validateRoute(req.params.routeId);
    return successResponse(res, {
      statusCode: 201,
      message: "Route validated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function getValidation(req, res, next) {
  try {
    const result = await routeValidationService.getValidation(req.params.routeId);
    return successResponse(res, {
      statusCode: 200,
      message: "Route validation fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  validateRoute,
  getValidation,
};
