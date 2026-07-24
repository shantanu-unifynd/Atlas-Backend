const positionRuntimeService = require("../services/positionRuntime.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function getRuntimeSnapshot(req, res, next) {
  try {
    const snapshot = await positionRuntimeService.getRuntimeSnapshot(req.params.id, req.query.provider);
    return successResponse(res, {
      statusCode: 200,
      message: "Runtime position snapshot computed successfully",
      data: snapshot,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getRuntimeSnapshot };
