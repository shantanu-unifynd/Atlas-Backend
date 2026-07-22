const navigationSessionValidationService = require("../service/navigationSessionValidation.service");
const { successResponse } = require("../../../../../common/utils/apiResponse");

async function validateSession(req, res, next) {
  try {
    const result = await navigationSessionValidationService.validateSession(req.params.id);
    return successResponse(res, {
      statusCode: 200,
      message: "Navigation Session validated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { validateSession };
