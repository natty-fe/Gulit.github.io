// js/views/customer.js
// Customer-facing screens (also hosts the auth screen).

import { Deliveries, Inventory, Orders, Products, Shops, Complaints } from "../api.js";
import { Auth } from "../auth.js";
import { state } from "../state.js";
import {
  toast, openModal, closeModal, etb, dateShort, statusBadge,
  iconSvg, avatarSvg, stars, formField, openThemePicker, getTheme, THEMES,
  t, catLabel,
} from "./shared.js";
import { SUB_CITIES, CATEGORIES } from "../seed.js";

const view = () => document.getElementById("view");

// ------------------ AUTH ------------------
export async function renderAuth() {
  const v = view();
  v.innerHTML = `
    <section class="page authwrap">
      <div class="authcard">
        <div class="authhero">
          <h2>${t("auth.welcome")}</h2>
          <p>${t("auth.subtitle")}</p>
        </div>
        <div class="authbody">
          <div class="tabs">
            <div class="tab active" data-tab="login">${t("auth.tab_signin")}</div>
            <div class="tab" data-tab="signup">${t("auth.tab_signup")}</div>
          </div>
          <div id="authForm"></div>

          <hr/>
          <div class="muted" style="font-size:12px;">
            ${t("auth.demo_logins")}<br/>
            <b>${t("role.customer")}</b> hana@example.com · <b>${t("role.owner")}</b> abebe@example.com · <b>${t("role.delivery")}</b> yonas@example.com<br/>
            <b>${t("role.branch")}</b> branch@example.com · <b>${t("role.main")}</b> main@example.com
          </div>
        </div>
      </div>
    </section>
  `;
  v.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
    v.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
    drawAuthForm(t.dataset.tab);
  }));
  drawAuthForm("login");
}

function drawAuthForm(mode) {
  const wrap = document.getElementById("authForm");
  if (mode === "login") {
    wrap.innerHTML = `
      ${formField({ label: t("auth.identifier"), name: "identifier", required: true, value: "hana@example.com" })}
      ${formField({ label: t("auth.password"), name: "password", type: "password", required: true, value: "demo1234" })}
      <div class="btnrow">
        <button class="primary" id="loginBtn">${t("auth.signin_btn")}</button>
      </div>
    `;
    document.getElementById("loginBtn").addEventListener("click", onLogin);
  } else {
    wrap.innerHTML = `
      ${formField({ label: t("auth.fullname"), name: "name", required: true, placeholder: t("auth.fullname_ph") })}
      ${formField({ label: t("auth.email"), name: "email", placeholder: t("auth.email_ph") })}
      ${formField({ label: t("auth.phone"), name: "phone", placeholder: t("auth.phone_ph") })}
      ${formField({ label: t("auth.password"), name: "password", type: "password", required: true })}
      ${formField({ label: t("auth.role"), name: "role", type: "select", value: "customer", options: [
        { value: "customer", label: t("role.customer") },
        { value: "owner", label: t("role.owner") },
        { value: "delivery", label: t("role.delivery") },
      ]})}
      ${formField({ label: t("auth.subcity"), name: "subCity", type: "select", value: "Bole",
        options: SUB_CITIES.map(s => ({ value: s, label: s })) })}
      <div class="btnrow">
        <button class="primary" id="signupBtn">${t("auth.signup_btn")}</button>
      </div>
      <div class="muted mt8" style="font-size:12px;">${t("auth.committee_note")}</div>
    `;
    document.getElementById("signupBtn").addEventListener("click", onSignup);
  }
}

async function onLogin() {
  const identifier = document.querySelector("#authForm [name=identifier]").value.trim();
  const password = document.querySelector("#authForm [name=password]").value;
  if (!identifier || !password) { toast(t("auth.enter_creds"), "danger"); return; }
  try {
    const { user } = await Auth.login({ identifier, password });
    state.setUser(user);
    toast(t("auth.welcome_user", { name: user.name }), "success");
    location.hash = defaultRouteFor(user.role);
  } catch (e) {
    toast(e.message, "danger");
  }
}

async function onSignup() {
  const f = (n) => document.querySelector(`#authForm [name=${n}]`).value.trim();
  try {
    const { user } = await Auth.register({
      name: f("name"), email: f("email"), phone: f("phone"),
      password: f("password"), role: f("role"), subCity: f("subCity"),
    });
    state.setUser(user);
    toast(t("auth.account_created", { name: user.name }), "success");
    location.hash = defaultRouteFor(user.role);
  } catch (e) {
    toast(e.message, "danger");
  }
}

export function defaultRouteFor(role) {
  return ({
    customer: "#/home",
    owner: "#/owner",
    delivery: "#/delivery",
    branch: "#/committee",
    main: "#/main-committee",
  })[role] || "#/home";
}

// ------------------ HOME / BROWSE ------------------
export async function renderHome() {
  const u = state.user;
  if (!u) { location.hash = "#/auth"; return; }
  const subCity = state.get("filterSubCity") || u.subCity || "Bole";
  const cat = state.get("filterCategory") || "All";
  const q = state.get("filterQ") || "";

  const v = view();
  v.innerHTML = `
    <section class="page">
      <div class="grid cols2">
        <div class="card">
          <div class="hd">
            <div>
              <h2>${t("home.title")}</h2>
              <div class="muted">${t("home.subtitle")}</div>
            </div>
            <div class="right">
              <div class="muted" style="font-weight:900;">${t("auth.subcity")}</div>
              <select id="subCitySel" style="width:auto; padding: 6px 10px;">
                ${SUB_CITIES.map(s => `<option value="${s}" ${s === subCity ? "selected" : ""}>${s}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="bd">
            <div class="searchwrap">
              <input id="qInput" placeholder="${t("home.search_ph")}" value="${q}"/>
              <button class="iconbtn" id="qClear" title="${t("close")}">×</button>
            </div>
            <div class="chips" id="catChips">
              ${CATEGORIES.map(c => `<button class="chip ${c === cat ? "active" : ""}" data-cat="${c}">${catLabel(c)}</button>`).join("")}
            </div>
            <div class="plist" id="plist"><div class="empty">${t("loading")}</div></div>
          </div>
        </div>

        <div class="card">
          <div class="hd">
            <div>
              <h2>${t("home.shops_nearby")}</h2>
              <div class="muted">${t("home.shops_in", { city: subCity })}</div>
            </div>
            <button class="viewbtn" id="allShopsBtn">${t("all")}</button>
          </div>
          <div class="bd">
            <div class="map">
              <div class="pin" aria-hidden="true">
                <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
                  <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" fill="#ef4444"/>
                  <circle cx="12" cy="10" r="2.8" fill="white"/>
                </svg>
              </div>
              <div class="maplabel">Addis Ababa · ${subCity}</div>
            </div>
            <div class="shopsgrid" id="shopsList" style="padding-left:0; padding-right:0;"></div>
          </div>
        </div>
      </div>
    </section>
  `;

  // Wire filters
  document.getElementById("subCitySel").addEventListener("change", (e) => {
    state.set("filterSubCity", e.target.value);
    renderHome();
  });
  document.getElementById("qInput").addEventListener("input", (e) => {
    state.set("filterQ", e.target.value);
    drawProducts();
  });
  document.getElementById("qClear").addEventListener("click", () => {
    state.set("filterQ", "");
    document.getElementById("qInput").value = "";
    drawProducts();
  });
  document.getElementById("catChips").addEventListener("click", (e) => {
    const btn = e.target.closest(".chip"); if (!btn) return;
    state.set("filterCategory", btn.dataset.cat);
    document.querySelectorAll("#catChips .chip").forEach(c => c.classList.toggle("active", c === btn));
    drawProducts();
  });
  document.getElementById("allShopsBtn").addEventListener("click", () => location.hash = "#/shops");

  await drawProducts();
  await drawShops();
}

async function drawProducts() {
  const subCity = state.get("filterSubCity") || state.user?.subCity || "Bole";
  const category = state.get("filterCategory") || "All";
  const q = state.get("filterQ") || "";
  const list = document.getElementById("plist");
  if (!list) return;
  list.innerHTML = `<div class="empty">${t("loading")}</div>`;

  const rows = await Inventory.listingsForBrowse({ subCity, q, category });
  if (rows.length === 0) {
    list.innerHTML = `<div class="empty">${t("home.no_products", { city: subCity })}</div>`;
    return;
  }
  list.innerHTML = rows.map(r => {
    const oldPrice = r.oldPrice && r.oldPrice > r.price
      ? `<div class="old">${etb(r.oldPrice)}</div>` : "";
    const range = r.range ? `<div class="range">${t("home.range", { min: etb(r.range.minPrice), max: etb(r.range.maxPrice) })}</div>` : "";
    return `
      <div class="pitem">
        <div class="pimg">${iconSvg(r.product.icon)}</div>
        <div>
          <div class="ptitle">${r.product.name}</div>
          <div class="psub">${catLabel(r.product.category)} · ${t("home.sold_by")} <a data-shop="${r.shop.id}">${r.shop.name}</a></div>
          ${range}
        </div>
        <div class="pricebox">
          ${oldPrice}
          <div class="now">${etb(r.price)} / ${r.product.unit}</div>
          <button class="addbtn" data-add="${r.id}">${t("add")}</button>
        </div>
      </div>
    `;
  }).join("");

  list.querySelectorAll("[data-add]").forEach(b => b.addEventListener("click", () => addToCart(b.dataset.add)));
  list.querySelectorAll("[data-shop]").forEach(b => b.addEventListener("click", () => openShopModal(b.dataset.shop)));
}

async function drawShops() {
  const subCity = state.get("filterSubCity") || state.user?.subCity || "Bole";
  const grid = document.getElementById("shopsList");
  if (!grid) return;
  const shops = await Shops.list({ subCity });
  if (shops.length === 0) {
    grid.innerHTML = `<div class="empty">${t("home.no_shops", { city: subCity })}</div>`;
    return;
  }
  grid.innerHTML = shops.map((s, i) => `
    <div class="shopcard">
      <div class="avatar">${avatarSvg(i)}</div>
      <div>
        <div style="font-weight:900;">${s.name}</div>
        <div>${stars(s.rating || 0)}</div>
        <div class="shopmeta">${t("auth.subcity")}: ${s.subCity}</div>
      </div>
      <button class="viewbtn" data-shop="${s.id}">${t("profile")}</button>
    </div>
  `).join("");
  grid.querySelectorAll("[data-shop]").forEach(b => b.addEventListener("click", () => openShopModal(b.dataset.shop)));
}

// ------------------ SHOPS LIST PAGE ------------------
export async function renderShops() {
  const subCity = state.get("filterSubCity") || state.user?.subCity || "Bole";
  const v = view();
  v.innerHTML = `
    <section class="page">
      <div class="card">
        <div class="hd">
          <div><h2>${t("shops.title", { city: subCity })}</h2><div class="muted">${t("shops.subtitle")}</div></div>
          <button class="viewbtn" data-link="home">${t("back")}</button>
        </div>
        <div class="shopsgrid" id="shopsAll"></div>
      </div>
    </section>
  `;
  const shops = await Shops.list({ subCity });
  const el = document.getElementById("shopsAll");
  if (shops.length === 0) { el.innerHTML = `<div class="empty">${t("shops.no_approved", { city: subCity })}</div>`; return; }
  el.innerHTML = shops.map((s, i) => `
    <div class="shopcard">
      <div class="avatar">${avatarSvg(i)}</div>
      <div>
        <div style="font-weight:900;">${s.name}</div>
        <div>${stars(s.rating || 0)}</div>
        <div class="shopmeta">${t("auth.subcity")}: ${s.subCity}</div>
      </div>
      <button class="viewbtn" data-shop="${s.id}">${t("profile")}</button>
    </div>
  `).join("");
  el.querySelectorAll("[data-shop]").forEach(b => b.addEventListener("click", () => openShopModal(b.dataset.shop)));
}

// ------------------ SHOP MODAL ------------------
async function openShopModal(shopId) {
  const shop = await Shops.byId(shopId);
  if (!shop) return;
  const inv = await Inventory.byShop(shopId);
  const sample = inv.slice(0, 6);
  openModal(`${shop.name} · ${t("profile")}`, `
    <div class="row">
      <div>
        <div style="font-weight:900;font-size:16px;">${shop.name}</div>
        <div class="muted">${t("auth.subcity")}: <b>${shop.subCity}</b></div>
        <div class="mt8">${stars(shop.rating || 0)}</div>
      </div>
      <div>${statusBadge(shop.status)}</div>
    </div>

    <hr/>
    <div style="font-weight:900;">${t("shops.popular_items")}</div>
    <div class="muted">${t("shops.regulated_note")}</div>
    <div class="mt8" style="display:grid;gap:10px;">
      ${sample.map(i => `
        <div class="pitem">
          <div class="pimg">${iconSvg(i.product?.icon || "grain")}</div>
          <div>
            <div class="ptitle">${i.product?.name || ""}</div>
            <div class="psub">${catLabel(i.product?.category || "All")} · ${etb(i.price)} / ${i.product?.unit || "kg"}</div>
          </div>
          <div class="pricebox">
            <button class="addbtn" data-add="${i.id}">${t("add")}</button>
          </div>
        </div>
      `).join("") || `<div class="muted">${t("shops.no_listed")}</div>`}
    </div>

    <hr/>
    <div class="row">
      <div><div style="font-weight:900;">${t("shops.reviews")}</div><div class="muted">${t("shops.feedback_note")}</div></div>
      <button class="viewbtn" id="addReview">${t("shops.add_review")}</button>
    </div>
    ${(shop.reviews || []).map(r => `
      <div class="comment">
        <div style="font-weight:900;">${r.by} <span class="muted">· ${"★".repeat(r.stars || 5)}</span></div>
        <div class="muted" style="margin-top:4px;">${r.text}</div>
      </div>
    `).join("") || `<div class="muted mt8">${t("shops.no_reviews")}</div>`}
  `);

  document.querySelectorAll("#modalBody [data-add]").forEach(b => b.addEventListener("click", () => {
    addToCart(b.dataset.add);
  }));

  document.getElementById("addReview")?.addEventListener("click", () => {
    openModal(t("shops.review_title"), `
      ${formField({ label: t("shops.review_stars"), name: "stars", type: "number", value: "5" })}
      ${formField({ label: t("shops.review_text"), name: "text", type: "textarea", placeholder: t("shops.review_text_ph") })}
      <div class="btnrow"><button class="primary" id="reviewSubmit">${t("submit")}</button><button class="ghost" id="reviewCancel">${t("cancel")}</button></div>
    `);
    document.getElementById("reviewCancel").onclick = () => closeModal();
    document.getElementById("reviewSubmit").onclick = async () => {
      const stars = Number(document.querySelector("#modalBody [name=stars]").value || 5);
      const text = document.querySelector("#modalBody [name=text]").value.trim();
      if (!text) { toast(t("shops.write_comment"), "danger"); return; }
      try {
        await Shops.addReview(shopId, { text, stars });
        toast(t("shops.review_posted"), "success");
        openShopModal(shopId);
      } catch (e) { toast(e.message, "danger"); }
    };
  });
}

// ------------------ CART ------------------
function getCart() { return state.get("cart") || {}; }
function setCart(c) { state.set("cart", c); state.emit("cart"); }

export function addToCart(inventoryId) {
  const cart = { ...getCart() };
  cart[inventoryId] = (cart[inventoryId] || 0) + 1;
  setCart(cart);
  toast(t("home.added"), "success");
}
export function decFromCart(inventoryId) {
  const cart = { ...getCart() };
  if (!cart[inventoryId]) return;
  cart[inventoryId] -= 1;
  if (cart[inventoryId] <= 0) delete cart[inventoryId];
  setCart(cart);
}
export function cartCount() {
  return Object.values(getCart()).reduce((a, b) => a + b, 0);
}

export async function renderCart() {
  const v = view();
  v.innerHTML = `<section class="page"><div class="card">
    <div class="hd"><div><h2>${t("cart.title")}</h2><div class="muted">${t("cart.subtitle")}</div></div>
      <button class="viewbtn" data-link="home">${t("back")}</button>
    </div>
    <div class="bd" id="cartBody">${t("loading")}</div>
  </div></section>`;

  const cart = getCart();
  const ids = Object.keys(cart);
  if (ids.length === 0) {
    document.getElementById("cartBody").innerHTML =
      `<div class="empty">${t("cart.empty")} <a data-link="home">${t("cart.empty_browse")}</a>.</div>`;
    return;
  }

  const items = [];
  for (const id of ids) {
    const inv = await fetchInventoryWithProduct(id);
    if (inv) items.push({ inv, qty: cart[id] });
  }
  const total = items.reduce((a, x) => a + x.qty * x.inv.price, 0);
  document.getElementById("cartBody").innerHTML = `
    <div style="display:grid;gap:10px;">
      ${items.map(({ inv, qty }) => `
        <div class="pitem">
          <div class="pimg">${iconSvg(inv.product?.icon || "grain")}</div>
          <div>
            <div class="ptitle">${inv.product?.name || ""}</div>
            <div class="psub">${etb(inv.price)} / ${inv.product?.unit} · ${t("br.shop_label")}: ${inv.shop?.name || ""}</div>
          </div>
          <div class="pricebox">
            <div style="font-weight:900;">x ${qty}</div>
            <div class="muted">${etb(inv.price * qty)}</div>
            <div class="flex" style="justify-content:flex-end;margin-top:6px;">
              <button class="viewbtn" data-dec="${inv.id}">−</button>
              <button class="addbtn" data-inc="${inv.id}">+</button>
            </div>
          </div>
        </div>
      `).join("")}
    </div>
    <hr/>
    <div class="row">
      <div><div style="font-weight:900;">${t("total")}</div><div class="muted">${t("cart.delivery_note")}</div></div>
      <div style="font-weight:900;color:var(--primary);font-size:18px;">${etb(total)}</div>
    </div>
    <div class="mt12"><button class="primary w100" id="checkout">${t("cart.proceed")}</button></div>
  `;

  document.querySelectorAll("[data-inc]").forEach(b => b.addEventListener("click", () => { addToCart(b.dataset.inc); renderCart(); }));
  document.querySelectorAll("[data-dec]").forEach(b => b.addEventListener("click", () => { decFromCart(b.dataset.dec); renderCart(); }));
  document.getElementById("checkout").addEventListener("click", () => location.hash = "#/checkout");
}

async function fetchInventoryWithProduct(invId) {
  return await Inventory.byId(invId);
}

// ------------------ CHECKOUT ------------------
export async function renderCheckout() {
  const v = view();
  v.innerHTML = `<section class="page"><div class="card">
    <div class="hd"><div><h2>${t("checkout.title")}</h2><div class="muted">${t("checkout.subtitle")}</div></div>
      <button class="viewbtn" data-link="cart">${t("back")}</button>
    </div>
    <div class="bd" id="checkoutBody">${t("loading")}</div>
  </div></section>`;

  const cart = getCart();
  const ids = Object.keys(cart);
  if (ids.length === 0) { document.getElementById("checkoutBody").innerHTML = `<div class="empty">${t("cart.empty")}</div>`; return; }
  const items = [];
  for (const id of ids) {
    const inv = await fetchInventoryWithProduct(id);
    if (inv) items.push({ inv, qty: cart[id] });
  }
  const total = items.reduce((a, x) => a + x.qty * x.inv.price, 0);

  document.getElementById("checkoutBody").innerHTML = `
    <div style="font-weight:900;">${t("checkout.summary")}</div>
    <div class="muted">${t("checkout.lines_total", { lines: items.length, total: etb(total) })}</div>

    <hr/>
    <div class="fieldlabel">${t("checkout.address")}</div>
    <select id="deliverySubCity">
      ${SUB_CITIES.map(s => `<option ${s === state.user?.subCity ? "selected" : ""}>${s}</option>`).join("")}
    </select>

    <div class="btnrow">
      <button class="primary" id="payNow">${t("checkout.pay_now")}</button>
      <button class="ghost" id="payCod">${t("checkout.pay_cod")}</button>
    </div>
    <div class="muted mt12" style="font-size:12px;">${t("checkout.note")}</div>
  `;

  document.getElementById("payNow").onclick = () => placeOrder("prepay");
  document.getElementById("payCod").onclick = () => placeOrder("cod");
}

async function placeOrder(paymentType) {
  const subCity = document.getElementById("deliverySubCity").value;
  const cart = getCart();
  const items = Object.entries(cart).map(([id, qty]) => ({ inventoryId: id, qty }));
  if (items.length === 0) { toast(t("cart.empty_toast"), "danger"); return; }
  try {
    const orders = await Orders.create({ items, paymentType, customerSubCity: subCity });
    setCart({});
    toast(t("checkout.placed", { n: orders.length }), "success");
    location.hash = "#/track";
  } catch (e) {
    toast(e.message, "danger");
  }
}

// ------------------ TRACKING ------------------
export async function renderTracking() {
  const u = state.user;
  if (!u) { location.hash = "#/auth"; return; }
  const v = view();
  v.innerHTML = `<section class="page"><div class="card">
    <div class="hd"><div><h2>${t("track.title")}</h2><div class="muted">${t("track.subtitle")}</div></div>
      <button class="viewbtn" data-link="home">${t("track.home")}</button>
    </div>
    <div class="bd" id="trackBody">${t("loading")}</div>
  </div></section>`;

  const orders = await Orders.list({ customerId: u.id });
  if (orders.length === 0) {
    document.getElementById("trackBody").innerHTML = `<div class="empty">${t("track.no_orders")} <a data-link="home">${t("track.start_browsing")}</a>.</div>`;
    return;
  }
  document.getElementById("trackBody").innerHTML = orders.map(o => `
    <div class="deliverycard mt12">
      <div class="row">
        <div>
          <div style="font-weight:900;">${t("track.order_label")} ${o.id.slice(-6).toUpperCase()}</div>
          <div class="muted">${t("track.placed", { date: dateShort(o.createdAt) })} · ${t("track.payment")} <b>${o.paymentType === "prepay" ? t("track.pay_now_label") : t("track.pay_cod_label")}</b></div>
        </div>
        <div>${statusBadge(o.status)}</div>
      </div>
      <div class="muted mt8">${t("items_count", { n: o.items.length })} · ${t("total")} <b>${etb(o.total)}</b></div>
      <div class="progress"><div class="bar" style="width:${progressPct(o.status)}%"></div></div>
      <div class="flex mt12" style="flex-wrap:wrap;gap:6px;">
        <button class="viewbtn" data-detail="${o.id}">${t("details")}</button>
        ${o.status !== "completed" && o.status !== "cancelled" && o.status !== "refunded" ?
          `<button class="ghost" data-complain="${o.id}">${t("track.complain")}</button>` : ""}
      </div>
    </div>
  `).join("");

  document.querySelectorAll("[data-detail]").forEach(b => b.addEventListener("click", () => openOrderDetail(b.dataset.detail)));
  document.querySelectorAll("[data-complain]").forEach(b => b.addEventListener("click", () => openComplaintForm(b.dataset.complain)));
}

function progressPct(status) {
  return ({ created: 15, paid: 30, accepted: 45, preparing: 60, dispatched: 80, delivered: 95, completed: 100,
            cancelled: 100, refunded: 100 })[status] || 10;
}

async function openOrderDetail(orderId) {
  const o = await Orders.byId(orderId);
  if (!o) return;
  // Look up delivery (if assigned) so we can show the OTP and courier info.
  const delivery = o.deliveryId ? await Deliveries.byId(o.deliveryId) : null;

  openModal(`${t("track.order_label")} ${o.id.slice(-6).toUpperCase()}`, `
    <div class="row">
      <div><div style="font-weight:900;">${t("items_count", { n: o.items.length })}</div><div class="muted">${t("track.placed", { date: dateShort(o.createdAt) })}</div></div>
      <div>${statusBadge(o.status)}</div>
    </div>
    <hr/>
    ${o.items.map(i => `
      <div class="row mt8"><div class="muted"><b>${i.name}</b> × ${i.qty}</div><div style="font-weight:900;">${etb(i.lineTotal)}</div></div>
    `).join("")}
    <hr/>
    <div class="row"><div style="font-weight:900;">${t("total")}</div><div style="font-weight:900;color:var(--primary);">${etb(o.total)}</div></div>
    <div class="muted mt8">${t("track.payment")}: <b>${o.paymentType === "prepay" ? t("track.pay_now_label") : t("track.pay_cod_label")}</b></div>
    ${delivery ? `
      <hr/>
      <div style="font-weight:900;">${t("track.delivery")}</div>
      <div class="muted mt8">${statusBadge(delivery.status)} · ${t("track.eta")} ${delivery.eta || "—"}</div>
      ${delivery.status !== "delivered" ? `
        <div class="mt12" style="padding:12px;background:var(--primary-tint);border:1px solid var(--primary-ring);border-radius:14px;text-align:center;">
          <div class="muted" style="font-size:12px;">${t("track.share_otp")}</div>
          <div style="font-size:28px;font-weight:900;letter-spacing:.4em;color:var(--primary);">${delivery.otp}</div>
        </div>
      ` : `<div class="muted mt8">${t("track.confirmed_at", { date: dateShort(delivery.confirmedAt) })}</div>`}
    ` : ""}
  `);
}

function openComplaintForm(orderId) {
  openModal(t("cmp.modal_title"), `
    ${formField({ label: t("cmp.type"), name: "type", type: "select", options: [
      { value: "Missing item", label: t("cmp.type.missing") },
      { value: "Late delivery", label: t("cmp.type.late") },
      { value: "Wrong item", label: t("cmp.type.wrong") },
      { value: "Refund request", label: t("cmp.type.refund") },
      { value: "Other", label: t("cmp.type.other") },
    ]})}
    ${formField({ label: t("cmp.detail"), name: "detail", type: "textarea", placeholder: t("cmp.detail_ph"), required: true })}
    <div class="btnrow"><button class="primary" id="cmpSubmit">${t("cmp.submit")}</button><button class="ghost" id="cmpCancel">${t("cancel")}</button></div>
  `);
  document.getElementById("cmpCancel").onclick = () => closeModal();
  document.getElementById("cmpSubmit").onclick = async () => {
    const type = document.querySelector("#modalBody [name=type]").value;
    const detail = document.querySelector("#modalBody [name=detail]").value.trim();
    if (!detail) { toast(t("cmp.describe"), "danger"); return; }
    try {
      await Complaints.create({ orderId, type, detail });
      toast(t("cmp.sent"), "success");
      closeModal(); renderTracking();
    } catch (e) { toast(e.message, "danger"); }
  };
}

// ------------------ ACCOUNT ------------------
export async function renderAccount() {
  const u = state.user;
  if (!u) { location.hash = "#/auth"; return; }
  const v = view();
  const curTheme = THEMES.find(th => th.id === getTheme());

  v.innerHTML = `<section class="page"><div class="card">
    <div class="hd">
      <div><h2>${t("acc.title")}</h2><div class="muted">${t("acc.subtitle")}</div></div>
      <button class="danger" id="logoutBtn">${t("acc.signout")}</button>
    </div>
    <div class="bd">
      <div class="row">
        <div>
          <div style="font-weight:900;">${u.name}</div>
          <div class="muted">${t("acc.role")}: <b>${t(`role.${u.role}`)}</b> · ${t("acc.subcity")}: <b>${u.subCity || "—"}</b></div>
          <div class="muted">${t("acc.email")}: ${u.email || "—"} · ${t("acc.phone")}: ${u.phone || "—"}</div>
        </div>
      </div>
      <hr/>
      <div style="font-weight:900;">${t("preferences")}</div>
      <div class="row mt8">
        <div>
          <div class="muted" style="font-size:13px;">${t("acc.theme")}</div>
          <div style="font-weight:800;">${curTheme?.name || ""}</div>
        </div>
        <button class="viewbtn" id="themePickBtn">${t("acc.change_theme")}</button>
      </div>

      <hr/>
      <div class="muted">${t("acc.demo")}</div>
      <div class="btnrow">
        <button class="ghost" id="resetBtn">${t("acc.reset")}</button>
      </div>
      <div class="muted mt8" style="font-size:12px;">${t("acc.reset_note")}</div>
    </div>
  </div></section>`;

  document.getElementById("themePickBtn").addEventListener("click", () => openThemePicker());

  document.getElementById("logoutBtn").addEventListener("click", () => {
    Auth.logout(); state.setUser(null); toast(t("acc.signed_out")); location.hash = "#/auth";
  });
  document.getElementById("resetBtn").addEventListener("click", async () => {
    if (!confirm(t("acc.reset_confirm"))) return;
    const { runSeed } = await import("../seed.js");
    Auth.logout();
    state.setUser(null);
    await runSeed({ force: true });
    toast(t("acc.reset_done"), "success");
    location.hash = "#/auth";
  });
}
