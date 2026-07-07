import { Router } from "express";
import { body, param } from "express-validator";
import { deleteInventory, getInventory, listInventory, updateInventory, upsertInventory } from "../controllers/inventoryController.js";
import { authenticateJWT, authorizeRole } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validationMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(listInventory));
router.get("/:id", param("id").notEmpty(), validateRequest, asyncHandler(getInventory));
router.post(
  "/",
  authenticateJWT,
  authorizeRole("owner", "branch", "main"),
  body("shopId").notEmpty(),
  body("productId").notEmpty(),
  body("qty").isFloat({ min: 0 }),
  body("price").isFloat({ min: 0 }),
  validateRequest,
  asyncHandler(upsertInventory)
);
router.put(
  "/:id",
  authenticateJWT,
  authorizeRole("owner", "branch", "main"),
  param("id").notEmpty(),
  validateRequest,
  asyncHandler(updateInventory)
);
router.delete("/:id", authenticateJWT, authorizeRole("owner", "branch", "main"), param("id").notEmpty(), validateRequest, asyncHandler(deleteInventory));

export default router;

