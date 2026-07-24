const positionValidationService = require("../services/positionValidation.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function validatePositioning(req, res, next) {
  try {
    const result = await positionValidationService.validatePositioning(req.params.id);
    return successResponse(res, {
      statusCode: 200,
      message: "Positioning runtime validated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { validatePositioning };
