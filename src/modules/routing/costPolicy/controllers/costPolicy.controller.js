const costPolicyService = require("../services/costPolicy.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function computeEffectiveCosts(req, res, next) {
  try {
    const result = await costPolicyService.computeEffectiveCosts(
      req.params.contextId,
      req.body.graphId
    );
    return successResponse(res, {
      statusCode: 200,
      message: "Effective costs computed successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { computeEffectiveCosts };
