function successResponse(res, { statusCode = 200, message = "Success", data = {} } = {}) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

function errorResponse(res, { statusCode = 500, message = "Something went wrong", errors = [] } = {}) {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
}

module.exports = {
  successResponse,
  errorResponse,
};
