import { Router } from "express";
import { body, query } from "express-validator";
import { authenticateJWT, authorizeRole } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validationMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { checkUnique, deleteMe, listUsers, updateMe } from "../controllers/userController.js";

const router = Router();
const roles = ["customer", "owner", "delivery", "branch", "main"];

router.post("/check-unique", asyncHandler(checkUnique));
router.get("/", authenticateJWT, authorizeRole("main", "branch", "owner"), query("role").optional().isIn(roles), validateRequest, asyncHandler(listUsers));
router.put(
  "/me",
  authenticateJWT,
  [
    body("email").optional({ values: "falsy" }).isEmail(),
    body("newPassword").optional({ values: "falsy" }).isLength({ min: 8 }),
  ],
  validateRequest,
  asyncHandler(updateMe)
);
router.delete("/me", authenticateJWT, body("password").notEmpty(), body("confirmName").notEmpty(), validateRequest, asyncHandler(deleteMe));

export default router;
