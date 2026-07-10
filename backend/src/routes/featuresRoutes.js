import { Router } from "express";
import { param } from "express-validator";
import { getInventoryTrend, listInventoryTrends } from "../controllers/featuresController.js";
import { validateRequest } from "../middleware/validationMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/inventory-trends", asyncHandler(listInventoryTrends));
router.get("/inventory-trends/:id", param("id").notEmpty(), validateRequest, asyncHandler(getInventoryTrend));

export default router;
