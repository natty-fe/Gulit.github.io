// js/views/owner.js
// Shop owner dashboard: orders queue, accept/reject, assign deliveries,
// inventory CRUD with regulated-range validation, and shop registration.

import { Inventory, Notifications, Orders, PriceRanges, Products, ProductProposals, Shops, Users } from "../api.js";
import { state } from "../state.js";
import {
  toast, openModal, closeModal, etb, dateShort, timeShort, statusBadge, iconSvg, formField, t,
  productName, unitLabel, shopName, subCityLabel,
} from "./shared.js";
import { SUB_CITIES, CATEGORIES } from "../seed.js";

const PROPOSE_UNITS = ["kg", "tray", "dozen", "pack", "litre", "piece"];
const PROPOSE_ICONS = ["onion", "tomato", "potato", "carrot", "pepper", "cabbage", "egg", "grain", "banana", "spice"];

const view = () => document.getElementById("view");

export async function renderOwner() {
  const u = state.user;
  if (!u || u.role !== "owner") { location.hash = "#/auth"; return; }

  const myShops = await Shops.byOwner(u.id);
  const v = view();
  v.innerHTML = `
    <section class="page">
      <div class="card">
        <div class="hd">
          <div>
            <h2>${t("own.title")}</h2>
            <div class="muted">${t("own.subtitle")}</div>
          </div>
          <button class="primary" id="newShopBtn">${t("own.register_shop")}</button>
        </div>
        <div class="bd">
          <div class="statrow" id="ownerStats"></div>

          <div class="card mt12" style="box-shadow:none;border:1px solid var(--border);">
            <div class="hd"><h2>${t("own.queue")}</h2><div class="muted">${t("own.queue_subtitle")}</div></div>
            <div class="bd" id="ownerOrders">${t("loading")}</div>
          </div>

          <div class="card mt12" style="box-shadow:none;border:1px solid var(--border);">
            <div class="hd">
              <h2>${t("inventory")}</h2>
              <div class="flex" style="gap:8px;align-items:center;flex-wrap:wrap;">
                <select id="invShopSel">${myShops.map(s => `<option value="${s.id}">${shopName(s)} · ${subCityLabel(s.subCity)}</option>`).join("")}</select>
                <button class="addbtn" id="bulkBtn" ${myShops.some(s => s.status === "approved") ? "" : "disabled"}>${t("own.bulk_btn")}</button>
                <button class="addbtn" id="proposeBtn" ${myShops.some(s => s.status === "approved") ? "" : "disabled"}>${t("own.propose_btn")}</button>
              </div>
            </div>
            <div class="bd" id="ownerInv">${t("loading")}</div>
          </div>

          <div class="card mt12" style="box-shadow:none;border:1px solid var(--border);">
            <div class="hd"><h2>${t("own.proposals_title")}</h2></div>
            <div class="bd" id="ownerProposals">${t("loading")}</div>
          </div>

          <div class="card mt12" style="box-shadow:none;border:1px solid var(--border);">
            <div class="hd">
              <h2>${t("own.activity_title")}</h2>
              <div class="muted">${t("own.activity_subtitle")}</div>
            </div>
            <div class="bd" id="ownerActivity">${t("loading")}</div>
          </div>
        </div>
      </div>
    </section>
  `;

  drawOwnerStats(myShops);
  drawOwnerOrders(myShops);
  if (myShops.length > 0) {
    drawOwnerInventory(myShops[0].id);
  } else {
    document.getElementById("ownerInv").innerHTML =
      `<div class="empty">${t("own.inv_no_shops")}</div>`;
  }
  drawOwnerProposals();
  drawOwnerActivity();

  document.getElementById("newShopBtn").addEventListener("click", () => openShopRegistration());
  document.getElementById("invShopSel")?.addEventListener("change", (e) => drawOwnerInventory(e.target.value));
  document.getElementById("proposeBtn")?.addEventListener("click", () => openProposeProduct(myShops));
  document.getElementById("bulkBtn")?.addEventListener("click", () => {
    const shopId = document.getElementById("invShopSel")?.value;
    if (shopId) openBulkInventoryEditor(shopId);
  });
}

async function drawOwnerStats(shops) {
  const u = state.user;
  let totalOrders = 0;
  for (const s of shops) {
    const o = await Orders.list({ shopId: s.id });
    totalOrders += o.length;
  }
  const approved = shops.filter(s => s.status === "approved").length;
  const pending = shops.filter(s => s.status === "pending").length;
  const avgRating = shops.length ? (shops.reduce((a, s) => a + (s.rating || 0), 0) / shops.length).toFixed(1) : "—";
  document.getElementById("ownerStats").innerHTML = `
    <div class="stat"><div class="k">${t("own.stat_shops")}</div><div class="v">${shops.length}</div></div>
    <div class="stat"><div class="k">${t("own.stat_approved")}</div><div class="v">${approved}</div></div>
    <div class="stat"><div class="k">${t("own.stat_pending")}</div><div class="v">${pending}</div></div>
    <div class="stat"><div class="k">${t("own.stat_orders")}</div><div class="v">${totalOrders}</div></div>
    <div class="stat"><div class="k">${t("own.stat_rating")}</div><div class="v">${avgRating}</div></div>
  `;
}

async function drawOwnerOrders(shops) {
  const el = document.getElementById("ownerOrders");
  if (!shops.length) { el.innerHTML = `<div class="empty">${t("own.no_shops")}</div>`; return; }
  const allOrders = [];
  for (const s of shops) {
    const orders = await Orders.list({ shopId: s.id });
    for (const o of orders) allOrders.push({ ...o, shopName: s.name });
  }
  if (allOrders.length === 0) { el.innerHTML = `<div class="empty">${t("own.no_orders")}</div>`; return; }

  el.innerHTML = allOrders.map(o => `
    <div class="pitem" style="grid-template-columns:48px 1fr auto;">
      <div class="pimg">${iconSvg("tomato")}</div>
      <div>
        <div class="ptitle">${t("track.order_label")} ${o.id.slice(-6).toUpperCase()} <span class="tag-chip">${shopName({ name: o.shopName })}</span></div>
        <div class="psub">${t("items_count", { n: o.items.length })} · ${etb(o.total)} · ${t("own.customer")}: ${o.customerName}</div>
        <div class="muted mt8">${dateShort(o.createdAt)} · ${statusBadge(o.status)}</div>
      </div>
      <div class="flex" style="flex-direction:column;gap:6px;align-items:flex-end;">
        <button class="viewbtn" data-detail="${o.id}">${t("view")}</button>
        ${nextActionBtn(o)}
      </div>
    </div>
  `).join("");

  el.querySelectorAll("[data-detail]").forEach(b => b.addEventListener("click", () => openOrderDetail(b.dataset.detail)));
  el.querySelectorAll("[data-accept]").forEach(b => b.addEventListener("click", () => updateStatus(b.dataset.accept, "accepted")));
  el.querySelectorAll("[data-prep]").forEach(b => b.addEventListener("click", () => updateStatus(b.dataset.prep, "preparing")));
  el.querySelectorAll("[data-cancel]").forEach(b => b.addEventListener("click", () => updateStatus(b.dataset.cancel, "cancelled")));
  el.querySelectorAll("[data-assign]").forEach(b => b.addEventListener("click", () => openAssignDelivery(b.dataset.assign)));
}

function nextActionBtn(o) {
  if (o.status === "created" || o.status === "paid") {
    return `<button class="addbtn" data-accept="${o.id}">${t("own.accept")}</button>
            <button class="viewbtn" data-cancel="${o.id}">${t("own.reject")}</button>`;
  }
  if (o.status === "accepted") {
    return `<button class="addbtn" data-prep="${o.id}">${t("own.mark_prep")}</button>`;
  }
  if (o.status === "preparing") {
    return `<button class="addbtn" data-assign="${o.id}">${t("own.assign_delivery")}</button>`;
  }
  if (o.status === "dispatched") {
    return `<span class="muted" style="font-size:12px;">${t("own.awaiting")}</span>`;
  }
  return `<span class="muted" style="font-size:12px;">${t("own.no_action")}</span>`;
}

async function updateStatus(orderId, status) {
  try {
    await Orders.updateStatus(orderId, status);
    toast(t("own.order_updated", { status: t(`status.${status}`) }), "success");
    renderOwner();
  } catch (e) { toast(e.message, "danger"); }
}

async function openAssignDelivery(orderId) {
  const couriers = await Users.listByRole("delivery");
  if (couriers.length === 0) { toast(t("own.no_couriers"), "danger"); return; }
  openModal(t("own.assign_title"), `
    ${formField({ label: t("own.courier"), name: "courier", type: "select", options: couriers.map(c => ({ value: c.id, label: `${c.name} · ${c.phone || ""}` })) })}
    ${formField({ label: t("own.eta"), name: "eta", value: "30–45 min" })}
    <div class="muted mt8" style="font-size:12px;">${t("own.otp_note")}</div>
    <div class="btnrow"><button class="primary" id="assignSubmit">${t("own.assign_btn")}</button><button class="ghost" id="assignCancel">${t("cancel")}</button></div>
  `);
  document.getElementById("assignCancel").onclick = () => closeModal();
  document.getElementById("assignSubmit").onclick = async () => {
    const courierId = document.querySelector("#modalBody [name=courier]").value;
    const eta = document.querySelector("#modalBody [name=eta]").value.trim();
    try {
      const d = await Orders.assignDelivery(orderId, { courierId, eta });
      toast(t("own.assigned_otp", { otp: d.otp }), "success");
      closeModal();
      renderOwner();
    } catch (e) { toast(e.message, "danger"); }
  };
}

async function openOrderDetail(orderId) {
  const o = await Orders.byId(orderId);
  if (!o) return;
  openModal(`${t("track.order_label")} ${o.id.slice(-6).toUpperCase()}`, `
    <div class="row">
      <div><div style="font-weight:900;">${t("own.customer")}: ${o.customerName}</div><div class="muted">${t("own.subcity")}: ${subCityLabel(o.customerSubCity) || "—"}</div></div>
      <div>${statusBadge(o.status)}</div>
    </div>
    <hr/>
    ${o.items.map(i => `<div class="row mt8"><div class="muted"><b>${i.name}</b> × ${i.qty}</div><div style="font-weight:900;">${etb(i.lineTotal)}</div></div>`).join("")}
    <hr/>
    <div class="row"><div style="font-weight:900;">${t("total")}</div><div style="font-weight:900;color:var(--primary);">${etb(o.total)}</div></div>
    <div class="muted mt8">${t("track.payment")}: <b>${o.paymentType === "prepay" ? t("track.pay_now_label") : t("track.pay_cod_label")}</b></div>
  `);
}

// ------------------ INVENTORY ------------------
async function drawOwnerInventory(shopId) {
  const el = document.getElementById("ownerInv");
  el.innerHTML = "Loading…";
  const items = await Inventory.byShop(shopId);
  const ranges = await PriceRanges.list();
  const products = await Products.list();
  const inMap = new Map(items.map(i => [i.productId, i]));

  el.innerHTML = `
    <div class="muted">${t("own.inv_note")}</div>
    <div class="mt12" style="display:grid;gap:10px;">
      ${products.map(p => {
        const inv = inMap.get(p.id);
        const r = ranges.find(x => x.productId === p.id);
        const rangeText = r ? t("own.range_label", { min: etb(r.minPrice), max: etb(r.maxPrice) }) : t("own.no_range");
        const priceField = inv ? etb(inv.price) : "—";
        return `
          <div class="pitem">
            <div class="pimg">${iconSvg(p.icon)}</div>
            <div>
              <div class="ptitle">${productName(p)}</div>
              <div class="psub">${t(`cat.${p.category}`, p.category)} · ${unitLabel(p.unit)}</div>
              <div class="muted mt8">${rangeText}</div>
            </div>
            <div class="pricebox">
              <div class="now">${priceField}</div>
              <div class="muted">${t("own.qty")}: ${inv ? inv.qty : 0}</div>
              <button class="addbtn" data-edit="${p.id}">${inv ? t("own.update") : t("own.add")}</button>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  el.querySelectorAll("[data-edit]").forEach(b =>
    b.addEventListener("click", () => openInventoryEditor(shopId, b.dataset.edit, inMap.get(b.dataset.edit), ranges)));
}

function openInventoryEditor(shopId, productId, existing, ranges) {
  const range = ranges.find(r => r.productId === productId);
  openModal(existing ? t("own.inv_update") : t("own.inv_add"), `
    ${range ? `<div class="muted">${t("own.allowed_range", { min: etb(range.minPrice), max: etb(range.maxPrice) })}</div>` : ""}
    ${formField({ label: t("own.qty_label"), name: "qty", type: "number", value: String(existing?.qty || 10) })}
    ${formField({ label: t("own.unit_price"), name: "price", type: "number", value: String(existing?.price || (range ? ((range.minPrice + range.maxPrice) / 2).toFixed(2) : "")) })}
    ${existing ? `<div class="muted mt8" style="font-size:12px;">${t("own.notify_committee")}</div>` : ""}
    <div class="btnrow"><button class="primary" id="invSave">${t("save")}</button><button class="ghost" id="invCancel">${t("cancel")}</button></div>
  `);
  document.getElementById("invCancel").onclick = () => closeModal();
  document.getElementById("invSave").onclick = async () => {
    const qty = Number(document.querySelector("#modalBody [name=qty]").value);
    const price = Number(document.querySelector("#modalBody [name=price]").value);
    try {
      await Inventory.upsert({ id: existing?.id, shopId, productId, qty, price });
      toast(t("own.inv_saved"), "success");
      closeModal();
      renderOwner();
    } catch (e) { toast(e.message, "danger"); }
  };
}

// ------------------ BULK INVENTORY EDITOR -------------------
async function openBulkInventoryEditor(shopId) {
  const items = await Inventory.byShop(shopId);
  const inMap = new Map(items.map(i => [i.productId, i]));
  const ranges = await PriceRanges.list();
  const products = await Products.list();

  const rows = products.map(p => {
    const inv = inMap.get(p.id);
    const r = ranges.find(x => x.productId === p.id);
    const fallbackPrice = r ? Number(((r.minPrice + r.maxPrice) / 2).toFixed(2)) : 0;
    return {
      product: p,
      range: r,
      origQty: inv?.qty ?? 0,
      origPrice: inv?.price ?? 0,
      qty: inv?.qty ?? 0,
      price: inv?.price ?? fallbackPrice,
      invId: inv?.id || null,
      isNew: !inv,
    };
  });

  const isDirty = (row) => row.qty !== row.origQty || Number(row.price).toFixed(2) !== Number(row.origPrice).toFixed(2);

  function renderEdit() {
    openModal(t("own.bulk_title"), `
      <div class="muted">${t("own.bulk_subtitle")}</div>
      <div class="bulkrows mt12">
        ${rows.map((row, idx) => `
          <div class="bulkrow">
            <div class="row" style="gap:10px;align-items:flex-start;">
              <div class="pimg" style="width:40px;height:40px;flex-shrink:0;">${iconSvg(row.product.icon)}</div>
              <div style="flex:1;min-width:0;">
                <div class="ptitle" style="font-size:14px;">${productName(row.product)}</div>
                <div class="psub" style="font-size:11px;">${unitLabel(row.product.unit)} · ${row.range ? t("own.range_label", { min: etb(row.range.minPrice), max: etb(row.range.maxPrice) }) : t("own.no_range")}</div>
              </div>
            </div>
            <div class="row mt8" style="gap:8px;">
              <label style="flex:1;display:flex;flex-direction:column;gap:2px;font-size:11px;color:var(--muted);">
                ${t("own.qty_label")}
                <input type="number" class="bulk-qty" data-idx="${idx}" value="${row.qty}" min="0" />
              </label>
              <label style="flex:1;display:flex;flex-direction:column;gap:2px;font-size:11px;color:var(--muted);">
                ${t("own.unit_price")}
                <input type="number" step="0.01" class="bulk-price" data-idx="${idx}" value="${row.price}" min="0" />
              </label>
            </div>
          </div>
        `).join("")}
      </div>
      <div class="bulkfooter">
        <span id="bulkCount" class="muted" style="font-size:13px;font-weight:700;"></span>
        <div class="btnrow" style="margin:0;">
          <button class="ghost" id="bulkCancel">${t("cancel")}</button>
          <button class="primary" id="bulkReview">${t("own.bulk_review")}</button>
        </div>
      </div>
    `);

    const updateCount = () => {
      const n = rows.filter(isDirty).length;
      document.getElementById("bulkCount").textContent = t("own.bulk_changes", { n });
    };

    document.querySelectorAll(".bulk-qty").forEach(el => el.addEventListener("input", () => {
      rows[Number(el.dataset.idx)].qty = Number(el.value || 0);
      updateCount();
    }));
    document.querySelectorAll(".bulk-price").forEach(el => el.addEventListener("input", () => {
      rows[Number(el.dataset.idx)].price = Number(el.value || 0);
      updateCount();
    }));
    document.getElementById("bulkCancel").onclick = () => closeModal();
    document.getElementById("bulkReview").onclick = renderReview;
    updateCount();
  }

  function renderReview() {
    const dirty = rows.filter(isDirty);
    if (dirty.length === 0) {
      toast(t("own.bulk_no_changes"));
      return;
    }
    openModal(t("own.bulk_review_title"), `
      <div class="muted">${t("own.bulk_review_subtitle", { n: dirty.length })}</div>
      <div style="display:grid;gap:10px;margin-top:12px;">
        ${dirty.map(row => `
          <div class="case">
            <div class="row" style="align-items:flex-start;">
              <div class="pimg" style="width:40px;height:40px;flex-shrink:0;">${iconSvg(row.product.icon)}</div>
              <div style="flex:1;">
                <div class="title">${productName(row.product)} ${row.isNew ? `<span class="tag-chip">${t("own.bulk_new")}</span>` : ""}</div>
                <div class="meta">${t("own.qty_label")}: ${row.origQty} → <b>${row.qty}</b></div>
                <div class="meta">${t("own.unit_price")}: ${etb(row.origPrice)} → <b>${etb(row.price)}</b></div>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
      <div class="btnrow mt12">
        <button class="ghost" id="bulkBack">${t("back")}</button>
        <button class="primary" id="bulkSave">${t("own.bulk_save")}</button>
      </div>
    `);
    document.getElementById("bulkBack").onclick = renderEdit;
    document.getElementById("bulkSave").onclick = async () => {
      const errs = [];
      let saved = 0;
      for (const row of dirty) {
        try {
          await Inventory.upsert({
            id: row.invId, shopId,
            productId: row.product.id,
            qty: row.qty, price: row.price,
          });
          saved++;
        } catch (e) {
          errs.push(`${productName(row.product)}: ${e.message}`);
        }
      }
      closeModal();
      if (errs.length) toast(t("own.bulk_partial", { saved, failed: errs.length, first: errs[0] }), "danger");
      else toast(t("own.bulk_saved", { n: saved }), "success");
      renderOwner();
    };
  }

  renderEdit();
}

// ------------------ PROPOSAL: new product ---------------
async function drawOwnerProposals() {
  const u = state.user;
  const el = document.getElementById("ownerProposals");
  if (!el) return;
  const proposals = await ProductProposals.list({ ownerId: u.id });
  if (!proposals.length) { el.innerHTML = `<div class="empty">${t("own.no_proposals")}</div>`; return; }
  el.innerHTML = proposals.map(p => `
    <div class="pitem" style="grid-template-columns:48px 1fr auto;">
      <div class="pimg">${iconSvg(p.icon)}</div>
      <div>
        <div class="ptitle">${p.name} · <span class="muted" style="font-weight:600;">${p.nameAm}</span></div>
        <div class="psub">${t(`cat.${p.category}`, p.category)} · ${unitLabel(p.unit)} · ${t("br.suggested_label")}: <b>${etb(p.suggestedMin)}–${etb(p.suggestedMax)}</b></div>
        <div class="muted mt8">${shopName({ name: p.shopName })} · ${dateShort(p.createdAt)}</div>
        ${p.decisionNote ? `<div class="muted mt8">"${escapeAttr(p.decisionNote)}"</div>` : ""}
      </div>
      <div>${statusBadge(p.status)}</div>
    </div>
  `).join("");
}

async function drawOwnerActivity() {
  const u = state.user;
  const el = document.getElementById("ownerActivity");
  if (!el) return;
  const items = await Notifications.list({ recipientType: "user", recipientId: u.id, limit: 30 });
  if (!items.length) { el.innerHTML = `<div class="empty">${t("own.no_activity")}</div>`; return; }
  el.innerHTML = items.map(n => `
    <div class="comment ${n.read ? "" : "unread"}" style="background:var(--surface);">
      <div class="row" style="align-items:flex-start;">
        <div>
          <div style="font-weight:900;">${notifTitle(n)}</div>
          ${n.body ? `<div class="muted mt8" style="font-size:13px;">${escapeAttr(n.body)}</div>` : ""}
        </div>
        <div class="muted" style="font-size:12px;">${dateShort(n.createdAt)} ${timeShort(n.createdAt)}</div>
      </div>
      ${n.read ? "" : `<div class="actions"><button class="ghost" data-mark="${n.id}">${t("own.mark_read")}</button></div>`}
    </div>
  `).join("");
  el.querySelectorAll("[data-mark]").forEach(b => b.addEventListener("click", async () => {
    await Notifications.markRead(b.dataset.mark);
    drawOwnerActivity();
  }));
}

function notifTitle(n) {
  const d = n.data || {};
  switch (n.type) {
    case "PROPOSAL_APPROVED": return t("notif.proposal_approved", { name: d.productName || "" });
    case "PROPOSAL_REJECTED": return t("notif.proposal_rejected", { name: d.productName || "" });
    case "PROPOSAL_PENDING":  return t("notif.proposal_pending",  { owner: d.ownerName || "", name: d.productName || "" });
    case "PRICE_CHANGE":      return t("notif.price_change", {
      shop: d.shopName || "", product: d.productName || "",
      oldPrice: etb(d.oldPrice ?? 0), newPrice: etb(d.newPrice ?? 0),
    });
    case "COMPLAINT_OPEN":       return t("notif.complaint_open",       { shop: d.shopName || "", type: d.type || "" });
    case "COMPLAINT_ESCALATED":  return t("notif.complaint_escalated",  { id: (d.complaintId || "").slice(-6).toUpperCase(), type: d.type || "" });
    case "LOCATION_BRANCH_APPROVED":
    case "LOCATION_APPROVED":
    case "LOCATION_REJECTED":    return t(`notif.${n.type.toLowerCase()}`, {
      from: d.fromSubCity || "", to: d.toSubCity || "", by: d.by || "",
    });
    default: return n.title || n.type;
  }
}

function escapeAttr(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function openProposeProduct(myShops) {
  const eligible = myShops.filter(s => s.status === "approved");
  if (eligible.length === 0) { toast(t("own.inv_no_shops"), "danger"); return; }
  const catOptions = CATEGORIES.filter(c => c !== "All").map(c => ({ value: c, label: t(`cat.${c}`, c) }));
  const unitOptions = PROPOSE_UNITS.map(u => ({ value: u, label: unitLabel(u) }));
  const iconOptions = PROPOSE_ICONS.map(i => ({ value: i, label: i }));
  openModal(t("own.propose_title"), `
    <div class="muted">${t("own.propose_subtitle")}</div>
    ${formField({ label: t("own.propose_shop"), name: "shopId", type: "select",
      options: eligible.map(s => ({ value: s.id, label: `${shopName(s)} · ${subCityLabel(s.subCity)}` })) })}
    ${formField({ label: t("own.product_name_en"), name: "name", required: true, placeholder: t("own.product_name_en_ph") })}
    ${formField({ label: t("own.product_name_am"), name: "nameAm", required: true, placeholder: t("own.product_name_am_ph") })}
    ${formField({ label: t("own.product_category"), name: "category", type: "select", value: "Vegetables", options: catOptions })}
    ${formField({ label: t("own.product_unit"), name: "unit", type: "select", value: "kg", options: unitOptions })}
    ${formField({ label: t("own.product_icon"), name: "icon", type: "select", value: "grain", options: iconOptions })}
    <div class="row mt8" style="gap:8px;">
      <div style="flex:1;">${formField({ label: t("own.suggested_min"), name: "min", type: "number" })}</div>
      <div style="flex:1;">${formField({ label: t("own.suggested_max"), name: "max", type: "number" })}</div>
    </div>
    <div class="row mt8" style="gap:8px;">
      <div style="flex:1;">${formField({ label: t("own.initial_price"), name: "ip", type: "number" })}</div>
      <div style="flex:1;">${formField({ label: t("own.initial_qty"), name: "iq", type: "number", value: "20" })}</div>
    </div>
    <div class="btnrow"><button class="primary" id="propSave">${t("own.propose_send")}</button><button class="ghost" id="propCancel">${t("cancel")}</button></div>
  `);
  document.getElementById("propCancel").onclick = () => closeModal();
  document.getElementById("propSave").onclick = async () => {
    const get = (n) => document.querySelector(`#modalBody [name=${n}]`).value;
    try {
      await ProductProposals.propose({
        shopId: get("shopId"),
        name: get("name").trim(),
        nameAm: get("nameAm").trim(),
        category: get("category"),
        unit: get("unit"),
        icon: get("icon"),
        suggestedMin: Number(get("min")),
        suggestedMax: Number(get("max")),
        initialPrice: Number(get("ip")),
        initialQty: Number(get("iq")),
      });
      toast(t("own.proposal_sent"), "success");
      closeModal();
      renderOwner();
    } catch (e) { toast(e.message, "danger"); }
  };
}

// ------------------ SHOP REGISTRATION ------------------
function openShopRegistration() {
  openModal(t("own.shop_modal"), `
    ${formField({ label: t("own.shop_name"), name: "name", required: true, placeholder: t("own.shop_name_ph") })}
    ${formField({ label: t("auth.subcity"), name: "subCity", type: "select", value: "Bole",
      options: SUB_CITIES.map(s => ({ value: s, label: subCityLabel(s) })) })}
    <div class="muted mt8" style="font-size:12px;">${t("own.shop_note")}</div>
    <div class="btnrow"><button class="primary" id="shopSave">${t("submit")}</button><button class="ghost" id="shopCancel">${t("cancel")}</button></div>
  `);
  document.getElementById("shopCancel").onclick = () => closeModal();
  document.getElementById("shopSave").onclick = async () => {
    const name = document.querySelector("#modalBody [name=name]").value.trim();
    const subCity = document.querySelector("#modalBody [name=subCity]").value;
    try {
      await Shops.register({ name, subCity });
      toast(t("own.shop_submitted"), "success");
      closeModal();
      renderOwner();
    } catch (e) { toast(e.message, "danger"); }
  };
}
