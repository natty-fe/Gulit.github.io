import { ShopModel } from "../models/shopModel.js";
import { writeAuditLog } from "../services/auditService.js";
import { httpError } from "../utils/httpError.js";

export async function listShops(req, res) {
  const filters = {};
  if (req.query.subCity) filters.sub_city = req.query.subCity;
  if (req.query.status) filters.status = req.query.status;
  if (req.query.ownerId) filters.owner_id = req.query.ownerId;
  res.json(await ShopModel.list(filters));
}

export async function getShop(req, res) {
  const shop = await ShopModel.findById(req.params.id);
  if (!shop) throw httpError(404, "Shop not found.");
  res.json(shop);
}

export async function createShop(req, res) {
  const payload = { ...req.body };
  if (payload.ownerId) {
    payload.owner_id = payload.ownerId;
    delete payload.ownerId;
  }
  if (payload.subCity) {
    payload.sub_city = payload.subCity;
    delete payload.subCity;
  }
  if (payload.paymentAccounts) {
    payload.payment_accounts = payload.paymentAccounts;
    delete payload.paymentAccounts;
  }
  const shop = await ShopModel.create({
    ...payload,
    owner_id: payload.owner_id || req.user.id,
    status: "pending",
  });
  await writeAuditLog(req.user.id, "SHOP_REGISTERED", "shop", shop.id);
  res.status(201).json(shop);
}

export async function updateShop(req, res) {
  const patch = { ...req.body };
  if (patch.ownerId) {
    patch.owner_id = patch.ownerId;
    delete patch.ownerId;
  }
  if (patch.subCity) {
    patch.sub_city = patch.subCity;
    delete patch.subCity;
  }
  if (patch.paymentAccounts) {
    patch.payment_accounts = patch.paymentAccounts;
    delete patch.paymentAccounts;
  }
  const shop = await ShopModel.update(req.params.id, patch);
  if (!shop) throw httpError(404, "Shop not found.");
  await writeAuditLog(req.user.id, "SHOP_UPDATED", "shop", req.params.id, patch);
  res.json(shop);
}

export async function approveShop(req, res) {
  const shop = await ShopModel.update(req.params.id, {
    status: "approved",
    approved_by: req.user.id,
    approved_at: new Date().toISOString(),
  });
  if (!shop) throw httpError(404, "Shop not found.");
  await writeAuditLog(req.user.id, "SHOP_APPROVED", "shop", req.params.id);
  res.json(shop);
}
