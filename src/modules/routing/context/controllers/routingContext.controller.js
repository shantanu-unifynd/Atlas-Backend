const routingContextService = require("../services/routingContext.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function createRoutingContext(req, res, next) {
  try {
    const routingContext = await routingContextService.createRoutingContext(req.body);
    return successResponse(res, {
      statusCode: 201,
      message: "Routing Context created successfully",
      data: routingContext,
    });
  } catch (error) {
    next(error);
  }
}

async function getRoutingContexts(req, res, next) {
  try {
    const routingContexts = await routingContextService.listRoutingContexts(req.query);
    return successResponse(res, {
      statusCode: 200,
      message: "Routing Contexts fetched successfully",
      data: routingContexts,
    });
  } catch (error) {
    next(error);
  }
}

async function getRoutingContextById(req, res, next) {
  try {
    const routingContext = await routingContextService.getRoutingContext(req.params.id);
    return successResponse(res, {
      statusCode: 200,
      message: "Routing Context fetched successfully",
      data: routingContext,
    });
  } catch (error) {
    next(error);
  }
}

async function deleteRoutingContext(req, res, next) {
  try {
    await routingContextService.deleteRoutingContext(req.params.id);
    return successResponse(res, {
      statusCode: 200,
      message: "Routing Context deleted successfully",
      data: null,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createRoutingContext,
  getRoutingContexts,
  getRoutingContextById,
  deleteRoutingContext,
};
