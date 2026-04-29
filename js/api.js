// js/api.js
// REST-like API surface backed by db.js. Each method is async and validates
// inputs/role permissions/state transitions, mirroring what a Spring Boot
// controller + service layer would do server-side. A real backend can replace
// this file by exporting the same shape over fetch() without view changes.

import { DB } from "./db.js";
import { Auth } from "./auth.js";

// Tiny artificial latency to mimic network calls (and let UI show loading).
const sleep = (ms = 80) => new Promise((r) => setTimeout(r, ms));

function audit(actorId, action, entity, entityId, details = {}) {
  DB.insert("auditLogs", {
    actorId, action, entity, entityId,
    details, timestamp: new Date().toISOString(),
  });
}

// ------------------ PRODUCTS & PRICING ------------------
export const Products = {
  async list({ q = "", category = "All" } = {}) {
    await sleep();
    const all = DB.all("products");
    const ql = q.trim().toLowerCase();
    return all.filter((p) => {
      const okCat = category === "All" || p.category === category;
      const okQ = !ql || p.name.toLowerCase().includes(ql) || p.category.toLowerCase().includes(ql);
      return okCat && okQ;
    });
  },
  async byId(id) {
    await sleep();
    return DB.byId("products", id);
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
    await sleep();
    return DB.filter("shops", (s) => (!subCity || s.subCity === subCity) && (!status || s.status === status));
  },
  async byId(id) {
    await sleep();
    return DB.byId("shops", id);
  },
  async byOwner(ownerId) {
    await sleep();
    return DB.filter("shops", (s) => s.ownerId === ownerId);
  },
  async register({ ownerId, name, subCity }) {
    const u = Auth.require(["owner", "branch", "main"]);
    if (!name || !subCity) throw new Error("Name and sub-city required.");
    // Find branch committee for that sub-city.
    const branch = DB.find("committees", (c) => c.type === "branch" && c.jurisdiction === subCity);
    if (!branch) throw new Error("No branch committee for that sub-city.");
    const shop = DB.insert("shops", {
      ownerId: ownerId || u.id, name, subCity,
      branchCommitteeId: branch.id, status: "pending",
      rating: 0, reviews: [],
    });
    audit(u.id, "SHOP_REGISTERED", "shop", shop.id, { name, subCity });
    return shop;
  },
  async setStatus(shopId, status, reason = "") {
    const u = Auth.require(["branch", "main"]);
    if (!["approved", "rejected", "suspended", "pending"].includes(status))
      throw new Error("Invalid status.");
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
  async byShop(shopId) {
    await sleep();
    const items = DB.filter("inventory", (i) => i.shopId === shopId);
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
    if (id) {
      const existing = DB.byId("inventory", id);
      if (!existing) throw new Error("Inventory item not found.");
      const next = DB.update("inventory", id, { qty: Number(qty), price: Number(price) });
      audit(u.id, "INVENTORY_UPDATED", "inventory", id, { qty, price });
      return next;
    } else {
      // If shop already has the product, update; otherwise create.
      const existing = DB.find("inventory", (i) => i.shopId === shopId && i.productId === productId);
      if (existing) {
        const next = DB.update("inventory", existing.id, { qty: Number(qty), price: Number(price) });
        audit(u.id, "INVENTORY_UPDATED", "inventory", existing.id, { qty, price });
        return next;
      }
      const inserted = DB.insert("inventory", {
        shopId, productId, qty: Number(qty), price: Number(price),
        oldPrice: Number((Number(price) * 1.6).toFixed(2)),
      });
      audit(u.id, "INVENTORY_CREATED", "inventory", inserted.id, { qty, price });
      return inserted;
    }
  },
  async listingsForBrowse({ subCity, q = "", category = "All" } = {}) {
    // Aggregate inventory across approved shops in a sub-city for customer browsing.
    await sleep();
    const shops = DB.filter("shops", (s) => s.status === "approved" && (!subCity || s.subCity === subCity));
    const products = DB.all("products");
    const inventory = DB.all("inventory");
    const ranges = await PriceRanges.list();
    const ql = q.trim().toLowerCase();
    const out = [];
    for (const inv of inventory) {
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
};

// ------------------ ORDERS ------------------
const ORDER_STATUS = ["created", "paid", "accepted", "preparing", "dispatched", "delivered", "completed", "cancelled", "refunded"];

export const Orders = {
  async create({ items, paymentType, customerSubCity }) {
    const u = Auth.require(["customer"]);
    if (!Array.isArray(items) || items.length === 0) throw new Error("Cart is empty.");
    if (!["prepay", "cod"].includes(paymentType)) throw new Error("Invalid payment type.");

    // Group items by shop -> one order per shop (real marketplace behavior).
    const byShop = new Map();
    for (const it of items) {
      const inv = DB.byId("inventory", it.inventoryId);
      if (!inv) throw new Error("Inventory item missing.");
      const shop = DB.byId("shops", inv.shopId);
      if (!shop || shop.status !== "approved") throw new Error("Shop unavailable.");
      const product = DB.byId("products", inv.productId);
      const range = await PriceRanges.byProduct(product.id);
      if (range && (inv.price < range.minPrice || inv.price > range.maxPrice)) {
        throw new Error(`Listed price for ${product.name} is outside regulated range.`);
      }
      const qty = Math.max(1, Number(it.qty || 1));
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
      const order = DB.insert("orders", {
        customerId: u.id, customerName: u.name, customerSubCity: customerSubCity || u.subCity,
        shopId, items: lines, total, paymentType,
        status: paymentType === "prepay" ? "paid" : "created",
      });

      // Decrement inventory.
      for (const l of lines) {
        const inv = DB.byId("inventory", l.inventoryId);
        if (inv) DB.update("inventory", inv.id, { qty: Math.max(0, inv.qty - l.qty) });
      }

      audit(u.id, "ORDER_CREATED", "order", order.id, { shopId, total, paymentType });
      created.push(order);
    }
    return created;
  },

  async list({ customerId, shopId, courierId, status } = {}) {
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
    await sleep();
    return DB.byId("orders", id);
  },

  async updateStatus(orderId, status) {
    const u = Auth.require(["owner", "delivery", "branch", "main"]);
    if (!ORDER_STATUS.includes(status)) throw new Error("Invalid status.");
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
    if (delivery) {
      delivery = DB.update("deliveries", delivery.id, { courierId, eta, otp, status: "assigned" });
    } else {
      delivery = DB.insert("deliveries", {
        orderId, shopId: shop.id, courierId, eta, otp, status: "assigned",
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
    const next = DB.update("deliveries", deliveryId, {
      status: "delivered", confirmedAt: new Date().toISOString(),
    });
    DB.update("orders", d.orderId, { status: "completed" });
    audit(u.id, "DELIVERY_CONFIRMED", "delivery", deliveryId, { orderId: d.orderId });
    return next;
  },
};

// ------------------ COMPLAINTS / REFUNDS ------------------
export const Complaints = {
  async create({ orderId, type, detail }) {
    const u = Auth.require(["customer"]);
    const order = DB.byId("orders", orderId);
    if (!order) throw new Error("Order not found.");
    if (order.customerId !== u.id) throw new Error("Not your order.");
    const shop = DB.byId("shops", order.shopId);
    const c = DB.insert("complaints", {
      orderId, type: type || "Other", detail: detail || "",
      fromId: u.id, fromName: u.name,
      shopId: shop.id, shopName: shop.name,
      branchCommitteeId: shop.branchCommitteeId,
      status: "open",
    });
    audit(u.id, "COMPLAINT_CREATED", "complaint", c.id, { orderId, type });
    return c;
  },
  async list({ branchCommitteeId, status, mainOnly } = {}) {
    await sleep();
    let rows = DB.all("complaints");
    if (branchCommitteeId) rows = rows.filter((c) => c.branchCommitteeId === branchCommitteeId);
    if (status) rows = rows.filter((c) => c.status === status);
    if (mainOnly) rows = rows.filter((c) => c.status === "escalated");
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
    await sleep();
    return DB.filter("users", (u) => u.role === role).map((u) => Auth.publicUser(u));
  },
};

// ------------------ COMMITTEES ------------------
export const Committees = {
  async list() {
    await sleep();
    return DB.all("committees");
  },
};
