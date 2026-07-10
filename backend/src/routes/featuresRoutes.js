import { Router } from "express";
import { body, param, query } from "express-validator";
import { listFavorites, getInventoryTrend, listInventoryTrends, toggleFavorite } from "../controllers/featuresController.js";
import { authenticateJWT } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validationMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get(
  "/favorites",
  authenticateJWT,
  query("type").optional().isIn(["shop", "product"]),
  validateRequest,
  asyncHandler(listFavorites)
);

router.post(
  "/favorites/toggle",
  authenticateJWT,
  body("targetType").isIn(["shop", "product"]),
  body("targetId").trim().notEmpty(),
  validateRequest,
  asyncHandler(toggleFavorite)
);

router.get("/inventory-trends", asyncHandler(listInventoryTrends));
router.get("/inventory-trends/:id", param("id").notEmpty(), validateRequest, asyncHandler(getInventoryTrend));

export default router;
