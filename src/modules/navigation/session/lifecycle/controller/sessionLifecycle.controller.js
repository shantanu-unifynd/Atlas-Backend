const sessionLifecycleService = require("../service/sessionLifecycle.service");
const { successResponse } = require("../../../../../common/utils/apiResponse");

function makeTransitionHandler(transition, message) {
  return async function handleTransition(req, res, next) {
    try {
      const result = await sessionLifecycleService.performTransition(req.params.id, transition);
      return successResponse(res, {
        statusCode: 200,
        message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  start: makeTransitionHandler("START", "Navigation Session started successfully"),
  pause: makeTransitionHandler("PAUSE", "Navigation Session paused successfully"),
  resume: makeTransitionHandler("RESUME", "Navigation Session resumed successfully"),
  cancel: makeTransitionHandler("CANCEL", "Navigation Session cancelled successfully"),
  complete: makeTransitionHandler("COMPLETE", "Navigation Session completed successfully"),
};
