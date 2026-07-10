const multer = require("multer");
const { errorResponse } = require("../utils/apiResponse");

function errorHandler(err, req, res, next) {
  const statusCode = err instanceof multer.MulterError ? 400 : err.statusCode || 500;
  const message = err.message || "Something went wrong";

  return errorResponse(res, {
    statusCode,
    message,
    errors: err.errors || [message],
  });
}

module.exports = errorHandler;
