const mapModelService = require("../services/mapModel.service");
const { successResponse } = require("../../../../common/utils/apiResponse");
const { isRoomRemovalEnabled } = require("../../../../config/roomRemoval");

// "Remove room" write endpoints are gated: flag off -> 404 (feature invisible),
// while read-filtering stays on so existing tombstones keep being respected.
function featureDisabled() {
  const err = new Error("Not found");
  err.statusCode = 404;
  return err;
}

async function generateMapModel(req, res, next) {
  try {
    const model = await mapModelService.generate(req.params.floorId);
    return successResponse(res, {
      statusCode: 201,
      message: "Map presentation model generated successfully",
      data: model,
    });
  } catch (error) {
    next(error);
  }
}

async function getMapModel(req, res, next) {
  try {
    // Sprint 07A — ?published=true returns the single live version; otherwise
    // the latest version (unchanged default behavior).
    const published = req.query.published === "true";
    const model = await mapModelService.getByFloorId(req.params.floorId, { published });
    return successResponse(res, {
      statusCode: 200,
      message: "Map presentation model fetched successfully",
      data: model,
    });
  } catch (error) {
    next(error);
  }
}

async function publishMapModel(req, res, next) {
  try {
    const model = await mapModelService.publish(req.params.floorId);
    return successResponse(res, {
      statusCode: 200,
      message: "Map presentation model published successfully",
      data: model,
    });
  } catch (error) {
    next(error);
  }
}

async function listRoomOverrides(req, res, next) {
  try {
    const overrides = await mapModelService.listRoomOverrides(req.params.floorId);
    return successResponse(res, { statusCode: 200, message: "Room overrides fetched successfully", data: overrides });
  } catch (error) {
    next(error);
  }
}

async function createRoomOverride(req, res, next) {
  try {
    const result = await mapModelService.createRoomOverride(req.params.floorId, req.body);
    return successResponse(res, { statusCode: 201, message: "Room override created successfully", data: result });
  } catch (error) {
    next(error);
  }
}

async function updateRoomOverride(req, res, next) {
  try {
    const result = await mapModelService.updateRoomOverride(req.params.floorId, req.params.overrideId, req.body);
    return successResponse(res, { statusCode: 200, message: "Room override updated successfully", data: result });
  } catch (error) {
    next(error);
  }
}

async function deleteRoomOverride(req, res, next) {
  try {
    const result = await mapModelService.deleteRoomOverride(req.params.floorId, req.params.overrideId);
    return successResponse(res, { statusCode: 200, message: "Room override deleted successfully", data: result });
  } catch (error) {
    next(error);
  }
}

async function removeRoom(req, res, next) {
  try {
    if (!isRoomRemovalEnabled()) throw featureDisabled();
    const result = await mapModelService.removeRoom(req.params.floorId, req.params.roomId, {
      reason: (req.body && req.body.reason) || null,
    });
    return successResponse(res, { statusCode: 201, message: "Room removed successfully", data: result });
  } catch (error) {
    next(error);
  }
}

async function restoreRoom(req, res, next) {
  try {
    if (!isRoomRemovalEnabled()) throw featureDisabled();
    const result = await mapModelService.restoreRoom(req.params.floorId, req.params.roomId);
    return successResponse(res, { statusCode: 200, message: "Room restore processed", data: result });
  } catch (error) {
    next(error);
  }
}

async function listRemovedRooms(req, res, next) {
  try {
    if (!isRoomRemovalEnabled()) throw featureDisabled();
    const result = await mapModelService.listRemovedRooms(req.params.floorId);
    return successResponse(res, { statusCode: 200, message: "Removed rooms fetched successfully", data: result });
  } catch (error) {
    next(error);
  }
}

async function listContainedRooms(req, res, next) {
  try {
    if (!isRoomRemovalEnabled()) throw featureDisabled();
    const result = await mapModelService.listContainedRooms(req.params.floorId, req.params.roomId);
    return successResponse(res, { statusCode: 200, message: "Contained rooms fetched successfully", data: result });
  } catch (error) {
    next(error);
  }
}

async function removeContainedRooms(req, res, next) {
  try {
    if (!isRoomRemovalEnabled()) throw featureDisabled();
    const result = await mapModelService.removeContainedRooms(req.params.floorId, req.params.roomId, {
      reason: (req.body && req.body.reason) || null,
    });
    return successResponse(res, { statusCode: 201, message: "Contained rooms removed successfully", data: result });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  generateMapModel,
  getMapModel,
  publishMapModel,
  listRoomOverrides,
  createRoomOverride,
  updateRoomOverride,
  deleteRoomOverride,
  removeRoom,
  restoreRoom,
  listRemovedRooms,
  listContainedRooms,
  removeContainedRooms,
};
