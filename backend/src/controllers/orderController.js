import { OrderModel } from "../models/orderModel.js";
import { InventoryModel } from "../models/inventoryModel.js";
import { ProductModel } from "../models/productModel.js";
import { ShopModel } from "../models/shopModel.js";
import { writeAuditLog } from "../services/auditService.js";
import { httpError } from "../utils/httpError.js";

export async function listOrders(req, res) {
  const filters = {};
  if (req.user.role === "customer") filters.customer_id = req.user.id;
  if (req.query.customerId && req.user.role !== "customer") filters.customer_id = req.query.customerId;
  if (req.query.shopId) filters.shop_id = req.query.shopId;
  if (req.query.status) filters.status = req.query.status;
  res.json(await OrderModel.list(filters));
}

export async function getOrder(req, res) {
  const order = await OrderModel.findById(req.params.id);
  if (!order) throw httpError(404, "Order not found.");
  res.json(order);
}

export async function createOrder(req, res) {
  const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
  const shopId = req.body.shopId || req.body.shop_id || null;
  if (!shopId) throw httpError(400, "shopId is required.");
  const shop = await ShopModel.findById(shopId);
  if (!shop || shop.status !== "approved") throw httpError(400, "Shop unavailable.");

  const items = [];
  for (const item of rawItems) {
    const inventoryId = item.inventoryId || item.inventory_id;
    const qty = Math.max(1, Number(item.qty || 1));
    let line = { ...item, qty };
    if (inventoryId) {
      const inv = await InventoryModel.findById(inventoryId);
      if (!inv || inv.shop_id !== shopId || inv.status !== "approved") throw httpError(400, "Inventory item unavailable.");
      if (Number(inv.qty) < qty) throw httpError(400, "Not enough stock for one or more items.");
      const product = await ProductModel.findById(inv.product_id);
      line = {
        productId: inv.product_id,
        name: product?.name || item.name || inv.product_id,
        unit: product?.unit || item.unit || "",
        qty,
        price: Number(inv.price),
        lineTotal: Number((Number(inv.price) * qty).toFixed(2)),
        inventoryId: inv.id,
      };
      await InventoryModel.update(inv.id, { qty: Math.max(0, Number(inv.qty) - qty) });
    } else {
      const price = Number(item.price || 0);
      line = {
        productId: item.productId || item.product_id || null,
        name: item.name || "Item",
        unit: item.unit || "",
        qty,
        price,
        lineTotal: Number((Number(item.lineTotal ?? price * qty)).toFixed(2)),
        inventoryId: null,
      };
    }
    items.push(line);
  }
  if (!items.length) throw httpError(400, "Cart is empty.");

  const total = Number(req.body.total ?? items.reduce((sum, item) => {
    const line = Number(item.lineTotal ?? (Number(item.price || 0) * Number(item.qty || 1)));
    return sum + (Number.isFinite(line) ? line : 0);
  }, 0).toFixed(2));
  const order = await OrderModel.create({
    items,
    total,
    payment_type: req.body.paymentType || req.body.payment_type || null,
    payment_status: req.body.paymentStatus || req.body.payment_status || null,
    payment_proofs: req.body.paymentProof ? [req.body.paymentProof] : (req.body.paymentProofs || []),
    customer_sub_city: req.body.customerSubCity || req.body.customer_sub_city || req.user.sub_city || null,
    shop_id: shopId,
    customer_id: req.user.id,
    customer_name: req.user.name,
    status: "created",
  });
  await writeAuditLog(req.user.id, "ORDER_CREATED", "order", order.id, { total: order.total });
  res.status(201).json(order);
}

export async function updateOrder(req, res) {
  const order = await OrderModel.findById(req.params.id);
  if (!order) throw httpError(404, "Order not found.");
  const patch = { ...req.body };
  if (patch.deliveryId) {
    patch.delivery_id = patch.deliveryId;
    delete patch.deliveryId;
  }
  if (patch.paymentStatus) {
    patch.payment_status = patch.paymentStatus;
    delete patch.paymentStatus;
  }
  if (patch.paymentProofs) {
    patch.payment_proofs = patch.paymentProofs;
    delete patch.paymentProofs;
  }
  if (patch.completedAt) {
    patch.completed_at = patch.completedAt;
    delete patch.completedAt;
  }
  const updated = await OrderModel.update(req.params.id, patch);
  await writeAuditLog(req.user.id, "ORDER_UPDATED", "order", req.params.id, patch);
  res.json(updated);
}
