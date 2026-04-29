// js/views/committee.js
// Branch and Main committee dashboards.

import { Audit, Complaints, PriceRanges, Products, Shops } from "../api.js";
import { state } from "../state.js";
import {
  toast, openModal, closeModal, etb, dateShort, timeShort, statusBadge, formField, t,
} from "./shared.js";

const view = () => document.getElementById("view");

// ------------------ BRANCH COMMITTEE ------------------
export async function renderBranchCommittee() {
  const u = state.user;
  if (!u || u.role !== "branch") { location.hash = "#/auth"; return; }

  const v = view();
  v.innerHTML = `
    <section class="page">
      <div class="card">
        <div class="hd">
          <div><h2>${t("br.title", { city: u.subCity })}</h2><div class="muted">${t("br.subtitle")}</div></div>
          <div class="flex"><button class="viewbtn" id="auditBtn">${t("br.audit_btn")}</button></div>
        </div>
        <div class="bd">
          <div class="card mt8" style="box-shadow:none;border:1px solid var(--border);">
            <div class="hd"><h2>${t("br.pending_title")}</h2><div class="muted">${t("br.pending_subtitle")}</div></div>
            <div class="bd" id="pendShops">${t("loading")}</div>
          </div>

          <div class="card mt12" style="box-shadow:none;border:1px solid var(--border);">
            <div class="hd"><h2>${t("br.queue_title")}</h2><div class="muted">${t("br.queue_subtitle")}</div></div>
            <div class="bd" id="cmpQueue">${t("loading")}</div>
          </div>
        </div>
      </div>
    </section>
  `;

  document.getElementById("auditBtn").addEventListener("click", openAuditLog);

  await drawPendingShops();
  await drawComplaintsForBranch();
}

async function drawPendingShops() {
  const u = state.user;
  const allPending = await Shops.list({ subCity: u.subCity, status: "pending" });
  const el = document.getElementById("pendShops");
  if (!allPending.length) { el.innerHTML = `<div class="empty">${t("br.no_pending")}</div>`; return; }
  el.innerHTML = allPending.map(s => `
    <div class="case">
      <div class="row">
        <div>
          <div class="title">${s.name}</div>
          <div class="meta">${t("auth.subcity")}: <b>${s.subCity}</b> · ${t("br.submitted", { date: dateShort(s.createdAt) })} · ${statusBadge(s.status)}</div>
        </div>
      </div>
      <div class="actions">
        <button class="addbtn" data-approve="${s.id}">${t("br.approve")}</button>
        <button class="ghost" data-reject="${s.id}">${t("br.reject")}</button>
      </div>
    </div>
  `).join("");

  el.querySelectorAll("[data-approve]").forEach(b => b.addEventListener("click", () => decideShop(b.dataset.approve, "approved")));
  el.querySelectorAll("[data-reject]").forEach(b => b.addEventListener("click", () => decideShop(b.dataset.reject, "rejected")));
}

async function decideShop(shopId, status) {
  let reason = "";
  if (status === "rejected") {
    reason = prompt(t("br.reject_reason")) || "";
    if (!reason) return;
  }
  try {
    await Shops.setStatus(shopId, status, reason);
    toast(t("br.shop_status", { status: t(`status.${status}`) }), "success");
    drawPendingShops();
  } catch (e) { toast(e.message, "danger"); }
}

async function drawComplaintsForBranch() {
  const u = state.user;
  // Scope complaints to this branch's committee. Seed users have committeeId set;
  // for any branch user without one, fall back to filtering by their sub-city's shops.
  let cases;
  if (u.committeeId) {
    cases = await Complaints.list({ branchCommitteeId: u.committeeId, status: "open" });
  } else {
    const shopsHere = await Shops.list({ subCity: u.subCity });
    const ids = new Set(shopsHere.map(s => s.id));
    const all = await Complaints.list({ status: "open" });
    cases = all.filter(c => ids.has(c.shopId));
  }
  const el = document.getElementById("cmpQueue");
  if (!cases.length) { el.innerHTML = `<div class="empty">${t("br.no_open")}</div>`; return; }
  el.innerHTML = cases.map(c => `
    <div class="case">
      <div class="row">
        <div>
          <div class="title">${c.id.slice(-6).toUpperCase()} · ${c.type}</div>
          <div class="meta">${t("br.from")}: <b>${c.fromName}</b> · ${t("br.order_label")}: <b>${c.orderId.slice(-6).toUpperCase()}</b> · ${t("br.shop_label")}: <b>${c.shopName}</b></div>
          <div class="meta">${t("br.submitted", { date: dateShort(c.createdAt) })} · ${statusBadge(c.status)}</div>
        </div>
      </div>
      <div class="muted mt8">${c.detail}</div>
      <div class="actions">
        <button class="addbtn" data-decide="${c.id}" data-decision="approved">${t("br.approve_refund")}</button>
        <button class="ghost" data-decide="${c.id}" data-decision="rejected">${t("br.reject")}</button>
        <button class="ghost" data-decide="${c.id}" data-decision="escalated">${t("br.escalate")}</button>
      </div>
    </div>
  `).join("");

  el.querySelectorAll("[data-decide]").forEach(b => b.addEventListener("click", () => decideCase(b.dataset.decide, b.dataset.decision)));
}

async function decideCase(caseId, decision) {
  const note = prompt(t("br.decision_note")) || "";
  try {
    await Complaints.decide(caseId, decision, note);
    toast(t("br.case_updated", { decision: t(`status.${decision}`, decision) }), "success");
    drawComplaintsForBranch();
  } catch (e) { toast(e.message, "danger"); }
}

// ------------------ MAIN COMMITTEE ------------------
export async function renderMainCommittee() {
  const u = state.user;
  if (!u || u.role !== "main") { location.hash = "#/auth"; return; }

  const v = view();
  v.innerHTML = `
    <section class="page">
      <div class="card">
        <div class="hd">
          <div><h2>${t("mc.title")}</h2><div class="muted">${t("mc.subtitle")}</div></div>
          <div class="flex"><button class="viewbtn" id="auditBtn">${t("br.audit_btn")}</button></div>
        </div>
        <div class="bd">
          <div class="card mt8" style="box-shadow:none;border:1px solid var(--border);">
            <div class="hd"><h2>${t("mc.ranges_title")}</h2><div class="muted">${t("mc.ranges_subtitle")}</div></div>
            <div class="bd" id="prList">${t("loading")}</div>
          </div>

          <div class="card mt12" style="box-shadow:none;border:1px solid var(--border);">
            <div class="hd"><h2>${t("mc.escalations_title")}</h2><div class="muted">${t("mc.escalations_subtitle")}</div></div>
            <div class="bd" id="escList">${t("loading")}</div>
          </div>
        </div>
      </div>
    </section>
  `;

  document.getElementById("auditBtn").addEventListener("click", openAuditLog);
  await drawPriceRanges();
  await drawEscalations();
}

async function drawPriceRanges() {
  const ranges = await PriceRanges.list();
  const products = await Products.list();
  const el = document.getElementById("prList");
  el.innerHTML = `
    <div class="muted">${t("mc.ranges_note")}</div>
    <div class="mt12" style="display:grid;gap:10px;">
      ${products.map(p => {
        const r = ranges.find(x => x.productId === p.id);
        return `
          <div class="pitem">
            <div class="pimg"><svg viewBox="0 0 24 24" width="32" height="32" fill="none"><path d="M3 12h18M12 3v18" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="color:var(--primary)"/></svg></div>
            <div>
              <div class="ptitle">${p.name}</div>
              <div class="psub">${t(`cat.${p.category}`, p.category)} · ${p.unit}</div>
              <div class="muted mt8">${r ? t("mc.effective", { date: dateShort(r.effectiveDate) }) : t("mc.no_range")}</div>
            </div>
            <div class="pricebox">
              <div class="now">${r ? `${etb(r.minPrice)} – ${etb(r.maxPrice)}` : "—"}</div>
              <button class="addbtn" data-edit="${p.id}">${r ? t("mc.update") : t("mc.set")}</button>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  el.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => openSetRange(b.dataset.edit, ranges, products)));
}

function openSetRange(productId, ranges, products) {
  const product = products.find(p => p.id === productId);
  const range = ranges.find(r => r.productId === productId);
  openModal(t("mc.set_modal", { name: product.name }), `
    ${formField({ label: t("mc.min_price"), name: "min", type: "number", value: range?.minPrice || 0 })}
    ${formField({ label: t("mc.max_price"), name: "max", type: "number", value: range?.maxPrice || 0 })}
    <div class="muted mt8" style="font-size:12px;">${t("mc.set_note")}</div>
    <div class="btnrow"><button class="primary" id="rngSave">${t("save")}</button><button class="ghost" id="rngCancel">${t("cancel")}</button></div>
  `);
  document.getElementById("rngCancel").onclick = () => closeModal();
  document.getElementById("rngSave").onclick = async () => {
    const min = Number(document.querySelector("#modalBody [name=min]").value);
    const max = Number(document.querySelector("#modalBody [name=max]").value);
    try {
      await PriceRanges.set({ productId, minPrice: min, maxPrice: max });
      toast(t("mc.range_updated"), "success");
      closeModal();
      drawPriceRanges();
    } catch (e) { toast(e.message, "danger"); }
  };
}

async function drawEscalations() {
  const cases = await Complaints.list({ mainOnly: true });
  const el = document.getElementById("escList");
  if (!cases.length) { el.innerHTML = `<div class="empty">${t("mc.no_escalations")}</div>`; return; }
  el.innerHTML = cases.map(c => `
    <div class="case">
      <div class="row">
        <div>
          <div class="title">${c.id.slice(-6).toUpperCase()} · ${c.type}</div>
          <div class="meta">${t("br.from")}: <b>${c.fromName}</b> · ${t("br.shop_label")}: <b>${c.shopName}</b> · ${statusBadge(c.status)}</div>
        </div>
      </div>
      <div class="muted mt8">${c.detail}</div>
      <div class="actions">
        <button class="addbtn" data-decide="${c.id}" data-decision="approved">${t("br.approve_refund")}</button>
        <button class="ghost" data-decide="${c.id}" data-decision="rejected">${t("br.reject")}</button>
        <button class="ghost" data-decide="${c.id}" data-decision="resolved">${t("mc.mark_resolved")}</button>
      </div>
    </div>
  `).join("");

  el.querySelectorAll("[data-decide]").forEach(b => b.addEventListener("click", async () => {
    const note = prompt(t("mc.final_note")) || "";
    try {
      await Complaints.decide(b.dataset.decide, b.dataset.decision, note);
      toast(t("br.case_updated", { decision: t(`status.${b.dataset.decision}`, b.dataset.decision) }), "success");
      drawEscalations();
    } catch (e) { toast(e.message, "danger"); }
  }));
}

// ------------------ AUDIT LOG (shared modal) ------------------
async function openAuditLog() {
  const rows = await Audit.list({ limit: 100 });
  openModal(t("audit.title"), `
    <div class="muted">${t("audit.subtitle")}</div>
    <div class="mt12" style="display:grid;gap:6px;">
      ${rows.map(r => `
        <div class="comment" style="background:var(--surface);">
          <div class="row" style="align-items:flex-start;">
            <div>
              <div style="font-weight:900;">${r.action}</div>
              <div class="muted" style="font-size:12px;">${r.entity}${r.entityId ? " · " + r.entityId.slice(-6) : ""}</div>
            </div>
            <div class="muted" style="font-size:12px;">${dateShort(r.timestamp)} ${timeShort(r.timestamp)}</div>
          </div>
          ${r.details && Object.keys(r.details).length
            ? `<div class="muted mt8" style="font-size:12px;font-family:ui-monospace,monospace;">${escapeHtml(JSON.stringify(r.details))}</div>`
            : ""}
        </div>
      `).join("") || `<div class="empty">${t("audit.empty")}</div>`}
    </div>
  `);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}
