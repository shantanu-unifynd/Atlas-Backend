const navigationCandidateService = require("../services/navigationCandidate.service");
const { successResponse } = require("../../../../common/utils/apiResponse");

async function generateCandidates(req, res, next) {
  try {
    const result = await navigationCandidateService.generateCandidates(req.params.graphId);
    return successResponse(res, {
      statusCode: 201,
      message: "Navigation candidates generated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

async function getCandidates(req, res, next) {
  try {
    const candidates = await navigationCandidateService.getCandidates(req.params.graphId);
    return successResponse(res, {
      statusCode: 200,
      message: "Navigation candidates fetched successfully",
      data: candidates,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  generateCandidates,
  getCandidates,
};
