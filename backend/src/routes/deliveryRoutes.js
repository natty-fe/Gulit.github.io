import { Router } from "express";
import { body, param } from "express-validator";
import { assignDelivery, confirmDelivery, getDelivery, listDeliveries, updateDelivery } from "../controllers/deliveryController.js";
import { authenticateJWT, authorizeRole } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validationMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", authenticateJWT, authorizeRole("delivery", "owner", "branch", "main"), asyncHandler(listDeliveries));
router.get("/:id", authenticateJWT, param("id").notEmpty(), validateRequest, asyncHandler(getDelivery));
router.post(
  "/",
  authenticateJWT,
  authorizeRole("owner"),
  body("orderId").notEmpty(),
  body("courierId").notEmpty(),
  validateRequest,
  asyncHandler(assignDelivery)
);
router.put("/:id", authenticateJWT, authorizeRole("delivery", "owner"), param("id").notEmpty(), validateRequest, asyncHandler(updateDelivery));
router.post("/:id/confirm", authenticateJWT, authorizeRole("delivery"), param("id").notEmpty(), body("otp").notEmpty(), validateRequest, asyncHandler(confirmDelivery));

export default router;

