// js/views/owner.js
// Shop owner dashboard: orders queue, accept/reject, assign deliveries,
// inventory CRUD with regulated-range validation, and shop registration.

import { Inventory, Orders, PriceRanges, Products, Shops, Users } from "../api.js";
import { state } from "../state.js";
import {
  toast, openModal, closeModal, etb, dateShort, statusBadge, iconSvg, formField,
} from "./shared.js";
import { SUB_CITIES } from "../seed.js";

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
            <h2>Shop Owner Dashboard</h2>
            <div class="muted">Manage shops, inventory, and incoming orders.</div>
          </div>
          <button class="primary" id="newShopBtn">+ Register shop</button>
        </div>
        <div class="bd">
          <div class="statrow" id="ownerStats"></div>

          <div class="card mt12" style="box-shadow:none;border:1px solid var(--border);">
            <div class="hd"><h2>Orders queue</h2><div class="muted">Accept, prepare, and assign delivery</div></div>
            <div class="bd" id="ownerOrders">Loading…</div>
          </div>

          <div class="card mt12" style="box-shadow:none;border:1px solid var(--border);">
            <div class="hd">
              <h2>Inventory</h2>
              <select id="invShopSel">${myShops.map(s => `<option value="${s.id}">${s.name} · ${s.subCity}</option>`).join("")}</select>
            </div>
            <div class="bd" id="ownerInv">Loading…</div>
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
      `<div class="empty">Register a shop above to manage inventory. Once your local branch committee approves it, you can list items.</div>`;
  }

  document.getElementById("newShopBtn").addEventListener("click", () => openShopRegistration());
  document.getElementById("invShopSel")?.addEventListener("change", (e) => drawOwnerInventory(e.target.value));
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
    <div class="stat"><div class="k">Shops</div><div class="v">${shops.length}</div></div>
    <div class="stat"><div class="k">Approved</div><div class="v">${approved}</div></div>
    <div class="stat"><div class="k">Pending</div><div class="v">${pending}</div></div>
    <div class="stat"><div class="k">Orders received</div><div class="v">${totalOrders}</div></div>
    <div class="stat"><div class="k">Avg. rating</div><div class="v">${avgRating}</div></div>
  `;
}

async function drawOwnerOrders(shops) {
  const el = document.getElementById("ownerOrders");
  if (!shops.length) { el.innerHTML = `<div class="empty">Register a shop to receive orders.</div>`; return; }
  const allOrders = [];
  for (const s of shops) {
    const orders = await Orders.list({ shopId: s.id });
    for (const o of orders) allOrders.push({ ...o, shopName: s.name });
  }
  if (allOrders.length === 0) { el.innerHTML = `<div class="empty">No orders yet. They will appear here as soon as customers buy from your shop.</div>`; return; }

  el.innerHTML = allOrders.map(o => `
    <div class="pitem" style="grid-template-columns:48px 1fr auto;">
      <div class="pimg">${iconSvg("tomato")}</div>
      <div>
        <div class="ptitle">Order ${o.id.slice(-6).toUpperCase()} <span class="tag-chip">${o.shopName}</span></div>
        <div class="psub">${o.items.length} item(s) · ${etb(o.total)} · Customer: ${o.customerName}</div>
        <div class="muted mt8">${dateShort(o.createdAt)} · ${statusBadge(o.status)}</div>
      </div>
      <div class="flex" style="flex-direction:column;gap:6px;align-items:flex-end;">
        <button class="viewbtn" data-detail="${o.id}">View</button>
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
    return `<button class="addbtn" data-accept="${o.id}">Accept</button>
            <button class="viewbtn" data-cancel="${o.id}">Reject</button>`;
  }
  if (o.status === "accepted") {
    return `<button class="addbtn" data-prep="${o.id}">Mark preparing</button>`;
  }
  if (o.status === "preparing") {
    return `<button class="addbtn" data-assign="${o.id}">Assign delivery</button>`;
  }
  if (o.status === "dispatched") {
    return `<span class="muted" style="font-size:12px;">Awaiting delivery</span>`;
  }
  return `<span class="muted" style="font-size:12px;">No action</span>`;
}

async function updateStatus(orderId, status) {
  try {
    await Orders.updateStatus(orderId, status);
    toast(`Order updated · ${status}`, "success");
    renderOwner();
  } catch (e) { toast(e.message, "danger"); }
}

async function openAssignDelivery(orderId) {
  const couriers = await Users.listByRole("delivery");
  if (couriers.length === 0) { toast("No delivery personnel available", "danger"); return; }
  openModal("Assign delivery", `
    ${formField({ label: "Courier", name: "courier", type: "select", options: couriers.map(c => ({ value: c.id, label: `${c.name} · ${c.phone || ""}` })) })}
    ${formField({ label: "ETA", name: "eta", value: "30–45 min" })}
    <div class="muted mt8" style="font-size:12px;">Customer receives a 4-digit OTP. Courier confirms with OTP at delivery.</div>
    <div class="btnrow"><button class="primary" id="assignSubmit">Assign</button><button class="ghost" id="assignCancel">Cancel</button></div>
  `);
  document.getElementById("assignCancel").onclick = () => closeModal();
  document.getElementById("assignSubmit").onclick = async () => {
    const courierId = document.querySelector("#modalBody [name=courier]").value;
    const eta = document.querySelector("#modalBody [name=eta]").value.trim();
    try {
      const d = await Orders.assignDelivery(orderId, { courierId, eta });
      toast(`Delivery assigned · OTP ${d.otp}`, "success");
      closeModal();
      renderOwner();
    } catch (e) { toast(e.message, "danger"); }
  };
}

async function openOrderDetail(orderId) {
  const o = await Orders.byId(orderId);
  if (!o) return;
  openModal(`Order ${o.id.slice(-6).toUpperCase()}`, `
    <div class="row">
      <div><div style="font-weight:900;">Customer: ${o.customerName}</div><div class="muted">Sub-city: ${o.customerSubCity || "—"}</div></div>
      <div>${statusBadge(o.status)}</div>
    </div>
    <hr/>
    ${o.items.map(i => `<div class="row mt8"><div class="muted"><b>${i.name}</b> × ${i.qty}</div><div style="font-weight:900;">${etb(i.lineTotal)}</div></div>`).join("")}
    <hr/>
    <div class="row"><div style="font-weight:900;">Total</div><div style="font-weight:900;color:var(--g2);">${etb(o.total)}</div></div>
    <div class="muted mt8">Payment: <b>${o.paymentType === "prepay" ? "Pay now" : "Cash on delivery"}</b></div>
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
    <div class="muted">Listing prices must fall within committee-set ranges.</div>
    <div class="mt12" style="display:grid;gap:10px;">
      ${products.map(p => {
        const inv = inMap.get(p.id);
        const r = ranges.find(x => x.productId === p.id);
        const rangeText = r ? `Range ${etb(r.minPrice)}–${etb(r.maxPrice)}` : "No regulated range";
        const priceField = inv ? etb(inv.price) : "—";
        return `
          <div class="pitem">
            <div class="pimg">${iconSvg(p.icon)}</div>
            <div>
              <div class="ptitle">${p.name}</div>
              <div class="psub">${p.category} · ${p.unit}</div>
              <div class="muted mt8">${rangeText}</div>
            </div>
            <div class="pricebox">
              <div class="now">${priceField}</div>
              <div class="muted">Qty: ${inv ? inv.qty : 0}</div>
              <button class="addbtn" data-edit="${p.id}">${inv ? "Update" : "Add"}</button>
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
  openModal(existing ? "Update inventory" : "Add to inventory", `
    ${range ? `<div class="muted">Allowed range: <b>${etb(range.minPrice)}</b> to <b>${etb(range.maxPrice)}</b></div>` : ""}
    ${formField({ label: "Quantity", name: "qty", type: "number", value: String(existing?.qty || 10) })}
    ${formField({ label: "Unit price (ETB)", name: "price", type: "number", value: String(existing?.price || (range ? ((range.minPrice + range.maxPrice) / 2).toFixed(2) : "")) })}
    <div class="btnrow"><button class="primary" id="invSave">Save</button><button class="ghost" id="invCancel">Cancel</button></div>
  `);
  document.getElementById("invCancel").onclick = () => closeModal();
  document.getElementById("invSave").onclick = async () => {
    const qty = Number(document.querySelector("#modalBody [name=qty]").value);
    const price = Number(document.querySelector("#modalBody [name=price]").value);
    try {
      await Inventory.upsert({ id: existing?.id, shopId, productId, qty, price });
      toast("Inventory saved", "success");
      closeModal();
      renderOwner();
    } catch (e) { toast(e.message, "danger"); }
  };
}

// ------------------ SHOP REGISTRATION ------------------
function openShopRegistration() {
  openModal("Register a new shop", `
    ${formField({ label: "Shop name", name: "name", required: true, placeholder: "e.g., Bole Fresh Veggies" })}
    ${formField({ label: "Sub-city", name: "subCity", type: "select", value: "Bole",
      options: SUB_CITIES.map(s => ({ value: s, label: s })) })}
    <div class="muted mt8" style="font-size:12px;">After submission, the local branch committee reviews and approves your shop before you can sell.</div>
    <div class="btnrow"><button class="primary" id="shopSave">Submit</button><button class="ghost" id="shopCancel">Cancel</button></div>
  `);
  document.getElementById("shopCancel").onclick = () => closeModal();
  document.getElementById("shopSave").onclick = async () => {
    const name = document.querySelector("#modalBody [name=name]").value.trim();
    const subCity = document.querySelector("#modalBody [name=subCity]").value;
    try {
      await Shops.register({ name, subCity });
      toast("Submitted for branch committee review", "success");
      closeModal();
      renderOwner();
    } catch (e) { toast(e.message, "danger"); }
  };
}
