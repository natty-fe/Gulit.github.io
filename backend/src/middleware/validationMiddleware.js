import { validationResult } from "express-validator";
import { httpError } from "../utils/httpError.js";

export function validateRequest(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  next(httpError(400, "Validation failed.", result.array()));
}
