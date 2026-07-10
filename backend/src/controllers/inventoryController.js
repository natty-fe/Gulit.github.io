import { InventoryModel } from "../models/inventoryModel.js";
import { ProductModel } from "../models/productModel.js";
import { ShopModel } from "../models/shopModel.js";
import { writeAuditLog } from "../services/auditService.js";
import { httpError } from "../utils/httpError.js";

function toInventoryPayload(body, patch = false) {
  const out = {};
  const map = {
    shopId: "shop_id",
    productId: "product_id",
    oldPrice: "old_price",
    decisionBy: "decision_by",
    decisionNote: "decision_note",
    decidedAt: "decided_at",
  };
  for (const [key, value] of Object.entries(body || {})) {
    const dest = map[key] || key;
    if (["shop_id", "product_id", "qty", "price", "old_price", "status", "decision_by", "decision_note", "decided_at"].includes(dest)) {
      out[dest] = value;
    }
  }
  if (!patch) {
    out.status = "approved";
    out.decision_note = out.decision_note || "Auto-approved because the price is inside the committee range.";
    out.decided_at = out.decided_at || new Date().toISOString();
  }
  if (out.qty !== undefined) out.qty = Number(out.qty);
  if (out.price !== undefined) out.price = Number(out.price);
  if (out.old_price !== undefined && out.old_price !== null) out.old_price = Number(out.old_price);
  return out;
}

async function requireShopAccess(shopId, user) {
  const shop = await ShopModel.findById(shopId);
  if (!shop) throw httpError(404, "Shop not found.");
  if (user.role === "owner" && shop.owner_id !== user.id) throw httpError(403, "You don't own this shop.");
  return shop;
}

async function validateListing({ shop, productId, price }) {
  if (shop.status !== "approved") throw httpError(400, "Shop must be approved before listing products.");
  const product = await ProductModel.findById(productId);
  if (!product) throw httpError(404, "Product not found.");
  const min = Number(product.min_price);
  const max = Number(product.max_price);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    throw httpError(400, "Main committee has not set a price range for this product yet.");
  }
  const value = Number(price);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw httpError(400, `Out of price range. Allowed range is ${min} to ${max} ETB.`);
  }
  return product;
}

export async function listInventory(req, res) {
  const filters = {};
  if (req.query.shopId) filters.shop_id = req.query.shopId;
  if (req.query.productId) filters.product_id = req.query.productId;
  if (req.query.status) filters.status = req.query.status;
  res.json(await InventoryModel.list(filters));
}

export async function getInventory(req, res) {
  const row = await InventoryModel.findById(req.params.id);
  if (!row) throw httpError(404, "Inventory item not found.");
  res.json(row);
}

export async function upsertInventory(req, res) {
  const payload = toInventoryPayload(req.body);
  if (!payload.shop_id || !payload.product_id) throw httpError(400, "shopId and productId are required.");
  const shop = await requireShopAccess(payload.shop_id, req.user);
  await validateListing({ shop, productId: payload.product_id, price: payload.price });

  const existing = await InventoryModel.findOne({ shop_id: payload.shop_id, product_id: payload.product_id });
  const body = {
    ...payload,
    status: "approved",
    decision_note: payload.decision_note || "Auto-approved because the price is inside the committee range.",
    decided_at: new Date().toISOString(),
  };
  const row = existing
    ? await InventoryModel.update(existing.id, body)
    : await InventoryModel.create(body);

  await writeAuditLog(req.user.id, existing ? "INVENTORY_UPDATED" : "INVENTORY_CREATED", "inventory", row.id, {
    shopId: payload.shop_id,
    productId: payload.product_id,
    qty: payload.qty,
    price: payload.price,
  });
  res.status(existing ? 200 : 201).json(row);
}

export async function updateInventory(req, res) {
  const existing = await InventoryModel.findById(req.params.id);
  if (!existing) throw httpError(404, "Inventory item not found.");
  const shop = await requireShopAccess(existing.shop_id, req.user);
  const payload = toInventoryPayload(req.body, true);
  const productId = payload.product_id || existing.product_id;
  const price = payload.price ?? existing.price;
  await validateListing({ shop, productId, price });
  const row = await InventoryModel.update(req.params.id, {
    ...payload,
    status: "approved",
    decision_note: payload.decision_note || existing.decision_note || "Auto-approved because the price is inside the committee range.",
    decided_at: new Date().toISOString(),
  });
  await writeAuditLog(req.user.id, "INVENTORY_UPDATED", "inventory", req.params.id, payload);
  res.json(row);
}

export async function deleteInventory(req, res) {
  const existing = await InventoryModel.findById(req.params.id);
  if (!existing) throw httpError(404, "Inventory item not found.");
  await requireShopAccess(existing.shop_id, req.user);
  await InventoryModel.remove(req.params.id);
  await writeAuditLog(req.user.id, "INVENTORY_REMOVED", "inventory", req.params.id);
  res.status(204).send();
}

