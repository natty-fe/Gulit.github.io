// js/views/delivery.js
// Delivery personnel dashboard: assigned tasks, status updates, OTP confirm.

import { Deliveries, Orders } from "../api.js";
import { state } from "../state.js";
import {
  toast, openModal, closeModal, etb, dateShort, statusBadge, formField,
} from "./shared.js";

const view = () => document.getElementById("view");

const FLOW = ["assigned", "accepted", "picked_up", "en_route", "delivered"];

export async function renderDelivery() {
  const u = state.user;
  if (!u || u.role !== "delivery") { location.hash = "#/auth"; return; }

  const v = view();
  v.innerHTML = `
    <section class="page">
      <div class="card">
        <div class="hd">
          <div><h2>Delivery dashboard</h2><div class="muted">Update task status and confirm with customer OTP.</div></div>
        </div>
        <div class="bd" id="dlvBody">Loading…</div>
      </div>
    </section>
  `;
  await drawList();
}

async function drawList() {
  const u = state.user;
  const list = await Deliveries.list({ courierId: u.id });
  const el = document.getElementById("dlvBody");
  if (!list.length) { el.innerHTML = `<div class="empty">No assigned deliveries yet.</div>`; return; }

  // Get order details in parallel for richer cards.
  const orders = await Promise.all(list.map(d => Orders.byId(d.orderId)));
  el.innerHTML = list.map((d, i) => {
    const o = orders[i];
    const idx = FLOW.indexOf(d.status);
    const pct = ((idx + 1) / FLOW.length) * 100;
    return `
      <div class="deliverycard mt12">
        <div class="row">
          <div>
            <div style="font-weight:900;">Delivery · Order ${o ? o.id.slice(-6).toUpperCase() : "—"}</div>
            <div class="muted">Drop: <b>${o?.customerSubCity || "—"}</b> · ETA <b>${d.eta || "—"}</b></div>
          </div>
          <div>${statusBadge(d.status)}</div>
        </div>
        <div class="muted mt8">${o?.items?.length || 0} item(s) · Total <b>${etb(o?.total || 0)}</b></div>
        <div class="progress"><div class="bar" style="width:${pct}%"></div></div>
        <div class="stepbtns">
          ${nextStepButtons(d)}
          <button class="ghost" data-detail="${d.orderId}">Items</button>
        </div>
      </div>
    `;
  }).join("");

  document.querySelectorAll("[data-step]").forEach(b => b.addEventListener("click", () =>
    setStatus(b.dataset.id, b.dataset.step)));
  document.querySelectorAll("[data-confirm]").forEach(b => b.addEventListener("click", () =>
    openConfirm(b.dataset.confirm)));
  document.querySelectorAll("[data-detail]").forEach(b => b.addEventListener("click", () =>
    openItems(b.dataset.detail)));
}

function nextStepButtons(d) {
  const cur = FLOW.indexOf(d.status);
  if (d.status === "delivered") return `<span class="muted" style="font-size:12px;">Completed</span>`;
  // Allow advance to immediate next step or to delivered (which requires OTP).
  const next = FLOW[cur + 1];
  if (!next) return "";
  if (next === "delivered") {
    return `<button class="primary" data-confirm="${d.id}">Confirm with OTP</button>`;
  }
  return `<button class="addbtn" data-step="${next}" data-id="${d.id}">Mark ${labelOf(next)}</button>`;
}

function labelOf(s) {
  return ({ accepted: "accepted", picked_up: "picked up", en_route: "en route", delivered: "delivered" })[s] || s;
}

async function setStatus(id, status) {
  try {
    await Deliveries.updateStatus(id, status);
    toast(`Status: ${labelOf(status)}`, "success");
    drawList();
  } catch (e) { toast(e.message, "danger"); }
}

function openConfirm(deliveryId) {
  openModal("Confirm delivery with OTP", `
    <div class="muted">Ask the customer for the 4-digit OTP shown on their tracking screen.</div>
    ${formField({ label: "OTP", name: "otp", placeholder: "1234" })}
    <div class="btnrow"><button class="primary" id="otpSubmit">Confirm</button><button class="ghost" id="otpCancel">Cancel</button></div>
  `);
  document.getElementById("otpCancel").onclick = () => closeModal();
  document.getElementById("otpSubmit").onclick = async () => {
    const otp = document.querySelector("#modalBody [name=otp]").value.trim();
    try {
      await Deliveries.confirm(deliveryId, otp);
      toast("Delivery confirmed", "success");
      closeModal();
      drawList();
    } catch (e) { toast(e.message, "danger"); }
  };
}

async function openItems(orderId) {
  const o = await Orders.byId(orderId);
  if (!o) return;
  openModal(`Items · Order ${o.id.slice(-6).toUpperCase()}`, `
    ${o.items.map(i => `
      <div class="row mt8"><div class="muted"><b>${i.name}</b> × ${i.qty}</div><div style="font-weight:900;">${etb(i.lineTotal)}</div></div>
    `).join("")}
    <hr/>
    <div class="row"><div style="font-weight:900;">Total</div><div style="font-weight:900;color:var(--primary);">${etb(o.total)}</div></div>
    <div class="muted mt8">Payment: <b>${o.paymentType === "prepay" ? "Pay now" : "Cash on delivery"}</b></div>
  `);
}
