const sessionProgressService = require("../service/sessionProgress.service");
const { successResponse } = require("../../../../../common/utils/apiResponse");

async function getSessionProgress(req, res, next) {
  try {
    const progress = await sessionProgressService.computeProgress(req.params.id);
    return successResponse(res, {
      statusCode: 200,
      message: "Navigation Session progress computed successfully",
      data: progress,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getSessionProgress };
