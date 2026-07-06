// js/router.js
// Hash-based router with role-aware fallbacks.

import { state } from "./state.js";
import { renderAuth, renderHome, renderShops, renderCart, renderCheckout, renderTracking, renderAccount, defaultRouteFor } from "./views/customer.js";
import { renderOwner } from "./views/owner.js";
import { renderDelivery } from "./views/delivery.js";
import { renderBranchCommittee, renderMainCommittee } from "./views/committee.js";

const ROUTES = {
  "#/auth":     { view: renderAuth, public: true },
  "#/home":     { view: renderHome, roles: ["customer"] },
  "#/shops":    { view: renderShops, roles: ["customer"] },
  "#/cart":     { view: renderCart, roles: ["customer"] },
  "#/checkout": { view: renderCheckout, roles: ["customer"] },
  "#/track":    { view: renderTracking, roles: ["customer"] },
  "#/account":  { view: renderAccount, roles: ["customer", "owner", "delivery", "branch", "main"] },
  "#/owner":    { view: renderOwner, roles: ["owner"] },
  "#/delivery": { view: renderDelivery, roles: ["delivery"] },
  "#/committee":{ view: renderBranchCommittee, roles: ["branch"] },
  "#/main-committee": { view: renderMainCommittee, roles: ["main"] },
};

export function start() {
  window.addEventListener("hashchange", route);
  route();
}

export function route() {
  const hash = location.hash || "";
  const r = ROUTES[hash];
  const u = state.user;

  // Authed user on a public-only screen → bounce to their role default.
  if (u && r && r.public) { location.hash = defaultRouteFor(u.role); return; }

  // Public route, not signed in: render directly.
  if (r && r.public) { r.view(); return; }

  // Needs auth.
  if (!u) {
    if (hash !== "#/auth") { location.hash = "#/auth"; return; }
    renderAuth();
    return;
  }

  // Authed but unknown route → role default.
  if (!r) { location.hash = defaultRouteFor(u.role); return; }

  // Role-restricted route the user can't access.
  if (r.roles && !r.roles.includes(u.role)) {
    location.hash = defaultRouteFor(u.role);
    return;
  }

  r.view();
}

export function go(path) {
  if (location.hash === path) route(); else location.hash = path;
}
