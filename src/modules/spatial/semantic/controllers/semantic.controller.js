const semanticService = require("../services/semantic.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function generateSemantics(req, res, next) {
  try {
    const result = await semanticService.generateSemanticModels(req.params.usoModelId);
    return successResponse(res, {
      statusCode: 201,
      message: "Semantic Models generated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function getSemantics(req, res, next) {
  try {
    const semanticModels = await semanticService.getSemanticModels(req.params.usoModelId);
    return successResponse(res, {
      statusCode: 200,
      message: "Semantic Models fetched successfully",
      data: semanticModels,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  generateSemantics,
  getSemantics,
};
