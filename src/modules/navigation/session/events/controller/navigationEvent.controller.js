const navigationEventService = require("../service/navigationEvent.service");
const { successResponse } = require("../../../../../common/utils/apiResponse");

async function getSessionEvents(req, res, next) {
  try {
    const result = await navigationEventService.generateSessionEvents(req.params.id);
    return successResponse(res, {
      statusCode: 200,
      message: "Navigation Session events generated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getSessionEvents };
