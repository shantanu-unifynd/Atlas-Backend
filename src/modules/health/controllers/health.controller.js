const { checkDatabaseConnection } = require("../../../config/database");
const { successResponse, errorResponse } = require("../../../common/utils/apiResponse");

async function getDatabaseHealth(req, res) {
  try {
    await checkDatabaseConnection();
    return successResponse(res, {
      statusCode: 200,
      message: "Database connection healthy",
    });
  } catch (error) {
    return errorResponse(res, {
      statusCode: 503,
      message: "Database connection unavailable",
      errors: [error.message],
    });
  }
}

module.exports = {
  getDatabaseHealth,
};
