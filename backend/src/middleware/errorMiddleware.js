export function notFoundHandler(req, _res, next) {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.status = 404;
  next(err);
}

export function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  res.status(status).json({
    message: status === 500 ? "Internal server error." : err.message,
    ...(err.details ? { details: err.details } : {}),
  });
}
