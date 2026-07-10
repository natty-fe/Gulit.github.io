import { Router } from "express";
import { body, param } from "express-validator";
import { listOrders, getOrder, createOrder, updateOrder } from "../controllers/orderController.js";
import { authenticateJWT, authorizeRole } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validationMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", authenticateJWT, asyncHandler(listOrders));
router.get("/:id", authenticateJWT, param("id").notEmpty(), validateRequest, asyncHandler(getOrder));
router.post("/", authenticateJWT, authorizeRole("customer"), body("items").isArray({ min: 1 }), body("total").optional().isFloat({ min: 0 }), validateRequest, asyncHandler(createOrder));
router.put("/:id", authenticateJWT, authorizeRole("owner", "delivery", "branch", "main"), param("id").notEmpty(), validateRequest, asyncHandler(updateOrder));

export default router;
