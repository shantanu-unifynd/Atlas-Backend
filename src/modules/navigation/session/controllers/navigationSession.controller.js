const navigationSessionService = require("../services/navigationSession.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function createNavigationSession(req, res, next) {
  try {
    const navigationSession = await navigationSessionService.createNavigationSession(req.body);
    return successResponse(res, {
      statusCode: 201,
      message: "Navigation Session created successfully",
      data: navigationSession,
    });
  } catch (error) {
    next(error);
  }
}

async function getNavigationSessions(req, res, next) {
  try {
    const navigationSessions = await navigationSessionService.listNavigationSessions(req.query);
    return successResponse(res, {
      statusCode: 200,
      message: "Navigation Sessions fetched successfully",
      data: navigationSessions,
    });
  } catch (error) {
    next(error);
  }
}

async function getNavigationSessionById(req, res, next) {
  try {
    const navigationSession = await navigationSessionService.getNavigationSession(req.params.id);
    return successResponse(res, {
      statusCode: 200,
      message: "Navigation Session fetched successfully",
      data: navigationSession,
    });
  } catch (error) {
    next(error);
  }
}

async function deleteNavigationSession(req, res, next) {
  try {
    await navigationSessionService.deleteNavigationSession(req.params.id);
    return successResponse(res, {
      statusCode: 200,
      message: "Navigation Session deleted successfully",
      data: null,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createNavigationSession,
  getNavigationSessions,
  getNavigationSessionById,
  deleteNavigationSession,
};
