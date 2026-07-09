const { errorResponse } = require("../utils/apiResponse");

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Something went wrong";

  return errorResponse(res, {
    statusCode,
    message,
    errors: err.errors || [message],
  });
}

module.exports = errorHandler;
