import { DeliveryModel } from "../models/deliveryModel.js";
import { OrderModel } from "../models/orderModel.js";
import { ShopModel } from "../models/shopModel.js";
import { UserModel } from "../models/userModel.js";
import { writeAuditLog } from "../services/auditService.js";
import { httpError } from "../utils/httpError.js";

function normalizePatch(body = {}) {
  const out = {};
  const map = {
    orderId: "order_id",
    shopId: "shop_id",
    courierId: "courier_id",
    courierName: "courier_name",
    courierPhone: "courier_phone",
    confirmedAt: "confirmed_at",
  };
  for (const [key, value] of Object.entries(body)) {
    const dest = map[key] || key;
    if (["order_id", "shop_id", "courier_id", "eta", "otp", "status", "courier_name", "courier_phone", "confirmed_at"].includes(dest)) {
      out[dest] = value;
    }
  }
  return out;
}

async function requireOwnerOrder(orderId, user) {
  const order = await OrderModel.findById(orderId);
  if (!order) throw httpError(404, "Order not found.");
  const shop = await ShopModel.findById(order.shop_id);
  if (!shop) throw httpError(404, "Shop not found.");
  if (user.role === "owner" && shop.owner_id !== user.id) throw httpError(403, "Not your order.");
  return { order, shop };
}

export async function listDeliveries(req, res) {
  const filters = {};
  if (req.query.courierId) filters.courier_id = req.query.courierId;
  if (req.query.orderId) filters.order_id = req.query.orderId;
  if (req.user.role === "delivery") filters.courier_id = req.user.id;
  res.json(await DeliveryModel.list(filters));
}

export async function getDelivery(req, res) {
  const row = await DeliveryModel.findById(req.params.id);
  if (!row) throw httpError(404, "Delivery not found.");
  res.json(row);
}

export async function assignDelivery(req, res) {
  const { orderId, courierId, eta = "30-45 min" } = req.body;
  if (!orderId || !courierId) throw httpError(400, "orderId and courierId are required.");
  const { order, shop } = await requireOwnerOrder(orderId, req.user);
  const courier = await UserModel.findById(courierId);
  if (!courier || courier.role !== "delivery") throw httpError(404, "Courier not found.");
  const existing = await DeliveryModel.findOne({ order_id: orderId });
  const otp = String(1000 + Math.floor(Math.random() * 9000));
  const payload = {
    order_id: orderId,
    shop_id: shop.id,
    courier_id: courierId,
    eta,
    otp,
    status: "assigned",
    courier_name: courier.name || "",
    courier_phone: courier.phone || "",
  };
  const delivery = existing
    ? await DeliveryModel.update(existing.id, payload)
    : await DeliveryModel.create(payload);
  await OrderModel.update(order.id, { status: "preparing", delivery_id: delivery.id });
  await writeAuditLog(req.user.id, "DELIVERY_ASSIGNED", "delivery", delivery.id, { orderId, courierId });
  res.status(existing ? 200 : 201).json(delivery);
}

export async function updateDelivery(req, res) {
  const row = await DeliveryModel.findById(req.params.id);
  if (!row) throw httpError(404, "Delivery not found.");
  if (req.user.role === "delivery" && row.courier_id !== req.user.id) throw httpError(403, "Not your delivery.");
  if (req.user.role === "owner") await requireOwnerOrder(row.order_id, req.user);
  const patch = normalizePatch(req.body);
  const updated = await DeliveryModel.update(req.params.id, patch);
  const orderStatus =
    patch.status === "picked_up" ? "dispatched" :
    patch.status === "en_route" ? "dispatched" :
    patch.status === "delivered" ? "delivered" : null;
  if (orderStatus) await OrderModel.update(row.order_id, { status: orderStatus });
  await writeAuditLog(req.user.id, "DELIVERY_STATUS", "delivery", req.params.id, { status: patch.status });
  res.json(updated);
}

export async function confirmDelivery(req, res) {
  const row = await DeliveryModel.findById(req.params.id);
  if (!row) throw httpError(404, "Delivery not found.");
  if (row.courier_id !== req.user.id) throw httpError(403, "Not your delivery.");
  if (String(req.body.otp || "").trim() !== String(row.otp || "")) throw httpError(400, "Invalid OTP.");
  const now = new Date().toISOString();
  const updated = await DeliveryModel.update(req.params.id, {
    status: "delivered",
    confirmed_at: now,
  });
  await OrderModel.update(row.order_id, { status: "completed", completed_at: now });
  await writeAuditLog(req.user.id, "DELIVERY_CONFIRMED", "delivery", req.params.id, { orderId: row.order_id });
  res.json(updated);
}

