// js/views/customer.js
// Customer-facing screens (also hosts the auth screen).

import { Deliveries, Inventory, Orders, Products, Shops, Complaints } from "../api.js";
import { Auth } from "../auth.js";
import { state } from "../state.js";
import {
  toast, openModal, closeModal, etb, dateShort, statusBadge,
  iconSvg, avatarSvg, stars, formField,
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
          <h2>Welcome to GULIT</h2>
          <p>The digital gulit market: regulated prices, trusted shops, and traceable deliveries.</p>
        </div>
        <div class="authbody">
          <div class="tabs">
            <div class="tab active" data-tab="login">Sign in</div>
            <div class="tab" data-tab="signup">Create account</div>
          </div>
          <div id="authForm"></div>

          <hr/>
          <div class="muted" style="font-size:12px;">
            Demo logins (password <b>demo1234</b>):<br/>
            <b>customer</b> hana@example.com · <b>owner</b> abebe@example.com · <b>delivery</b> yonas@example.com<br/>
            <b>branch</b> branch@example.com · <b>main</b> main@example.com
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
      ${formField({ label: "Email or phone", name: "identifier", required: true, value: "hana@example.com" })}
      ${formField({ label: "Password", name: "password", type: "password", required: true, value: "demo1234" })}
      <div class="btnrow">
        <button class="primary" id="loginBtn">Sign in</button>
      </div>
    `;
    document.getElementById("loginBtn").addEventListener("click", onLogin);
  } else {
    wrap.innerHTML = `
      ${formField({ label: "Full name", name: "name", required: true, placeholder: "e.g., Hana Tesfaye" })}
      ${formField({ label: "Email", name: "email", placeholder: "you@example.com" })}
      ${formField({ label: "Phone", name: "phone", placeholder: "+251 9xx xxx xxx" })}
      ${formField({ label: "Password", name: "password", type: "password", required: true })}
      ${formField({ label: "Role", name: "role", type: "select", value: "customer", options: [
        { value: "customer", label: "Customer" },
        { value: "owner", label: "Shop Owner" },
        { value: "delivery", label: "Delivery" },
      ]})}
      ${formField({ label: "Sub-city", name: "subCity", type: "select", value: "Bole",
        options: SUB_CITIES.map(s => ({ value: s, label: s })) })}
      <div class="btnrow">
        <button class="primary" id="signupBtn">Create account</button>
      </div>
      <div class="muted mt8" style="font-size:12px;">
        Branch and Main Committee accounts are provisioned by administrators.
      </div>
    `;
    document.getElementById("signupBtn").addEventListener("click", onSignup);
  }
}

async function onLogin() {
  const identifier = document.querySelector("#authForm [name=identifier]").value.trim();
  const password = document.querySelector("#authForm [name=password]").value;
  if (!identifier || !password) { toast("Enter your credentials", "danger"); return; }
  try {
    const { user } = await Auth.login({ identifier, password });
    state.setUser(user);
    toast(`Welcome, ${user.name}`, "success");
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
    toast(`Account created · welcome, ${user.name}`, "success");
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
              <h2>Browse regulated prices</h2>
              <div class="muted">Search items, filter categories, add to cart.</div>
            </div>
            <div class="right">
              <div class="muted" style="font-weight:900;">Sub-city</div>
              <select id="subCitySel" style="width:auto; padding: 6px 10px;">
                ${SUB_CITIES.map(s => `<option value="${s}" ${s === subCity ? "selected" : ""}>${s}</option>`).join("")}
              </select>
            </div>
          </div>
          <div class="bd">
            <div class="searchwrap">
              <input id="qInput" placeholder="Search vegetables, grains, eggs…" value="${q}"/>
              <button class="iconbtn" id="qClear" title="Clear">×</button>
            </div>
            <div class="chips" id="catChips">
              ${CATEGORIES.map(c => `<button class="chip ${c === cat ? "active" : ""}" data-cat="${c}">${c}</button>`).join("")}
            </div>
            <div class="plist" id="plist"><div class="empty">Loading…</div></div>
          </div>
        </div>

        <div class="card">
          <div class="hd">
            <div>
              <h2>Shops nearby</h2>
              <div class="muted">In <b>${subCity}</b> sub-city.</div>
            </div>
            <button class="viewbtn" id="allShopsBtn">All</button>
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
  list.innerHTML = `<div class="empty">Loading…</div>`;

  const rows = await Inventory.listingsForBrowse({ subCity, q, category });
  if (rows.length === 0) {
    list.innerHTML = `<div class="empty">No products in ${subCity} match your filters.</div>`;
    return;
  }
  list.innerHTML = rows.map(r => {
    const oldPrice = r.oldPrice && r.oldPrice > r.price
      ? `<div class="old">${etb(r.oldPrice)}</div>` : "";
    const range = r.range ? `<div class="range">Range ${etb(r.range.minPrice)}–${etb(r.range.maxPrice)}</div>` : "";
    return `
      <div class="pitem">
        <div class="pimg">${iconSvg(r.product.icon)}</div>
        <div>
          <div class="ptitle">${r.product.name}</div>
          <div class="psub">${r.product.category} · Sold by <a data-shop="${r.shop.id}">${r.shop.name}</a></div>
          ${range}
        </div>
        <div class="pricebox">
          ${oldPrice}
          <div class="now">${etb(r.price)} / ${r.product.unit}</div>
          <button class="addbtn" data-add="${r.id}">Add</button>
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
    grid.innerHTML = `<div class="empty">No approved shops yet in ${subCity}.</div>`;
    return;
  }
  grid.innerHTML = shops.map((s, i) => `
    <div class="shopcard">
      <div class="avatar">${avatarSvg(i)}</div>
      <div>
        <div style="font-weight:900;">${s.name}</div>
        <div>${stars(s.rating || 0)}</div>
        <div class="shopmeta">Sub-city: ${s.subCity}</div>
      </div>
      <button class="viewbtn" data-shop="${s.id}">Profile</button>
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
          <div><h2>Shops in ${subCity}</h2><div class="muted">Tap a shop for profile, sellers, and reviews.</div></div>
          <button class="viewbtn" data-link="home">Back</button>
        </div>
        <div class="shopsgrid" id="shopsAll"></div>
      </div>
    </section>
  `;
  const shops = await Shops.list({ subCity });
  const el = document.getElementById("shopsAll");
  if (shops.length === 0) { el.innerHTML = `<div class="empty">No approved shops in ${subCity}.</div>`; return; }
  el.innerHTML = shops.map((s, i) => `
    <div class="shopcard">
      <div class="avatar">${avatarSvg(i)}</div>
      <div>
        <div style="font-weight:900;">${s.name}</div>
        <div>${stars(s.rating || 0)}</div>
        <div class="shopmeta">Sub-city: ${s.subCity}</div>
      </div>
      <button class="viewbtn" data-shop="${s.id}">Profile</button>
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
  openModal(`${shop.name} · Profile`, `
    <div class="row">
      <div>
        <div style="font-weight:900;font-size:16px;">${shop.name}</div>
        <div class="muted">Sub-city: <b>${shop.subCity}</b></div>
        <div class="mt8">${stars(shop.rating || 0)}</div>
      </div>
      <div>${statusBadge(shop.status)}</div>
    </div>

    <hr/>
    <div style="font-weight:900;">Popular items</div>
    <div class="muted">Prices respect committee-set ranges.</div>
    <div class="mt8" style="display:grid;gap:10px;">
      ${sample.map(i => `
        <div class="pitem">
          <div class="pimg">${iconSvg(i.product?.icon || "grain")}</div>
          <div>
            <div class="ptitle">${i.product?.name || "Item"}</div>
            <div class="psub">${i.product?.category || ""} · ${etb(i.price)} / ${i.product?.unit || "kg"}</div>
          </div>
          <div class="pricebox">
            <button class="addbtn" data-add="${i.id}">Add</button>
          </div>
        </div>
      `).join("") || `<div class="muted">No items listed yet.</div>`}
    </div>

    <hr/>
    <div class="row">
      <div><div style="font-weight:900;">Reviews</div><div class="muted">Customers can leave feedback after delivery.</div></div>
      <button class="viewbtn" id="addReview">Add review</button>
    </div>
    ${(shop.reviews || []).map(r => `
      <div class="comment">
        <div style="font-weight:900;">${r.by} <span class="muted">· ${"★".repeat(r.stars || 5)}</span></div>
        <div class="muted" style="margin-top:4px;">${r.text}</div>
      </div>
    `).join("") || `<div class="muted mt8">No reviews yet.</div>`}
  `);

  document.querySelectorAll("#modalBody [data-add]").forEach(b => b.addEventListener("click", () => {
    addToCart(b.dataset.add);
  }));

  document.getElementById("addReview")?.addEventListener("click", () => {
    openModal("Add review", `
      ${formField({ label: "Stars (1–5)", name: "stars", type: "number", value: "5" })}
      ${formField({ label: "Your comment", name: "text", type: "textarea", placeholder: "Share your experience…" })}
      <div class="btnrow"><button class="primary" id="reviewSubmit">Submit</button><button class="ghost" id="reviewCancel">Cancel</button></div>
    `);
    document.getElementById("reviewCancel").onclick = () => closeModal();
    document.getElementById("reviewSubmit").onclick = async () => {
      const stars = Number(document.querySelector("#modalBody [name=stars]").value || 5);
      const text = document.querySelector("#modalBody [name=text]").value.trim();
      if (!text) { toast("Please write a comment", "danger"); return; }
      try {
        await Shops.addReview(shopId, { text, stars });
        toast("Review posted", "success");
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
  toast("Added to cart", "success");
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
    <div class="hd"><div><h2>Cart</h2><div class="muted">Review items, then checkout.</div></div>
      <button class="viewbtn" data-link="home">Back</button>
    </div>
    <div class="bd" id="cartBody">Loading…</div>
  </div></section>`;

  const cart = getCart();
  const ids = Object.keys(cart);
  if (ids.length === 0) {
    document.getElementById("cartBody").innerHTML =
      `<div class="empty">Cart is empty. <a data-link="home">Browse items</a>.</div>`;
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
            <div class="ptitle">${inv.product?.name || "Item"}</div>
            <div class="psub">${etb(inv.price)} / ${inv.product?.unit} · Shop: ${inv.shop?.name || ""}</div>
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
      <div><div style="font-weight:900;">Total</div><div class="muted">Delivery fees added at checkout.</div></div>
      <div style="font-weight:900;color:var(--primary);font-size:18px;">${etb(total)}</div>
    </div>
    <div class="mt12"><button class="primary w100" id="checkout">Proceed to checkout</button></div>
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
    <div class="hd"><div><h2>Checkout</h2><div class="muted">Choose payment option and confirm.</div></div>
      <button class="viewbtn" data-link="cart">Back</button>
    </div>
    <div class="bd" id="checkoutBody">Loading…</div>
  </div></section>`;

  const cart = getCart();
  const ids = Object.keys(cart);
  if (ids.length === 0) { document.getElementById("checkoutBody").innerHTML = `<div class="empty">Cart is empty.</div>`; return; }
  const items = [];
  for (const id of ids) {
    const inv = await fetchInventoryWithProduct(id);
    if (inv) items.push({ inv, qty: cart[id] });
  }
  const total = items.reduce((a, x) => a + x.qty * x.inv.price, 0);

  document.getElementById("checkoutBody").innerHTML = `
    <div style="font-weight:900;">Order summary</div>
    <div class="muted">${items.length} item line(s) · Total <b>${etb(total)}</b></div>

    <hr/>
    <div class="fieldlabel">Delivery address (sub-city)</div>
    <select id="deliverySubCity">
      ${SUB_CITIES.map(s => `<option ${s === state.user?.subCity ? "selected" : ""}>${s}</option>`).join("")}
    </select>

    <div class="btnrow">
      <button class="primary" id="payNow">Pay now</button>
      <button class="ghost" id="payCod">Pay on delivery</button>
    </div>
    <div class="muted mt12" style="font-size:12px;">
      Pay-now uses a third-party gateway (mocked in this prototype). Refunds are issued via the same gateway when committee approves.
    </div>
  `;

  document.getElementById("payNow").onclick = () => placeOrder("prepay");
  document.getElementById("payCod").onclick = () => placeOrder("cod");
}

async function placeOrder(paymentType) {
  const subCity = document.getElementById("deliverySubCity").value;
  const cart = getCart();
  const items = Object.entries(cart).map(([id, qty]) => ({ inventoryId: id, qty }));
  try {
    const orders = await Orders.create({ items, paymentType, customerSubCity: subCity });
    setCart({});
    toast(`Order placed · ${orders.length} shop(s)`, "success");
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
    <div class="hd"><div><h2>Order tracking</h2><div class="muted">Latest orders and live status.</div></div>
      <button class="viewbtn" data-link="home">Home</button>
    </div>
    <div class="bd" id="trackBody">Loading…</div>
  </div></section>`;

  const orders = await Orders.list({ customerId: u.id });
  if (orders.length === 0) {
    document.getElementById("trackBody").innerHTML = `<div class="empty">No orders yet. <a data-link="home">Start browsing</a>.</div>`;
    return;
  }
  document.getElementById("trackBody").innerHTML = orders.map(o => `
    <div class="deliverycard mt12">
      <div class="row">
        <div>
          <div style="font-weight:900;">Order ${o.id.slice(-6).toUpperCase()}</div>
          <div class="muted">Placed ${dateShort(o.createdAt)} · Payment <b>${o.paymentType === "prepay" ? "Pay now" : "Cash on delivery"}</b></div>
        </div>
        <div>${statusBadge(o.status)}</div>
      </div>
      <div class="muted mt8">${o.items.length} item(s) · Total <b>${etb(o.total)}</b></div>
      <div class="progress"><div class="bar" style="width:${progressPct(o.status)}%"></div></div>
      <div class="flex mt12" style="flex-wrap:wrap;gap:6px;">
        <button class="viewbtn" data-detail="${o.id}">Details</button>
        ${o.status !== "completed" && o.status !== "cancelled" && o.status !== "refunded" ?
          `<button class="ghost" data-complain="${o.id}">Submit complaint</button>` : ""}
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

  openModal(`Order ${o.id.slice(-6).toUpperCase()}`, `
    <div class="row">
      <div><div style="font-weight:900;">${o.items.length} item(s)</div><div class="muted">Placed ${dateShort(o.createdAt)}</div></div>
      <div>${statusBadge(o.status)}</div>
    </div>
    <hr/>
    ${o.items.map(i => `
      <div class="row mt8"><div class="muted"><b>${i.name}</b> × ${i.qty}</div><div style="font-weight:900;">${etb(i.lineTotal)}</div></div>
    `).join("")}
    <hr/>
    <div class="row"><div style="font-weight:900;">Total</div><div style="font-weight:900;color:var(--primary);">${etb(o.total)}</div></div>
    <div class="muted mt8">Payment: <b>${o.paymentType === "prepay" ? "Pay now" : "Cash on delivery"}</b></div>
    ${delivery ? `
      <hr/>
      <div style="font-weight:900;">Delivery</div>
      <div class="muted mt8">Status: ${statusBadge(delivery.status)} · ETA ${delivery.eta || "—"}</div>
      ${delivery.status !== "delivered" ? `
        <div class="mt12" style="padding:12px;background:var(--primary-tint);border:1px solid var(--primary-ring);border-radius:14px;text-align:center;">
          <div class="muted" style="font-size:12px;">Share this OTP with the courier on arrival</div>
          <div style="font-size:28px;font-weight:900;letter-spacing:.4em;color:var(--primary);">${delivery.otp}</div>
        </div>
      ` : `<div class="muted mt8">Confirmed at ${dateShort(delivery.confirmedAt)}.</div>`}
    ` : ""}
  `);
}

function openComplaintForm(orderId) {
  openModal("Submit complaint", `
    ${formField({ label: "Complaint type", name: "type", type: "select", options: [
      { value: "Missing item", label: "Missing item" },
      { value: "Late delivery", label: "Late delivery" },
      { value: "Wrong item", label: "Wrong item" },
      { value: "Refund request", label: "Refund request" },
      { value: "Other", label: "Other" },
    ]})}
    ${formField({ label: "Details", name: "detail", type: "textarea", placeholder: "Explain what happened…", required: true })}
    <div class="btnrow"><button class="primary" id="cmpSubmit">Submit</button><button class="ghost" id="cmpCancel">Cancel</button></div>
  `);
  document.getElementById("cmpCancel").onclick = () => closeModal();
  document.getElementById("cmpSubmit").onclick = async () => {
    const type = document.querySelector("#modalBody [name=type]").value;
    const detail = document.querySelector("#modalBody [name=detail]").value.trim();
    if (!detail) { toast("Please describe the issue", "danger"); return; }
    try {
      await Complaints.create({ orderId, type, detail });
      toast("Complaint submitted to branch committee", "success");
      closeModal(); renderTracking();
    } catch (e) { toast(e.message, "danger"); }
  };
}

// ------------------ ACCOUNT ------------------
export async function renderAccount() {
  const u = state.user;
  if (!u) { location.hash = "#/auth"; return; }
  const v = view();
  v.innerHTML = `<section class="page"><div class="card">
    <div class="hd">
      <div><h2>Account</h2><div class="muted">Profile and demo controls.</div></div>
      <button class="danger" id="logoutBtn">Sign out</button>
    </div>
    <div class="bd">
      <div class="row">
        <div>
          <div style="font-weight:900;">${u.name}</div>
          <div class="muted">Role: <b>${u.role}</b> · Sub-city: <b>${u.subCity || "—"}</b></div>
          <div class="muted">Email: ${u.email || "—"} · Phone: ${u.phone || "—"}</div>
        </div>
      </div>
      <hr/>
      <div class="muted">Demo controls</div>
      <div class="btnrow">
        <button class="ghost" id="resetBtn">Reset demo data</button>
      </div>
      <div class="muted mt8" style="font-size:12px;">
        Resetting wipes local data and reloads the seed (products, shops, demo accounts, regulated price ranges).
      </div>
    </div>
  </div></section>`;

  document.getElementById("logoutBtn").addEventListener("click", () => {
    Auth.logout(); state.setUser(null); toast("Signed out"); location.hash = "#/auth";
  });
  document.getElementById("resetBtn").addEventListener("click", async () => {
    if (!confirm("Reset all local demo data? This signs you out.")) return;
    const { runSeed } = await import("../seed.js");
    Auth.logout();
    state.setUser(null);
    await runSeed({ force: true });
    toast("Demo data reset", "success");
    location.hash = "#/auth";
  });
}
