import { Router } from "express";
import { body } from "express-validator";
import { listComplaints, createComplaint } from "../controllers/complaintController.js";
import { authenticateJWT, authorizeRole } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validationMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", authenticateJWT, authorizeRole("customer", "branch", "main"), asyncHandler(listComplaints));
router.post("/", authenticateJWT, authorizeRole("customer"), body("order_id").notEmpty().withMessage("Order ID is required."), body("message").trim().notEmpty().withMessage("Complaint message is required."), validateRequest, asyncHandler(createComplaint));

export default router;
