// js/main.js
// App bootstrap: seeds local DB, hydrates auth session, wires global UI
// (topbar, bottom nav), and starts the router.

import { DB } from "./db.js";
import { runSeed, runMigrations } from "./seed.js";
import { Auth } from "./auth.js";
import { state } from "./state.js";
import { start, go, route } from "./router.js";
import { defaultRouteFor } from "./views/customer.js";
import { cartCount } from "./views/customer.js";
import { ROLE_LABELS, t, getLang, setLang, applyTheme, openThemePicker } from "./views/shared.js";

(async function bootstrap() {
  // Theme must be applied before anything paints to avoid a flash.
  applyTheme();

  DB.ensure();
  await runSeed();
  await runMigrations();

  // Restore session if a token exists.
  const u = Auth.currentUser();
  if (u) state.setUser(u);

  wireTopbar();
  wireBottomNav();
  applyLang();
  applyThemeButton();

  // Re-render topbar/bottom nav whenever the user or cart changes.
  state.on("user", () => { wireTopbar(); wireBottomNav(); });
  state.on("cart", wireBottomNav);

  // Delegated [data-link="route"] navigation.
  document.body.addEventListener("click", (e) => {
    const a = e.target.closest("[data-link]");
    if (!a) return;
    const target = a.dataset.link;
    if (!target) return;
    e.preventDefault();
    if (target === "home") {
      const role = state.user?.role;
      go(defaultRouteFor(role));
    } else if (target.startsWith("#/")) {
      go(target);
    } else {
      go(`#/${target}`);
    }
  });

  start();
})();

function wireTopbar() {
  const u = state.user;
  const pill = document.getElementById("userPill");
  const authBtn = document.getElementById("authBtn");
  if (u) {
    pill.hidden = false;
    pill.querySelector(".userName").textContent = u.name;
    pill.querySelector(".userRole").textContent = ROLE_LABELS[u.role] || u.role;
    authBtn.textContent = t("acc.account_btn");
    authBtn.onclick = () => go("#/account");
  } else {
    pill.hidden = true;
    authBtn.textContent = t("signin");
    authBtn.onclick = () => go("#/auth");
  }

  const tagline = document.getElementById("tagline");
  if (tagline) tagline.textContent = t("tagline");
}

function wireBottomNav() {
  const nav = document.getElementById("bottomnav");
  const inner = document.getElementById("bottomnavInner");
  const u = state.user;
  if (!u) { nav.hidden = true; return; }
  nav.hidden = false;

  const items = navConfigFor(u.role);
  inner.innerHTML = items.map(i => {
    const active = location.hash === i.path ? "active" : "";
    const badge = i.badge ? `<span class="badge">${i.badge}</span>` : "";
    return `<div class="navitem ${active}" data-link="${i.path}">${i.icon}<span>${i.label}</span>${badge}</div>`;
  }).join("");
}

function navConfigFor(role) {
  const items = {
    customer: [
      { path: "#/home",  icon: "🏠", label: t("browse") },
      { path: "#/cart",  icon: "🛒", label: t("cart"), badge: cartCount() || null },
      { path: "#/track", icon: "📦", label: t("track") },
      { path: "#/account", icon: "👤", label: t("account") },
    ],
    owner: [
      { path: "#/owner",   icon: "🏪", label: t("orders") },
      { path: "#/account", icon: "👤", label: t("account") },
    ],
    delivery: [
      { path: "#/delivery", icon: "🛵", label: t("deliveries") },
      { path: "#/account",  icon: "👤", label: t("account") },
    ],
    branch: [
      { path: "#/committee", icon: "🧾", label: t("cases") },
      { path: "#/account",   icon: "👤", label: t("account") },
    ],
    main: [
      { path: "#/main-committee", icon: "📊", label: t("ranges") },
      { path: "#/account",        icon: "👤", label: t("account") },
    ],
  };
  return items[role] || [];
}

// Re-highlight active nav item on hash changes.
window.addEventListener("hashchange", wireBottomNav);

function applyLang() {
  const btn = document.getElementById("langToggle");
  const label = document.getElementById("langLabel");
  if (!btn) return;
  const setLabel = () => { label.textContent = getLang() === "en" ? "EN" : "አ"; };
  setLabel();
  btn.onclick = () => {
    setLang(getLang() === "en" ? "am" : "en");
    setLabel();
    wireTopbar();
    wireBottomNav();
    // Re-render the current view so all translated strings update at once.
    route();
  };
}

function applyThemeButton() {
  const btn = document.getElementById("themeToggle");
  if (!btn) return;
  btn.onclick = () => openThemePicker();
}
