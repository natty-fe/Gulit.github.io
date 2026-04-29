// js/views/committee.js
// Branch and Main committee dashboards.

import { Audit, Complaints, Inventory, Notifications, PriceRanges, Products, ProductProposals, Shops } from "../api.js";
import { state } from "../state.js";
import {
  toast, openModal, closeModal, etb, dateShort, timeShort, statusBadge, iconSvg, formField, t,
  productName, shopName, subCityLabel, unitLabel,
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
          <div><h2>${t("br.title", { city: subCityLabel(u.subCity) })}</h2><div class="muted">${t("br.subtitle")}</div></div>
          <div class="flex"><button class="viewbtn" id="auditBtn">${t("br.audit_btn")}</button></div>
        </div>
        <div class="bd">
          <div class="card mt8" style="box-shadow:none;border:1px solid var(--border);">
            <div class="hd"><h2>${t("br.pending_title")}</h2><div class="muted">${t("br.pending_subtitle")}</div></div>
            <div class="bd" id="pendShops">${t("loading")}</div>
          </div>

          <div class="card mt12" style="box-shadow:none;border:1px solid var(--border);">
            <div class="hd"><h2>${t("br.proposals_title")}</h2><div class="muted">${t("br.proposals_subtitle")}</div></div>
            <div class="bd" id="propQueue">${t("loading")}</div>
          </div>

          <div class="card mt12" style="box-shadow:none;border:1px solid var(--border);">
            <div class="hd"><h2>${t("br.queue_title")}</h2><div class="muted">${t("br.queue_subtitle")}</div></div>
            <div class="bd" id="cmpQueue">${t("loading")}</div>
          </div>

          <div class="card mt12" style="box-shadow:none;border:1px solid var(--border);">
            <div class="hd"><h2>${t("br.shops_title")}</h2><div class="muted">${t("br.shops_subtitle")}</div></div>
            <div class="bd" id="brShops">${t("loading")}</div>
          </div>

          <div class="card mt12" style="box-shadow:none;border:1px solid var(--border);">
            <div class="hd"><h2>${t("br.notifs_title")}</h2><div class="muted">${t("br.notifs_subtitle")}</div></div>
            <div class="bd" id="brNotifs">${t("loading")}</div>
          </div>
        </div>
      </div>
    </section>
  `;

  document.getElementById("auditBtn").addEventListener("click", openAuditLog);

  await drawPendingShops();
  await drawProposalsForBranch();
  await drawComplaintsForBranch();
  await drawShopsForBranch();
  await drawBranchNotifs();
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
          <div class="title">${shopName(s)}</div>
          <div class="meta">${t("auth.subcity")}: <b>${subCityLabel(s.subCity)}</b> · ${t("br.submitted", { date: dateShort(s.createdAt) })} · ${statusBadge(s.status)}</div>
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
          <div class="meta">${t("br.from")}: <b>${c.fromName}</b> · ${t("br.order_label")}: <b>${c.orderId.slice(-6).toUpperCase()}</b> · ${t("br.shop_label")}: <b>${shopName({ name: c.shopName })}</b></div>
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

// Resolve which complaints/proposals/notifications belong to this branch.
async function branchScope() {
  const u = state.user;
  if (u.committeeId) return { committeeId: u.committeeId, shopFilter: null };
  // Older branch users without committeeId fall back to sub-city filtering.
  const shopsHere = await Shops.list({ subCity: u.subCity });
  return { committeeId: null, shopFilter: new Set(shopsHere.map(s => s.id)) };
}

async function drawProposalsForBranch() {
  const el = document.getElementById("propQueue");
  if (!el) return;
  const { committeeId } = await branchScope();
  let rows = [];
  if (committeeId) {
    rows = await ProductProposals.list({ branchCommitteeId: committeeId, status: "pending" });
  } else {
    const all = await ProductProposals.list({ status: "pending" });
    const u = state.user;
    const shopsHere = await Shops.list({ subCity: u.subCity });
    const ids = new Set(shopsHere.map(s => s.id));
    rows = all.filter(p => ids.has(p.shopId));
  }
  if (!rows.length) { el.innerHTML = `<div class="empty">${t("br.no_proposals")}</div>`; return; }
  el.innerHTML = rows.map(p => `
    <div class="case">
      <div class="row" style="align-items:flex-start;">
        <div>
          <div class="title">${p.name} · <span class="muted" style="font-weight:600;">${p.nameAm}</span></div>
          <div class="meta">${t(`cat.${p.category}`, p.category)} · ${unitLabel(p.unit)} · ${t("br.proposed_by")}: <b>${p.ownerName}</b> · ${shopName({ name: p.shopName })}</div>
          <div class="meta">${t("br.suggested_label")}: <b>${etb(p.suggestedMin)}–${etb(p.suggestedMax)}</b> · ${t("br.initial_label")}: <b>${etb(p.initialPrice)}</b> × ${p.initialQty}</div>
          <div class="meta">${t("br.submitted", { date: dateShort(p.createdAt) })} · ${statusBadge(p.status)}</div>
        </div>
        <div class="pimg">${iconSvg(p.icon)}</div>
      </div>
      <div class="actions">
        <button class="addbtn" data-prop="${p.id}" data-decision="approved">${t("br.approve")}</button>
        <button class="ghost" data-prop="${p.id}" data-decision="rejected">${t("br.reject")}</button>
      </div>
    </div>
  `).join("");

  el.querySelectorAll("[data-prop]").forEach(b => b.addEventListener("click", () =>
    decideProposal(b.dataset.prop, b.dataset.decision)));
}

async function decideProposal(id, decision) {
  let note = "";
  if (decision === "rejected") {
    note = prompt(t("br.decision_note")) || "";
    if (!note) return;
  }
  try {
    await ProductProposals.decide(id, decision, note);
    toast(t("br.proposal_decided", { decision: t(`status.${decision}`) }), "success");
    drawProposalsForBranch();
  } catch (e) { toast(e.message, "danger"); }
}

async function drawShopsForBranch() {
  const u = state.user;
  const el = document.getElementById("brShops");
  if (!el) return;
  const shops = await Shops.list({ subCity: u.subCity, status: "approved" });
  if (!shops.length) { el.innerHTML = `<div class="empty">${t("br.no_shops_here")}</div>`; return; }
  el.innerHTML = shops.map(s => `
    <div class="pitem" style="grid-template-columns:1fr auto;">
      <div>
        <div class="ptitle">${shopName(s)}</div>
        <div class="psub">${subCityLabel(s.subCity)} · ★ ${(s.rating || 0).toFixed(1)}</div>
      </div>
      <button class="viewbtn" data-shop="${s.id}">${t("br.view_inventory")}</button>
    </div>
  `).join("");
  el.querySelectorAll("[data-shop]").forEach(b => b.addEventListener("click", () => openShopInventory(b.dataset.shop)));
}

async function openShopInventory(shopId) {
  const shop = await Shops.byId(shopId);
  if (!shop) return;
  const inv = await Inventory.byShop(shopId);
  const ranges = await PriceRanges.list();
  const body = inv.length === 0
    ? `<div class="empty">${t("br.no_inventory")}</div>`
    : inv.map(i => {
        const r = ranges.find(x => x.productId === i.productId);
        const outOfBand = r && (i.price < r.minPrice || i.price > r.maxPrice);
        return `
          <div class="pitem">
            <div class="pimg">${iconSvg(i.product?.icon || "grain")}</div>
            <div>
              <div class="ptitle">${productName(i.product)}</div>
              <div class="psub">${unitLabel(i.product?.unit)} · ${t("own.qty")}: ${i.qty}</div>
              <div class="muted mt8">${r ? t("own.range_label", { min: etb(r.minPrice), max: etb(r.maxPrice) }) : t("own.no_range")}</div>
            </div>
            <div class="pricebox">
              <div class="now" style="${outOfBand ? "color:var(--danger,#dc2626);" : ""}">${etb(i.price)}</div>
              ${outOfBand ? `<div class="muted" style="color:var(--danger,#dc2626);font-size:11px;">⚠ out of band</div>` : ""}
            </div>
          </div>
        `;
      }).join("");
  openModal(t("br.inv_modal", { shop: shopName(shop) }), `
    <div class="muted">${subCityLabel(shop.subCity)}</div>
    <div class="mt12" style="display:grid;gap:10px;">${body}</div>
  `);
}

async function drawBranchNotifs() {
  const el = document.getElementById("brNotifs");
  if (!el) return;
  const { committeeId } = await branchScope();
  if (!committeeId) { el.innerHTML = `<div class="empty">${t("br.no_notifs")}</div>`; return; }
  const items = await Notifications.list({ recipientType: "committee", recipientId: committeeId, limit: 30 });
  if (!items.length) { el.innerHTML = `<div class="empty">${t("br.no_notifs")}</div>`; return; }
  el.innerHTML = items.map(n => `
    <div class="comment ${n.read ? "" : "unread"}" style="background:var(--surface);">
      <div class="row" style="align-items:flex-start;">
        <div>
          <div style="font-weight:900;">${notifTitleCommittee(n)}</div>
          ${n.body ? `<div class="muted mt8" style="font-size:13px;">${escapeHtml(n.body)}</div>` : ""}
        </div>
        <div class="muted" style="font-size:12px;">${dateShort(n.createdAt)} ${timeShort(n.createdAt)}</div>
      </div>
      ${n.read ? "" : `<div class="actions"><button class="ghost" data-mark="${n.id}">${t("own.mark_read")}</button></div>`}
    </div>
  `).join("");
  el.querySelectorAll("[data-mark]").forEach(b => b.addEventListener("click", async () => {
    await Notifications.markRead(b.dataset.mark);
    drawBranchNotifs();
  }));
}

function notifTitleCommittee(n) {
  const d = n.data || {};
  switch (n.type) {
    case "PROPOSAL_PENDING":     return t("notif.proposal_pending", { owner: d.ownerName || "", name: d.productName || "" });
    case "PRICE_CHANGE":         return t("notif.price_change", {
      shop: d.shopName || "", product: d.productName || "",
      oldPrice: etb(d.oldPrice ?? 0), newPrice: etb(d.newPrice ?? 0),
    });
    case "COMPLAINT_OPEN":       return t("notif.complaint_open",      { shop: d.shopName || "", type: d.type || "" });
    case "COMPLAINT_ESCALATED":  return t("notif.complaint_escalated", { id: (d.complaintId || "").slice(-6).toUpperCase(), type: d.type || "" });
    default: return n.title || n.type;
  }
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

          <div class="card mt12" style="box-shadow:none;border:1px solid var(--border);">
            <div class="hd"><h2>${t("mc.complaints_overview")}</h2><div class="muted">${t("mc.complaints_subtitle")}</div></div>
            <div class="bd" id="mcOverview">${t("loading")}</div>
          </div>

          <div class="card mt12" style="box-shadow:none;border:1px solid var(--border);">
            <div class="hd"><h2>${t("mc.notifs_title")}</h2><div class="muted">${t("mc.notifs_subtitle")}</div></div>
            <div class="bd" id="mcNotifs">${t("loading")}</div>
          </div>
        </div>
      </div>
    </section>
  `;

  document.getElementById("auditBtn").addEventListener("click", openAuditLog);
  await drawPriceRanges();
  await drawEscalations();
  await drawMainOverview();
  await drawMainNotifs();
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
              <div class="ptitle">${productName(p)}</div>
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
  openModal(t("mc.set_modal", { name: productName(product) }), `
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
          <div class="meta">${t("br.from")}: <b>${c.fromName}</b> · ${t("br.shop_label")}: <b>${shopName({ name: c.shopName })}</b> · ${statusBadge(c.status)}</div>
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

// ------------------ MAIN: complaints overview & notifications ------
async function drawMainOverview() {
  const el = document.getElementById("mcOverview");
  if (!el) return;
  const all = await Complaints.list({});
  if (!all.length) { el.innerHTML = `<div class="empty">${t("mc.no_complaints")}</div>`; return; }
  // "Open" = unanswered. "in_review" not in current data model; we show
  // open as unanswered. Resolved/rejected/escalated come straight from status.
  const counts = { open: 0, escalated: 0, resolved: 0, rejected: 0 };
  for (const c of all) counts[c.status] = (counts[c.status] || 0) + 1;

  el.innerHTML = `
    <div class="statrow">
      <div class="stat" data-filter="open"><div class="k">${t("mc.cnt_unanswered")}</div><div class="v">${counts.open}</div></div>
      <div class="stat" data-filter="escalated"><div class="k">${t("mc.cnt_escalated")}</div><div class="v">${counts.escalated}</div></div>
      <div class="stat" data-filter="resolved"><div class="k">${t("mc.cnt_resolved")}</div><div class="v">${counts.resolved}</div></div>
      <div class="stat" data-filter="rejected"><div class="k">${t("mc.cnt_rejected")}</div><div class="v">${counts.rejected}</div></div>
      <div class="stat" data-filter="all"><div class="k">${t("mc.filter_all")}</div><div class="v">${all.length}</div></div>
    </div>
    <div class="mt12" style="display:grid;gap:8px;" id="mcOverviewList"></div>
  `;
  const renderList = (filter) => {
    const list = document.getElementById("mcOverviewList");
    const rows = filter === "all" ? all : all.filter(c => c.status === filter);
    if (!rows.length) { list.innerHTML = `<div class="empty">—</div>`; return; }
    list.innerHTML = rows.map(c => `
      <div class="case">
        <div class="row" style="align-items:flex-start;">
          <div>
            <div class="title">${c.id.slice(-6).toUpperCase()} · ${c.type}</div>
            <div class="meta">${t("br.from")}: <b>${c.fromName}</b> · ${t("br.shop_label")}: <b>${shopName({ name: c.shopName })}</b></div>
            <div class="meta">${dateShort(c.createdAt)} · ${statusBadge(c.status)}</div>
            ${c.detail ? `<div class="muted mt8">${escapeHtml(c.detail)}</div>` : ""}
            ${c.decisionNote ? `<div class="muted mt8">"${escapeHtml(c.decisionNote)}"</div>` : ""}
          </div>
        </div>
      </div>
    `).join("");
  };
  renderList("all");
  el.querySelectorAll("[data-filter]").forEach(b => b.addEventListener("click", () => {
    el.querySelectorAll(".stat").forEach(s => s.classList.remove("selected"));
    b.classList.add("selected");
    renderList(b.dataset.filter);
  }));
}

async function drawMainNotifs() {
  const el = document.getElementById("mcNotifs");
  if (!el) return;
  const main = (await DBCommitteeMain());
  if (!main) { el.innerHTML = `<div class="empty">${t("mc.no_notifs")}</div>`; return; }
  const items = await Notifications.list({ recipientType: "committee", recipientId: main.id, limit: 30 });
  if (!items.length) { el.innerHTML = `<div class="empty">${t("mc.no_notifs")}</div>`; return; }
  el.innerHTML = items.map(n => `
    <div class="comment ${n.read ? "" : "unread"}" style="background:var(--surface);">
      <div class="row" style="align-items:flex-start;">
        <div>
          <div style="font-weight:900;">${notifTitleCommittee(n)}</div>
          ${n.body ? `<div class="muted mt8" style="font-size:13px;">${escapeHtml(n.body)}</div>` : ""}
        </div>
        <div class="muted" style="font-size:12px;">${dateShort(n.createdAt)} ${timeShort(n.createdAt)}</div>
      </div>
      ${n.read ? "" : `<div class="actions"><button class="ghost" data-mark="${n.id}">${t("own.mark_read")}</button></div>`}
    </div>
  `).join("");
  el.querySelectorAll("[data-mark]").forEach(b => b.addEventListener("click", async () => {
    await Notifications.markRead(b.dataset.mark);
    drawMainNotifs();
  }));
}

// Look up the (single) main committee record. We use the public Committees
// list to avoid pulling DB into the view layer.
async function DBCommitteeMain() {
  const { Committees } = await import("../api.js");
  const all = await Committees.list();
  return all.find(c => c.type === "main") || null;
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
