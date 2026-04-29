// js/views/shared.js
// Shared rendering helpers: toast, modal, icons, money/date formatters,
// minimal i18n, status-badge mapper, and small reusable components.

let _toastTimer = null;
export function toast(msg, kind = "") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.className = "toast show" + (kind ? ` ${kind}` : "");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.className = "toast"; }, 1700);
}

export function openModal(title, htmlOrNode) {
  const overlay = document.getElementById("overlay");
  const t = document.getElementById("modalTitle");
  const b = document.getElementById("modalBody");
  t.textContent = title;
  if (typeof htmlOrNode === "string") b.innerHTML = htmlOrNode;
  else { b.innerHTML = ""; b.appendChild(htmlOrNode); }
  overlay.hidden = false;
}

export function closeModal() {
  const overlay = document.getElementById("overlay");
  overlay.hidden = true;
}

document.addEventListener("click", (e) => {
  if (e.target.id === "modalClose" || e.target.closest("#modalClose")) closeModal();
  if (e.target.id === "overlay") closeModal();
});

// Money formatter (ETB).
export function etb(n) {
  const v = Number(n || 0);
  return `${v.toFixed(2)} ETB`;
}

export function dateShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export function timeShort(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export const ROLE_LABELS = {
  customer: "Customer",
  owner: "Shop Owner",
  delivery: "Delivery",
  branch: "Branch Committee",
  main: "Main Committee",
};

export function statusBadge(status) {
  const map = {
    created: ["muted", "Created"],
    paid: ["ok", "Paid"],
    accepted: ["ok", "Accepted"],
    preparing: ["warn", "Preparing"],
    dispatched: ["warn", "Dispatched"],
    delivered: ["ok", "Delivered"],
    completed: ["ok", "Completed"],
    cancelled: ["danger", "Cancelled"],
    refunded: ["danger", "Refunded"],
    open: ["warn", "Open"],
    escalated: ["danger", "Escalated"],
    resolved: ["ok", "Resolved"],
    rejected: ["danger", "Rejected"],
    pending: ["warn", "Pending"],
    approved: ["ok", "Approved"],
    suspended: ["danger", "Suspended"],
    assigned: ["warn", "Assigned"],
    picked_up: ["warn", "Picked up"],
    en_route: ["warn", "En route"],
  };
  const [tone, label] = map[status] || ["muted", status || "—"];
  return `<span class="badge-status ${tone}">${label}</span>`;
}

// Simple ES/AM dictionary (extend as needed).
const STR = {
  en: {
    "tagline": "Bilingual Market Price Management",
    "signin": "Sign in",
    "signout": "Sign out",
    "browse": "Browse",
    "cart": "Cart",
    "track": "Track",
    "account": "Account",
    "shops": "Shops",
    "orders": "Orders",
    "inventory": "Inventory",
    "deliveries": "Deliveries",
    "cases": "Cases",
    "ranges": "Price ranges",
    "audit": "Audit",
  },
  am: {
    "tagline": "የገበያ ዋጋ አስተዳደር",
    "signin": "ግባ",
    "signout": "ውጣ",
    "browse": "ይመልከቱ",
    "cart": "ጋሪ",
    "track": "ይከታተሉ",
    "account": "መለያ",
    "shops": "መሸጫዎች",
    "orders": "ትዕዛዞች",
    "inventory": "ክምችት",
    "deliveries": "አመጣጥ",
    "cases": "ጉዳዮች",
    "ranges": "የዋጋ ክልሎች",
    "audit": "ማረጋገጫ",
  },
};

export function getLang() { return localStorage.getItem("gulit:v1:lang") || "en"; }
export function setLang(l) { localStorage.setItem("gulit:v1:lang", l); }
export function t(key) {
  const lang = getLang();
  return (STR[lang] && STR[lang][key]) || (STR.en[key] || key);
}

// Inline product-icon SVGs (offline-safe, match the prototype's look).
export function iconSvg(kind) {
  const svgs = {
    onion: `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M32 8c3 7 10 11 10 18 0 13-6 26-10 26s-10-13-10-26c0-7 7-11 10-18Z" fill="#a855f7" opacity=".85"/>
      <path d="M32 12c1.8 5 6 8 6 13 0 9-3.5 20-6 20s-6-11-6-20c0-5 4.2-8 6-13Z" fill="#c084fc" opacity=".9"/>
      <path d="M32 6c2 3 2 6 0 9" stroke="#16a34a" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    tomato: `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="36" r="18" fill="#ef4444"/>
      <path d="M32 14c-4 4-8 4-12 2 3 8 9 10 12 10s9-2 12-10c-4 2-8 2-12-2Z" fill="#16a34a"/>
      <path d="M32 14c0-4 2-6 6-8" stroke="#16a34a" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    potato: `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M24 18c8-6 22-2 26 8 5 13-5 28-20 26-16-2-18-24-6-34Z" fill="#a16207" opacity=".9"/>
      <circle cx="30" cy="30" r="2" fill="#78350f"/>
      <circle cx="40" cy="36" r="2" fill="#78350f"/>
      <circle cx="36" cy="44" r="2" fill="#78350f"/>
    </svg>`,
    carrot: `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M30 20c8 8 12 18 10 30-10 2-22-2-30-10 2-8 10-16 20-20Z" fill="#f97316"/>
      <path d="M38 16c4-4 8-4 12-2-2 6-6 10-12 12" fill="#16a34a"/>
    </svg>`,
    pepper: `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M22 26c-2 20 10 28 20 26 12-2 14-20 8-28-6-8-24-8-28 2Z" fill="#22c55e"/>
      <path d="M34 14c0-4 2-6 6-8" stroke="#16a34a" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    cabbage: `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="32" cy="36" r="18" fill="#86efac"/>
      <path d="M20 38c6-10 18-12 24-4" stroke="#16a34a" stroke-width="3" stroke-linecap="round"/>
      <path d="M24 46c6-6 16-6 20 0" stroke="#16a34a" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    egg: `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M32 14c10 0 16 14 16 24S42 54 32 54 16 48 16 38s6-24 16-24Z" fill="#fde68a"/>
      <path d="M28 24c-4 6-4 16 0 22" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" opacity=".8"/>
    </svg>`,
    grain: `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M32 14c10 8 12 24 0 36-12-12-10-28 0-36Z" fill="#fbbf24"/>
      <path d="M32 14v36" stroke="#a16207" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    banana: `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M16 40c10 12 24 14 34 6-8 6-22 2-30-10-2-3-3-6-4-10-2 6-2 10 0 14Z" fill="#fde047"/>
      <path d="M48 46c2-2 4-4 4-8" stroke="#a16207" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    spice: `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M22 18h20v10H22V18Z" fill="#ef4444" opacity=".9"/>
      <path d="M22 28h20v18c0 4-4 8-10 8s-10-4-10-8V28Z" fill="#f97316"/>
      <path d="M26 34h12" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".9"/>
    </svg>`,
  };
  return svgs[kind] || svgs.grain;
}

export function avatarSvg(seed = 0) {
  const skins = ["#7c4a2d","#8b5a3c","#6b3f27","#9a6a4a"];
  const shirts = ["#16a34a","#0ea5e9","#f97316","#a855f7"];
  const hair = ["#1f2937","#111827","#0f172a","#3f3f46"];
  const s = skins[seed % skins.length];
  const sh = shirts[seed % shirts.length];
  const h = hair[seed % hair.length];
  return `<svg viewBox="0 0 64 64" fill="none" aria-hidden="true" width="56" height="56">
    <rect x="0" y="0" width="64" height="64" rx="18" fill="rgba(46,125,50,.10)"/>
    <path d="M14 58c3-14 13-18 18-18s15 4 18 18" fill="${sh}" opacity=".95"/>
    <circle cx="32" cy="28" r="12" fill="${s}" />
    <path d="M20 24c2-10 22-10 24 0 0-10-6-16-12-16s-12 6-12 16Z" fill="${h}"/>
    <circle cx="27" cy="28" r="1.5" fill="#0f172a" opacity=".8"/>
    <circle cx="37" cy="28" r="1.5" fill="#0f172a" opacity=".8"/>
    <path d="M28 33c2 2 6 2 8 0" stroke="#0f172a" stroke-width="2" stroke-linecap="round" opacity=".55"/>
  </svg>`;
}

// Star renderer for ratings.
export function stars(n) {
  const full = Math.floor(n);
  const half = (n - full) >= 0.5 ? "½" : "";
  return `<span class="stars">${"★".repeat(full)}${half}</span> <span class="muted">(${Number(n).toFixed(1)})</span>`;
}

// Simple form helper: build a form node from a schema.
export function formField({ label, name, type = "text", value = "", placeholder = "", options = null, required = false }) {
  const id = `f_${name}`;
  let input;
  if (type === "select") {
    const opts = (options || []).map(o => `<option value="${o.value}" ${o.value === value ? "selected" : ""}>${o.label}</option>`).join("");
    input = `<select id="${id}" name="${name}" ${required ? "required" : ""}>${opts}</select>`;
  } else if (type === "textarea") {
    input = `<textarea id="${id}" name="${name}" placeholder="${placeholder}" ${required ? "required" : ""}>${value || ""}</textarea>`;
  } else {
    input = `<input id="${id}" name="${name}" type="${type}" placeholder="${placeholder}" value="${value ?? ""}" ${required ? "required" : ""} />`;
  }
  return `<div class="fieldlabel">${label}${required ? " *" : ""}</div>${input}`;
}
