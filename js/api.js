// js/api.js
// REST-like API surface backed by db.js. Each method is async and validates
// inputs/role permissions/state transitions, mirroring what a Spring Boot
// controller + service layer would do server-side. A real backend can replace
// this file by exporting the same shape over fetch() without view changes.

import { DB } from "./db.js";
import { Auth } from "./auth.js";
import { SUB_CITIES } from "./seed.js";
import { apiRequest, isBackendApiEnabled } from "./http.js";

// Tiny artificial latency to mimic network calls (and let UI show loading).
const sleep = (ms = 80) => new Promise((r) => setTimeout(r, ms));
const ACTIVE_USER_WINDOW_MS = 30 * 60 * 1000;

function queryString(params = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "" && value !== "All") qs.set(key, value);
  }
  const out = qs.toString();
  return out ? `?${out}` : "";
}

function normalizeShop(s) {
  if (!s) return s;
  return {
    ...s,
    ownerId: s.ownerId ?? s.owner_id,
    subCity: s.subCity ?? s.sub_city,
    branchCommitteeId: s.branchCommitteeId ?? s.branch_committee_id,
    paymentAccounts: s.paymentAccounts ?? s.payment_accounts ?? [],
    approvedBy: s.approvedBy ?? s.approved_by,
    approvedAt: s.approvedAt ?? s.approved_at,
    statusReason: s.statusReason ?? s.status_reason,
    createdAt: s.createdAt ?? s.created_at,
    updatedAt: s.updatedAt ?? s.updated_at,
  };
}

function cacheShopLocal(shop) {
  const s = normalizeShop(shop);
  if (!s?.id) return null;
  const existing = DB.byId("shops", s.id);
  if (existing) return DB.update("shops", s.id, { ...existing, ...s });
  return DB.insert("shops", s);
}

function normalizeOrder(o) {
  if (!o) return o;
  return {
    ...o,
    customerId: o.customerId ?? o.customer_id,
    customerName: o.customerName ?? o.customer_name,
    customerSubCity: o.customerSubCity ?? o.customer_sub_city,
    shopId: o.shopId ?? o.shop_id,
    paymentType: o.paymentType ?? o.payment_type,
    paymentStatus: o.paymentStatus ?? o.payment_status,
    paymentProofs: o.paymentProofs ?? o.payment_proofs ?? [],
    deliveryId: o.deliveryId ?? o.delivery_id,
    completedAt: o.completedAt ?? o.completed_at,
    createdAt: o.createdAt ?? o.created_at,
    updatedAt: o.updatedAt ?? o.updated_at,
  };
}

function normalizeComplaint(c) {
  if (!c) return c;
  return {
    ...c,
    orderId: c.orderId ?? c.order_id,
    shopId: c.shopId ?? c.shop_id,
    fromId: c.fromId ?? c.from_id,
    fromName: c.fromName ?? c.from_name,
    decisionNote: c.decisionNote ?? c.decision_note,
    decisionBy: c.decisionBy ?? c.decision_by,
    wantsRefund: c.wantsRefund ?? c.wants_refund,
    createdAt: c.createdAt ?? c.created_at,
    updatedAt: c.updatedAt ?? c.updated_at,
  };
}

function normalizeProduct(p) {
  if (!p) return p;
  return {
    ...p,
    nameAm: p.nameAm ?? p.name_am,
    createdAt: p.createdAt ?? p.created_at,
    updatedAt: p.updatedAt ?? p.updated_at,
  };
}

function normalizeUser(u) {
  if (!u) return u;
  return {
    ...u,
    subCity: u.subCity ?? u.sub_city,
    committeeId: u.committeeId ?? u.committee_id,
    workId: u.workId ?? u.work_id,
    faydaFan: u.faydaFan ?? u.fayda_fan,
    createdAt: u.createdAt ?? u.created_at,
    updatedAt: u.updatedAt ?? u.updated_at,
  };
}

function cacheUserLocal(user) {
  const u = normalizeUser(user);
  if (!u?.id) return null;
  const existing = DB.byId("users", u.id);
  if (existing) return DB.update("users", u.id, { ...existing, ...u });
  return DB.insert("users", u);
}

function cacheProductLocal(product) {
  const p = normalizeProduct(product);
  if (!p?.id) return null;
  const existing = DB.byId("products", p.id);
  if (existing) {
    return DB.update("products", p.id, {
      ...p,
      nameAm: p.nameAm || existing.nameAm,
      unit: p.unit || existing.unit,
      icon: p.icon || existing.icon,
      image: p.image || existing.image,
    });
  }
  return DB.insert("products", p);
}

function productMatches({ q = "", category = "All" } = {}) {
  const ql = String(q || "").trim().toLowerCase();
  return (p) => {
    const haystack = `${p.name || ""} ${p.nameAm || ""} ${p.category || ""}`.toLowerCase();
    const okCat = category === "All" || p.category === category;
    const okQ = !ql || haystack.includes(ql);
    return okCat && okQ;
  };
}

function shopMatches({ subCity, status } = {}) {
  return (s) => (!subCity || s.subCity === subCity) && (!status || s.status === status);
}

function shopDisplayKey(shop) {
  const s = normalizeShop(shop);
  const name = String(s?.name || "").trim().toLowerCase();
  const city = String(s?.subCity || "").trim().toLowerCase();
  return name && city ? `${name}|${city}` : s?.id;
}

function mergeShops(localRows = [], backendRows = []) {
  const byKey = new Map();
  for (const row of localRows) {
    const shop = normalizeShop(row);
    const key = shopDisplayKey(shop);
    if (key && !byKey.has(key)) byKey.set(key, shop);
  }
  for (const row of backendRows) {
    const shop = cacheShopLocal(row);
    const key = shopDisplayKey(shop);
    if (key) byKey.set(key, shop);
  }
  return [...byKey.values()];
}

function audit(actorId, action, entity, entityId, details = {}) {
  DB.insert("auditLogs", {
    actorId, action, entity, entityId,
    details, timestamp: new Date().toISOString(),
  });
}

// Notifications are addressed to either a user (recipientType="user") or a
// committee inbox (recipientType="committee" + recipientId=committeeId, or
// recipientType="main" for the main committee broadcast).
function notify({ recipientType, recipientId = null, type, title, body = "", data = {} }) {
  return DB.insert("notifications", {
    recipientType, recipientId, type, title, body, data, read: false,
  });
}

function mainCommitteeId() {
  const c = DB.find("committees", (x) => x.type === "main");
  return c ? c.id : null;
}

// Normalize a list of payment account entries from the UI. Each must have a
// bank name, account name, and account number. Empty/invalid rows dropped.
function sanitizePaymentAccounts(list) {
  if (!Array.isArray(list)) return [];
  return list.map((a) => ({
    id:            String(a.id || "").trim() || DB.id("pay"),
    bankName:      String(a.bankName || "").trim(),
    accountName:   String(a.accountName || "").trim(),
    accountNumber: String(a.accountNumber || "").trim(),
  })).filter((a) => a.bankName && a.accountName && a.accountNumber);
}

// ------------------ PRODUCTS & PRICING ------------------
export const Products = {
  async list({ q = "", category = "All" } = {}) {
    const byId = new Map(DB.all("products").map((p) => [p.id, normalizeProduct(p)]));
    if (isBackendApiEnabled()) {
      try {
        const backendProducts = await apiRequest("/products");
        for (const row of backendProducts) {
          const product = cacheProductLocal(row);
          if (!product) continue;
          const current = byId.get(product.id) || {};
          byId.set(product.id, {
            ...current,
            ...normalizeProduct(product),
            nameAm: product.nameAm || current.nameAm,
            icon: product.icon || current.icon,
            image: product.image || current.image,
            unit: product.unit || current.unit,
          });
        }
      } catch (err) {
        console.warn("Backend product catalog unavailable; using local catalog.", err.message);
      }
      return [...byId.values()].filter(productMatches({ q, category }));
    }
    await sleep();
    return [...byId.values()].filter(productMatches({ q, category }));
  },
  async byId(id) {
    if (isBackendApiEnabled()) {
      try {
        const backendProduct = await apiRequest(`/products/${encodeURIComponent(id)}`);
        return cacheProductLocal(backendProduct);
      } catch (err) {
        console.warn("Backend product lookup unavailable; using local catalog.", err.message);
      }
    }
    await sleep();
    return normalizeProduct(DB.byId("products", id));
  },
};

export const PriceRanges = {
  async list() {
    await sleep();
    // For each product, return the most recent effective range.
    const all = DB.all("priceRanges").sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
    const map = new Map();
    for (const r of all) if (!map.has(r.productId)) map.set(r.productId, r);
    return [...map.values()];
  },
  async byProduct(productId) {
    const all = await PriceRanges.list();
    return all.find((r) => r.productId === productId) || null;
  },
  async set({ productId, minPrice, maxPrice }) {
    const u = Auth.require(["main"]);
    if (!productId) throw new Error("productId required");
    if (!(minPrice >= 0) || !(maxPrice > minPrice)) throw new Error("Invalid price range.");
    const row = DB.insert("priceRanges", {
      productId, minPrice: Number(minPrice), maxPrice: Number(maxPrice),
      effectiveDate: new Date().toISOString(), setBy: u.id,
    });
    audit(u.id, "PRICE_RANGE_SET", "priceRange", row.id, { productId, minPrice, maxPrice });
    return row;
  },
};

// ------------------ SHOPS ------------------
export const Shops = {
  async list({ subCity, status = "approved" } = {}) {
    const localRows = DB.all("shops").map(normalizeShop);
    if (isBackendApiEnabled()) {
      let backendRows = [];
      try {
        backendRows = await apiRequest(`/shops${queryString({ subCity, status })}`);
      } catch (err) {
        console.warn("Backend shop list unavailable; using local cache.", err.message);
      }
      return mergeShops(localRows, backendRows).filter(shopMatches({ subCity, status }));
    }
    await sleep();
    return localRows.filter(shopMatches({ subCity, status }));
  },
  async byId(id) {
    if (isBackendApiEnabled()) {
      try {
        return cacheShopLocal(await apiRequest(`/shops/${encodeURIComponent(id)}`));
      } catch (err) {
        console.warn("Backend shop lookup unavailable; using local cache.", err.message);
      }
    }
    await sleep();
    return DB.byId("shops", id);
  },
  async byOwner(ownerId) {
    const localRows = DB.filter("shops", (s) => s.ownerId === ownerId).map(normalizeShop);
    if (isBackendApiEnabled()) {
      let backendRows = [];
      try {
        backendRows = await apiRequest(`/shops${queryString({ ownerId, status: "" })}`);
      } catch (err) {
        console.warn("Backend owner shops unavailable; using local cache.", err.message);
      }
      return mergeShops(localRows, backendRows).filter((s) => s.ownerId === ownerId);
    }
    await sleep();
    return localRows;
  },
  async register({ ownerId, name, subCity, paymentAccounts = [] }) {
    const u = Auth.require(["owner", "branch", "main"]);
    if (isBackendApiEnabled()) {
      return cacheShopLocal(await apiRequest("/shops", {
        method: "POST",
        body: { ownerId: ownerId || u.id, name, subCity, paymentAccounts },
      }));
    }
    if (!name || !subCity) throw new Error("Name and sub-city required.");
    const cleanAccounts = sanitizePaymentAccounts(paymentAccounts);
    if (cleanAccounts.length === 0) throw new Error("Add at least one payment account.");
    // Find branch committee for that sub-city.
    const branch = DB.find("committees", (c) => c.type === "branch" && c.jurisdiction === subCity);
    if (!branch) throw new Error("No branch committee for that sub-city.");
    const shop = DB.insert("shops", {
      ownerId: ownerId || u.id, name, subCity,
      branchCommitteeId: branch.id, status: "pending",
      rating: 0, reviews: [], paymentAccounts: cleanAccounts,
    });
    audit(u.id, "SHOP_REGISTERED", "shop", shop.id, { name, subCity });
    return shop;
  },

  async setPaymentAccounts(shopId, accounts) {
    const u = Auth.require(["owner"]);
    const shop = DB.byId("shops", shopId);
    if (!shop) throw new Error("Shop not found.");
    if (shop.ownerId !== u.id) throw new Error("Not your shop.");
    const cleaned = sanitizePaymentAccounts(accounts);
    if (cleaned.length === 0) throw new Error("You must keep at least one payment account.");
    const next = DB.update("shops", shopId, { paymentAccounts: cleaned });
    audit(u.id, "PAYMENT_ACCOUNTS_UPDATED", "shop", shopId, { count: cleaned.length });
    return next;
  },
  async setStatus(shopId, status, reason = "") {
    const u = Auth.require(["branch", "main"]);
    if (!["approved", "rejected", "suspended", "pending"].includes(status))
      throw new Error("Invalid status.");
    if (isBackendApiEnabled()) {
      const path = status === "approved"
        ? `/shops/${encodeURIComponent(shopId)}/approve`
        : `/shops/${encodeURIComponent(shopId)}`;
      return normalizeShop(await apiRequest(path, {
        method: "PUT",
        body: { status, statusReason: reason },
      }));
    }
    const shop = DB.byId("shops", shopId);
    if (!shop) throw new Error("Shop not found.");
    const next = DB.update("shops", shopId, {
      status,
      approvedBy: status === "approved" ? u.id : shop.approvedBy,
      approvedAt: status === "approved" ? new Date().toISOString() : shop.approvedAt,
      statusReason: reason,
    });
    audit(u.id, "SHOP_STATUS", "shop", shopId, { status, reason });
    return next;
  },
  async addReview(shopId, { by, text, stars }) {
    const u = Auth.require(["customer", "owner", "delivery", "branch", "main"]);
    const shop = DB.byId("shops", shopId);
    if (!shop) throw new Error("Shop not found.");
    const reviews = [...(shop.reviews || []), { by: by || u.name, text, stars: Number(stars) || 5, date: new Date().toISOString().slice(0, 10) }];
    const avg = reviews.reduce((a, r) => a + (r.stars || 0), 0) / reviews.length;
    const updated = DB.update("shops", shopId, { reviews, rating: Number(avg.toFixed(1)) });
    audit(u.id, "REVIEW_ADDED", "shop", shopId, { stars });
    return updated;
  },
};

// ------------------ INVENTORY ------------------
export const Inventory = {
  async byShop(shopId, { onlyApproved = false } = {}) {
    await sleep();
    const items = DB.filter("inventory", (i) =>
      i.shopId === shopId && (!onlyApproved || i.status === "approved")
    );
    const products = DB.all("products");
    return items.map((i) => ({ ...i, product: products.find((p) => p.id === i.productId) || null }));
  },
  async byId(id) {
    await sleep();
    const inv = DB.byId("inventory", id);
    if (!inv) return null;
    const product = DB.byId("products", inv.productId);
    const shop = DB.byId("shops", inv.shopId);
    return { ...inv, product, shop };
  },
  async upsert({ id, shopId, productId, qty, price }) {
    const u = Auth.require(["owner"]);
    const shop = DB.byId("shops", shopId);
    if (!shop) throw new Error("Shop not found.");
    if (shop.ownerId !== u.id) throw new Error("You don't own this shop.");
    const range = await PriceRanges.byProduct(productId);
    if (range && (price < range.minPrice || price > range.maxPrice)) {
      throw new Error(`Price ${price} outside regulated range ${range.minPrice}–${range.maxPrice}.`);
    }
    const product = DB.byId("products", productId);
    const priceChanged = (prev) =>
      prev && Number(prev.price).toFixed(2) !== Number(price).toFixed(2);

    const firePriceChange = (prev) => {
      if (!priceChanged(prev) || !shop.branchCommitteeId) return;
      notify({
        recipientType: "committee",
        recipientId: shop.branchCommitteeId,
        type: "PRICE_CHANGE",
        title: "Price change",
        data: {
          shopId: shop.id, shopName: shop.name,
          productId, productName: product?.name || "",
          oldPrice: Number(prev.price), newPrice: Number(price),
        },
      });
    };

    const fireNewListing = () => {
      if (!shop.branchCommitteeId) return;
      notify({
        recipientType: "committee",
        recipientId: shop.branchCommitteeId,
        type: "INVENTORY_NEW",
        title: "New listing",
        data: {
          shopId: shop.id, shopName: shop.name,
          productId, productName: product?.name || "",
          qty: Number(qty), price: Number(price),
        },
      });
    };

    if (id) {
      const existing = DB.byId("inventory", id);
      if (!existing) throw new Error("Inventory item not found.");
      const next = DB.update("inventory", id, { qty: Number(qty), price: Number(price) });
      firePriceChange(existing);
      audit(u.id, "INVENTORY_UPDATED", "inventory", id, { qty, price });
      return next;
    } else {
      // If shop already has the product, update; otherwise create.
      const existing = DB.find("inventory", (i) => i.shopId === shopId && i.productId === productId);
      if (existing) {
        const next = DB.update("inventory", existing.id, { qty: Number(qty), price: Number(price) });
        firePriceChange(existing);
        audit(u.id, "INVENTORY_UPDATED", "inventory", existing.id, { qty, price });
        return next;
      }
      const inserted = DB.insert("inventory", {
        shopId, productId, qty: Number(qty), price: Number(price),
        oldPrice: Number((Number(price) * 1.6).toFixed(2)),
        status: "pending",
      });
      fireNewListing();
      audit(u.id, "INVENTORY_CREATED", "inventory", inserted.id, { qty, price });
      return inserted;
    }
  },
  async listingsForBrowse({ subCity, q = "", category = "All" } = {}) {
    // Aggregate inventory across approved shops in a sub-city for customer browsing.
    // Pending or rejected inventory rows are hidden from customers.
    await sleep();
    const shops = await Shops.list({ subCity, status: "approved" });
    const products = DB.all("products");
    const inventory = DB.all("inventory");
    const ranges = await PriceRanges.list();
    const ql = q.trim().toLowerCase();
    const out = [];
    for (const inv of inventory) {
      if (inv.status !== "approved") continue;
      const shop = shops.find((s) => s.id === inv.shopId);
      if (!shop) continue;
      const product = products.find((p) => p.id === inv.productId);
      if (!product) continue;
      if (category !== "All" && product.category !== category) continue;
      if (ql && !product.name.toLowerCase().includes(ql) && !product.category.toLowerCase().includes(ql)) continue;
      const range = ranges.find((r) => r.productId === product.id);
      out.push({ ...inv, shop, product, range });
    }
    return out;
  },

  // Branch decides on a pending listing: approve makes it live to customers,
  // reject removes it from the shop. Notifies the owner either way.
  async decideListing(id, decision, note = "") {
    const u = Auth.require(["branch", "main"]);
    if (!["approved", "rejected"].includes(decision)) throw new Error("Invalid decision.");
    const inv = DB.byId("inventory", id);
    if (!inv) throw new Error("Listing not found.");
    if (inv.status !== "pending") throw new Error("Listing is not pending.");
    const shop = DB.byId("shops", inv.shopId);
    if (!shop) throw new Error("Shop not found.");
    if (u.role === "branch" && u.committeeId && shop.branchCommitteeId !== u.committeeId) {
      throw new Error("Not in your jurisdiction.");
    }
    const product = DB.byId("products", inv.productId);

    if (decision === "approved") {
      DB.update("inventory", id, {
        status: "approved",
        decisionBy: u.id, decisionNote: String(note || ""),
        decidedAt: new Date().toISOString(),
      });
      audit(u.id, "INVENTORY_APPROVED", "inventory", id, {});
      notify({
        recipientType: "user", recipientId: shop.ownerId, type: "INVENTORY_APPROVED",
        title: "Listing approved", body: String(note || ""),
        data: { inventoryId: id, productName: product?.name || "", shopName: shop.name },
      });
    } else {
      DB.remove("inventory", id);
      audit(u.id, "INVENTORY_REJECTED", "inventory", id, { note });
      notify({
        recipientType: "user", recipientId: shop.ownerId, type: "INVENTORY_REJECTED",
        title: "Listing rejected", body: String(note || ""),
        data: { inventoryId: id, productName: product?.name || "", shopName: shop.name },
      });
    }
    return DB.byId("inventory", id);
  },

  // Owner removes one of their listings entirely (e.g., they no longer sell
  // it). Notifies the branch for awareness so they can prune any in-flight
  // approval queue entries.
  async remove(id) {
    const u = Auth.require(["owner"]);
    const inv = DB.byId("inventory", id);
    if (!inv) throw new Error("Listing not found.");
    const shop = DB.byId("shops", inv.shopId);
    if (!shop || shop.ownerId !== u.id) throw new Error("Not your listing.");
    const product = DB.byId("products", inv.productId);
    DB.remove("inventory", id);
    audit(u.id, "INVENTORY_REMOVED", "inventory", id, {});
    if (shop.branchCommitteeId) {
      notify({
        recipientType: "committee",
        recipientId: shop.branchCommitteeId,
        type: "INVENTORY_REMOVED",
        title: "Listing removed",
        data: {
          shopId: shop.id, shopName: shop.name,
          productId: inv.productId, productName: product?.name || "",
        },
      });
    }
    return true;
  },

  async listPending({ branchCommitteeId } = {}) {
    await sleep();
    const rows = DB.filter("inventory", (i) => i.status === "pending");
    const products = DB.all("products");
    const shops = DB.all("shops");
    return rows
      .map((i) => ({
        ...i,
        product: products.find((p) => p.id === i.productId) || null,
        shop: shops.find((s) => s.id === i.shopId) || null,
      }))
      .filter((row) => row.shop && (!branchCommitteeId || row.shop.branchCommitteeId === branchCommitteeId))
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  },
};

// ------------------ ORDERS ------------------
const ORDER_STATUS = ["created", "paid", "accepted", "preparing", "dispatched", "delivered", "completed", "cancelled", "refunded"];

export const Orders = {
  async create({ items, paymentType, customerSubCity, paymentProof }) {
    const u = Auth.require(["customer"]);
    if (isBackendApiEnabled()) {
      const created = await apiRequest("/orders", {
        method: "POST",
        body: { items, paymentType, customerSubCity, paymentProof },
      });
      return Array.isArray(created) ? created.map(normalizeOrder) : [normalizeOrder(created)];
    }
    if (!Array.isArray(items) || items.length === 0) throw new Error("Cart is empty.");
    if (!["prepay", "cod"].includes(paymentType)) throw new Error("Invalid payment type.");
    // For pay-now (prepay), a payment proof (screenshot + reference) is
    // required from the customer. Owner verifies before order moves to paid.
    if (paymentType === "prepay") {
      if (!paymentProof || !paymentProof.image || !paymentProof.reference) {
        throw new Error("Upload a payment screenshot and enter the transaction reference.");
      }
    }

    // Group items by shop -> one order per shop (real marketplace behavior).
    const byShop = new Map();
    for (const it of items) {
      const inv = DB.byId("inventory", it.inventoryId);
      if (!inv) throw new Error("Inventory item missing.");
      if (inv.status && inv.status !== "approved") throw new Error("Listing is not available for purchase.");
      const shop = DB.byId("shops", inv.shopId);
      if (!shop || shop.status !== "approved") throw new Error("Shop unavailable.");
      const product = DB.byId("products", inv.productId);
      const range = await PriceRanges.byProduct(product.id);
      if (range && (inv.price < range.minPrice || inv.price > range.maxPrice)) {
        throw new Error(`Listed price for ${product.name} is outside regulated range.`);
      }
      const qty = Math.max(1, Number(it.qty || 1));
      if (inv.qty <= 0) throw new Error(`${product.name} is out of stock.`);
      if (qty > inv.qty) throw new Error(`Only ${inv.qty} ${product.unit} of ${product.name} left in stock.`);
      const list = byShop.get(shop.id) || [];
      list.push({
        productId: product.id, name: product.name, unit: product.unit,
        qty, price: inv.price, lineTotal: Number((inv.price * qty).toFixed(2)),
        inventoryId: inv.id,
      });
      byShop.set(shop.id, list);
    }

    const created = [];
    for (const [shopId, lines] of byShop.entries()) {
      const total = Number(lines.reduce((a, l) => a + l.lineTotal, 0).toFixed(2));
      const shop = DB.byId("shops", shopId);
      // Attach the payment proof per-order (one proof per shop in cart).
      // Snapshot the destination account so the proof is self-contained
      // even if the owner later edits or removes that account.
      let proofs = [];
      let status = "created";
      let paymentStatus = "n/a";
      if (paymentType === "prepay") {
        const account = (shop?.paymentAccounts || []).find((a) => a.id === paymentProof.accountId) || null;
        proofs = [{
          id: DB.id("pp"),
          accountId: paymentProof.accountId || null,
          accountSnapshot: account ? { bankName: account.bankName, accountName: account.accountName, accountNumber: account.accountNumber } : null,
          image: paymentProof.image,
          reference: String(paymentProof.reference || "").trim(),
          uploadedAt: new Date().toISOString(),
          status: "pending",
        }];
        paymentStatus = "pending_verification";
      }
      const order = DB.insert("orders", {
        customerId: u.id, customerName: u.name, customerSubCity: customerSubCity || u.subCity,
        shopId, items: lines, total, paymentType,
        status, paymentStatus, paymentProofs: proofs,
      });

      // Decrement inventory.
      for (const l of lines) {
        const inv = DB.byId("inventory", l.inventoryId);
        if (inv) DB.update("inventory", inv.id, { qty: Math.max(0, inv.qty - l.qty) });
      }

      // Notify owner if they need to verify a payment.
      if (paymentType === "prepay" && shop?.ownerId) {
        notify({
          recipientType: "user", recipientId: shop.ownerId, type: "PAYMENT_PROOF_PENDING",
          title: "Payment to verify",
          data: { orderId: order.id, reference: proofs[0].reference },
        });
      }

      audit(u.id, "ORDER_CREATED", "order", order.id, { shopId, total, paymentType });
      created.push(order);
    }
    return created;
  },

  // Customer uploads an additional payment proof on an existing order
  // (e.g., after a rejected first attempt, or pay-after-delivery). Proofs
  // are append-only: no delete API.
  async uploadPaymentProof(orderId, { accountId, image, reference }) {
    const u = Auth.require(["customer"]);
    const order = DB.byId("orders", orderId);
    if (!order) throw new Error("Order not found.");
    if (order.customerId !== u.id) throw new Error("Not your order.");
    if (!image || !reference) throw new Error("Screenshot and reference number are required.");
    const shop = DB.byId("shops", order.shopId);
    const account = (shop?.paymentAccounts || []).find((a) => a.id === accountId) || null;
    const proof = {
      id: DB.id("pp"),
      accountId: accountId || null,
      accountSnapshot: account ? { bankName: account.bankName, accountName: account.accountName, accountNumber: account.accountNumber } : null,
      image, reference: String(reference || "").trim(),
      uploadedAt: new Date().toISOString(),
      status: "pending",
    };
    const proofs = [...(order.paymentProofs || []), proof];
    const updated = DB.update("orders", orderId, { paymentProofs: proofs, paymentStatus: "pending_verification" });
    if (shop?.ownerId) {
      notify({
        recipientType: "user", recipientId: shop.ownerId, type: "PAYMENT_PROOF_PENDING",
        title: "New payment proof",
        data: { orderId, reference: proof.reference },
      });
    }
    audit(u.id, "PAYMENT_PROOF_UPLOADED", "order", orderId, { proofId: proof.id });
    return updated;
  },

  // Owner verifies or rejects a payment proof. Verifying flips order to paid;
  // rejecting leaves the order open and notifies the customer to retry.
  async decidePaymentProof(orderId, proofId, decision, note = "") {
    const u = Auth.require(["owner"]);
    if (!["verified", "rejected"].includes(decision)) throw new Error("Invalid decision.");
    const order = DB.byId("orders", orderId);
    if (!order) throw new Error("Order not found.");
    const shop = DB.byId("shops", order.shopId);
    if (!shop || shop.ownerId !== u.id) throw new Error("Not your order.");
    const proofs = (order.paymentProofs || []).map((p) =>
      p.id === proofId
        ? { ...p, status: decision, decidedBy: u.id, decidedAt: new Date().toISOString(), decisionNote: String(note || "") }
        : p
    );
    const patch = { paymentProofs: proofs };
    if (decision === "verified") {
      patch.paymentStatus = "verified";
      if (order.status === "created") patch.status = "paid";
    } else {
      patch.paymentStatus = "rejected";
    }
    const updated = DB.update("orders", orderId, patch);
    notify({
      recipientType: "user", recipientId: order.customerId,
      type: decision === "verified" ? "PAYMENT_VERIFIED" : "PAYMENT_REJECTED",
      title: decision === "verified" ? "Payment verified" : "Payment rejected",
      body: note,
      data: { orderId, reference: proofs.find((p) => p.id === proofId)?.reference },
    });
    audit(u.id, decision === "verified" ? "PAYMENT_VERIFIED" : "PAYMENT_REJECTED", "order", orderId, { proofId });
    return updated;
  },

  async list({ customerId, shopId, courierId, status } = {}) {
    if (isBackendApiEnabled()) {
      const rows = await apiRequest(`/orders${queryString({ customerId, shopId, courierId, status })}`);
      return rows.map(normalizeOrder);
    }
    await sleep();
    let rows = DB.all("orders");
    if (customerId) rows = rows.filter((o) => o.customerId === customerId);
    if (shopId)     rows = rows.filter((o) => o.shopId === shopId);
    if (status)     rows = rows.filter((o) => o.status === status);
    if (courierId) {
      const myDeliveries = DB.filter("deliveries", (d) => d.courierId === courierId).map((d) => d.orderId);
      rows = rows.filter((o) => myDeliveries.includes(o.id));
    }
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async byId(id) {
    if (isBackendApiEnabled()) {
      return normalizeOrder(await apiRequest(`/orders/${encodeURIComponent(id)}`));
    }
    await sleep();
    return DB.byId("orders", id);
  },

  async updateStatus(orderId, status) {
    const u = Auth.require(["owner", "delivery", "branch", "main"]);
    if (!ORDER_STATUS.includes(status)) throw new Error("Invalid status.");
    if (isBackendApiEnabled()) {
      return normalizeOrder(await apiRequest(`/orders/${encodeURIComponent(orderId)}`, {
        method: "PUT",
        body: { status },
      }));
    }
    const order = DB.byId("orders", orderId);
    if (!order) throw new Error("Order not found.");
    if (u.role === "owner") {
      const shop = DB.byId("shops", order.shopId);
      if (!shop || shop.ownerId !== u.id) throw new Error("Not your order.");
      if (!["accepted", "preparing", "dispatched", "cancelled"].includes(status))
        throw new Error("Owners can only set: accepted, preparing, dispatched, cancelled.");
    }
    if (u.role === "delivery") {
      const delivery = DB.find("deliveries", (d) => d.orderId === order.id);
      if (!delivery || delivery.courierId !== u.id) throw new Error("Not your delivery.");
      if (!["dispatched", "delivered"].includes(status))
        throw new Error("Couriers can only set: dispatched, delivered.");
    }
    const next = DB.update("orders", orderId, { status });
    audit(u.id, "ORDER_STATUS", "order", orderId, { from: order.status, to: status });
    return next;
  },

  async assignDelivery(orderId, { courierId, eta = "30–45 min" }) {
    const u = Auth.require(["owner"]);
    const order = DB.byId("orders", orderId);
    if (!order) throw new Error("Order not found.");
    const shop = DB.byId("shops", order.shopId);
    if (!shop || shop.ownerId !== u.id) throw new Error("Not your order.");
    const courier = DB.byId("users", courierId);
    if (!courier || courier.role !== "delivery") throw new Error("Courier not found.");

    let delivery = DB.find("deliveries", (d) => d.orderId === orderId);
    const otp = String(1000 + Math.floor(Math.random() * 9000));
    const courierSnapshot = {
      courierName: courier.name || "",
      courierPhone: courier.phone || "",
    };
    if (delivery) {
      delivery = DB.update("deliveries", delivery.id, { courierId, eta, otp, status: "assigned", ...courierSnapshot });
    } else {
      delivery = DB.insert("deliveries", {
        orderId, shopId: shop.id, courierId, eta, otp, status: "assigned", ...courierSnapshot,
      });
    }
    DB.update("orders", orderId, { status: "preparing", deliveryId: delivery.id });
    audit(u.id, "DELIVERY_ASSIGNED", "delivery", delivery.id, { orderId, courierId });
    return delivery;
  },
};

// ------------------ DELIVERIES ------------------
const DELIVERY_STATUS = ["assigned", "accepted", "picked_up", "en_route", "delivered"];

export const Deliveries = {
  async list({ courierId } = {}) {
    await sleep();
    return DB.filter("deliveries", (d) => !courierId || d.courierId === courierId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async byId(id) {
    await sleep();
    return DB.byId("deliveries", id);
  },
  async updateStatus(deliveryId, status) {
    const u = Auth.require(["delivery", "owner"]);
    if (!DELIVERY_STATUS.includes(status)) throw new Error("Invalid status.");
    const d = DB.byId("deliveries", deliveryId);
    if (!d) throw new Error("Delivery not found.");
    if (u.role === "delivery" && d.courierId !== u.id) throw new Error("Not your delivery.");
    const next = DB.update("deliveries", deliveryId, { status });

    // Mirror to order status for tracking UI.
    const orderStatus =
      status === "picked_up" ? "dispatched" :
      status === "en_route"  ? "dispatched" :
      status === "delivered" ? "delivered"  :
      null;
    if (orderStatus) DB.update("orders", d.orderId, { status: orderStatus });

    audit(u.id, "DELIVERY_STATUS", "delivery", deliveryId, { from: d.status, to: status });
    return next;
  },
  async confirm(deliveryId, otp) {
    const u = Auth.require(["delivery"]);
    const d = DB.byId("deliveries", deliveryId);
    if (!d) throw new Error("Delivery not found.");
    if (d.courierId !== u.id) throw new Error("Not your delivery.");
    if (String(otp).trim() !== String(d.otp)) throw new Error("OTP does not match.");
    const now = new Date().toISOString();
    const next = DB.update("deliveries", deliveryId, {
      status: "delivered", confirmedAt: now,
    });
    DB.update("orders", d.orderId, { status: "completed", completedAt: now });
    audit(u.id, "DELIVERY_CONFIRMED", "delivery", deliveryId, { orderId: d.orderId });
    return next;
  },
};

// ------------------ COMPLAINTS / REFUNDS ------------------
export const Complaints = {
  async create({ orderId, type, detail, image }) {
    const u = Auth.require(["customer"]);
    if (isBackendApiEnabled()) {
      return normalizeComplaint(await apiRequest("/complaints", {
        method: "POST",
        body: { order_id: orderId, type, message: detail, image },
      }));
    }
    const order = DB.byId("orders", orderId);
    if (!order) throw new Error("Order not found.");
    if (order.customerId !== u.id) throw new Error("Not your order.");
    // Wrong-item and Quality complaints need a photo as evidence (the bad
    // item vs. what was ordered; the spoiled/damaged item). Missing item
    // and Late delivery have nothing concrete to photograph; Other is open.
    if ((type === "Wrong item" || type === "Quality") && !image) {
      throw new Error("A photo is required for this complaint type.");
    }
    // "Order never arrived" is only valid before the order is finalized as
    // delivered / completed (the OTP confirmation proves receipt), and only
    // after the customer has waited at least 6 hours since placing it.
    if (type === "Never arrived") {
      if (order.status === "delivered" || order.status === "completed") {
        throw new Error("This order has already been marked as delivered. Use a different complaint type.");
      }
      const hoursOld = (Date.now() - new Date(order.createdAt).getTime()) / 3600000;
      if (hoursOld < 6) {
        const hLeft = Math.max(0, 6 - hoursOld).toFixed(1);
        throw new Error(`Please wait at least 6 hours before filing this complaint (~${hLeft}h left).`);
      }
    }
    const shop = DB.byId("shops", order.shopId);
    const c = DB.insert("complaints", {
      orderId, type: type || "Other", detail: detail || "",
      image: image || null,
      wantsRefund: false,
      fromId: u.id, fromName: u.name,
      shopId: shop.id, shopName: shop.name,
      branchCommitteeId: shop.branchCommitteeId,
      status: "open",
    });
    if (shop.branchCommitteeId) {
      notify({
        recipientType: "committee",
        recipientId: shop.branchCommitteeId,
        type: "COMPLAINT_OPEN",
        title: "New complaint",
        data: { complaintId: c.id, shopName: shop.name, type: c.type },
      });
    }
    audit(u.id, "COMPLAINT_CREATED", "complaint", c.id, { orderId, type });
    return c;
  },
  // Customer marks a complaint as wanting a refund. Notifies the owner of
  // the shop and the branch committee so refund processing can begin.
  async requestRefund(complaintId) {
    const u = Auth.require(["customer"]);
    const c = DB.byId("complaints", complaintId);
    if (!c) throw new Error("Complaint not found.");
    if (c.fromId !== u.id) throw new Error("Not your complaint.");
    if (c.wantsRefund) return c;
    const updated = DB.update("complaints", complaintId, { wantsRefund: true });
    const shop = DB.byId("shops", c.shopId);
    if (shop?.ownerId) {
      notify({
        recipientType: "user", recipientId: shop.ownerId, type: "REFUND_REQUESTED",
        title: "Refund requested",
        data: { complaintId, orderId: c.orderId, shopName: c.shopName, type: c.type },
      });
    }
    if (c.branchCommitteeId) {
      notify({
        recipientType: "committee", recipientId: c.branchCommitteeId, type: "REFUND_REQUESTED",
        title: "Refund requested",
        data: { complaintId, fromName: c.fromName, shopName: c.shopName, type: c.type },
      });
    }
    audit(u.id, "REFUND_REQUESTED", "complaint", complaintId, {});
    return updated;
  },

  async list({ branchCommitteeId, status, mainOnly, orderId, fromId } = {}) {
    if (isBackendApiEnabled()) {
      const rows = await apiRequest(`/complaints${queryString({ branchCommitteeId, status, mainOnly, orderId, fromId })}`);
      return rows.map(normalizeComplaint);
    }
    await sleep();
    let rows = DB.all("complaints");
    if (branchCommitteeId) rows = rows.filter((c) => c.branchCommitteeId === branchCommitteeId);
    if (status) rows = rows.filter((c) => c.status === status);
    if (mainOnly) rows = rows.filter((c) => c.status === "escalated");
    if (orderId) rows = rows.filter((c) => c.orderId === orderId);
    if (fromId)  rows = rows.filter((c) => c.fromId === fromId);
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async decide(id, decision, note = "") {
    const u = Auth.require(["branch", "main"]);
    if (!["approved", "rejected", "escalated", "resolved"].includes(decision))
      throw new Error("Invalid decision.");
    const c = DB.byId("complaints", id);
    if (!c) throw new Error("Case not found.");
    const status =
      decision === "approved" ? "resolved" :
      decision === "rejected" ? "rejected" :
      decision === "escalated" ? "escalated" :
      "resolved";

    const updated = DB.update("complaints", id, { decision, decisionNote: note, status, decisionBy: u.id });

    // Escalations notify the main committee for next-meeting tracking.
    if (decision === "escalated") {
      const mainId = mainCommitteeId();
      if (mainId) {
        notify({
          recipientType: "committee",
          recipientId: mainId,
          type: "COMPLAINT_ESCALATED",
          title: "Complaint escalated",
          data: { complaintId: id, type: c.type, shopName: c.shopName },
        });
      }
    }

    // If approved and order was prepay, mark refund.
    if (decision === "approved") {
      const order = DB.byId("orders", c.orderId);
      if (order && order.paymentType === "prepay") {
        const refund = DB.insert("refunds", {
          complaintId: id, orderId: order.id, amount: order.total,
          status: "refunded", decisionBy: u.id, decisionAt: new Date().toISOString(),
        });
        DB.update("orders", order.id, { status: "refunded" });
        audit(u.id, "REFUND_ISSUED", "refund", refund.id, { orderId: order.id, amount: order.total });
      }
    }

    audit(u.id, "COMPLAINT_DECIDED", "complaint", id, { decision, status });
    return updated;
  },
};

// ------------------ AUDIT ------------------
export const Audit = {
  async list({ limit = 50 } = {}) {
    Auth.require(["main", "branch"]);
    await sleep();
    return DB.all("auditLogs")
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  },
};

// ------------------ USERS (lookups for assignment dropdowns) ------------------
export const Users = {
  async listByRole(role) {
    if (isBackendApiEnabled()) {
      const rows = await apiRequest(`/users${queryString({ role })}`);
      return rows.map(cacheUserLocal).filter(Boolean);
    }
    await sleep();
    return DB.filter("users", (u) => u.role === role).map((u) => Auth.publicUser(u));
  },

  // Customer leaves a rating + comment on a delivery courier after completion.
  async rateDelivery({ userId, stars, text = "" }) {
    const u = Auth.require(["customer"]);
    const n = Number(stars);
    if (!(n >= 1 && n <= 5)) throw new Error("Stars must be between 1 and 5.");
    const courier = DB.byId("users", userId);
    if (!courier || courier.role !== "delivery") throw new Error("Delivery person not found.");
    const reviews = [...(courier.reviews || []), {
      by: u.name, byId: u.id,
      text: String(text || "").trim(),
      stars: n,
      date: new Date().toISOString().slice(0, 10),
    }];
    const avg = reviews.reduce((a, r) => a + (r.stars || 0), 0) / reviews.length;
    const next = DB.update("users", userId, { reviews, rating: Number(avg.toFixed(1)) });
    audit(u.id, "DELIVERY_RATED", "user", userId, { stars: n });
    return Auth.publicUser(next);
  },

  async byId(id) {
    await sleep();
    const u = DB.byId("users", id);
    return u ? Auth.publicUser(normalizeUser(u)) : null;
  },
  // Check whether a Work ID and/or Fayda FAN is already taken. Used by the
  // signup and profile-editor forms to give the user immediate feedback while
  // typing, instead of failing only at submit. excludeUserId lets the profile
  // editor ignore the user's own existing values when they aren't changing.
  async checkUnique({ workId, faydaFan, excludeUserId } = {}) {
    await sleep(40);
    const out = {};
    // In full-stack mode the Express API is the source of truth.
    if (isBackendApiEnabled()) {
      return apiRequest("/users/check-unique", {
        method: "POST",
        body: { workId, faydaFan, excludeUserId },
      });
    }
    if (workId) {
      const v = String(workId).trim().toUpperCase();
      const found = DB.find("users", (u) => u.workId === v && (!excludeUserId || u.id !== excludeUserId));
      out.workIdTaken = !!found;
    }
    if (faydaFan) {
      const v = String(faydaFan).replace(/\s+/g, "");
      const found = DB.find("users", (u) => u.faydaFan === v && (!excludeUserId || u.id !== excludeUserId));
      out.faydaFanTaken = !!found;
    }
    return out;
  },

  // Main-committee admin view: every user with an "active" flag derived from
  // whether they were seen recently on this browser/device.
  async listAll() {
    Auth.require(["main"]);
    if (isBackendApiEnabled()) {
      try {
        const rows = await apiRequest("/users");
        rows.forEach(cacheUserLocal);
      } catch (err) {
        console.warn("Backend users unavailable; using local cache.", err.message);
      }
    }
    await sleep();
    const users = DB.all("users").map(normalizeUser);
    const sessions = DB.all("sessions");
    const sessionByUser = new Map();
    for (const s of sessions) {
      const prev = sessionByUser.get(s.userId);
      if (!prev || (prev.lastSeen || "") < (s.lastSeen || "")) sessionByUser.set(s.userId, s);
    }
    return users.map((u) => {
      const session = sessionByUser.get(u.id);
      const lastSeen = session?.lastSeen || u.updatedAt || u.updated_at || null;
      const lastSeenMs = lastSeen ? new Date(lastSeen).getTime() : 0;
      const recentlySeen = Number.isFinite(lastSeenMs) && Date.now() - lastSeenMs <= ACTIVE_USER_WINDOW_MS;
      return {
        ...Auth.publicUser(u),
        active: recentlySeen,
        lastSeen,
      };
    });
  },
};

// ------------------ COMMITTEES ------------------
export const Committees = {
  async list() {
    await sleep();
    return DB.all("committees");
  },
};

// ------------------ PRODUCT PROPOSALS ------------------
// Owners suggest new catalog products with bilingual names + a suggested
// price band. Branch committee approves/rejects. Approval creates a product,
// a price range, and stocks the proposing shop in one shot.
export const ProductProposals = {
  async list({ status, ownerId, branchCommitteeId } = {}) {
    await sleep();
    let rows = DB.all("productProposals");
    if (status) rows = rows.filter((p) => p.status === status);
    if (ownerId) rows = rows.filter((p) => p.ownerId === ownerId);
    if (branchCommitteeId) rows = rows.filter((p) => p.branchCommitteeId === branchCommitteeId);
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async propose({ shopId, name, nameAm, category = "Vegetables", unit = "kg", icon = "grain", image = null, suggestedMin, suggestedMax, initialPrice, initialQty }) {
    const u = Auth.require(["owner"]);
    if (!name || !name.trim() || !nameAm || !nameAm.trim())
      throw new Error("Both English and Amharic names are required.");
    const min = Number(suggestedMin), max = Number(suggestedMax);
    if (!(min >= 0) || !(max > min)) throw new Error("Invalid suggested price range.");
    const ip = Number(initialPrice);
    if (!(ip >= min && ip <= max)) throw new Error("Initial price must be inside the suggested range.");
    const iq = Number(initialQty);
    if (!(iq > 0)) throw new Error("Initial stock must be greater than zero.");

    const shop = DB.byId("shops", shopId);
    if (!shop) throw new Error("Shop not found.");
    if (shop.ownerId !== u.id) throw new Error("Not your shop.");
    if (shop.status !== "approved") throw new Error("Shop must be approved before proposing products.");

    const proposal = DB.insert("productProposals", {
      ownerId: u.id, ownerName: u.name,
      shopId, shopName: shop.name,
      branchCommitteeId: shop.branchCommitteeId,
      name: name.trim(), nameAm: nameAm.trim(),
      category, unit, icon, image: image || null,
      suggestedMin: min, suggestedMax: max,
      initialPrice: ip, initialQty: iq,
      status: "pending",
    });

    if (shop.branchCommitteeId) {
      notify({
        recipientType: "committee",
        recipientId: shop.branchCommitteeId,
        type: "PROPOSAL_PENDING",
        title: "New product proposal",
        data: {
          proposalId: proposal.id,
          ownerName: u.name,
          productName: proposal.name,
          productNameAm: proposal.nameAm,
          shopName: shop.name,
        },
      });
    }
    audit(u.id, "PROPOSAL_CREATED", "productProposal", proposal.id, { name, nameAm });
    return proposal;
  },

  async decide(id, decision, note = "") {
    const u = Auth.require(["branch", "main"]);
    if (!["approved", "rejected"].includes(decision)) throw new Error("Invalid decision.");
    const p = DB.byId("productProposals", id);
    if (!p) throw new Error("Proposal not found.");
    if (p.status !== "pending") throw new Error("Already decided.");

    const updated = DB.update("productProposals", id, {
      status: decision, decisionBy: u.id, decisionNote: note,
    });

    if (decision === "approved") {
      // Generate a stable-ish product id from the English name.
      const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 20) || "item";
      const productId = `prd_${slug}_${Date.now().toString(36).slice(-4)}`;
      const product = DB.insert("products", {
        id: productId,
        name: p.name, nameAm: p.nameAm,
        category: p.category, unit: p.unit, icon: p.icon || "grain",
        image: p.image || null,
      });
      // Initial regulated price band.
      DB.insert("priceRanges", {
        productId: product.id,
        minPrice: p.suggestedMin, maxPrice: p.suggestedMax,
        effectiveDate: new Date().toISOString(),
        setBy: u.id,
      });
      // Stock the proposing shop with the initial entry.
      DB.insert("inventory", {
        shopId: p.shopId, productId: product.id,
        qty: p.initialQty, price: p.initialPrice,
        oldPrice: Number((p.initialPrice * 1.6).toFixed(2)),
      });
      audit(u.id, "PROPOSAL_APPROVED", "productProposal", id, { productId: product.id, note });
      notify({
        recipientType: "user",
        recipientId: p.ownerId,
        type: "PROPOSAL_APPROVED",
        title: "Proposal approved",
        body: note,
        data: { proposalId: id, productId: product.id, productName: p.name },
      });
      // Surface to the main committee so they can confirm or override the
      // initial band the branch just locked in.
      const mainId = mainCommitteeId();
      if (mainId && u.role === "branch") {
        const branchCommittee = DB.byId("committees", p.branchCommitteeId);
        notify({
          recipientType: "committee",
          recipientId: mainId,
          type: "PRODUCT_ADDED",
          title: "New product added",
          data: {
            productId: product.id,
            productName: p.name,
            productNameAm: p.nameAm,
            branchName: branchCommittee?.name || "Branch",
            minPrice: p.suggestedMin,
            maxPrice: p.suggestedMax,
          },
        });
      }
    } else {
      audit(u.id, "PROPOSAL_REJECTED", "productProposal", id, { note });
      notify({
        recipientType: "user",
        recipientId: p.ownerId,
        type: "PROPOSAL_REJECTED",
        title: "Proposal rejected",
        body: note,
        data: { proposalId: id, productName: p.name },
      });
    }
    return updated;
  },
};

// ------------------ LOCATION CHANGE REQUESTS -----------------
// Sub-city changes for staff roles go through committee approval. Owners and
// delivery agents need their branch committee to approve; the main committee
// is then notified and can override (revert). Branch members request directly
// from the main committee.
const LOCATION_OPEN_STATUSES = ["pending_branch", "branch_approved", "pending_main"];

export const LocationChanges = {
  async create({ toSubCity, reason = "" }) {
    const u = Auth.require(["owner", "delivery", "branch"]);
    if (!toSubCity) throw new Error("Target sub-city required.");
    if (!SUB_CITIES.includes(toSubCity)) throw new Error("Invalid sub-city.");
    if (toSubCity === u.subCity) throw new Error("You're already in that sub-city.");

    const existing = DB.find(
      "locationChangeRequests",
      (r) => r.userId === u.id && LOCATION_OPEN_STATUSES.includes(r.status)
    );
    if (existing) throw new Error("You already have a pending location request.");

    let branchCommitteeId = null;
    let initialStatus;
    if (u.role === "branch") {
      initialStatus = "pending_main";
    } else {
      const branch = DB.find("committees", (c) => c.type === "branch" && c.jurisdiction === u.subCity);
      if (!branch) throw new Error("No branch committee for your current sub-city.");
      branchCommitteeId = branch.id;
      initialStatus = "pending_branch";
    }

    const req = DB.insert("locationChangeRequests", {
      userId: u.id, userName: u.name, userRole: u.role,
      fromSubCity: u.subCity, toSubCity, reason: String(reason || "").trim(),
      branchCommitteeId,
      status: initialStatus,
      branchDecision: null, mainDecision: null,
    });

    if (u.role === "branch") {
      const mainId = mainCommitteeId();
      if (mainId) {
        notify({
          recipientType: "committee", recipientId: mainId,
          type: "LOCATION_REQUEST",
          title: "Location change request",
          data: { requestId: req.id, userName: u.name, userRole: u.role,
                  fromSubCity: req.fromSubCity, toSubCity: req.toSubCity },
        });
      }
    } else {
      notify({
        recipientType: "committee", recipientId: branchCommitteeId,
        type: "LOCATION_REQUEST",
        title: "Location change request",
        data: { requestId: req.id, userName: u.name, userRole: u.role,
                fromSubCity: req.fromSubCity, toSubCity: req.toSubCity },
      });
    }
    audit(u.id, "LOCATION_REQUESTED", "locationChange", req.id, {
      from: req.fromSubCity, to: req.toSubCity,
    });
    return req;
  },

  async list({ status, branchCommitteeId, forMain = false, userId } = {}) {
    await sleep();
    let rows = DB.all("locationChangeRequests");
    if (userId) rows = rows.filter((r) => r.userId === userId);
    if (status) rows = rows.filter((r) => r.status === status);
    if (branchCommitteeId) rows = rows.filter((r) => r.branchCommitteeId === branchCommitteeId);
    if (forMain) rows = rows.filter((r) => r.status === "pending_main" || r.status === "branch_approved");
    return rows.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  },

  async myPending() {
    const u = Auth.currentUser();
    if (!u) return null;
    return DB.find(
      "locationChangeRequests",
      (r) => r.userId === u.id && LOCATION_OPEN_STATUSES.includes(r.status)
    ) || null;
  },

  async decide(id, decision, note = "") {
    const u = Auth.require(["branch", "main"]);
    if (!["approved", "rejected"].includes(decision)) throw new Error("Invalid decision.");
    const req = DB.byId("locationChangeRequests", id);
    if (!req) throw new Error("Request not found.");

    const stamp = { by: u.id, decision, note: String(note || ""), at: new Date().toISOString() };

    if (u.role === "branch") {
      if (req.status !== "pending_branch") throw new Error("Request is not pending branch review.");
      if (u.committeeId && req.branchCommitteeId && u.committeeId !== req.branchCommitteeId) {
        throw new Error("Not in your jurisdiction.");
      }
      if (decision === "rejected") {
        DB.update("locationChangeRequests", id, { status: "rejected", branchDecision: stamp });
        notify({
          recipientType: "user", recipientId: req.userId, type: "LOCATION_REJECTED",
          title: "Location change rejected", body: stamp.note,
          data: { requestId: id, by: "branch", fromSubCity: req.fromSubCity, toSubCity: req.toSubCity },
        });
      } else {
        // Apply the change immediately and forward to main for confirmation.
        DB.update("users", req.userId, { subCity: req.toSubCity });
        DB.update("locationChangeRequests", id, { status: "branch_approved", branchDecision: stamp });
        const mainId = mainCommitteeId();
        if (mainId) {
          notify({
            recipientType: "committee", recipientId: mainId, type: "LOCATION_BRANCH_APPROVED",
            title: "Branch approved a location change",
            data: { requestId: id, userName: req.userName, userRole: req.userRole,
                    fromSubCity: req.fromSubCity, toSubCity: req.toSubCity },
          });
        }
        notify({
          recipientType: "user", recipientId: req.userId, type: "LOCATION_BRANCH_APPROVED",
          title: "Location change approved by branch", body: stamp.note,
          data: { requestId: id, fromSubCity: req.fromSubCity, toSubCity: req.toSubCity },
        });
      }
      audit(u.id, "LOCATION_BRANCH_DECIDED", "locationChange", id, { decision });
    } else {
      // main
      if (req.status === "pending_main") {
        if (decision === "approved") {
          DB.update("users", req.userId, { subCity: req.toSubCity });
          DB.update("locationChangeRequests", id, { status: "approved", mainDecision: stamp });
        } else {
          DB.update("locationChangeRequests", id, { status: "rejected", mainDecision: stamp });
        }
      } else if (req.status === "branch_approved") {
        if (decision === "approved") {
          DB.update("locationChangeRequests", id, { status: "approved", mainDecision: stamp });
        } else {
          // Override: revert the user's sub-city.
          DB.update("users", req.userId, { subCity: req.fromSubCity });
          DB.update("locationChangeRequests", id, {
            status: "rejected", mainDecision: stamp, override: true,
          });
        }
      } else {
        throw new Error("Request is not pending main review.");
      }
      notify({
        recipientType: "user", recipientId: req.userId,
        type: decision === "approved" ? "LOCATION_APPROVED" : "LOCATION_REJECTED",
        title: decision === "approved" ? "Location change approved" : "Location change rejected",
        body: stamp.note,
        data: { requestId: id, by: "main", fromSubCity: req.fromSubCity, toSubCity: req.toSubCity },
      });
      audit(u.id, "LOCATION_MAIN_DECIDED", "locationChange", id, { decision });
    }
    return DB.byId("locationChangeRequests", id);
  },
};

// ------------------ NOTIFICATIONS ------------------
export const Notifications = {
  async list({ recipientType, recipientId, unreadOnly = false, limit = 50 } = {}) {
    await sleep();
    let rows = DB.all("notifications");
    if (recipientType) rows = rows.filter((n) => n.recipientType === recipientType);
    if (recipientId !== undefined && recipientId !== null) rows = rows.filter((n) => n.recipientId === recipientId);
    if (unreadOnly) rows = rows.filter((n) => !n.read);
    return rows
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .slice(0, limit);
  },
  async markRead(id) {
    return DB.update("notifications", id, { read: true });
  },
  async markAllRead({ recipientType, recipientId }) {
    const all = DB.all("notifications");
    for (const n of all) {
      if (n.read) continue;
      if (recipientType && n.recipientType !== recipientType) continue;
      if (recipientId && n.recipientId !== recipientId) continue;
      DB.update("notifications", n.id, { read: true });
    }
  },
};
