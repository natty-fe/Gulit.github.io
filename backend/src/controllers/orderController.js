import { OrderModel } from "../models/orderModel.js";
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
  const items = Array.isArray(req.body.items) ? req.body.items : [];
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
    shop_id: req.body.shopId || req.body.shop_id || null,
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
  const updated = await OrderModel.update(req.params.id, req.body);
  await writeAuditLog(req.user.id, "ORDER_UPDATED", "order", req.params.id, req.body);
  res.json(updated);
}
