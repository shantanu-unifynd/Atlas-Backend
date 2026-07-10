const assetService = require("../services/asset.service");
const { successResponse } = require("../../../common/utils/apiResponse");

function uploadAsset(req, res, next) {
  try {
    const asset = assetService.createAsset(req.params.floorId, req.file);
    return successResponse(res, {
      statusCode: 201,
      message: "Asset uploaded successfully",
      data: asset,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  uploadAsset,
};
