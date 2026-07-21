const routingValidationService = require("../services/routingValidation.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function validateRouting(req, res, next) {
  try {
    const { graphId, originNodeId, destinationNodeId, routingContextIds } = req.body;
    const result = await routingValidationService.validateRouting(
      graphId,
      originNodeId,
      destinationNodeId,
      routingContextIds
    );
    return successResponse(res, {
      statusCode: 200,
      message: "Routing validation computed successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { validateRouting };
