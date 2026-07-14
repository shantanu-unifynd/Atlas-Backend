const blueprintService = require("../services/blueprint.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

function createBlueprint(req, res, next) {
  try {
    const blueprint = blueprintService.createBlueprint(
      req.params.floorId,
      req.body
    );
    return successResponse(res, {
      statusCode: 201,
      message: "Blueprint created successfully",
      data: blueprint,
    });
  } catch (error) {
    next(error);
  }
}

function getBlueprint(req, res, next) {
  try {
    const blueprint = blueprintService.getBlueprintByFloorId(
      req.params.floorId
    );
    return successResponse(res, {
      statusCode: 200,
      message: "Blueprint fetched successfully",
      data: blueprint,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createBlueprint,
  getBlueprint,
};
