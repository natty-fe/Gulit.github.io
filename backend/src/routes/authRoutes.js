import { Router } from "express";
import { body } from "express-validator";
import { forgotPassword, login, me, register, resetPassword } from "../controllers/authController.js";
import { authenticateJWT } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validationMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
const roles = ["customer", "owner", "delivery", "branch", "main"];

router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required."),
    body("email").optional({ values: "falsy" }).isEmail().withMessage("Valid email is required."),
    body("phone").optional({ values: "falsy" }).isLength({ min: 7 }).withMessage("Phone number is too short."),
    body("password").isStrongPassword({ minLength: 8, minSymbols: 0 }).withMessage("Password must be at least 8 characters and include uppercase, lowercase, and a number."),
    body("role").isIn(roles).withMessage("Role is invalid."),
  ],
  validateRequest,
  asyncHandler(register)
);

router.post(
  "/login",
  [
    body("identifier").trim().notEmpty().withMessage("Email or phone is required."),
    body("password").notEmpty().withMessage("Password is required."),
  ],
  validateRequest,
  asyncHandler(login)
);

router.post(
  "/forgot-password",
  [
    body("identifier").trim().notEmpty().withMessage("Email or phone is required."),
  ],
  validateRequest,
  asyncHandler(forgotPassword)
);

router.post(
  "/reset-password",
  [
    body("token").trim().notEmpty().withMessage("Reset token is required."),
    body("password").isStrongPassword({ minLength: 8, minSymbols: 0 }).withMessage("Password must be at least 8 characters and include uppercase, lowercase, and a number."),
  ],
  validateRequest,
  asyncHandler(resetPassword)
);

router.get("/me", authenticateJWT, asyncHandler(me));

export default router;
