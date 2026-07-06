import { Router } from "express";
import authRoutes from "./authRoutes.js";
import productRoutes from "./productRoutes.js";
import orderRoutes from "./orderRoutes.js";
import complaintRoutes from "./complaintRoutes.js";
import shopRoutes from "./shopRoutes.js";
import userRoutes from "./userRoutes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/products", productRoutes);
router.use("/orders", orderRoutes);
router.use("/complaints", complaintRoutes);
router.use("/shops", shopRoutes);
router.use("/users", userRoutes);

export default router;
