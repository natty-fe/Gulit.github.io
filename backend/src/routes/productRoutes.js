import { Router } from "express";
import { body, param } from "express-validator";
import { authenticateJWT, authorizeRole } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validationMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createProduct, deleteProduct, getProduct, listProducts, updateProduct } from "../controllers/productController.js";

const router = Router();

router.get("/", asyncHandler(listProducts));
router.get("/:id", param("id").notEmpty(), validateRequest, asyncHandler(getProduct));
router.post("/", authenticateJWT, authorizeRole("main", "branch"), body("name").trim().notEmpty(), body("price").optional().isFloat({ min: 0 }), validateRequest, asyncHandler(createProduct));
router.put("/:id", authenticateJWT, authorizeRole("main", "branch"), param("id").notEmpty(), validateRequest, asyncHandler(updateProduct));
router.delete("/:id", authenticateJWT, authorizeRole("main"), param("id").notEmpty(), validateRequest, asyncHandler(deleteProduct));

export default router;
