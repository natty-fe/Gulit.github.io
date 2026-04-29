// js/api.js
// REST-like API surface backed by db.js. Each method is async and validates
// inputs/role permissions/state transitions, mirroring what a Spring Boot
// controller + service layer would do server-side. A real backend can replace
// this file by exporting the same shape over fetch() without view changes.

import { DB } from "./db.js";
import { Auth } from "./auth.js";
import { SUB_CITIES } from "./seed.js";

// Tiny artificial latency to mimic network calls (and let UI show loading).
const sleep = (ms = 80) => new Promise((r) => setTimeout(r, ms));

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
    const product = DB.byId("products", productId);
    const priceChanged = (prev) =>
      prev && Number(prev.price).toFixed(2) !== Number(price).toFixed(2);

    const fireNotification = (prev) => {
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

    if (id) {
      const existing = DB.byId("inventory", id);
      if (!existing) throw new Error("Inventory item not found.");
      const next = DB.update("inventory", id, { qty: Number(qty), price: Number(price) });
      fireNotification(existing);
      audit(u.id, "INVENTORY_UPDATED", "inventory", id, { qty, price });
      return next;
    } else {
      // If shop already has the product, update; otherwise create.
      const existing = DB.find("inventory", (i) => i.shopId === shopId && i.productId === productId);
      if (existing) {
        const next = DB.update("inventory", existing.id, { qty: Number(qty), price: Number(price) });
        fireNotification(existing);
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
    await sleep();
    return DB.filter("users", (u) => u.role === role).map((u) => Auth.publicUser(u));
  },
  // Check whether a Work ID and/or Fayda FAN is already taken. Used by the
  // signup and profile-editor forms to give the user immediate feedback while
  // typing, instead of failing only at submit. excludeUserId lets the profile
  // editor ignore the user's own existing values when they aren't changing.
  async checkUnique({ workId, faydaFan, excludeUserId } = {}) {
    await sleep(40);
    const out = {};
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
  // whether they currently have a session token (not signed out yet).
  async listAll() {
    Auth.require(["main"]);
    await sleep();
    const users = DB.all("users");
    const sessions = DB.all("sessions");
    const sessionByUser = new Map();
    for (const s of sessions) {
      const prev = sessionByUser.get(s.userId);
      if (!prev || (prev.lastSeen || "") < (s.lastSeen || "")) sessionByUser.set(s.userId, s);
    }
    return users.map((u) => {
      const session = sessionByUser.get(u.id);
      return {
        ...Auth.publicUser(u),
        active: !!session,
        lastSeen: session?.lastSeen || u.updatedAt || null,
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

  async propose({ shopId, name, nameAm, category = "Vegetables", unit = "kg", icon = "grain", suggestedMin, suggestedMax, initialPrice, initialQty }) {
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
      category, unit, icon,
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
