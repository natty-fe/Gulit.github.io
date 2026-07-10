// js/views/delivery.js
// Delivery personnel dashboard: assigned tasks, status updates, OTP confirm.

import { Deliveries, Orders } from "../api.js";
import { state } from "../state.js";
import {
  toast, openModal, closeModal, etb, dateShort, statusBadge, formField, t,
  subCityLabel,
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
          <div><h2>${t("dlv.title")}</h2><div class="muted">${t("dlv.subtitle")}</div></div>
        </div>
        <div class="bd" id="dlvBody">${t("loading")}</div>
      </div>
    </section>
  `;
  await drawList();
}

async function drawList() {
  const u = state.user;
  const list = await Deliveries.list({ courierId: u.id });
  const el = document.getElementById("dlvBody");
  if (!list.length) { el.innerHTML = `<div class="empty">${t("dlv.no_tasks")}</div>`; return; }

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
            <div style="font-weight:900;">${t("track.delivery")} · ${t("track.order_label")} ${o ? o.id.slice(-6).toUpperCase() : "—"}</div>
            <div class="muted">${t("dlv.drop")}: <b>${subCityLabel(o?.customerSubCity) || "—"}</b> · ${t("dlv.eta")} <b>${d.eta || "—"}</b></div>
          </div>
          <div>${statusBadge(d.status)}</div>
        </div>
        <div class="muted mt8">${t("items_count", { n: o?.items?.length || 0 })} · ${t("total")} <b>${etb(o?.total || 0)}</b></div>
        <div class="progress"><div class="bar" style="width:${pct}%"></div></div>
        <div class="stepbtns">
          ${nextStepButtons(d)}
          <button class="ghost" data-detail="${d.orderId}">${t("items")}</button>
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
  if (d.status === "delivered") return `<span class="muted" style="font-size:12px;">${t("dlv.completed")}</span>`;
  const next = FLOW[cur + 1];
  if (!next) return "";
  if (next === "delivered") {
    return `<button class="primary" data-confirm="${d.id}">${t("dlv.confirm_btn")}</button>`;
  }
  return `<button class="addbtn" data-step="${next}" data-id="${d.id}">${t("dlv.mark", { label: labelOf(next) })}</button>`;
}

function labelOf(s) {
  return t(`dlv.label.${s}`, s);
}

async function setStatus(id, status) {
  try {
    await Deliveries.updateStatus(id, status);
    toast(`${t(`status.${status}`, status)}`, "success");
    drawList();
  } catch (e) { toast(e.message, "danger"); }
}

function openConfirm(deliveryId) {
  openModal(t("dlv.confirm_title"), `
    <div class="muted">${t("dlv.otp_note")}</div>
    ${formField({ label: t("dlv.otp"), name: "otp", placeholder: "1234" })}
    <div class="btnrow"><button class="primary" id="otpSubmit">${t("dlv.confirm")}</button><button class="ghost" id="otpCancel">${t("cancel")}</button></div>
  `);
  document.getElementById("otpCancel").onclick = () => closeModal();
  document.getElementById("otpSubmit").onclick = async () => {
    const otp = document.querySelector("#modalBody [name=otp]").value.trim();
    try {
      await Deliveries.confirm(deliveryId, otp);
      toast(t("dlv.confirmed"), "success");
      closeModal();
      drawList();
    } catch (e) { toast(e.message, "danger"); }
  };
}

async function openItems(orderId) {
  const o = await Orders.byId(orderId);
  if (!o) return;
  openModal(t("dlv.items_modal", { id: o.id.slice(-6).toUpperCase() }), `
    ${o.items.map(i => `
      <div class="row mt8"><div class="muted"><b>${i.name}</b> × ${i.qty}</div><div style="font-weight:900;">${etb(i.lineTotal)}</div></div>
    `).join("")}
    <hr/>
    <div class="row"><div style="font-weight:900;">${t("total")}</div><div style="font-weight:900;color:var(--primary);">${etb(o.total)}</div></div>
    <div class="muted mt8">${t("track.payment")}: <b>${o.paymentType === "prepay" ? t("track.pay_now_label") : t("track.pay_cod_label")}</b></div>
  `);
}
