const routeService = require("../services/route.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function createRoute(req, res, next) {
  try {
    const route = await routeService.createRoute(req.body);
    return successResponse(res, {
      statusCode: 201,
      message: "Route created successfully",
      data: route,
    });
  } catch (error) {
    next(error);
  }
}

async function getRoutes(req, res, next) {
  try {
    const routes = await routeService.getAllRoutes(req.query);
    return successResponse(res, {
      statusCode: 200,
      message: "Routes fetched successfully",
      data: routes,
    });
  } catch (error) {
    next(error);
  }
}

async function getRouteById(req, res, next) {
  try {
    const route = await routeService.getRouteById(req.params.id);
    return successResponse(res, {
      statusCode: 200,
      message: "Route fetched successfully",
      data: route,
    });
  } catch (error) {
    next(error);
  }
}

async function deleteRoute(req, res, next) {
  try {
    await routeService.deleteRoute(req.params.id);
    return successResponse(res, {
      statusCode: 200,
      message: "Route deleted successfully",
      data: null,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createRoute,
  getRoutes,
  getRouteById,
  deleteRoute,
};
