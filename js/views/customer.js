// js/views/customer.js
// Customer-facing screens (also hosts the auth screen).

import { Deliveries, Inventory, LocationChanges, Orders, Products, Shops, Complaints, Users } from "../api.js";
import { Auth, WORK_ID_PATTERNS, ALLOWED_EMAIL_DOMAINS, isAcceptedEmail } from "../auth.js";
import { state } from "../state.js";
import {
  toast, openModal, closeModal, etb, dateShort, statusBadge,
  iconSvg, avatarSvg, stars, formField, openThemePicker, getTheme, THEMES,
  t, catLabel, productName, unitLabel, shopName, subCityLabel, cityLabel,
  SUB_CITY_COORDS, ADDIS_CENTER, isDev, productImageHtml, userAvatarHtml, imageFileToDataUrl,
} from "./shared.js";
import { SUB_CITIES, CATEGORIES } from "../seed.js";

const view = () => document.getElementById("view");

async function customerVisibleShops(subCity) {
  return Shops.list({ subCity, status: "approved" });
}

// ------------------ AUTH ------------------
function bindEnterSubmit(scope, buttonSelectorOrGetter) {
  if (!scope || scope.dataset.enterSubmitBound === "true") return;
  scope.dataset.enterSubmitBound = "true";
  scope.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.target?.tagName === "TEXTAREA") return;
    const button = typeof buttonSelectorOrGetter === "function"
      ? buttonSelectorOrGetter()
      : scope.querySelector(buttonSelectorOrGetter);
    if (!button || button.disabled) return;
    event.preventDefault();
    button.click();
  });
}

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
        </div>
      </div>
    </section>
  `;
  v.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
    v.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
    drawAuthForm(t.dataset.tab);
  }));
  bindEnterSubmit(v.querySelector("#authForm"), () => {
    const form = document.getElementById("authForm");
    return form?.querySelector(form.dataset.submitButton || "");
  });
  drawAuthForm("login");
}

function drawAuthForm(mode) {
  const wrap = document.getElementById("authForm");
  if (mode === "login") {
    wrap.dataset.submitButton = "#loginBtn";
    wrap.innerHTML = `
      ${formField({ label: t("auth.identifier"), name: "identifier", required: true })}
      ${formField({ label: t("auth.password"), name: "password", type: "password", required: true })}
      <div class="btnrow">
        <button class="primary" id="loginBtn">${t("auth.signin_btn")}</button>
      </div>
      <div class="forgot-row">
        <button class="forgot-link" id="forgotPasswordBtn" type="button">${t("auth.forgot_password")}</button>
      </div>
    `;
    document.getElementById("loginBtn").addEventListener("click", onLogin);
    document.getElementById("forgotPasswordBtn").addEventListener("click", openForgotPassword);
    // Force the identifier (email) to lowercase as the user types — emails
    // are case-insensitive and our auth store keeps them lowercase.
    const idInput = document.querySelector("#authForm [name=identifier]");
    idInput?.addEventListener("input", () => { idInput.value = idInput.value.toLowerCase(); });
  } else {
    wrap.dataset.submitButton = "#signupBtn";
    wrap.innerHTML = `
      ${formField({ label: t("auth.fullname"), name: "name", required: true, placeholder: t("auth.fullname_ph") })}
      ${formField({ label: t("auth.email"), name: "email", placeholder: t("auth.email_ph") })}
      <div class="muted" style="font-size:12px;margin-top:6px;">${t("auth.email_accepted_hint", { list: ALLOWED_EMAIL_DOMAINS.join(", ") })}</div>
      <div id="emailStatus" class="field-status" style="font-size:12px;margin-top:4px;"></div>
      ${formField({ label: t("auth.phone"), name: "phone", placeholder: t("auth.phone_ph") })}
      ${formField({ label: t("auth.password"), name: "password", type: "password", placeholder: t("auth.password_ph"), required: true })}
      <div class="muted password-hint">${t("auth.password_hint")}</div>
      ${formField({ label: t("auth.password_confirm"), name: "passwordConfirm", type: "password", required: true })}
      ${formField({ label: t("auth.role"), name: "role", type: "select", value: "customer", options: [
        { value: "customer", label: t("role.customer") },
        { value: "owner", label: t("role.owner") },
        { value: "delivery", label: t("role.delivery") },
        { value: "branch", label: t("role.branch") },
        { value: "main", label: t("role.main") },
      ]})}
      ${formField({ label: t("auth.subcity"), name: "subCity", type: "select", value: "Bole",
        options: SUB_CITIES.map(s => ({ value: s, label: subCityLabel(s) })) })}
      <div id="staffFields" hidden>
        <div class="muted mt8" style="font-size:12px;">${t("auth.staff_note")}</div>
        ${formField({ label: t("auth.workid"), name: "workId", placeholder: "" })}
        <div id="workIdHint" class="muted" style="font-size:12px;margin-top:6px;"></div>
        <div id="workIdStatus" class="field-status" style="font-size:12px;margin-top:4px;"></div>
        ${formField({ label: t("auth.fayda"), name: "faydaFan", placeholder: t("auth.fayda_ph") })}
        <div id="faydaStatus" class="field-status" style="font-size:12px;margin-top:4px;"></div>
      </div>
      <div class="btnrow">
        <button class="primary" id="signupBtn">${t("auth.signup_btn")}</button>
      </div>
    `;
    const roleSel = document.querySelector("#authForm [name=role]");
    const staffFields = document.getElementById("staffFields");
    const workIdInput = document.querySelector("#authForm [name=workId]");
    const workIdHint = document.getElementById("workIdHint");
    const workIdStatus = document.getElementById("workIdStatus");
    const fanInput = document.querySelector("#authForm [name=faydaFan]");
    const fanStatus = document.getElementById("faydaStatus");
    const emailInput = document.querySelector("#authForm [name=email]");
    const emailStatus = document.getElementById("emailStatus");
    const syncStaffFields = () => {
      const role = roleSel.value;
      staffFields.hidden = role === "customer";
      const pattern = WORK_ID_PATTERNS[role];
      if (pattern && workIdInput) {
        workIdInput.placeholder = pattern.example;
        workIdInput.value = "";
        workIdHint.textContent = t(`auth.workid_format_${role}`);
      }
      workIdStatus.textContent = "";
      workIdStatus.className = "field-status";
      fanStatus.textContent = "";
      fanStatus.className = "field-status";
      if (fanInput) fanInput.value = "";
    };
    let workIdTimer = null;
    const checkWorkId = async () => {
      const role = roleSel.value;
      if (role === "customer") return;
      const value = workIdInput.value.trim().toUpperCase();
      workIdStatus.textContent = "";
      workIdStatus.className = "field-status";
      if (!value) return;
      const pattern = WORK_ID_PATTERNS[role];
      if (!pattern || !pattern.regex.test(value)) {
        workIdStatus.textContent = `✗ ${t("auth.field_invalid_format")}`;
        workIdStatus.className = "field-status invalid";
        return;
      }
      const result = await Users.checkUnique({ workId: value });
      if (result.workIdTaken) {
        workIdStatus.textContent = `✗ ${t("auth.field_taken")}`;
        workIdStatus.className = "field-status taken";
      } else {
        workIdStatus.textContent = `✓ ${t("auth.field_available")}`;
        workIdStatus.className = "field-status available";
      }
    };
    workIdInput.addEventListener("input", () => {
      clearTimeout(workIdTimer);
      workIdTimer = setTimeout(checkWorkId, 250);
    });

    let fanTimer = null;
    const checkFan = async () => {
      if (roleSel.value === "customer") return;
      const fanDigits = (fanInput.value || "").replace(/\s+/g, "");
      fanStatus.textContent = "";
      fanStatus.className = "field-status";
      if (!fanDigits) return;
      if (!/^\d{16}$/.test(fanDigits)) {
        fanStatus.textContent = `✗ ${t("auth.field_invalid_format")}`;
        fanStatus.className = "field-status invalid";
        return;
      }
      const result = await Users.checkUnique({ faydaFan: fanDigits });
      if (result.faydaFanTaken) {
        fanStatus.textContent = `✗ ${t("auth.field_taken")}`;
        fanStatus.className = "field-status taken";
      } else {
        fanStatus.textContent = `✓ ${t("auth.field_available")}`;
        fanStatus.className = "field-status available";
      }
    };
    fanInput?.addEventListener("input", () => {
      clearTimeout(fanTimer);
      fanTimer = setTimeout(checkFan, 250);
    });

    let emailTimer = null;
    const checkEmail = () => {
      const value = (emailInput.value || "").trim();
      emailStatus.textContent = "";
      emailStatus.className = "field-status";
      if (!value) return;
      if (!isAcceptedEmail(value)) {
        emailStatus.textContent = `✗ ${t("auth.email_unsupported")}`;
        emailStatus.className = "field-status invalid";
      } else {
        emailStatus.textContent = `✓ ${t("auth.email_accepted")}`;
        emailStatus.className = "field-status available";
      }
    };
    emailInput?.addEventListener("input", () => {
      // Force lowercase as the user types so saved value matches Supabase.
      if (emailInput.value !== emailInput.value.toLowerCase()) {
        const pos = emailInput.selectionStart;
        emailInput.value = emailInput.value.toLowerCase();
        emailInput.setSelectionRange?.(pos, pos);
      }
      clearTimeout(emailTimer);
      emailTimer = setTimeout(checkEmail, 200);
    });

    roleSel.addEventListener("change", syncStaffFields);
    syncStaffFields();
    document.getElementById("signupBtn").addEventListener("click", onSignup);
  }
}

async function onLogin() {
  const identifier = document.querySelector("#authForm [name=identifier]").value.trim().toLowerCase();
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

function openForgotPassword() {
  openModal(t("auth.reset_title"), `
    ${formField({ label: t("auth.identifier"), name: "resetIdentifier", required: true })}
    <div class="btnrow mt12">
      <button class="primary" id="requestResetBtn">${t("auth.reset_request_btn")}</button>
      <button class="ghost" id="resetCancelBtn">${t("cancel")}</button>
    </div>
    <div id="resetStep" class="mt12"></div>
  `);

  const idInput = document.querySelector("#modalBody [name=resetIdentifier]");
  const requestBtn = document.getElementById("requestResetBtn");
  const resetStep = document.getElementById("resetStep");
  bindEnterSubmit(document.getElementById("modalBody"), () => (
    document.getElementById("completeResetBtn") || document.getElementById("requestResetBtn")
  ));
  idInput?.addEventListener("input", () => { idInput.value = idInput.value.toLowerCase(); });
  document.getElementById("resetCancelBtn").onclick = () => closeModal();
  requestBtn.onclick = async () => {
    const identifier = idInput.value.trim().toLowerCase();
    if (!identifier) { toast(t("auth.enter_creds"), "danger"); return; }
    const originalText = requestBtn.textContent;
    requestBtn.disabled = true;
    requestBtn.textContent = t("auth.reset_sending");
    resetStep.innerHTML = `<div class="muted reset-message">${t("auth.reset_sending")}</div>`;
    try {
      const result = await Auth.requestPasswordReset({ identifier });
      const emailFailed = result.emailSent === false;
      const tokenField = result.resetToken
        ? formField({ label: t("auth.reset_token"), name: "resetToken", value: result.resetToken, required: true })
        : formField({ label: t("auth.reset_token"), name: "resetToken", required: true });
      const resetForm = !emailFailed || result.resetToken ? `
          ${tokenField}
          ${formField({ label: t("auth.new_password"), name: "resetPassword", type: "password", placeholder: t("auth.password_ph"), required: true })}
          <div class="muted password-hint">${t("auth.password_hint")}</div>
          ${formField({ label: t("auth.password_confirm"), name: "resetPasswordConfirm", type: "password", required: true })}
          <div class="btnrow mt12">
            <button class="primary" id="completeResetBtn">${t("auth.reset_complete_btn")}</button>
          </div>
        ` : "";
      resetStep.innerHTML = `
        <div class="${emailFailed ? "reset-error" : "muted reset-message"}">${result.message || (emailFailed ? t("auth.reset_email_failed") : t("auth.reset_sent"))}</div>
        ${emailFailed ? "" : `<div class="muted reset-message">${t("auth.reset_email_hint")}</div>`}
        ${resetForm}
      `;
      document.getElementById("completeResetBtn")?.addEventListener("click", async () => {
        const token = document.querySelector("#modalBody [name=resetToken]").value.trim();
        const password = document.querySelector("#modalBody [name=resetPassword]").value;
        const confirm = document.querySelector("#modalBody [name=resetPasswordConfirm]").value;
        if (password !== confirm) { toast(t("auth.password_mismatch"), "danger"); return; }
        try {
          await Auth.resetPassword({ token, password });
          closeModal();
          toast(t("auth.reset_done"), "success");
        } catch (e) {
          toast(e.message, "danger");
        }
      });
      toast(emailFailed ? (result.message || t("auth.reset_email_failed")) : t("auth.reset_sent"), emailFailed ? "danger" : "success");
    } catch (e) {
      resetStep.innerHTML = `<div class="reset-error">${e.message}</div>`;
      toast(e.message, "danger");
    } finally {
      requestBtn.disabled = false;
      requestBtn.textContent = originalText;
    }
  };
}

async function onSignup() {
  const f = (n) => document.querySelector(`#authForm [name=${n}]`).value.trim();
  // Emails are case-insensitive — normalize to lowercase here as a safety net
  // in addition to the input-time listener.
  const emailEl = document.querySelector("#authForm [name=email]");
  if (emailEl) emailEl.value = emailEl.value.toLowerCase();
  const role = f("role");
  const subCity = f("subCity");
  const password = f("password");
  const passwordConfirm = f("passwordConfirm");
  if (password !== passwordConfirm) {
    toast(t("auth.password_mismatch"), "danger");
    return;
  }
  let committeeId = null;
  if (role === "branch" || role === "main") {
    const { Committees } = await import("../api.js");
    const committees = await Committees.list();
    if (role === "branch") {
      committeeId = committees.find(c => c.type === "branch" && c.jurisdiction === subCity)?.id || null;
    } else {
      committeeId = committees.find(c => c.type === "main")?.id || null;
    }
  }
  try {
    const { user } = await Auth.register({
      name: f("name"), email: f("email"), phone: f("phone"),
      password: f("password"), role, subCity, committeeId,
      workId: role === "customer" ? null : f("workId"),
      faydaFan: role === "customer" ? null : f("faydaFan"),
    });
    state.setUser(user);
    toast(t("auth.account_created", { name: user.name }), "success");
    const nextRoute = defaultRouteFor(user.role);
    if (location.hash === nextRoute) {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    } else {
      location.hash = nextRoute;
    }
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
                ${SUB_CITIES.map(s => `<option value="${s}" ${s === subCity ? "selected" : ""}>${subCityLabel(s)}</option>`).join("")}
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
            <div class="sort-row">
              <span class="muted" style="font-size:12px;font-weight:800;">${t("home.sort_by")}</span>
              <select id="sortSel">
                <option value="default">${t("home.sort_default")}</option>
                <option value="name_asc">${t("home.sort_name_asc")}</option>
                <option value="name_desc">${t("home.sort_name_desc")}</option>
                <option value="price_asc">${t("home.sort_price_asc")}</option>
                <option value="price_desc">${t("home.sort_price_desc")}</option>
                <option value="shop_asc">${t("home.sort_shop_asc")}</option>
                <option value="rating_desc">${t("home.sort_rating_desc")}</option>
              </select>
            </div>
            <div class="plist" id="plist"><div class="empty">${t("loading")}</div></div>
          </div>
        </div>

        <div class="card">
          <div class="hd">
            <div>
              <h2>${t("home.shops_nearby")}</h2>
              <div class="muted">${t("home.shops_in", { city: subCityLabel(subCity) })}</div>
            </div>
            <button class="viewbtn" id="allShopsBtn">${t("all")}</button>
          </div>
          <div class="bd">
            <div class="livemap" id="liveMap">
              <div class="maplabel">${cityLabel("Addis Ababa")} · ${subCityLabel(subCity)}</div>
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
  const sortSel = document.getElementById("sortSel");
  sortSel.value = state.get("filterSort") || "default";
  sortSel.addEventListener("change", (e) => {
    state.set("filterSort", e.target.value);
    drawProducts();
  });
  document.getElementById("allShopsBtn").addEventListener("click", () => location.hash = "#/shops");

  await drawProducts();
  await drawShops();
  initLiveMap(subCity);
}

// Module-scoped Leaflet instance so we can tear it down before re-initializing
// when the user changes sub-city or language (Leaflet leaks if you just drop
// the container without removing the map first).
let _leafletMap = null;
async function initLiveMap(subCity) {
  const el = document.getElementById("liveMap");
  if (!el || typeof L === "undefined") return;

  if (_leafletMap) { _leafletMap.remove(); _leafletMap = null; }

  const center = SUB_CITY_COORDS[subCity] || ADDIS_CENTER;
  _leafletMap = L.map(el, {
    zoomControl: true, attributionControl: true, scrollWheelZoom: false,
  }).setView(center, 14);

  // Esri WorldImagery — free, no API key, real satellite photography.
  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, attribution: "Imagery © Esri, Maxar, Earthstar Geographics" }
  ).addTo(_leafletMap);
  // Transparent labels layer so streets, sub-city names, and major roads
  // still show on top of the satellite imagery (Google-Maps-Hybrid style).
  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, attribution: "Labels © Esri" }
  ).addTo(_leafletMap);

  // Drop a marker at the sub-city center, then mark each approved shop in
  // the area with a slight jitter so multiple shops don't overlap.
  const css = getComputedStyle(document.documentElement);
  const primary = css.getPropertyValue("--primary").trim() || "#6b8e4e";
  const accent  = css.getPropertyValue("--accent").trim()  || "#c97b5e";

  const centerIcon = L.divIcon({
    className: "leaflet-center-pin",
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${primary};border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.25);"></div>`,
    iconSize: [20, 20], iconAnchor: [10, 10],
  });
  const dirUrl = (lat, lng) =>
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  const dirLink = (lat, lng) =>
    `<a href="${dirUrl(lat, lng)}" target="_blank" rel="noopener" class="popup-dir">📍 ${t("map.directions")}</a>`;

  L.marker(center, { icon: centerIcon }).addTo(_leafletMap)
    .bindPopup(`<b>${subCityLabel(subCity)}</b><br/>${dirLink(center[0], center[1])}`);

  const shops = await customerVisibleShops(subCity);
  shops.forEach((s, i) => {
    const c = SUB_CITY_COORDS[s.subCity] || center;
    // Spiral the markers around the center so they're visually distinct.
    const angle = (i * 137.5) * (Math.PI / 180);
    const r = 0.0035 + (i % 3) * 0.0012;
    const lat = c[0] + Math.sin(angle) * r;
    const lng = c[1] + Math.cos(angle) * r;
    const shopIcon = L.divIcon({
      className: "leaflet-shop-pin",
      html: `<div style="width:30px;height:30px;border-radius:50%;background:${accent};border:3px solid #fff;display:grid;place-items:center;font-weight:900;color:#fff;font-size:12px;box-shadow:0 6px 14px rgba(0,0,0,.25);">${i+1}</div>`,
      iconSize: [30, 30], iconAnchor: [15, 15],
    });
    L.marker([lat, lng], { icon: shopIcon }).addTo(_leafletMap)
      .bindPopup(`<b>${shopName(s)}</b><br/>${stars(s.rating || 0)}<br/>${dirLink(lat, lng)}`);
  });

  // Floating "Open in Maps" control top-right so users can launch directions
  // to the sub-city center without clicking a pin first.
  const OpenInMapsControl = L.Control.extend({
    options: { position: "topright" },
    onAdd() {
      const a = L.DomUtil.create("a", "leaflet-open-maps");
      a.href = dirUrl(center[0], center[1]);
      a.target = "_blank";
      a.rel = "noopener";
      a.innerHTML = `📍 ${t("map.open_in_maps")}`;
      L.DomEvent.disableClickPropagation(a);
      return a;
    },
  });
  new OpenInMapsControl().addTo(_leafletMap);

  // Fix tile rendering inside flex/grid by invalidating size after layout settles.
  setTimeout(() => _leafletMap && _leafletMap.invalidateSize(), 60);
}

async function drawProducts() {
  const subCity = state.get("filterSubCity") || state.user?.subCity || "Bole";
  const category = state.get("filterCategory") || "All";
  const q = state.get("filterQ") || "";
  const sort = state.get("filterSort") || "default";
  const list = document.getElementById("plist");
  if (!list) return;
  list.innerHTML = `<div class="empty">${t("loading")}</div>`;

  const rows = await Inventory.listingsForBrowse({ subCity, q, category });

  const lc = (s) => String(s || "").toLowerCase();
  switch (sort) {
    case "name_asc":    rows.sort((a, b) => lc(productName(a.product)).localeCompare(lc(productName(b.product)))); break;
    case "name_desc":   rows.sort((a, b) => lc(productName(b.product)).localeCompare(lc(productName(a.product)))); break;
    case "price_asc":   rows.sort((a, b) => Number(a.price) - Number(b.price)); break;
    case "price_desc":  rows.sort((a, b) => Number(b.price) - Number(a.price)); break;
    case "shop_asc":    rows.sort((a, b) => lc(shopName(a.shop)).localeCompare(lc(shopName(b.shop)))); break;
    case "rating_desc": rows.sort((a, b) => (b.shop?.rating || 0) - (a.shop?.rating || 0)); break;
    default: /* leave default order */
  }
  if (rows.length === 0) {
    list.innerHTML = `<div class="empty">${t("home.no_products", { city: subCityLabel(subCity) })}</div>`;
    return;
  }
  list.innerHTML = rows.map(r => {
    const oldPrice = r.oldPrice && r.oldPrice > r.price
      ? `<div class="old">${etb(r.oldPrice)}</div>` : "";
    const range = r.range ? `<div class="range">${t("home.range", { min: etb(r.range.minPrice), max: etb(r.range.maxPrice) })}</div>` : "";
    const outOfStock = !(r.qty > 0);
    const buyAction = outOfStock
      ? `<span class="oos-badge">${t("home.out_of_stock")}</span>`
      : `
        <div class="qty-add">
          <div class="qty-stepper">
            <button type="button" class="qty-step" data-step="-1" data-id="${r.id}">−</button>
            <input type="number" class="qty-input" data-qty="${r.id}" value="1" min="1" max="${r.qty}" />
            <button type="button" class="qty-step" data-step="+1" data-id="${r.id}">+</button>
          </div>
          <button class="addbtn" data-add="${r.id}">${t("add")}</button>
        </div>
      `;
    return `
      <div class="pitem ${outOfStock ? "is-oos" : ""}">
        <div class="pimg">${productImageHtml(r.product)}</div>
        <div>
          <div class="ptitle">${productName(r.product)}</div>
          <div class="psub">${catLabel(r.product.category)} · ${t("home.sold_by")} <a data-shop="${r.shop.id}">${shopName(r.shop)}</a></div>
          ${range}
        </div>
        <div class="pricebox">
          ${oldPrice}
          <div class="now">${etb(r.price)} / ${unitLabel(r.product.unit)}</div>
          ${buyAction}
        </div>
      </div>
    `;
  }).join("");

  list.querySelectorAll("[data-add]").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.add;
    const qtyEl = list.querySelector(`[data-qty="${id}"]`);
    const qty = Math.max(1, Number(qtyEl?.value || 1));
    addToCart(id, qty);
  }));
  list.querySelectorAll("[data-step]").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.id;
    const qtyEl = list.querySelector(`[data-qty="${id}"]`);
    if (!qtyEl) return;
    const min = Number(qtyEl.min || 1);
    const max = Number(qtyEl.max || Infinity);
    const next = Math.min(max, Math.max(min, (Number(qtyEl.value) || min) + Number(b.dataset.step)));
    qtyEl.value = String(next);
  }));
  list.querySelectorAll("[data-shop]").forEach(b => b.addEventListener("click", () => openShopModal(b.dataset.shop)));
}

async function drawShops() {
  const subCity = state.get("filterSubCity") || state.user?.subCity || "Bole";
  const grid = document.getElementById("shopsList");
  if (!grid) return;
  const shops = await customerVisibleShops(subCity);
  if (shops.length === 0) {
    grid.innerHTML = `<div class="empty">${t("home.no_shops", { city: subCityLabel(subCity) })}</div>`;
    return;
  }
  grid.innerHTML = shops.map((s, i) => `
    <div class="shopcard">
      <div class="avatar">${avatarSvg(i)}</div>
      <div>
        <div style="font-weight:900;">${shopName(s)}</div>
        <div>${stars(s.rating || 0)}</div>
        <div class="shopmeta">${t("auth.subcity")}: ${subCityLabel(s.subCity)}</div>
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
          <div><h2>${t("shops.title", { city: subCityLabel(subCity) })}</h2><div class="muted">${t("shops.subtitle")}</div></div>
          <button class="viewbtn" data-link="home">${t("back")}</button>
        </div>
        <div class="shopsgrid" id="shopsAll"></div>
      </div>
    </section>
  `;
  const shops = await customerVisibleShops(subCity);
  const el = document.getElementById("shopsAll");
  if (shops.length === 0) { el.innerHTML = `<div class="empty">${t("shops.no_approved", { city: subCityLabel(subCity) })}</div>`; return; }
  el.innerHTML = shops.map((s, i) => `
    <div class="shopcard">
      <div class="avatar">${avatarSvg(i)}</div>
      <div>
        <div style="font-weight:900;">${shopName(s)}</div>
        <div>${stars(s.rating || 0)}</div>
        <div class="shopmeta">${t("auth.subcity")}: ${subCityLabel(s.subCity)}</div>
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
  const inv = await Inventory.byShop(shopId, { onlyApproved: true });
  const sample = inv.slice(0, 6);
  openModal(`${shopName(shop)} · ${t("profile")}`, `
    <div class="row">
      <div>
        <div style="font-weight:900;font-size:16px;">${shopName(shop)}</div>
        <div class="muted">${t("auth.subcity")}: <b>${subCityLabel(shop.subCity)}</b></div>
        <div class="mt8">${stars(shop.rating || 0)}</div>
      </div>
      <div>${statusBadge(shop.status)}</div>
    </div>

    <hr/>
    <div style="font-weight:900;">${t("shops.popular_items")}</div>
    <div class="muted">${t("shops.regulated_note")}</div>
    <div class="mt8" style="display:grid;gap:10px;">
      ${sample.map(i => {
        const oos = !(i.qty > 0);
        return `
        <div class="pitem ${oos ? "is-oos" : ""}">
          <div class="pimg">${productImageHtml(i.product)}</div>
          <div>
            <div class="ptitle">${productName(i.product)}</div>
            <div class="psub">${catLabel(i.product?.category || "All")} · ${etb(i.price)} / ${unitLabel(i.product?.unit || "kg")}</div>
          </div>
          <div class="pricebox">
            ${oos
              ? `<span class="oos-badge">${t("home.out_of_stock")}</span>`
              : `
                <div class="qty-add">
                  <div class="qty-stepper">
                    <button type="button" class="qty-step" data-step="-1" data-id="${i.id}">−</button>
                    <input type="number" class="qty-input" data-qty="${i.id}" value="1" min="1" max="${i.qty}" />
                    <button type="button" class="qty-step" data-step="+1" data-id="${i.id}">+</button>
                  </div>
                  <button class="addbtn" data-add="${i.id}">${t("add")}</button>
                </div>
              `}
          </div>
        </div>
      `;}).join("") || `<div class="muted">${t("shops.no_listed")}</div>`}
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

  document.querySelectorAll("#modalBody [data-step]").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.id;
    const qtyEl = document.querySelector(`#modalBody [data-qty="${id}"]`);
    if (!qtyEl) return;
    const min = Number(qtyEl.min || 1);
    const max = Number(qtyEl.max || Infinity);
    const next = Math.min(max, Math.max(min, (Number(qtyEl.value) || min) + Number(b.dataset.step)));
    qtyEl.value = String(next);
  }));
  document.querySelectorAll("#modalBody [data-add]").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.add;
    const qtyEl = document.querySelector(`#modalBody [data-qty="${id}"]`);
    const qty = Math.max(1, Number(qtyEl?.value || 1));
    addToCart(id, qty);
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

export function addToCart(inventoryId, qty = 1) {
  const n = Math.max(1, Math.floor(Number(qty) || 1));
  const cart = { ...getCart() };
  cart[inventoryId] = (cart[inventoryId] || 0) + n;
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

async function currentCartItems() {
  const original = { ...getCart() };
  const nextCart = {};
  let changed = false;

  for (const [id, qty] of Object.entries(original)) {
    const inv = await fetchInventoryWithProduct(id);
    if (!inv) {
      changed = true;
      continue;
    }
    if (inv.id !== id) changed = true;
    nextCart[inv.id] = (nextCart[inv.id] || 0) + qty;
  }

  if (changed) setCart(nextCart);

  const items = [];
  for (const [id, qty] of Object.entries(nextCart)) {
    const inv = await fetchInventoryWithProduct(id);
    if (inv) items.push({ inv, qty });
  }
  return items;
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

  const items = await currentCartItems();
  if (items.length === 0) {
    document.getElementById("cartBody").innerHTML =
      `<div class="empty">${t("cart.empty")} <a data-link="home">${t("cart.empty_browse")}</a>.</div>`;
    return;
  }
  const total = items.reduce((a, x) => a + x.qty * x.inv.price, 0);
  document.getElementById("cartBody").innerHTML = `
    <div style="display:grid;gap:10px;">
      ${items.map(({ inv, qty }) => `
        <div class="pitem">
          <div class="pimg">${iconSvg(inv.product?.icon || "grain")}</div>
          <div>
            <div class="ptitle">${productName(inv.product)}</div>
            <div class="psub">${etb(inv.price)} / ${unitLabel(inv.product?.unit)} · ${t("br.shop_label")}: ${shopName(inv.shop)}</div>
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
  const inv = await Inventory.byId(invId);
  if (!inv || inv.status !== "approved" || inv.shop?.status !== "approved") return null;
  const current = (await Inventory.byShop(inv.shopId, { onlyApproved: true }))
    .find((row) => row.productId === inv.productId);
  return current || null;
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
  const items = await currentCartItems();
  if (items.length === 0) { document.getElementById("checkoutBody").innerHTML = `<div class="empty">${t("cart.empty")}</div>`; return; }
  const total = items.reduce((a, x) => a + x.qty * x.inv.price, 0);

  document.getElementById("checkoutBody").innerHTML = `
    <div style="font-weight:900;">${t("checkout.summary")}</div>
    <div class="muted">${t("checkout.lines_total", { lines: items.length, total: etb(total) })}</div>

    <hr/>
    <div class="fieldlabel">${t("checkout.address")}</div>
    <select id="deliverySubCity">
      ${SUB_CITIES.map(s => `<option value="${s}" ${s === state.user?.subCity ? "selected" : ""}>${subCityLabel(s)}</option>`).join("")}
    </select>

    <div class="btnrow">
      <button class="primary" id="payNow">${t("checkout.pay_now")}</button>
      <button class="ghost" id="payCod">${t("checkout.pay_cod")}</button>
    </div>
    <div class="muted mt12" style="font-size:12px;">${t("checkout.note")}</div>
  `;

  document.getElementById("payNow").onclick = () => openPayNowFlow(items);
  document.getElementById("payCod").onclick = () => placeOrder("cod");
}

// Pay-now flow: customers split their cart into per-shop orders. We open
// a modal asking them to pay to each shop's account in turn and upload a
// screenshot. If there are multiple shops, the modal cycles through them.
async function openPayNowFlow(items) {
  // Group cart items by shop (mirror of what Orders.create will do server-
  // side), then ask the customer for a proof per shop.
  const shopGroups = new Map();
  for (const { inv, qty } of items) {
    if (!shopGroups.has(inv.shop.id)) shopGroups.set(inv.shop.id, { shop: inv.shop, items: [], total: 0 });
    const g = shopGroups.get(inv.shop.id);
    g.items.push({ inv, qty });
    g.total += inv.price * qty;
  }
  const groups = [...shopGroups.values()];
  // We collect one proof per shop, then place all orders at the end.
  const proofs = new Map();
  let cursor = 0;

  const renderStep = async () => {
    const g = groups[cursor];
    const shop = await Shops.byId(g.shop.id);
    const accounts = shop?.paymentAccounts || [];
    if (accounts.length === 0) {
      toast(t("checkout.no_accounts", { shop: shopName(shop) }), "danger");
      closeModal();
      return;
    }
    let pickedAccountId = accounts[0].id;
    let proofImage = null;

    openModal(t("checkout.pay_modal", { shop: shopName(shop), step: cursor + 1, total: groups.length }), `
      <div class="muted">${t("checkout.pay_modal_subtitle", { total: etb(g.total) })}</div>
      <div class="fieldlabel mt12">${t("checkout.pick_account")}</div>
      <div id="payAccChoices" style="display:grid;gap:8px;">
        ${accounts.map((a, i) => `
          <label class="pay-account-card" data-acc="${a.id}">
            <input type="radio" name="payacc" value="${a.id}" ${i === 0 ? "checked" : ""} />
            <div>
              <div style="font-weight:900;">${escapeAttr(a.bankName)}</div>
              <div class="muted" style="font-size:12px;">${t("checkout.account_name")}: <b>${escapeAttr(a.accountName)}</b></div>
              <div class="muted" style="font-size:12px;display:flex;gap:6px;align-items:center;">
                <span>${t("checkout.account_number")}: <b class="mono">${escapeAttr(a.accountNumber)}</b></span>
                <button type="button" class="ghost copy-btn" data-copy="${escapeAttr(a.accountNumber)}" style="font-size:11px;padding:2px 8px;">${t("checkout.copy")}</button>
              </div>
            </div>
          </label>
        `).join("")}
      </div>
      <div class="muted mt12" style="font-size:12px;">${t("checkout.transfer_instructions")}</div>
      <hr/>
      <div class="fieldlabel">${t("checkout.proof_label")} *</div>
      <div class="avatar-picker">
        <div class="avatar-preview" id="payProofPreview" style="border-radius:14px;">
          <span class="muted" style="font-size:11px;text-align:center;padding:6px;">${t("checkout.proof_hint")}</span>
        </div>
        <div class="avatar-picker-side">
          <input type="file" id="payProofUpload" accept="image/*" capture="environment" hidden />
          <div class="btnrow" style="margin:0;flex-wrap:wrap;">
            <button type="button" class="viewbtn" id="payProofBtn">📷 ${t("checkout.upload_screenshot")}</button>
          </div>
        </div>
      </div>
      ${formField({ label: t("checkout.reference_label"), name: "reference", required: true, placeholder: t("checkout.reference_ph") })}
      <div class="btnrow mt12">
        <button class="primary" id="payNext">${cursor + 1 === groups.length ? t("checkout.pay_finish") : t("checkout.pay_next")}</button>
        <button class="ghost" id="payCancel">${t("cancel")}</button>
      </div>
    `);

    document.querySelectorAll('input[name="payacc"]').forEach(r => r.addEventListener("change", (e) => {
      pickedAccountId = e.target.value;
    }));
    document.querySelectorAll(".copy-btn").forEach(b => b.addEventListener("click", async (e) => {
      e.preventDefault();
      try { await navigator.clipboard.writeText(b.dataset.copy); toast(t("checkout.copied"), "success"); } catch {}
    }));
    const proofInput = document.getElementById("payProofUpload");
    document.getElementById("payProofBtn").onclick = () => proofInput.click();
    proofInput.addEventListener("change", async () => {
      const f = proofInput.files?.[0];
      if (!f) return;
      try {
        proofImage = await imageFileToDataUrl(f, { maxSize: 600, quality: 0.85 });
        document.getElementById("payProofPreview").innerHTML = `<img src="${proofImage}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:14px;" />`;
      } catch (e) { toast(e.message, "danger"); }
      proofInput.value = "";
    });
    document.getElementById("payCancel").onclick = () => closeModal();
    document.getElementById("payNext").onclick = async () => {
      const reference = document.querySelector("#modalBody [name=reference]").value.trim();
      if (!proofImage) { toast(t("checkout.proof_required"), "danger"); return; }
      if (!reference) { toast(t("checkout.reference_required"), "danger"); return; }
      proofs.set(g.shop.id, { accountId: pickedAccountId, image: proofImage, reference });
      cursor++;
      if (cursor < groups.length) {
        await renderStep();
      } else {
        await submitAllOrders(proofs);
      }
    };
  };
  await renderStep();
}

async function submitAllOrders(proofs) {
  const subCity = document.getElementById("deliverySubCity")?.value || state.user?.subCity || "Bole";
  const cart = getCart();
  const items = Object.entries(cart).map(([id, qty]) => ({ inventoryId: id, qty }));
  // Orders.create groups per shop and only accepts one proof at a time. We
  // do separate calls per shop so each gets its own proof attached.
  try {
    // First call: send full cart with the first shop's proof; this won't
    // attach proofs to other shops. So instead: split cart per shop and
    // place each order with its proof.
    const ordersResult = [];
    for (const [shopId, proof] of proofs.entries()) {
      const groupItems = [];
      for (const { inventoryId, qty } of items) {
        const inv = await Inventory.byId(inventoryId);
        if (inv?.shopId === shopId) groupItems.push({ inventoryId, qty });
      }
      if (groupItems.length === 0) continue;
      const placed = await Orders.create({
        items: groupItems, paymentType: "prepay", customerSubCity: subCity,
        paymentProof: proof,
      });
      ordersResult.push(...placed);
    }
    setCart({});
    closeModal();
    toast(t("checkout.placed", { n: ordersResult.length }), "success");
    location.hash = "#/track";
  } catch (e) {
    toast(e.message, "danger");
  }
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
  v.innerHTML = `<section class="page">
    <div class="card" id="trackLiveCard" hidden>
      <div class="hd"><div><h2>${t("track.live_title")}</h2><div class="muted" id="trackLiveSub"></div></div></div>
      <div class="bd">
        <div class="livemap" id="trackLiveMap"></div>
      </div>
    </div>
    <div class="card mt12">
      <div class="hd"><div><h2>${t("track.title")}</h2><div class="muted">${t("track.subtitle")}</div></div>
        <button class="viewbtn" data-link="home">${t("track.home")}</button>
      </div>
      <div class="bd" id="trackBody">${t("loading")}</div>
    </div>
  </section>`;

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
        ${canComplainNow(o) ? `<button class="ghost" data-complain="${o.id}">${t("track.complain")}</button>` : ""}
      </div>
    </div>
  `).join("");

  document.querySelectorAll("[data-detail]").forEach(b => b.addEventListener("click", async () => {
    try {
      await openOrderDetail(b.dataset.detail);
    } catch (e) {
      toast(e.message || "Could not open order details.", "danger");
    }
  }));
  document.querySelectorAll("[data-complain]").forEach(b => b.addEventListener("click", () => openComplaintForm(b.dataset.complain)));

  // Find the first active delivery (assigned / accepted / picked_up / en_route)
  // and show a live tracking map for it. Position is interpolated from the
  // shop to the customer's sub-city, with a status- and time-based offset
  // plus a small wobble so it feels alive.
  const ACTIVE = ["assigned", "accepted", "picked_up", "en_route"];
  let liveOrder = null;
  let liveDelivery = null;
  for (const o of orders) {
    if (!o.deliveryId) continue;
    const d = await Deliveries.byId(o.deliveryId);
    if (d && ACTIVE.includes(d.status)) { liveOrder = o; liveDelivery = d; break; }
  }
  if (liveOrder && liveDelivery) {
    await initTrackingMap(liveOrder, liveDelivery);
  } else {
    stopTrackingMap();
  }
}

// Module-scoped Leaflet instance + animation timer so we can tear them down
// when navigating away or rendering again.
let _trackMap = null;
let _trackInterval = null;

function googleMapsRouteUrl(origin, destination) {
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination[0]},${destination[1]}`,
    travelmode: "driving",
  });
  if (origin) params.set("origin", `${origin[0]},${origin[1]}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function deliveryProgressPoint(delivery, shopCenter, custCenter, { live = false } = {}) {
  const baseT = {
    assigned:  0.02,
    accepted:  0.05,
    picked_up: 0.20,
    en_route:  0.55,
  }[delivery?.status] ?? 0.5;

  const dispatchedAt = new Date(delivery?.updatedAt || delivery?.createdAt || Date.now()).getTime();
  const elapsed = (Date.now() - dispatchedAt) / 60000; // minutes
  let progress = baseT;
  if (delivery?.status === "en_route") {
    progress = Math.min(0.95, 0.55 + (elapsed / 20) * 0.4);
  } else if (delivery?.status === "picked_up") {
    progress = Math.min(0.45, 0.20 + (elapsed / 15) * 0.25);
  }
  if (live) progress += (Math.random() - 0.5) * 0.015;
  progress = Math.max(0.02, Math.min(0.98, progress));
  return [
    shopCenter[0] + (custCenter[0] - shopCenter[0]) * progress,
    shopCenter[1] + (custCenter[1] - shopCenter[1]) * progress,
  ];
}

function stopTrackingMap() {
  if (_trackInterval) { clearInterval(_trackInterval); _trackInterval = null; }
  if (_trackMap) { _trackMap.remove(); _trackMap = null; }
  const card = document.getElementById("trackLiveCard");
  if (card) card.hidden = true;
}

async function initTrackingMap(order, delivery) {
  stopTrackingMap();
  const el = document.getElementById("trackLiveMap");
  const card = document.getElementById("trackLiveCard");
  if (!el || typeof L === "undefined") return;

  const shop = await Shops.byId(order.shopId);
  const shopCenter = SUB_CITY_COORDS[shop?.subCity] || ADDIS_CENTER;
  const custCenter = SUB_CITY_COORDS[order.customerSubCity] || ADDIS_CENTER;
  card.hidden = false;
  document.getElementById("trackLiveSub").textContent = t("track.live_sub", {
    id: order.id.slice(-6).toUpperCase(),
    status: t(`status.${delivery.status}`, delivery.status),
  });

  const bounds = L.latLngBounds([shopCenter, custCenter]).pad(0.4);
  _trackMap = L.map(el, { scrollWheelZoom: false, attributionControl: true }).fitBounds(bounds);
  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, attribution: "Imagery © Esri" }
  ).addTo(_trackMap);
  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19 }
  ).addTo(_trackMap);

  const pinIcon = (bg, glyph) => L.divIcon({
    className: "track-pin",
    html: `<div style="background:${bg};width:34px;height:34px;border-radius:50%;border:3px solid #fff;display:grid;place-items:center;color:#fff;font-size:16px;box-shadow:0 4px 10px rgba(0,0,0,.25);">${glyph}</div>`,
    iconSize: [34, 34], iconAnchor: [17, 17],
  });
  L.marker(shopCenter, { icon: pinIcon("#6b8e4e", "🏪") }).addTo(_trackMap)
    .bindPopup(`<b>${shopName(shop)}</b><br/>${subCityLabel(shop?.subCity || "")}`);
  L.marker(custCenter, { icon: pinIcon("#c97b5e", "🏠") }).addTo(_trackMap)
    .bindPopup(`<b>${t("track.your_address")}</b><br/>${subCityLabel(order.customerSubCity)}`);
  L.polyline([shopCenter, custCenter], { color: "#fff", weight: 3, dashArray: "6 8", opacity: .7 }).addTo(_trackMap);

  const courierIcon = L.divIcon({
    className: "track-courier",
    html: `<div style="background:#fbbf24;width:38px;height:38px;border-radius:50%;border:3px solid #fff;display:grid;place-items:center;color:#fff;font-size:18px;box-shadow:0 6px 14px rgba(0,0,0,.35);">🛵</div>`,
    iconSize: [38, 38], iconAnchor: [19, 19],
  });
  const computePos = () => deliveryProgressPoint(delivery, shopCenter, custCenter, { live: true });
  const courierMarker = L.marker(computePos(), { icon: courierIcon }).addTo(_trackMap)
    .bindPopup(`<b>${t("track.live_courier")}</b><br/>${t("track.live_eta")}: ${delivery.eta || "—"}`);

  const GoogleMapsControl = L.Control.extend({
    options: { position: "topright" },
    onAdd() {
      const a = L.DomUtil.create("a", "leaflet-open-maps");
      a.href = googleMapsRouteUrl(computePos(), custCenter);
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = t("track.open_google_maps");
      a.title = t("track.google_maps_note");
      L.DomEvent.disableClickPropagation(a);
      L.DomEvent.on(a, "click", () => {
        const pos = courierMarker.getLatLng();
        a.href = googleMapsRouteUrl([pos.lat, pos.lng], custCenter);
      });
      return a;
    },
  });
  new GoogleMapsControl().addTo(_trackMap);

  _trackInterval = setInterval(() => {
    courierMarker.setLatLng(computePos());
  }, 5000);

  setTimeout(() => _trackMap?.invalidateSize(), 60);
}

// When the user navigates away from /track, stop the animation.
window.addEventListener("hashchange", () => {
  if (!location.hash.startsWith("#/track")) stopTrackingMap();
});

function progressPct(status) {
  return ({ created: 15, paid: 30, accepted: 45, preparing: 60, dispatched: 80, delivered: 95, completed: 100,
            cancelled: 100, refunded: 100 })[status] || 10;
}

// Customers can file complaints while an order is in progress, and for a
// 4-hour window after it completes. Cancelled / refunded orders are closed.
const COMPLAINT_WINDOW_HOURS = 4;
function canComplainNow(o) {
  if (!o) return false;
  if (o.status === "cancelled" || o.status === "refunded") return false;
  if (o.status !== "completed" && o.status !== "delivered") return true;
  const ts = o.completedAt || o.updatedAt || o.createdAt;
  if (!ts) return true;
  const hoursSince = (Date.now() - new Date(ts).getTime()) / (1000 * 60 * 60);
  return hoursSince <= COMPLAINT_WINDOW_HOURS;
}

async function openOrderDetail(orderId) {
  const o = await Orders.byId(orderId);
  if (!o) return;
  // Look up delivery (if assigned) so we can show the OTP and courier info.
  const delivery = o.deliveryId ? await Deliveries.byId(o.deliveryId) : null;
  const shop = await Shops.byId(o.shopId);
  const courier = delivery?.courierId ? await Users.byId(delivery.courierId) : null;
  const courierName = courier?.name || delivery?.courierName || "";
  const courierPhone = courier?.phone || delivery?.courierPhone || "";
  const shopCenter = delivery ? (SUB_CITY_COORDS[shop?.subCity] || ADDIS_CENTER) : null;
  const custCenter = delivery ? (SUB_CITY_COORDS[o.customerSubCity] || ADDIS_CENTER) : null;
  const routeOrigin = delivery ? deliveryProgressPoint(delivery, shopCenter, custCenter) : null;
  const googleRoute = delivery ? googleMapsRouteUrl(routeOrigin, custCenter) : "";
  const isDone = o.status === "delivered" || o.status === "completed";
  const paymentStatusHtml = o.paymentStatus && o.paymentStatus !== "n/a"
    ? paymentProofBadge(o.paymentStatus)
    : `<span class="badge-status warn">${o.paymentType === "prepay" ? t("payment_status.pending") : t("track.pay_cod_label")}</span>`;
  const deliveryPersonHtml = courierName
    ? `<b>${escapeAttr(courierName)}</b>${courierPhone ? `<div class="muted mt8" style="font-size:12px;">${t("auth.phone")}: ${escapeAttr(courierPhone)}</div>` : ""}`
    : `<span class="muted">${t("track.not_assigned")}</span>`;
  // Customer's existing complaints against this order — surface them so the
  // customer can see what they've already filed and not lose track.
  const u = state.user;
  const myComplaints = u
    ? await Complaints.list({ orderId, fromId: u.id })
    : [];

  openModal(`${t("track.order_label")} ${o.id.slice(-6).toUpperCase()}`, `
    <div class="row">
      <div>
        <div style="font-weight:900;">${t("track.order_label")} ${o.id.slice(-6).toUpperCase()}</div>
        <div class="muted">${t("track.placed", { date: dateShort(o.createdAt) })}</div>
      </div>
      <div>${statusBadge(o.status)}</div>
    </div>
    <div class="complaint-item mt12">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
        <div>
          <div class="muted" style="font-size:12px;font-weight:800;">${t("track.shop")}</div>
          <div style="font-weight:900;">${escapeAttr(shopName(shop) || "—")}</div>
          <div class="muted mt8" style="font-size:12px;">${subCityLabel(shop?.subCity || "") || "—"}</div>
        </div>
        <div>
          <div class="muted" style="font-size:12px;font-weight:800;">${t("track.delivery_area")}</div>
          <div style="font-weight:900;">${subCityLabel(o.customerSubCity) || "—"}</div>
          <div class="muted mt8" style="font-size:12px;">${t("track.your_address")}</div>
        </div>
        <div>
          <div class="muted" style="font-size:12px;font-weight:800;">${t("track.delivery_person")}</div>
          <div>${deliveryPersonHtml}</div>
        </div>
        <div>
          <div class="muted" style="font-size:12px;font-weight:800;">${t("track.payment_status")}</div>
          <div>${paymentStatusHtml}</div>
          <div class="muted mt8" style="font-size:12px;">${t("track.payment")}: <b>${o.paymentType === "prepay" ? t("track.pay_now_label") : t("track.pay_cod_label")}</b></div>
        </div>
      </div>
    </div>
    <hr/>
    <div style="font-weight:900;">${t("items_count", { n: o.items.length })}</div>
    ${o.items.map(i => `
      <div class="row mt8"><div class="muted"><b>${i.name}</b> × ${i.qty}</div><div style="font-weight:900;">${etb(i.lineTotal)}</div></div>
    `).join("")}
    <hr/>
    <div class="row"><div style="font-weight:900;">${t("total")}</div><div style="font-weight:900;color:var(--primary);">${etb(o.total)}</div></div>
    <div class="muted mt8">${t("track.payment")}: <b>${o.paymentType === "prepay" ? t("track.pay_now_label") : t("track.pay_cod_label")}</b></div>
    ${(o.paymentProofs || []).length ? `
      <hr/>
      <div style="font-weight:900;">${t("track.payment_history")}</div>
      <div class="muted" style="font-size:12px;">${t("track.payment_history_note")}</div>
      <div style="display:grid;gap:8px;margin-top:8px;">
        ${o.paymentProofs.map(p => `
          <div class="complaint-item">
            <div class="row" style="align-items:flex-start;gap:10px;">
              <img src="${p.image}" alt="" class="proof-thumb" />
              <div style="flex:1;min-width:0;font-size:12px;">
                <div><b>${t("own.proof_ref")}:</b> <span class="mono">${escapeAttr(p.reference)}</span></div>
                ${p.accountSnapshot ? `<div class="muted mt8">${escapeAttr(p.accountSnapshot.bankName)} · ${escapeAttr(p.accountSnapshot.accountNumber)}</div>` : ""}
                <div class="muted mt8">${dateShort(p.uploadedAt)} · ${paymentProofBadge(p.status)}</div>
                ${p.decisionNote ? `<div class="muted mt8">"${escapeAttr(p.decisionNote)}"</div>` : ""}
              </div>
            </div>
          </div>
        `).join("")}
      </div>
      ${o.paymentStatus === "rejected" ? `
        <div class="btnrow mt8"><button class="primary" data-reupload="${o.id}">${t("track.reupload_proof")}</button></div>
      ` : ""}
    ` : ""}
    ${delivery ? `
      <hr/>
      <div style="font-weight:900;">${t("track.delivery")}</div>
      <div class="muted mt8">${statusBadge(delivery.status)} · ${t("track.eta")} ${delivery.eta || "—"}</div>
      <div class="btnrow mt8" style="margin-bottom:0;">
        <a class="viewbtn map-action-link" href="${googleRoute}" target="_blank" rel="noopener">${t("track.open_google_maps")}</a>
      </div>
      <div class="muted mt8" style="font-size:12px;">${t("track.google_maps_note")}</div>
      ${delivery.status !== "delivered" ? `
        <div class="mt12" style="padding:12px;background:var(--primary-tint);border:1px solid var(--primary-ring);border-radius:14px;text-align:center;">
          <div class="muted" style="font-size:12px;">${t("track.share_otp")}</div>
          <div style="font-size:28px;font-weight:900;letter-spacing:.4em;color:var(--primary);">${delivery.otp}</div>
        </div>
      ` : `<div class="muted mt8">${t("track.confirmed_at", { date: dateShort(delivery.confirmedAt) })}</div>`}
    ` : ""}
    ${myComplaints.length ? `
      <hr/>
      <div style="font-weight:900;">${t("track.my_complaints", { n: myComplaints.length })}</div>
      <div style="display:grid;gap:10px;margin-top:10px;">
        ${myComplaints.map(c => `
          <div class="complaint-item">
            <div class="row" style="align-items:flex-start;">
              <div style="flex:1;min-width:0;">
                <div style="font-weight:900;">${c.type}</div>
                <div class="muted" style="font-size:12px;">${dateShort(c.createdAt)} · ${statusBadge(c.status)}${c.wantsRefund ? ` · <span style="color:var(--accent);font-weight:800;">💰 ${t("cmp.refund_requested")}</span>` : ""}</div>
                <div class="muted mt8" style="font-size:13px;">${escapeAttr(c.detail || "")}</div>
                ${c.image ? `<img src="${c.image}" alt="" class="complaint-photo" />` : ""}
                ${c.decisionNote ? `<div class="muted mt8" style="font-size:12px;">"${escapeAttr(c.decisionNote)}"</div>` : ""}
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    ` : ""}
    ${isDone ? `
      <hr/>
      <div style="font-weight:900;">${t("track.rate_title")}</div>
      <div class="muted mt8" style="font-size:12px;">${t("track.rate_subtitle")}</div>
      <div class="btnrow mt8" style="flex-wrap:wrap;">
        <button class="addbtn" data-rate-shop="${o.shopId}">${t("track.rate_shop")}</button>
        ${delivery && delivery.courierId ? `<button class="addbtn" data-rate-courier="${delivery.courierId}">${t("track.rate_delivery")}</button>` : ""}
      </div>
    ` : ""}
    ${canComplainNow(o) ? `
      <hr/>
      <div class="btnrow"><button class="ghost" data-complain-inline="${o.id}">${myComplaints.length ? t("track.complain_again") : t("track.complain")}</button></div>
    ` : ""}
  `);

  document.querySelector("#modalBody [data-rate-shop]")
    ?.addEventListener("click", (e) => openRateShop(e.currentTarget.dataset.rateShop));
  document.querySelector("#modalBody [data-rate-courier]")
    ?.addEventListener("click", (e) => openRateDelivery(e.currentTarget.dataset.rateCourier));
  document.querySelector("#modalBody [data-complain-inline]")
    ?.addEventListener("click", (e) => {
      closeModal();
      openComplaintForm(e.currentTarget.dataset.complainInline);
    });
  document.querySelector("#modalBody [data-reupload]")
    ?.addEventListener("click", (e) => {
      closeModal();
      openReuploadProof(e.currentTarget.dataset.reupload);
    });
  document.querySelectorAll("#modalBody .proof-thumb").forEach(img =>
    img.addEventListener("click", () => openImageZoomCust(img.src)));
}

function openImageZoomCust(src) {
  openModal("", `<img src="${src}" alt="" style="display:block;width:100%;max-width:600px;border-radius:14px;" />`);
}

function paymentProofBadge(s) {
  const tone = s === "verified" ? "ok" : s === "rejected" ? "danger" : "warn";
  return `<span class="badge-status ${tone}">${t(`payment_status.${s}`, s)}</span>`;
}

// Re-upload after a rejected proof — reuses the multi-step pay flow but for
// a single shop.
async function openReuploadProof(orderId) {
  const order = await Orders.byId(orderId);
  if (!order) return;
  const shop = await Shops.byId(order.shopId);
  const accounts = shop?.paymentAccounts || [];
  if (accounts.length === 0) { toast(t("checkout.no_accounts", { shop: shopName(shop) }), "danger"); return; }
  let pickedAccountId = accounts[0].id;
  let proofImage = null;
  openModal(t("track.reupload_proof"), `
    <div class="muted">${t("track.reupload_subtitle", { shop: shopName(shop) })}</div>
    <div class="fieldlabel mt12">${t("checkout.pick_account")}</div>
    <div style="display:grid;gap:8px;">
      ${accounts.map((a, i) => `
        <label class="pay-account-card" data-acc="${a.id}">
          <input type="radio" name="payacc" value="${a.id}" ${i === 0 ? "checked" : ""} />
          <div>
            <div style="font-weight:900;">${escapeAttr(a.bankName)}</div>
            <div class="muted" style="font-size:12px;">${escapeAttr(a.accountName)}</div>
            <div class="muted" style="font-size:12px;display:flex;gap:6px;align-items:center;">
              <span class="mono">${escapeAttr(a.accountNumber)}</span>
              <button type="button" class="ghost copy-btn" data-copy="${escapeAttr(a.accountNumber)}" style="font-size:11px;padding:2px 8px;">${t("checkout.copy")}</button>
            </div>
          </div>
        </label>
      `).join("")}
    </div>
    <hr/>
    <div class="fieldlabel">${t("checkout.proof_label")} *</div>
    <div class="avatar-picker">
      <div class="avatar-preview" id="reProofPreview" style="border-radius:14px;">
        <span class="muted" style="font-size:11px;text-align:center;padding:6px;">${t("checkout.proof_hint")}</span>
      </div>
      <div class="avatar-picker-side">
        <input type="file" id="reProofUpload" accept="image/*" capture="environment" hidden />
        <div class="btnrow" style="margin:0;flex-wrap:wrap;">
          <button type="button" class="viewbtn" id="reProofBtn">📷 ${t("checkout.upload_screenshot")}</button>
        </div>
      </div>
    </div>
    ${formField({ label: t("checkout.reference_label"), name: "reference", required: true, placeholder: t("checkout.reference_ph") })}
    <div class="btnrow mt12">
      <button class="primary" id="reSubmit">${t("submit")}</button>
      <button class="ghost" id="reCancel">${t("cancel")}</button>
    </div>
  `);
  document.querySelectorAll('input[name="payacc"]').forEach(r => r.addEventListener("change", (e) => { pickedAccountId = e.target.value; }));
  document.querySelectorAll(".copy-btn").forEach(b => b.addEventListener("click", async (e) => {
    e.preventDefault();
    try { await navigator.clipboard.writeText(b.dataset.copy); toast(t("checkout.copied"), "success"); } catch {}
  }));
  const proofInput = document.getElementById("reProofUpload");
  document.getElementById("reProofBtn").onclick = () => proofInput.click();
  proofInput.addEventListener("change", async () => {
    const f = proofInput.files?.[0];
    if (!f) return;
    try {
      proofImage = await imageFileToDataUrl(f, { maxSize: 600, quality: 0.85 });
      document.getElementById("reProofPreview").innerHTML = `<img src="${proofImage}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:14px;" />`;
    } catch (e) { toast(e.message, "danger"); }
    proofInput.value = "";
  });
  document.getElementById("reCancel").onclick = () => closeModal();
  document.getElementById("reSubmit").onclick = async () => {
    const reference = document.querySelector("#modalBody [name=reference]").value.trim();
    if (!proofImage) { toast(t("checkout.proof_required"), "danger"); return; }
    if (!reference) { toast(t("checkout.reference_required"), "danger"); return; }
    try {
      await Orders.uploadPaymentProof(orderId, { accountId: pickedAccountId, image: proofImage, reference });
      toast(t("track.proof_uploaded"), "success");
      closeModal();
      renderTracking();
    } catch (e) { toast(e.message, "danger"); }
  };
}

function escapeAttr(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function openRateShop(shopId) {
  openModal(t("shops.review_title"), `
    ${formField({ label: t("shops.review_stars"), name: "stars", type: "number", value: "5" })}
    ${formField({ label: t("shops.review_text"), name: "text", type: "textarea", placeholder: t("shops.review_text_ph") })}
    <div class="btnrow"><button class="primary" id="rsSubmit">${t("submit")}</button><button class="ghost" id="rsCancel">${t("cancel")}</button></div>
  `);
  document.getElementById("rsCancel").onclick = () => closeModal();
  document.getElementById("rsSubmit").onclick = async () => {
    const stars = Number(document.querySelector("#modalBody [name=stars]").value || 5);
    const text = document.querySelector("#modalBody [name=text]").value.trim();
    try {
      await Shops.addReview(shopId, { text, stars });
      toast(t("shops.review_posted"), "success");
      closeModal();
    } catch (e) { toast(e.message, "danger"); }
  };
}

function openRateDelivery(courierId) {
  openModal(t("track.rate_delivery_title"), `
    ${formField({ label: t("shops.review_stars"), name: "stars", type: "number", value: "5" })}
    ${formField({ label: t("shops.review_text"), name: "text", type: "textarea", placeholder: t("track.rate_delivery_ph") })}
    <div class="btnrow"><button class="primary" id="rdSubmit">${t("submit")}</button><button class="ghost" id="rdCancel">${t("cancel")}</button></div>
  `);
  document.getElementById("rdCancel").onclick = () => closeModal();
  document.getElementById("rdSubmit").onclick = async () => {
    const stars = Number(document.querySelector("#modalBody [name=stars]").value || 5);
    const text = document.querySelector("#modalBody [name=text]").value.trim();
    try {
      await Users.rateDelivery({ userId: courierId, stars, text });
      toast(t("track.rate_delivery_done"), "success");
      closeModal();
    } catch (e) { toast(e.message, "danger"); }
  };
}

async function openComplaintForm(orderId) {
  let cmpImage = null;
  // Pre-load the order so we can compute the 6-hour wait window for the
  // "Never arrived" option.
  const order = await Orders.byId(orderId);
  const NEVER_ARRIVED_WAIT_HOURS = 6;
  const orderCreatedMs = order ? new Date(order.createdAt).getTime() : 0;
  const unlockAtMs = orderCreatedMs + NEVER_ARRIVED_WAIT_HOURS * 3600 * 1000;
  // Hide "Never arrived" entirely once the order is marked delivered or
  // completed — the customer received it (or had the OTP), so the type
  // doesn't apply anymore.
  const naApplies = order && order.status !== "delivered" && order.status !== "completed";
  const initialNaReady = naApplies && Date.now() >= unlockAtMs;

  openModal(t("cmp.modal_title"), `
    <div class="fieldlabel">${t("cmp.type")}</div>
    <select name="type" id="cmpTypeSel">
      <option value="Missing item">${t("cmp.type.missing")}</option>
      <option value="Late delivery">${t("cmp.type.late")}</option>
      ${naApplies ? `<option value="Never arrived"${initialNaReady ? "" : " disabled"}>${initialNaReady ? t("cmp.type.never_arrived") : t("cmp.type.never_arrived_locked", { time: "…" })}</option>` : ""}
      <option value="Wrong item">${t("cmp.type.wrong")}</option>
      <option value="Quality">${t("cmp.type.quality")}</option>
      <option value="Other">${t("cmp.type.other")}</option>
    </select>
    ${naApplies && !initialNaReady ? `<div id="cmpNaCountdown" class="muted mt8" style="font-size:12px;font-weight:700;color:var(--accent);"></div>` : ""}

    ${formField({ label: t("cmp.detail"), name: "detail", type: "textarea", placeholder: t("cmp.detail_ph"), required: true })}

    <div id="cmpPhotoWrap">
      <div class="fieldlabel"><span id="cmpPhotoLabel">${t("cmp.photo_label")}</span></div>
      <div class="avatar-picker">
        <div class="avatar-preview" id="cmpPhotoPreview" style="border-radius:14px;">
          <span class="muted" style="font-size:11px;text-align:center;padding:6px;" id="cmpPhotoHint">${t("cmp.photo_hint")}</span>
        </div>
        <div class="avatar-picker-side">
          <input type="file" id="cmpPhotoUpload" accept="image/*" capture="environment" hidden />
          <div class="btnrow" style="margin:0;flex-wrap:wrap;">
            <button type="button" class="viewbtn" id="cmpPhotoBtn">📷 ${t("cmp.take_photo")}</button>
            <button type="button" class="ghost" id="cmpPhotoClear" hidden>${t("acc.clear_avatar")}</button>
          </div>
        </div>
      </div>
    </div>

    <div class="btnrow mt12"><button class="primary" id="cmpSubmit">${t("cmp.submit")}</button><button class="ghost" id="cmpCancel">${t("cancel")}</button></div>
  `);

  const typeSel = document.getElementById("cmpTypeSel");

  // Live countdown for the "Never arrived" option. Updates the option label
  // every 30 seconds; when the wait window elapses, the option flips enabled
  // and the prominent countdown line disappears. Self-cancels when the
  // modal closes (the option element disappears from the DOM).
  if (naApplies && !initialNaReady) {
    let countdownTimer = null;
    const fmt = (secLeft) => {
      const h = Math.floor(secLeft / 3600);
      const m = Math.floor((secLeft % 3600) / 60);
      const s = secLeft % 60;
      if (h > 0) return `${h}h ${m}m`;
      if (m > 0) return `${m}m ${s}s`;
      return `${s}s`;
    };
    const tick = () => {
      const naOption = typeSel.querySelector('option[value="Never arrived"]');
      if (!naOption) { clearInterval(countdownTimer); return; }
      const secLeft = Math.max(0, Math.ceil((unlockAtMs - Date.now()) / 1000));
      const countdownEl = document.getElementById("cmpNaCountdown");
      if (secLeft <= 0) {
        naOption.disabled = false;
        naOption.textContent = t("cmp.type.never_arrived");
        if (countdownEl) countdownEl.hidden = true;
        clearInterval(countdownTimer);
        return;
      }
      const formatted = fmt(secLeft);
      naOption.textContent = t("cmp.type.never_arrived_locked", { time: formatted });
      if (countdownEl) countdownEl.textContent = t("cmp.never_arrived_countdown", { time: formatted });
    };
    tick();
    countdownTimer = setInterval(tick, 30 * 1000);
  }
  const photoWrap = document.getElementById("cmpPhotoWrap");
  const photoLabel = document.getElementById("cmpPhotoLabel");
  const photoHint = document.getElementById("cmpPhotoHint");
  const previewEl = document.getElementById("cmpPhotoPreview");
  const uploadEl = document.getElementById("cmpPhotoUpload");
  const clearBtn = document.getElementById("cmpPhotoClear");

  const syncForType = () => {
    const type = typeSel.value;
    // Late delivery and Never arrived have nothing concrete to photograph.
    const noPhoto = type === "Late delivery" || type === "Never arrived";
    photoWrap.hidden = noPhoto;
    if (noPhoto) { cmpImage = null; }
    // Wrong item and Quality need a photo as evidence; the rest don't.
    const required = type === "Wrong item" || type === "Quality";
    photoLabel.textContent = required ? `${t("cmp.photo_label")} *` : `${t("cmp.photo_label")} (${t("optional")})`;
    const hintKey = {
      "Missing item":  "cmp.photo_hint.missing",
      "Wrong item":    "cmp.photo_hint.wrong",
      "Quality":       "cmp.photo_hint.quality",
      "Other":         "cmp.photo_hint.other",
    }[type] || "cmp.photo_hint_optional";
    photoHint.textContent = t(hintKey);
  };
  typeSel.addEventListener("change", syncForType);
  syncForType();

  document.getElementById("cmpPhotoBtn").onclick = () => uploadEl.click();
  uploadEl.addEventListener("change", async () => {
    const f = uploadEl.files?.[0];
    if (!f) return;
    try {
      cmpImage = await imageFileToDataUrl(f, { maxSize: 480, quality: 0.8 });
      previewEl.innerHTML = `<img src="${cmpImage}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:14px;" />`;
      clearBtn.hidden = false;
    } catch (e) { toast(e.message, "danger"); }
    uploadEl.value = "";
  });
  clearBtn.onclick = () => {
    cmpImage = null;
    previewEl.innerHTML = `<span class="muted" style="font-size:11px;text-align:center;padding:6px;">${photoHint.textContent}</span>`;
    clearBtn.hidden = true;
  };

  document.getElementById("cmpCancel").onclick = () => closeModal();
  document.getElementById("cmpSubmit").onclick = async () => {
    const type = typeSel.value;
    const detail = document.querySelector("#modalBody [name=detail]").value.trim();
    if (!detail) { toast(t("cmp.describe"), "danger"); return; }
    if ((type === "Wrong item" || type === "Quality") && !cmpImage) { toast(t("cmp.photo_required"), "danger"); return; }
    try {
      const noPhotoType = type === "Late delivery" || type === "Never arrived";
      const created = await Complaints.create({
        orderId, type, detail,
        image: noPhotoType ? null : cmpImage,
      });
      toast(t("cmp.sent"), "success");
      closeModal();
      // Follow-up: ask if the customer wants a refund. Independent of the
      // complaint type — they might want one even for a "late delivery".
      openRefundPrompt(created.id);
    } catch (e) { toast(e.message, "danger"); }
  };
}

function openRefundPrompt(complaintId) {
  openModal(t("cmp.refund_prompt_title"), `
    <div class="muted">${t("cmp.refund_prompt_body")}</div>
    <div class="muted mt8" style="font-size:12px;">${t("cmp.refund_prompt_note")}</div>
    <div class="btnrow mt12">
      <button class="primary" id="rfYes">${t("cmp.refund_prompt_yes")}</button>
      <button class="ghost" id="rfNo">${t("cmp.refund_prompt_no")}</button>
    </div>
  `);
  document.getElementById("rfNo").onclick = () => { closeModal(); renderTracking(); };
  document.getElementById("rfYes").onclick = async () => {
    try {
      await Complaints.requestRefund(complaintId);
      toast(t("cmp.refund_sent"), "success");
      closeModal();
      renderTracking();
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
      <div class="row" style="align-items:flex-start;gap:14px;">
        <div class="account-avatar">${userAvatarHtml(u, 72)}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:900;font-size:16px;">${u.name}</div>
          <div class="muted">${t("acc.role")}: <b>${t(`role.${u.role}`)}</b> · ${t("acc.subcity")}: <b>${subCityLabel(u.subCity) || "—"}</b></div>
          <div class="muted">${t("acc.email")}: ${u.email || "—"} · ${t("acc.phone")}: ${u.phone || "—"}</div>
        </div>
        <button class="viewbtn" id="editProfileBtn">${t("acc.edit_profile")}</button>
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

      ${isDev() ? `
      <hr/>
      <div class="muted">${t("acc.demo")} · <span style="color:var(--accent);font-weight:800;">DEV</span></div>
      <div class="btnrow">
        <button class="ghost" id="resetBtn">${t("acc.reset")}</button>
      </div>
      <div class="muted mt8" style="font-size:12px;">${t("acc.reset_note")}</div>
      ` : ""}

      <hr/>
      <div style="font-weight:900;color:var(--danger,#b91c1c);">${t("acc.delete_title")}</div>
      <div class="muted mt8" style="font-size:12px;">${t("acc.delete_subtitle")}</div>
      <div class="btnrow"><button class="danger" id="deleteAcctBtn">${t("acc.delete_btn")}</button></div>
    </div>
  </div></section>`;

  document.getElementById("themePickBtn").addEventListener("click", () => openThemePicker());
  document.getElementById("editProfileBtn").addEventListener("click", () => openProfileEditor());

  document.getElementById("logoutBtn").addEventListener("click", () => {
    openModal(t("acc.signout_confirm_title"), `
      <div class="muted">${t("acc.signout_confirm_body")}</div>
      <div class="btnrow mt12">
        <button class="danger" id="signoutYes">${t("acc.signout_yes")}</button>
        <button class="ghost" id="signoutNo">${t("cancel")}</button>
      </div>
    `);
    document.getElementById("signoutNo").onclick = () => closeModal();
    document.getElementById("signoutYes").onclick = async () => {
      await Auth.logout();
      state.setUser(null);
      closeModal();
      toast(t("acc.signed_out"));
      location.hash = "#/auth";
    };
  });
  document.getElementById("resetBtn")?.addEventListener("click", async () => {
    if (!confirm(t("acc.reset_confirm"))) return;
    const { runSeed } = await import("../seed.js");
    await Auth.logout();
    state.setUser(null);
    await runSeed({ force: true });
    toast(t("acc.reset_done"), "success");
    location.hash = "#/auth";
  });

  document.getElementById("deleteAcctBtn").addEventListener("click", () => openDeleteAccount(u));
}

function openDeleteAccount(u) {
  openModal(t("acc.delete_modal_title"), `
    <div class="muted">${t("acc.delete_modal_body", { name: u.name })}</div>
    ${formField({ label: t("acc.delete_name_label"), name: "confirmName", placeholder: u.name, required: true })}
    ${formField({ label: t("auth.password"), name: "delPassword", type: "password", required: true })}
    <div class="btnrow mt12">
      <button class="danger" id="delConfirm">${t("acc.delete_confirm")}</button>
      <button class="ghost" id="delCancel">${t("cancel")}</button>
    </div>
  `);
  document.getElementById("delCancel").onclick = () => closeModal();
  document.getElementById("delConfirm").onclick = async () => {
    const confirmName = document.querySelector("#modalBody [name=confirmName]").value;
    const password = document.querySelector("#modalBody [name=delPassword]").value;
    try {
      await Auth.deleteAccount({ password, confirmName });
      state.setUser(null);
      closeModal();
      toast(t("acc.delete_done"), "success");
      location.hash = "#/auth";
    } catch (e) { toast(e.message, "danger"); }
  };
}

async function openProfileEditor() {
  const u = state.user;
  if (!u) return;
  const isStaff = u.role !== "customer";
  const subCityLocked = isStaff;
  let pending = null;
  if (subCityLocked && u.role !== "main") {
    try { pending = await LocationChanges.myPending(); } catch { pending = null; }
  }

  const subCityField = subCityLocked
    ? `
      <div class="fieldlabel">${t("auth.subcity")}</div>
      <div class="readonly-field">${subCityLabel(u.subCity) || "—"}</div>
      <div class="muted" style="font-size:12px;margin-top:4px;">${t("acc.subcity_locked")}</div>
      ${pending
        ? `<div class="comment unread mt8" style="background:var(--surface);">
            <div style="font-weight:900;font-size:13px;">${t("acc.location_pending_title")}</div>
            <div class="muted mt8" style="font-size:12px;">${t(`acc.location_status_${pending.status}`, { from: subCityLabel(pending.fromSubCity), to: subCityLabel(pending.toSubCity) })}</div>
          </div>`
        : (u.role === "main"
            ? ""
            : `<div class="btnrow mt8" style="margin:0;"><button class="viewbtn" id="reqLocBtn">${t("acc.request_location")}</button></div>`)
      }
    `
    : formField({ label: t("auth.subcity"), name: "subCity", type: "select", value: u.subCity || "Bole",
        options: SUB_CITIES.map(s => ({ value: s, label: subCityLabel(s) })) });

  openModal(t("acc.edit_modal"), `
    <div class="fieldlabel">${t("acc.avatar_title")}</div>
    <div class="avatar-picker">
      <div class="avatar-preview" id="profAvatarPreview">${userAvatarHtml(u, 80)}</div>
      <div class="avatar-picker-side">
        <div class="muted" style="font-size:12px;">${t("acc.avatar_hint")}</div>
        <input type="file" id="profAvatarUpload" accept="image/*" hidden />
        <div class="btnrow" style="margin:0;">
          <button type="button" class="viewbtn" id="profAvatarBtn">📷 ${t("acc.upload_avatar")}</button>
          <button type="button" class="ghost" id="profAvatarClear" ${u.avatar ? "" : "hidden"}>${t("acc.clear_avatar")}</button>
        </div>
      </div>
    </div>
    <hr/>
    ${formField({ label: t("auth.fullname"), name: "name", value: u.name || "", required: true })}
    ${formField({ label: t("auth.email"), name: "email", value: u.email || "" })}
    <div class="muted" style="font-size:12px;margin-top:6px;">${t("auth.email_accepted_hint", { list: ALLOWED_EMAIL_DOMAINS.join(", ") })}</div>
    <div id="profEmailStatus" class="field-status" style="font-size:12px;margin-top:4px;"></div>
    ${formField({ label: t("auth.phone"), name: "phone", value: u.phone || "" })}
    ${subCityField}
    ${isStaff ? `
      <hr/>
      <div class="muted" style="font-size:12px;">${t("acc.workid_readonly")}: <b>${u.workId || "—"}</b></div>
      ${formField({ label: t("auth.fayda"), name: "faydaFan", value: u.faydaFan || "", placeholder: t("auth.fayda_ph") })}
      <div class="muted" style="font-size:11px;margin-top:6px;">${t("acc.fayda_hint")}</div>
      <div id="faydaStatus" class="field-status" style="font-size:12px;margin-top:4px;"></div>
    ` : ""}
    <hr/>
    ${formField({ label: t("acc.current_password"), name: "currentPassword", type: "password" })}
    ${formField({ label: t("acc.new_password"), name: "newPassword", type: "password", placeholder: t("auth.password_ph") })}
    <div class="muted password-hint">${t("auth.password_hint")}</div>
    ${formField({ label: t("acc.confirm_new_password"), name: "newPasswordConfirm", type: "password" })}
    <div class="btnrow">
      <button class="primary" id="profSave">${t("save")}</button>
      <button class="ghost" id="profCancel">${t("cancel")}</button>
    </div>
  `);
  document.getElementById("profCancel").onclick = () => closeModal();

  // Avatar picker. avatarValue tracks the current selection — null = use the
  // SVG fallback. undefined = no change (skip updating the field).
  let avatarValue = u.avatar ?? null;
  let avatarChanged = false;
  const renderAvatarPreview = () => {
    const wrap = document.getElementById("profAvatarPreview");
    if (!wrap) return;
    wrap.innerHTML = userAvatarHtml({ ...u, avatar: avatarValue }, 80);
    document.getElementById("profAvatarClear").hidden = !avatarValue;
  };
  const avInput = document.getElementById("profAvatarUpload");
  document.getElementById("profAvatarBtn").onclick = () => avInput.click();
  avInput.addEventListener("change", async () => {
    const f = avInput.files?.[0];
    if (!f) return;
    try {
      avatarValue = await imageFileToDataUrl(f, { maxSize: 200 });
      avatarChanged = true;
      renderAvatarPreview();
    } catch (e) { toast(e.message, "danger"); }
    avInput.value = "";
  });
  document.getElementById("profAvatarClear").onclick = () => {
    avatarValue = null;
    avatarChanged = true;
    renderAvatarPreview();
  };

  document.getElementById("reqLocBtn")?.addEventListener("click", () => openLocationRequest(u));

  // Live email-suffix check.
  {
    const emailInput = document.querySelector("#modalBody [name=email]");
    const emailStatus = document.getElementById("profEmailStatus");
    let emailTimer = null;
    const checkEmail = () => {
      const value = (emailInput.value || "").trim();
      emailStatus.textContent = "";
      emailStatus.className = "field-status";
      if (!value) return;
      if (!isAcceptedEmail(value)) {
        emailStatus.textContent = `✗ ${t("auth.email_unsupported")}`;
        emailStatus.className = "field-status invalid";
      } else {
        emailStatus.textContent = `✓ ${t("auth.email_accepted")}`;
        emailStatus.className = "field-status available";
      }
    };
    emailInput?.addEventListener("input", () => {
      // Force lowercase as the user types so saved value matches Supabase.
      if (emailInput.value !== emailInput.value.toLowerCase()) {
        const pos = emailInput.selectionStart;
        emailInput.value = emailInput.value.toLowerCase();
        emailInput.setSelectionRange?.(pos, pos);
      }
      clearTimeout(emailTimer);
      emailTimer = setTimeout(checkEmail, 200);
    });
  }

  // Live availability check for Fayda FAN — staff only.
  if (isStaff) {
    const fanInput = document.querySelector("#modalBody [name=faydaFan]");
    const fanStatus = document.getElementById("faydaStatus");
    let fanTimer = null;
    const checkFan = async () => {
      const fanDigits = (fanInput.value || "").replace(/\s+/g, "");
      fanStatus.textContent = "";
      fanStatus.className = "field-status";
      if (!fanDigits || fanDigits === u.faydaFan) return;
      if (!/^\d{16}$/.test(fanDigits)) {
        fanStatus.textContent = `✗ ${t("auth.field_invalid_format")}`;
        fanStatus.className = "field-status invalid";
        return;
      }
      const result = await Users.checkUnique({ faydaFan: fanDigits, excludeUserId: u.id });
      if (result.faydaFanTaken) {
        fanStatus.textContent = `✗ ${t("auth.field_taken")}`;
        fanStatus.className = "field-status taken";
      } else {
        fanStatus.textContent = `✓ ${t("auth.field_available")}`;
        fanStatus.className = "field-status available";
      }
    };
    fanInput?.addEventListener("input", () => {
      clearTimeout(fanTimer);
      fanTimer = setTimeout(checkFan, 250);
    });
  }

  document.getElementById("profSave").onclick = async () => {
    const f = (n) => document.querySelector(`#modalBody [name=${n}]`)?.value ?? "";
    const newPw = f("newPassword");
    if (newPw && newPw !== f("newPasswordConfirm")) {
      toast(t("auth.password_mismatch"), "danger");
      return;
    }
    try {
      const updated = await Auth.updateProfile({
        name: f("name").trim(),
        email: f("email").trim(),
        phone: f("phone").trim(),
        subCity: subCityLocked ? undefined : f("subCity"),
        currentPassword: f("currentPassword"),
        newPassword: newPw,
        faydaFan: isStaff ? f("faydaFan").trim() : undefined,
        avatar: avatarChanged ? avatarValue : undefined,
      });
      state.setUser(updated);
      toast(t("acc.profile_saved"), "success");
      closeModal();
      renderAccount();
    } catch (e) { toast(e.message, "danger"); }
  };
}

function openLocationRequest(u) {
  const targets = SUB_CITIES.filter(s => s !== u.subCity);
  openModal(t("acc.request_location"), `
    <div class="muted">${t("acc.request_location_subtitle")}</div>
    <div class="muted mt8" style="font-size:12px;">${t("acc.request_location_current", { city: subCityLabel(u.subCity) })}</div>
    ${formField({ label: t("acc.request_location_target"), name: "toSubCity", type: "select",
      options: targets.map(s => ({ value: s, label: subCityLabel(s) })) })}
    ${formField({ label: t("acc.request_location_reason"), name: "reason", type: "textarea", placeholder: t("acc.request_location_reason_ph") })}
    <div class="btnrow mt12">
      <button class="primary" id="locReqSubmit">${t("acc.request_location_submit")}</button>
      <button class="ghost" id="locReqCancel">${t("cancel")}</button>
    </div>
  `);
  document.getElementById("locReqCancel").onclick = () => closeModal();
  document.getElementById("locReqSubmit").onclick = async () => {
    const toSubCity = document.querySelector("#modalBody [name=toSubCity]").value;
    const reason = document.querySelector("#modalBody [name=reason]").value.trim();
    try {
      await LocationChanges.create({ toSubCity, reason });
      toast(t("acc.request_location_sent"), "success");
      closeModal();
      openProfileEditor();
    } catch (e) { toast(e.message, "danger"); }
  };
}
