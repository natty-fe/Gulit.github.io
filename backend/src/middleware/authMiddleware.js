import { UserModel } from "../models/userModel.js";
import { verifyToken } from "../services/tokenService.js";
import { httpError } from "../utils/httpError.js";

export async function authenticateJWT(req, _res, next) {
  try {
    const header = req.get("Authorization") || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) throw httpError(401, "Authentication required.");

    const payload = verifyToken(token);
    const user = await UserModel.findById(payload.sub);
    if (!user) throw httpError(401, "Invalid authentication token.");

    const { password_hash, passwordHash, ...safeUser } = user;
    req.user = safeUser;
    next();
  } catch (err) {
    next(err.status ? err : httpError(401, "Invalid or expired authentication token."));
  }
}

export function authorizeRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(httpError(401, "Authentication required."));
    if (!roles.includes(req.user.role)) {
      return next(httpError(403, "You do not have permission to perform this action."));
    }
    next();
  };
}
