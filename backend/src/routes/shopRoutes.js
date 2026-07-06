import { Router } from "express";
import { body, param } from "express-validator";
import { listShops, getShop, createShop, updateShop, approveShop } from "../controllers/shopController.js";
import { authenticateJWT, authorizeRole } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validationMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(listShops));
router.get("/:id", param("id").notEmpty(), validateRequest, asyncHandler(getShop));
router.post("/", authenticateJWT, authorizeRole("owner", "branch", "main"), body("name").trim().notEmpty(), body("sub_city").optional().notEmpty(), validateRequest, asyncHandler(createShop));
router.put("/:id", authenticateJWT, authorizeRole("owner", "branch", "main"), param("id").notEmpty(), validateRequest, asyncHandler(updateShop));
router.put("/:id/approve", authenticateJWT, authorizeRole("branch", "main"), param("id").notEmpty(), validateRequest, asyncHandler(approveShop));

export default router;
