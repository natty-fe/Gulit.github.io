import { InventoryModel } from "../models/inventoryModel.js";
import { httpError } from "../utils/httpError.js";

function toTrend(row) {
  const current = Number(row.price);
  const previous = Number(row.old_price);
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) {
    return { pct: 0, direction: "flat", isSudden: false };
  }

  const pct = Number((((current - previous) / previous) * 100).toFixed(1));
  const direction = pct > 0 ? "up" : pct < 0 ? "down" : "flat";

  return {
    pct,
    direction,
    isSudden: Math.abs(pct) >= 10,
  };
}

function withPriceTrend(row) {
  return {
    ...row,
    priceTrend: toTrend(row),
  };
}

export async function listInventoryTrends(req, res) {
  const filters = {};
  if (req.query.shopId) filters.shop_id = req.query.shopId;
  if (req.query.productId) filters.product_id = req.query.productId;
  if (req.query.status) filters.status = req.query.status;

  const rows = await InventoryModel.list(filters);
  res.json(rows.map(withPriceTrend));
}

export async function getInventoryTrend(req, res) {
  const row = await InventoryModel.findById(req.params.id);
  if (!row) throw httpError(404, "Inventory item not found.");
  res.json(withPriceTrend(row));
}
