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

// Roles and statuses are translated lazily via t() so a language toggle
// updates them on the next render.
export const ROLE_LABELS = new Proxy({}, {
  get(_t, role) { return t(`role.${role}`); },
});

const STATUS_TONES = {
  created: "muted", paid: "ok", accepted: "ok", preparing: "warn",
  dispatched: "warn", delivered: "ok", completed: "ok",
  cancelled: "danger", refunded: "danger",
  open: "warn", escalated: "danger", resolved: "ok", rejected: "danger",
  pending: "warn", approved: "ok", suspended: "danger",
  assigned: "warn", picked_up: "warn", en_route: "warn",
};
export function statusBadge(status) {
  const tone = STATUS_TONES[status] || "muted";
  const label = t(`status.${status}`, status || "—");
  return `<span class="badge-status ${tone}">${label}</span>`;
}

// Translate a category id (used in the category chips).
export function catLabel(c) { return t(`cat.${c}`, c); }

// ---- Data-name lookups (product/shop/sub-city/city) -------------------
// Stored values stay in English (so backend filters and seed lookups keep
// working). These helpers translate at render time.
const PRODUCT_NAMES_AM = {
  prd_onion:   "ሽንኩርት",
  prd_tomato:  "ቲማቲም",
  prd_potato:  "ድንች",
  prd_carrot:  "ካሮት",
  prd_pepper:  "ቃሪያ",
  prd_cabbage: "ጥቅል ጎመን",
  prd_egg:     "እንቁላል (ትሬ)",
  prd_teff:    "ጤፍ",
  prd_rice:    "ሩዝ",
  prd_lentils: "ምስር",
  prd_banana:  "ሙዝ",
  prd_berbere: "በርበሬ",
};
const PRODUCT_UNITS_AM = {
  kg:    "ኪሎ",
  tray:  "ትሬ",
  dozen: "ደርዘን",
  pack:  "ጥቅል",
};
const SHOP_NAMES_AM = {
  "Bole Fresh Veggies":   "ቦሌ ፍሬሽ አትክልቶች",
  "Kirkos Market Corner": "ቅርቆስ ገበያ ጥግ",
  "Arada Daily Goods":    "አራዳ የዕለት ዕቃዎች",
  "Yeka Grain & Eggs":    "የካ ጥራጥሬና እንቁላል",
};
const SUB_CITIES_AM = {
  "Bole":              "ቦሌ",
  "Kirkos":            "ቅርቆስ",
  "Arada":             "አራዳ",
  "Yeka":              "የካ",
  "Lideta":            "ልደታ",
  "Akaki Kality":      "አቃቂ ቃሊቲ",
  "Addis Ketema":      "አዲስ ከተማ",
  "Gulele":            "ጉለሌ",
  "Nifas Silk-Lafto":  "ንፋስ ስልክ-ላፍቶ",
  "Kolfe Keranio":     "ኮልፌ ቀራኒዮ",
  "Lemi Kura":         "ለሚ ኩራ",
};

export function productName(p) {
  if (!p) return "";
  if (getLang() === "am") return p.nameAm || PRODUCT_NAMES_AM[p.id] || p.name;
  return p.name;
}
export function unitLabel(u) {
  if (!u) return "";
  return getLang() === "am" ? (PRODUCT_UNITS_AM[u] || u) : u;
}
export function shopName(s) {
  if (!s) return "";
  return getLang() === "am" ? (SHOP_NAMES_AM[s.name] || s.name) : s.name;
}
export function subCityLabel(name) {
  if (!name) return "";
  return getLang() === "am" ? (SUB_CITIES_AM[name] || name) : name;
}
export function cityLabel(name) {
  if (!name) return "";
  if (getLang() === "am" && name === "Addis Ababa") return "አዲስ አበባ";
  return name;
}

// Latitude/longitude (approximate centers) for the Leaflet map.
// Used by views/customer.js to drop a marker per sub-city.
export const SUB_CITY_COORDS = {
  "Bole":             [8.9806, 38.7578],
  "Kirkos":           [9.0156, 38.7547],
  "Arada":            [9.0376, 38.7522],
  "Yeka":             [9.0422, 38.7892],
  "Lideta":           [9.0083, 38.7281],
  "Akaki Kality":     [8.8633, 38.7889],
  "Addis Ketema":     [9.0319, 38.7383],
  "Gulele":           [9.0533, 38.7406],
  "Nifas Silk-Lafto": [8.9628, 38.7472],
  "Kolfe Keranio":    [9.0144, 38.6925],
  "Lemi Kura":        [9.0625, 38.8086],
};
export const ADDIS_CENTER = [9.0192, 38.7525];

// Comprehensive EN/AM dictionary. Any view string used by the user-visible
// UI should live here so the language toggle translates everything.
const STR = {
  en: {
    // ---- common ----
    "tagline": "Bilingual Market Price Management",
    "loading": "Loading…",
    "back": "Back",
    "close": "Close",
    "cancel": "Cancel",
    "save": "Save",
    "submit": "Submit",
    "update": "Update",
    "add": "Add",
    "details": "Details",
    "view": "View",
    "all": "All",
    "total": "Total",
    "items": "Items",
    "items_count": "{n} item(s)",
    "yes": "Yes",
    "no": "No",
    "optional": "optional",
    "required": "required",
    "profile": "Profile",
    "preferences": "Preferences",

    // ---- topbar / nav ----
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
    "audit": "Audit log",

    // ---- roles ----
    "role.customer": "Customer",
    "role.owner": "Shop Owner",
    "role.delivery": "Delivery",
    "role.branch": "Branch Committee",
    "role.main": "Main Committee",

    // ---- categories ----
    "cat.All": "All",
    "cat.Vegetables": "Vegetables",
    "cat.Grains": "Grains",
    "cat.Cereals": "Cereals",
    "cat.Fruits": "Fruits",
    "cat.Protein": "Protein",
    "cat.Spices": "Spices",

    // ---- auth ----
    "auth.welcome": "Welcome to GULIT",
    "auth.subtitle": "The digital gulit market: regulated prices, trusted shops, and traceable deliveries.",
    "auth.tab_signin": "Sign in",
    "auth.tab_signup": "Create account",
    "auth.identifier": "Email or phone",
    "auth.password": "Password",
    "auth.signin_btn": "Sign in",
    "auth.fullname": "Full name",
    "auth.fullname_ph": "e.g., Hana Tesfaye",
    "auth.email": "Email",
    "auth.email_ph": "you@example.com",
    "auth.phone": "Phone",
    "auth.phone_ph": "+251 9xx xxx xxx",
    "auth.role": "Role",
    "auth.subcity": "Sub-city",
    "auth.signup_btn": "Create account",
    "auth.committee_note": "Branch and Main Committee accounts are provisioned by administrators.",
    "auth.show_password": "Show password",
    "auth.hide_password": "Hide password",
    "auth.staff_note": "Owner, delivery, and committee accounts require staff verification.",
    "auth.workid": "Work ID number",
    "auth.workid_ph": "Your organization-issued ID",
    "auth.fayda": "Fayda FAN number",
    "auth.fayda_ph": "16-digit Fayda national ID",
    "auth.demo_logins": "Demo logins (password demo1234):",
    "auth.enter_creds": "Enter your credentials",
    "auth.welcome_user": "Welcome, {name}",
    "auth.account_created": "Account created · welcome, {name}",

    // ---- home / browse ----
    "home.title": "Browse regulated prices",
    "home.subtitle": "Search items, filter categories, add to cart.",
    "home.search_ph": "Search vegetables, grains, eggs…",
    "home.shops_nearby": "Shops nearby",
    "home.shops_in": "In {city} sub-city.",
    "home.no_products": "No products in {city} match your filters.",
    "home.no_shops": "No approved shops yet in {city}.",
    "home.range": "Range {min}–{max}",
    "home.sold_by": "Sold by",
    "home.unit": "per",
    "home.added": "Added to cart",

    // ---- shops ----
    "shops.title": "Shops in {city}",
    "shops.subtitle": "Tap a shop for profile, sellers, and reviews.",
    "shops.no_approved": "No approved shops in {city}.",
    "shops.popular_items": "Popular items",
    "shops.regulated_note": "Prices respect committee-set ranges.",
    "shops.no_listed": "No items listed yet.",
    "shops.reviews": "Reviews",
    "shops.feedback_note": "Customers can leave feedback after delivery.",
    "shops.add_review": "Add review",
    "shops.no_reviews": "No reviews yet.",
    "shops.review_title": "Add review",
    "shops.review_stars": "Stars (1–5)",
    "shops.review_text": "Your comment",
    "shops.review_text_ph": "Share your experience…",
    "shops.write_comment": "Please write a comment",
    "shops.review_posted": "Review posted",

    // ---- cart ----
    "cart.title": "Cart",
    "cart.subtitle": "Review items, then checkout.",
    "cart.empty": "Cart is empty.",
    "cart.empty_browse": "Browse items",
    "cart.delivery_note": "Delivery fees added at checkout.",
    "cart.proceed": "Proceed to checkout",
    "cart.empty_toast": "Cart is empty",

    // ---- checkout ----
    "checkout.title": "Checkout",
    "checkout.subtitle": "Choose payment option and confirm.",
    "checkout.summary": "Order summary",
    "checkout.lines_total": "{lines} item line(s) · Total {total}",
    "checkout.address": "Delivery address (sub-city)",
    "checkout.pay_now": "Pay now",
    "checkout.pay_cod": "Pay on delivery",
    "checkout.note": "Pay-now uses a third-party gateway (mocked). Refunds are issued via the same gateway when committee approves.",
    "checkout.placed": "Order placed · {n} shop(s)",

    // ---- tracking ----
    "track.title": "Order tracking",
    "track.subtitle": "Latest orders and live status.",
    "track.no_orders": "No orders yet.",
    "track.start_browsing": "Start browsing",
    "track.home": "Home",
    "track.placed": "Placed {date}",
    "track.payment": "Payment",
    "track.pay_now_label": "Pay now",
    "track.pay_cod_label": "Cash on delivery",
    "track.complain": "Submit complaint",
    "track.order_label": "Order",
    "track.delivery": "Delivery",
    "track.eta": "ETA",
    "track.confirmed_at": "Confirmed at {date}.",
    "track.share_otp": "Share this OTP with the courier on arrival",

    // ---- complaint ----
    "cmp.modal_title": "Submit complaint",
    "cmp.type": "Complaint type",
    "cmp.type.missing": "Missing item",
    "cmp.type.late": "Late delivery",
    "cmp.type.wrong": "Wrong item",
    "cmp.type.refund": "Refund request",
    "cmp.type.other": "Other",
    "cmp.detail": "Details",
    "cmp.detail_ph": "Explain what happened…",
    "cmp.submit": "Submit",
    "cmp.describe": "Please describe the issue",
    "cmp.sent": "Complaint submitted to branch committee",

    // ---- account ----
    "acc.title": "Account",
    "acc.subtitle": "Profile and demo controls.",
    "acc.role": "Role",
    "acc.subcity": "Sub-city",
    "acc.email": "Email",
    "acc.phone": "Phone",
    "acc.signout": "Sign out",
    "acc.theme": "Theme",
    "acc.change_theme": "Change theme",
    "acc.demo": "Demo controls",
    "acc.reset": "Reset demo data",
    "acc.reset_note": "Resetting wipes local data and reloads the seed (products, shops, demo accounts, regulated price ranges).",
    "acc.reset_confirm": "Reset all local demo data? This signs you out.",
    "acc.reset_done": "Demo data reset",
    "acc.signed_out": "Signed out",
    "acc.account_btn": "Account",
    "acc.edit_profile": "Edit profile",
    "acc.edit_modal": "Edit profile",
    "acc.new_password": "New password (leave blank to keep current)",
    "acc.current_password": "Current password (required for changes)",
    "acc.profile_saved": "Profile saved",
    "acc.bad_password": "Current password is incorrect",
    "acc.signout_confirm_title": "Sign out?",
    "acc.signout_confirm_body": "You'll need to sign back in to use GULIT. Any unsaved cart items remain on this device.",
    "acc.signout_yes": "Yes, sign out",
    "map.loading": "Loading map…",
    "map.shops_in": "{n} shop(s) in {city}",

    // ---- owner ----
    "own.title": "Shop Owner Dashboard",
    "own.subtitle": "Manage shops, inventory, and incoming orders.",
    "own.register_shop": "+ Register shop",
    "own.stat_shops": "Shops",
    "own.stat_approved": "Approved",
    "own.stat_pending": "Pending",
    "own.stat_orders": "Orders received",
    "own.stat_rating": "Avg. rating",
    "own.queue": "Orders queue",
    "own.queue_subtitle": "Accept, prepare, and assign delivery",
    "own.no_shops": "Register a shop to receive orders.",
    "own.no_orders": "No orders yet. They will appear here as soon as customers buy from your shop.",
    "own.inv_no_shops": "Register a shop above to manage inventory. Once your local branch committee approves it, you can list items.",
    "own.accept": "Accept",
    "own.reject": "Reject",
    "own.mark_prep": "Mark preparing",
    "own.assign_delivery": "Assign delivery",
    "own.awaiting": "Awaiting delivery",
    "own.no_action": "No action",
    "own.assign_title": "Assign delivery",
    "own.courier": "Courier",
    "own.eta": "ETA",
    "own.otp_note": "Customer receives a 4-digit OTP. Courier confirms with OTP at delivery.",
    "own.assign_btn": "Assign",
    "own.no_couriers": "No delivery personnel available",
    "own.assigned_otp": "Delivery assigned · OTP {otp}",
    "own.order_updated": "Order updated · {status}",
    "own.customer": "Customer",
    "own.subcity": "Sub-city",
    "own.inv_note": "Listing prices must fall within committee-set ranges.",
    "own.range_label": "Range {min}–{max}",
    "own.no_range": "No regulated range",
    "own.qty": "Qty",
    "own.update": "Update",
    "own.add": "Add",
    "own.inv_update": "Update inventory",
    "own.inv_add": "Add to inventory",
    "own.allowed_range": "Allowed range: {min} to {max}",
    "own.qty_label": "Quantity",
    "own.unit_price": "Unit price (ETB)",
    "own.inv_saved": "Inventory saved",
    "own.shop_modal": "Register a new shop",
    "own.shop_name": "Shop name",
    "own.shop_name_ph": "e.g., Bole Fresh Veggies",
    "own.shop_note": "After submission, the local branch committee reviews and approves your shop before you can sell.",
    "own.shop_submitted": "Submitted for branch committee review",

    // ---- owner: product proposals + notifications ----
    "own.propose_btn": "+ Propose new product",
    "own.propose_title": "Propose new product",
    "own.propose_subtitle": "Suggest a new product for the catalog. The branch committee will review and, if approved, set the regulated price band and add it to your inventory.",
    "own.propose_shop": "Your shop",
    "own.product_name_en": "Product name (English)",
    "own.product_name_en_ph": "e.g., Cucumber",
    "own.product_name_am": "Product name (Amharic)",
    "own.product_name_am_ph": "e.g., ኪያር",
    "own.product_category": "Category",
    "own.product_unit": "Unit",
    "own.product_icon": "Icon",
    "own.suggested_min": "Suggested minimum (ETB)",
    "own.suggested_max": "Suggested maximum (ETB)",
    "own.initial_price": "My initial price (ETB)",
    "own.initial_qty": "Initial stock",
    "own.propose_send": "Submit for review",
    "own.proposal_sent": "Proposal sent to branch committee",
    "own.activity_title": "Notifications",
    "own.activity_subtitle": "Decisions on your proposals and committee responses to price changes.",
    "own.no_activity": "No notifications yet.",
    "own.mark_read": "Mark as read",
    "own.proposals_title": "My proposals",
    "own.no_proposals": "No proposals yet. Use “Propose new product” to suggest one.",
    "own.proposal_status": "Status",
    "own.notify_committee": "Branch committee will be notified of this price change.",

    // ---- delivery ----
    "dlv.title": "Delivery dashboard",
    "dlv.subtitle": "Update task status and confirm with customer OTP.",
    "dlv.no_tasks": "No assigned deliveries yet.",
    "dlv.drop": "Drop",
    "dlv.eta": "ETA",
    "dlv.completed": "Completed",
    "dlv.confirm_btn": "Confirm with OTP",
    "dlv.mark": "Mark {label}",
    "dlv.items_modal": "Items · Order {id}",
    "dlv.confirm_title": "Confirm delivery with OTP",
    "dlv.otp_note": "Ask the customer for the 4-digit OTP shown on their tracking screen.",
    "dlv.otp": "OTP",
    "dlv.confirm": "Confirm",
    "dlv.confirmed": "Delivery confirmed",
    "dlv.label.accepted": "accepted",
    "dlv.label.picked_up": "picked up",
    "dlv.label.en_route": "en route",
    "dlv.label.delivered": "delivered",

    // ---- committee (branch) ----
    "br.title": "Branch Committee · {city}",
    "br.subtitle": "Approve shops and review complaints in your jurisdiction.",
    "br.audit_btn": "Audit log",
    "br.pending_title": "Pending shop registrations",
    "br.pending_subtitle": "Verify and approve before sellers go live.",
    "br.no_pending": "No pending registrations.",
    "br.submitted": "Submitted {date}",
    "br.approve": "Approve",
    "br.reject": "Reject",
    "br.reject_reason": "Reason for rejection (visible to owner):",
    "br.shop_status": "Shop {status}",
    "br.queue_title": "Complaints queue",
    "br.queue_subtitle": "Approve refunds, reject, or escalate to main committee.",
    "br.no_open": "No open cases. ✨",
    "br.from": "From",
    "br.shop_label": "Shop",
    "br.order_label": "Order",
    "br.approve_refund": "Approve refund",
    "br.escalate": "Escalate",
    "br.decision_note": "Decision note:",
    "br.case_updated": "Case {decision}",
    "br.proposals_title": "Product proposals",
    "br.proposals_subtitle": "Owners suggest new products with bilingual names and a suggested price band. Approving adds the product to the catalog with that band, and stocks the proposing shop.",
    "br.no_proposals": "No pending proposals.",
    "br.proposed_by": "Proposed by",
    "br.suggested_label": "Suggested band",
    "br.initial_label": "Initial price",
    "br.shops_title": "Shops & inventory",
    "br.shops_subtitle": "Approved shops in your jurisdiction. Tap a shop to see what they sell and at what price.",
    "br.no_shops_here": "No approved shops in your jurisdiction yet.",
    "br.view_inventory": "View inventory",
    "br.inv_modal": "{shop} · inventory",
    "br.no_inventory": "No items listed yet.",
    "br.notifs_title": "Notifications",
    "br.notifs_subtitle": "Price changes, proposals, and shop activity in your jurisdiction.",
    "br.no_notifs": "No notifications.",
    "br.proposal_decided": "Proposal {decision}",

    // ---- committee (main) ----
    "mc.title": "City Main Committee",
    "mc.subtitle": "Set price ranges, review escalations, monitor compliance.",
    "mc.ranges_title": "Regulated price ranges",
    "mc.ranges_subtitle": "Min/max ETB values enforced at listing and checkout.",
    "mc.ranges_note": "Newer entries supersede older ones via effective date.",
    "mc.effective": "Effective {date}",
    "mc.no_range": "No range set yet",
    "mc.set": "Set",
    "mc.update": "Update",
    "mc.set_modal": "Set price range · {name}",
    "mc.min_price": "Minimum price (ETB)",
    "mc.max_price": "Maximum price (ETB)",
    "mc.set_note": "New range takes effect immediately. Existing inventory exceeding the band will be flagged for owner attention.",
    "mc.range_updated": "Price range updated",
    "mc.escalations_title": "Escalated cases",
    "mc.escalations_subtitle": "Branch committees forward unresolved disputes here.",
    "mc.no_escalations": "No escalated cases.",
    "mc.mark_resolved": "Mark resolved",
    "mc.final_note": "Final decision note:",
    "mc.complaints_overview": "Complaints overview",
    "mc.complaints_subtitle": "All complaints in the city by status — for next-meeting tracking.",
    "mc.no_complaints": "No complaints recorded.",
    "mc.cnt_unanswered": "Unanswered",
    "mc.cnt_in_review": "In review",
    "mc.cnt_resolved": "Resolved",
    "mc.cnt_rejected": "Rejected",
    "mc.cnt_escalated": "Escalated",
    "mc.filter_all": "All",
    "mc.notifs_title": "Notifications",
    "mc.notifs_subtitle": "Escalations and city-wide signals from branch committees.",
    "mc.no_notifs": "No notifications.",
    "mc.needs_review": "Needs main review",
    "mc.needs_review_hint": "Initial band was set by a branch committee. Tap Update to confirm or override.",
    "mc.accounts_title": "Accounts",
    "mc.accounts_subtitle": "Active vs inactive user accounts across the city.",
    "mc.acc_active": "Active",
    "mc.acc_inactive": "Inactive",
    "mc.acc_total": "Total",
    "mc.acc_last_seen": "Last seen {when}",
    "mc.acc_never_signed_in": "Never signed in",
    "mc.acc_filter_all": "All",
    "mc.no_accounts": "No accounts.",

    // ---- notifications (cross-cutting) ----
    "notif.proposal_pending": "{owner} proposed product “{name}” for review",
    "notif.proposal_approved": "Your proposal “{name}” was approved and added to the catalog",
    "notif.proposal_rejected": "Your proposal “{name}” was rejected",
    "notif.price_change": "{shop} changed price of {product}: {oldPrice} → {newPrice}",
    "notif.complaint_escalated": "Branch escalated complaint {id} ({type}) — needs main review",
    "notif.complaint_open": "New complaint filed against {shop} ({type})",
    "notif.product_added": "New product “{name}” added to catalog by {branch} (band {min}–{max})",

    // ---- audit ----
    "audit.title": "Audit log (last 100 events)",
    "audit.subtitle": "Append-only log of governance and lifecycle events.",
    "audit.empty": "No events yet.",

    // ---- theme ----
    "theme.title": "Choose a theme",
    "theme.subtitle": "Pick the look that suits you. Saved across sessions.",
    "theme.toast": "Theme: {name}",
    "theme.garden": "Garden Cream",
    "theme.garden.desc": "Sage and warm cream",
    "theme.terracotta": "Terracotta Earth",
    "theme.terracotta.desc": "Clay and peach",
    "theme.sage": "Sage Garden",
    "theme.sage.desc": "Soft sage and beige",
    "theme.rose": "Dusty Rose",
    "theme.rose.desc": "Rose and warm tan",
    "theme.mustard": "Mustard Field",
    "theme.mustard.desc": "Mustard and gold",
    "theme.plum": "Plum Bloom",
    "theme.plum.desc": "Dusty plum and rose",
    "theme.midnight": "Midnight",
    "theme.midnight.desc": "Warm dark with gold accent",

    // ---- status badges ----
    "status.created": "Created",
    "status.paid": "Paid",
    "status.accepted": "Accepted",
    "status.preparing": "Preparing",
    "status.dispatched": "Dispatched",
    "status.delivered": "Delivered",
    "status.completed": "Completed",
    "status.cancelled": "Cancelled",
    "status.refunded": "Refunded",
    "status.open": "Open",
    "status.escalated": "Escalated",
    "status.resolved": "Resolved",
    "status.rejected": "Rejected",
    "status.pending": "Pending",
    "status.approved": "Approved",
    "status.suspended": "Suspended",
    "status.assigned": "Assigned",
    "status.picked_up": "Picked up",
    "status.en_route": "En route",
  },

  am: {
    // ---- common ----
    "tagline": "የጉሊት ገበያ ዋጋ አስተዳደር",
    "loading": "በመጫን ላይ…",
    "back": "ተመለስ",
    "close": "ዝጋ",
    "cancel": "ሰርዝ",
    "save": "አስቀምጥ",
    "submit": "አስገባ",
    "update": "አስተካክል",
    "add": "ጨምር",
    "details": "ዝርዝር",
    "view": "እይ",
    "all": "ሁሉም",
    "total": "ድምር",
    "items": "ዕቃዎች",
    "items_count": "{n} ዕቃዎች",
    "yes": "አዎ",
    "no": "አይ",
    "optional": "አማራጭ",
    "required": "ግዴታ",
    "profile": "መግለጫ",
    "preferences": "ምርጫዎች",

    // ---- topbar / nav ----
    "signin": "ግባ",
    "signout": "ውጣ",
    "browse": "ይመልከቱ",
    "cart": "ጋሪ",
    "track": "ይከታተሉ",
    "account": "መለያ",
    "shops": "ሱቆች",
    "orders": "ትዕዛዞች",
    "inventory": "ክምችት",
    "deliveries": "አመጣጥ",
    "cases": "ጉዳዮች",
    "ranges": "የዋጋ ክልሎች",
    "audit": "የቁጥጥር ምዝገባ",

    // ---- roles ----
    "role.customer": "ደንበኛ",
    "role.owner": "የሱቅ ባለቤት",
    "role.delivery": "አስረካቢ",
    "role.branch": "የቅርንጫፍ ኮሚቴ",
    "role.main": "ዋና ኮሚቴ",

    // ---- categories ----
    "cat.All": "ሁሉም",
    "cat.Vegetables": "አትክልት",
    "cat.Grains": "ጥራጥሬ",
    "cat.Cereals": "እህል",
    "cat.Fruits": "ፍራፍሬ",
    "cat.Protein": "ፕሮቲን",
    "cat.Spices": "ቅመማ ቅመም",

    // ---- auth ----
    "auth.welcome": "ወደ GULIT እንኳን በደህና መጡ",
    "auth.subtitle": "ዲጂታል የጉሊት ገበያ፡ የተወሰኑ ዋጋዎች፣ የታመኑ ሱቆች እና ሊከታተል የሚችል አመጣጥ።",
    "auth.tab_signin": "ግባ",
    "auth.tab_signup": "መለያ ይክፈቱ",
    "auth.identifier": "ኢሜይል ወይም ስልክ ቁጥር",
    "auth.password": "የይለፍ ቃል",
    "auth.signin_btn": "ግባ",
    "auth.fullname": "ሙሉ ስም",
    "auth.fullname_ph": "ለምሳሌ፣ ሃና ተስፋዬ",
    "auth.email": "ኢሜይል",
    "auth.email_ph": "you@example.com",
    "auth.phone": "ስልክ ቁጥር",
    "auth.phone_ph": "+251 9xx xxx xxx",
    "auth.role": "ሚና",
    "auth.subcity": "ክፍለ ከተማ",
    "auth.signup_btn": "መለያ ይክፈቱ",
    "auth.committee_note": "የቅርንጫፍ እና ዋና ኮሚቴ መለያዎች በአስተዳዳሪዎች ይሰጣሉ።",
    "auth.show_password": "የይለፍ ቃል አሳይ",
    "auth.hide_password": "የይለፍ ቃል ደብቅ",
    "auth.staff_note": "የባለቤት፣ አስረካቢ እና ኮሚቴ መለያዎች የሰራተኛ ማረጋገጫ ያስፈልጋቸዋል።",
    "auth.workid": "የሥራ መታወቂያ ቁጥር",
    "auth.workid_ph": "በድርጅትዎ የተሰጠ መታወቂያ",
    "auth.fayda": "የፋይዳ FAN ቁጥር",
    "auth.fayda_ph": "16-አሃዝ የፋይዳ ብሄራዊ መታወቂያ",
    "auth.demo_logins": "የናሙና መለያዎች (የይለፍ ቃል፡ demo1234):",
    "auth.enter_creds": "የመለያ መረጃዎን ያስገቡ",
    "auth.welcome_user": "እንኳን ደህና መጡ፣ {name}",
    "auth.account_created": "መለያ ተፈጥሯል · እንኳን ደህና መጡ፣ {name}",

    // ---- home / browse ----
    "home.title": "የተወሰኑ ዋጋዎችን ይመልከቱ",
    "home.subtitle": "ዕቃዎችን ይፈልጉ፣ ምድቦችን ይምረጡ፣ ወደ ጋሪ ይጨምሩ።",
    "home.search_ph": "አትክልት፣ ጥራጥሬ፣ እንቁላል ይፈልጉ…",
    "home.shops_nearby": "በአቅራቢያ ያሉ ሱቆች",
    "home.shops_in": "በ{city} ክፍለ ከተማ ውስጥ።",
    "home.no_products": "በ{city} ውስጥ ከማጣሪያዎ ጋር የሚስማማ ዕቃ የለም።",
    "home.no_shops": "በ{city} ውስጥ የተፈቀደ ሱቅ የለም።",
    "home.range": "ክልል {min}–{max}",
    "home.sold_by": "ሻጭ",
    "home.unit": "በ",
    "home.added": "ወደ ጋሪ ታክሏል",

    // ---- shops ----
    "shops.title": "በ{city} ውስጥ ያሉ ሱቆች",
    "shops.subtitle": "ሱቁን ይንኩ መግለጫ፣ ሻጮችን እና አስተያየቶችን ለመመልከት።",
    "shops.no_approved": "በ{city} ውስጥ የተፈቀደ ሱቅ የለም።",
    "shops.popular_items": "ተመራጭ ዕቃዎች",
    "shops.regulated_note": "ዋጋዎች በኮሚቴ የተወሰኑ ክልሎችን ያከብራሉ።",
    "shops.no_listed": "ገና ምንም ዕቃ አልተዘረዘረም።",
    "shops.reviews": "አስተያየቶች",
    "shops.feedback_note": "ደንበኞች ከአመጣጥ በኋላ አስተያየት መስጠት ይችላሉ።",
    "shops.add_review": "አስተያየት ጨምር",
    "shops.no_reviews": "ገና ምንም አስተያየት የለም።",
    "shops.review_title": "አስተያየት ጨምር",
    "shops.review_stars": "ደረጃ (1–5)",
    "shops.review_text": "የእርስዎ አስተያየት",
    "shops.review_text_ph": "ልምድዎን ያካፍሉ…",
    "shops.write_comment": "እባኮት አስተያየት ይጻፉ",
    "shops.review_posted": "አስተያየት ተለጥፏል",

    // ---- cart ----
    "cart.title": "ጋሪ",
    "cart.subtitle": "ዕቃዎቹን ይከልሱ፣ ከዚያ ይክፈሉ።",
    "cart.empty": "ጋሪው ባዶ ነው።",
    "cart.empty_browse": "ዕቃዎችን ይመልከቱ",
    "cart.delivery_note": "የማድረሻ ክፍያ በክፍያ ላይ ይታከላል።",
    "cart.proceed": "ወደ ክፍያ ይቀጥሉ",
    "cart.empty_toast": "ጋሪው ባዶ ነው",

    // ---- checkout ----
    "checkout.title": "ክፍያ",
    "checkout.subtitle": "የክፍያ አማራጭ ይምረጡና ያረጋግጡ።",
    "checkout.summary": "የትዕዛዝ ማጠቃለያ",
    "checkout.lines_total": "{lines} የዕቃ መስመር · ድምር {total}",
    "checkout.address": "የማድረሻ አድራሻ (ክፍለ ከተማ)",
    "checkout.pay_now": "አሁን ይክፈሉ",
    "checkout.pay_cod": "በሚደርስ ጊዜ ይክፈሉ",
    "checkout.note": "አሁን ይክፈሉ የሶስተኛ ወገን ጌትዌይ ይጠቀማል (ለሙከራ የተዘጋጀ)። ኮሚቴ ሲፈቅድ ገንዘቦች በተመሳሳይ ጌትዌይ ይመለሳሉ።",
    "checkout.placed": "ትዕዛዝ ተሰጥቷል · {n} ሱቅ(ዎች)",

    // ---- tracking ----
    "track.title": "ትዕዛዝ መከታተያ",
    "track.subtitle": "የቅርብ ጊዜ ትዕዛዞች እና ቀጥታ ሁኔታ።",
    "track.no_orders": "ገና ትዕዛዝ የለም።",
    "track.start_browsing": "ይመልከቱ",
    "track.home": "መነሻ",
    "track.placed": "የተሰጠው {date}",
    "track.payment": "ክፍያ",
    "track.pay_now_label": "አሁን ተከፍሏል",
    "track.pay_cod_label": "በሚደርስ ጊዜ",
    "track.complain": "ቅሬታ ያስገቡ",
    "track.order_label": "ትዕዛዝ",
    "track.delivery": "አመጣጥ",
    "track.eta": "የሚደርስበት ጊዜ",
    "track.confirmed_at": "የተረጋገጠው {date}።",
    "track.share_otp": "ይህን ኮድ ሲደርስ ለአስረካቢው ያካፍሉ",

    // ---- complaint ----
    "cmp.modal_title": "ቅሬታ ያስገቡ",
    "cmp.type": "የቅሬታ ዓይነት",
    "cmp.type.missing": "የጎደለ ዕቃ",
    "cmp.type.late": "የዘገየ አመጣጥ",
    "cmp.type.wrong": "የተሳሳተ ዕቃ",
    "cmp.type.refund": "ገንዘብ መመለስ",
    "cmp.type.other": "ሌላ",
    "cmp.detail": "ዝርዝር",
    "cmp.detail_ph": "የተፈጠረውን ያስረዱ…",
    "cmp.submit": "አስገባ",
    "cmp.describe": "እባኮት ችግሩን ያስረዱ",
    "cmp.sent": "ቅሬታ ለቅርንጫፍ ኮሚቴ ቀርቧል",

    // ---- account ----
    "acc.title": "መለያ",
    "acc.subtitle": "መግለጫ እና የናሙና መቆጣጠሪያዎች።",
    "acc.role": "ሚና",
    "acc.subcity": "ክፍለ ከተማ",
    "acc.email": "ኢሜይል",
    "acc.phone": "ስልክ",
    "acc.signout": "ውጣ",
    "acc.theme": "ገጽታ",
    "acc.change_theme": "ገጽታ ቀይር",
    "acc.demo": "የናሙና መቆጣጠሪያዎች",
    "acc.reset": "ናሙና መረጃ እንደ አዲስ ጀምር",
    "acc.reset_note": "እንደ አዲስ መጀመር በዚህ መሳሪያ ላይ ያለውን መረጃ ያጠፋና የናሙና መረጃውን (ዕቃዎች፣ ሱቆች፣ የናሙና መለያዎች፣ የተወሰኑ የዋጋ ክልሎች) እንደገና ይጭነዋል።",
    "acc.reset_confirm": "ሁሉንም በዚህ መሳሪያ ያለ የናሙና መረጃ እንደ አዲስ ይጀምር? ይህ ከመለያው ያስወጣዎታል።",
    "acc.reset_done": "የናሙና መረጃ እንደ አዲስ ተጀምሯል",
    "acc.signed_out": "ወጥተዋል",
    "acc.account_btn": "መለያ",
    "acc.edit_profile": "መግለጫ አስተካክል",
    "acc.edit_modal": "መግለጫ አስተካክል",
    "acc.new_password": "አዲስ የይለፍ ቃል (ለመተው ባዶ ይተዉት)",
    "acc.current_password": "የአሁኑ የይለፍ ቃል (ለለውጥ ያስፈልጋል)",
    "acc.profile_saved": "መግለጫ ተቀምጧል",
    "acc.bad_password": "የአሁኑ የይለፍ ቃል ትክክል አይደለም",
    "acc.signout_confirm_title": "መውጣት?",
    "acc.signout_confirm_body": "GULIT ለመጠቀም እንደገና መግባት ያስፈልግዎታል። ያልተቀመጡ የጋሪ ዕቃዎች በዚህ መሳሪያ ላይ ይቆያሉ።",
    "acc.signout_yes": "አዎ፣ ውጣ",
    "map.loading": "ካርታ በመጫን ላይ…",
    "map.shops_in": "በ{city} ውስጥ {n} ሱቆች",

    // ---- owner ----
    "own.title": "የሱቅ ባለቤት ዳሽቦርድ",
    "own.subtitle": "ሱቆችን፣ ክምችትንና የሚገቡ ትዕዛዞችን ያስተዳድሩ።",
    "own.register_shop": "+ ሱቅ ይመዝግቡ",
    "own.stat_shops": "ሱቆች",
    "own.stat_approved": "የተፈቀዱ",
    "own.stat_pending": "በመጠባበቅ ላይ",
    "own.stat_orders": "የመጡ ትዕዛዞች",
    "own.stat_rating": "አማካይ ደረጃ",
    "own.queue": "የትዕዛዞች ሰልፍ",
    "own.queue_subtitle": "ይቀበሉ፣ ያዘጋጁ፣ አስረካቢ ይመድቡ",
    "own.no_shops": "ትዕዛዝ ለመቀበል ሱቅ ይመዝግቡ።",
    "own.no_orders": "ገና ትዕዛዝ የለም። ደንበኞች ከሱቅዎ ሲገዙ እዚህ ይታያሉ።",
    "own.inv_no_shops": "ክምችትን ለማስተዳደር ከላይ ሱቅ ይመዝግቡ። የአካባቢው የቅርንጫፍ ኮሚቴ ሲፈቅድ ዕቃዎች መዘርዘር ይችላሉ።",
    "own.accept": "ተቀበል",
    "own.reject": "አትቀበል",
    "own.mark_prep": "በማዘጋጀት ላይ",
    "own.assign_delivery": "አስረካቢ መድብ",
    "own.awaiting": "አስረካቢ በመጠበቅ ላይ",
    "own.no_action": "እርምጃ የለም",
    "own.assign_title": "አስረካቢ መድብ",
    "own.courier": "አስረካቢ",
    "own.eta": "የሚደርስበት ጊዜ",
    "own.otp_note": "ደንበኛው 4-አሃዝ ኮድ ይቀበላል። አስረካቢው ሲደርስ በኮዱ ያረጋግጣል።",
    "own.assign_btn": "መድብ",
    "own.no_couriers": "የሚገኝ አስረካቢ የለም",
    "own.assigned_otp": "አስረካቢ ተመድቧል · ኮድ {otp}",
    "own.order_updated": "ትዕዛዝ ተስተካክሏል · {status}",
    "own.customer": "ደንበኛ",
    "own.subcity": "ክፍለ ከተማ",
    "own.inv_note": "የመዘርዘሪያ ዋጋዎች በኮሚቴ የተወሰኑ ክልሎችን ማክበር አለባቸው።",
    "own.range_label": "ክልል {min}–{max}",
    "own.no_range": "የተወሰነ ክልል የለም",
    "own.qty": "ብዛት",
    "own.update": "አስተካክል",
    "own.add": "ጨምር",
    "own.inv_update": "ክምችት አስተካክል",
    "own.inv_add": "ወደ ክምችት ጨምር",
    "own.allowed_range": "የተፈቀደ ክልል፡ {min} እስከ {max}",
    "own.qty_label": "ብዛት",
    "own.unit_price": "የነጠላ ዋጋ (ብር)",
    "own.inv_saved": "ክምችት ተቀምጧል",
    "own.shop_modal": "አዲስ ሱቅ ይመዝግቡ",
    "own.shop_name": "የሱቅ ስም",
    "own.shop_name_ph": "ለምሳሌ፣ ቦሌ ፍሬሽ ቬጂስ",
    "own.shop_note": "ካስገቡ በኋላ የአካባቢው የቅርንጫፍ ኮሚቴ ሱቅዎን ይገመግማል፣ ካፀደቀ በኋላ መሸጥ ይጀምራሉ።",
    "own.shop_submitted": "ለቅርንጫፍ ኮሚቴ ግምገማ ቀርቧል",

    // ---- owner: product proposals + notifications ----
    "own.propose_btn": "+ አዲስ ምርት ጠቁም",
    "own.propose_title": "አዲስ ምርት ጠቁም",
    "own.propose_subtitle": "በዝርዝሩ ላይ የሚጨመር አዲስ ምርት ይጠቁሙ። የቅርንጫፍ ኮሚቴ ይገመግማል፤ ካፀደቀ የተወሰነ የዋጋ ክልል ይዘጋጅና ወደ ክምችትዎ ይታከላል።",
    "own.propose_shop": "ሱቅዎ",
    "own.product_name_en": "የምርት ስም (በእንግሊዝኛ)",
    "own.product_name_en_ph": "ለምሳሌ፣ Cucumber",
    "own.product_name_am": "የምርት ስም (በአማርኛ)",
    "own.product_name_am_ph": "ለምሳሌ፣ ኪያር",
    "own.product_category": "ምድብ",
    "own.product_unit": "መለኪያ",
    "own.product_icon": "አዶ",
    "own.suggested_min": "የተጠቆመ ዝቅተኛ (ብር)",
    "own.suggested_max": "የተጠቆመ ከፍተኛ (ብር)",
    "own.initial_price": "የእርስዎ የመጀመሪያ ዋጋ (ብር)",
    "own.initial_qty": "የመጀመሪያ ክምችት",
    "own.propose_send": "ለግምገማ አስገባ",
    "own.proposal_sent": "ጥቆማ ለቅርንጫፍ ኮሚቴ ቀርቧል",
    "own.activity_title": "ማሳወቂያዎች",
    "own.activity_subtitle": "ስለ ጥቆማዎችዎ ውሳኔዎችና ስለ ዋጋ ለውጥ የኮሚቴ ምላሾች።",
    "own.no_activity": "ገና ማሳወቂያ የለም።",
    "own.mark_read": "እንደ ተነበበ ምልክት",
    "own.proposals_title": "የእኔ ጥቆማዎች",
    "own.no_proposals": "ገና ጥቆማ የለም። “አዲስ ምርት ጠቁም” የሚለውን ይጠቀሙ።",
    "own.proposal_status": "ሁኔታ",
    "own.notify_committee": "የቅርንጫፍ ኮሚቴ ለዚህ ዋጋ ለውጥ ማሳወቂያ ይደርሰዋል።",

    // ---- delivery ----
    "dlv.title": "የአስረካቢ ዳሽቦርድ",
    "dlv.subtitle": "የተግባር ሁኔታ ያስተካክሉና በደንበኛ ኮድ ያረጋግጡ።",
    "dlv.no_tasks": "ገና የተመደበ አመጣጥ የለም።",
    "dlv.drop": "የሚደርስበት",
    "dlv.eta": "የሚደርስበት ጊዜ",
    "dlv.completed": "ተጠናቋል",
    "dlv.confirm_btn": "በኮድ አረጋግጥ",
    "dlv.mark": "ምልክት፡ {label}",
    "dlv.items_modal": "ዕቃዎች · ትዕዛዝ {id}",
    "dlv.confirm_title": "በኮድ አመጣጥ ያረጋግጡ",
    "dlv.otp_note": "በመከታተያ ስክሪኑ ላይ የሚታየውን 4-አሃዝ ኮድ ከደንበኛው ይጠይቁ።",
    "dlv.otp": "ኮድ",
    "dlv.confirm": "አረጋግጥ",
    "dlv.confirmed": "አመጣጥ ተረጋግጧል",
    "dlv.label.accepted": "ተቀብሏል",
    "dlv.label.picked_up": "ተወሰዷል",
    "dlv.label.en_route": "በጉዞ ላይ",
    "dlv.label.delivered": "ደርሷል",

    // ---- committee (branch) ----
    "br.title": "የቅርንጫፍ ኮሚቴ · {city}",
    "br.subtitle": "በሥልጣንዎ ስር ያሉ ሱቆችን ያፅድቁና ቅሬታዎችን ይገምግሙ።",
    "br.audit_btn": "የቁጥጥር ምዝገባ",
    "br.pending_title": "በመጠባበቅ ላይ ያሉ የሱቅ ምዝገባዎች",
    "br.pending_subtitle": "ሻጮች ከመጀመራቸው በፊት ያረጋግጡ እና ያፅድቁ።",
    "br.no_pending": "በመጠባበቅ ላይ ያለ ምዝገባ የለም።",
    "br.submitted": "የቀረበው {date}",
    "br.approve": "አፅድቅ",
    "br.reject": "አትቀበል",
    "br.reject_reason": "ያላፀደቁበት ምክንያት (ለባለቤቱ ይታያል):",
    "br.shop_status": "ሱቅ {status}",
    "br.queue_title": "የቅሬታዎች ሰልፍ",
    "br.queue_subtitle": "የገንዘብ መመለስን ያፅድቁ፣ ያትቀበሉ፣ ወይም ለዋና ኮሚቴ ያስተላልፉ።",
    "br.no_open": "ክፍት ጉዳይ የለም። ✨",
    "br.from": "ከ",
    "br.shop_label": "ሱቅ",
    "br.order_label": "ትዕዛዝ",
    "br.approve_refund": "ገንዘብ መመለስ ያፅድቁ",
    "br.escalate": "ለዋና ያስተላልፉ",
    "br.decision_note": "የውሳኔ ማስታወሻ:",
    "br.case_updated": "ጉዳይ {decision}",
    "br.proposals_title": "የምርት ጥቆማዎች",
    "br.proposals_subtitle": "ባለቤቶች በሁለት ቋንቋ ስምና የተጠቆመ የዋጋ ክልል ያላቸውን አዳዲስ ምርቶች ይጠቁማሉ። ካፀደቁ ምርቱ ወደ ዝርዝሩ ይታከላል፣ ጠቋሚው ሱቅም ይከማቻል።",
    "br.no_proposals": "በመጠባበቅ ላይ ጥቆማ የለም።",
    "br.proposed_by": "ጠቋሚ",
    "br.suggested_label": "የተጠቆመ ክልል",
    "br.initial_label": "የመጀመሪያ ዋጋ",
    "br.shops_title": "ሱቆችና ክምችት",
    "br.shops_subtitle": "በሥልጣንዎ ስር ያሉ የተፈቀዱ ሱቆች። ምን እንደሚሸጡና በምን ዋጋ ለማየት ሱቅን ይንኩ።",
    "br.no_shops_here": "በሥልጣንዎ ስር የተፈቀደ ሱቅ የለም።",
    "br.view_inventory": "ክምችት ይመልከቱ",
    "br.inv_modal": "{shop} · ክምችት",
    "br.no_inventory": "ገና የተዘረዘረ ዕቃ የለም።",
    "br.notifs_title": "ማሳወቂያዎች",
    "br.notifs_subtitle": "በሥልጣንዎ ውስጥ ያሉ የዋጋ ለውጦች፣ ጥቆማዎችና የሱቅ እንቅስቃሴዎች።",
    "br.no_notifs": "ማሳወቂያ የለም።",
    "br.proposal_decided": "ጥቆማ {decision}",

    // ---- committee (main) ----
    "mc.title": "የከተማ ዋና ኮሚቴ",
    "mc.subtitle": "የዋጋ ክልሎችን ያቀናብሩ፣ የተላለፉ ጉዳዮችን ይገምግሙ፣ ተገዢነትን ይከታተሉ።",
    "mc.ranges_title": "የተወሰኑ የዋጋ ክልሎች",
    "mc.ranges_subtitle": "በመዘርዘርና በክፍያ ጊዜ የሚተገበሩ ዝቅተኛ/ከፍተኛ ዋጋዎች (ብር)።",
    "mc.ranges_note": "አዲስ ግቤቶች በተግባር ቀን ቀደምትዎቹን ይተካሉ።",
    "mc.effective": "ከ{date} ጀምሮ",
    "mc.no_range": "ገና ክልል አልተቀመጠም",
    "mc.set": "አዘጋጅ",
    "mc.update": "አስተካክል",
    "mc.set_modal": "የዋጋ ክልል አዘጋጅ · {name}",
    "mc.min_price": "ዝቅተኛ ዋጋ (ብር)",
    "mc.max_price": "ከፍተኛ ዋጋ (ብር)",
    "mc.set_note": "አዲሱ ክልል ወዲያው ይተገበራል። ከክልሉ ውጭ ያሉ ነባር ዕቃዎች ለባለቤቶች ምልክት ይደረግባቸዋል።",
    "mc.range_updated": "የዋጋ ክልል ተስተካክሏል",
    "mc.escalations_title": "የተላለፉ ጉዳዮች",
    "mc.escalations_subtitle": "የቅርንጫፍ ኮሚቴዎች ያልተፈቱ ክርክሮችን ወደዚህ ይልካሉ።",
    "mc.no_escalations": "የተላለፈ ጉዳይ የለም።",
    "mc.mark_resolved": "እንደ ተፈታ ምልክት",
    "mc.final_note": "የመጨረሻ ውሳኔ ማስታወሻ:",
    "mc.complaints_overview": "የቅሬታዎች አጠቃላይ እይታ",
    "mc.complaints_subtitle": "በከተማው ውስጥ ያሉ ሁሉም ቅሬታዎች በሁኔታ ተከፋፍለው — ለቀጣዩ ስብሰባ ክትትል።",
    "mc.no_complaints": "የተመዘገበ ቅሬታ የለም።",
    "mc.cnt_unanswered": "ምላሽ ያልተሰጣቸው",
    "mc.cnt_in_review": "በግምገማ ላይ",
    "mc.cnt_resolved": "የተፈቱ",
    "mc.cnt_rejected": "አልተፈቀዱም",
    "mc.cnt_escalated": "የተላለፉ",
    "mc.filter_all": "ሁሉም",
    "mc.notifs_title": "ማሳወቂያዎች",
    "mc.notifs_subtitle": "ከቅርንጫፍ ኮሚቴዎች የተላለፉ ጉዳዮችና በከተማ ደረጃ ያሉ ምልክቶች።",
    "mc.no_notifs": "ማሳወቂያ የለም።",
    "mc.needs_review": "የዋና ግምገማ ይጠብቃል",
    "mc.needs_review_hint": "የመጀመሪያው ክልል በቅርንጫፍ ኮሚቴ ነው የተቀመጠው። ለማረጋገጥ ወይም ለመቀየር “አስተካክል” ይጫኑ።",
    "mc.accounts_title": "መለያዎች",
    "mc.accounts_subtitle": "በከተማ ውስጥ ያሉ አክቲቭ እና አክቲቭ ያልሆኑ መለያዎች።",
    "mc.acc_active": "አክቲቭ",
    "mc.acc_inactive": "አክቲቭ ያልሆነ",
    "mc.acc_total": "ጠቅላላ",
    "mc.acc_last_seen": "የመጨረሻ ሲሰራ {when}",
    "mc.acc_never_signed_in": "ገባ ያልገባ",
    "mc.acc_filter_all": "ሁሉም",
    "mc.no_accounts": "መለያ የለም።",

    // ---- notifications (cross-cutting) ----
    "notif.proposal_pending": "{owner} “{name}” ምርት ለግምገማ ጠቁሟል",
    "notif.proposal_approved": "የእርስዎ ጥቆማ “{name}” ፀድቆ ወደ ዝርዝሩ ታክሏል",
    "notif.proposal_rejected": "የእርስዎ ጥቆማ “{name}” አልተፈቀደም",
    "notif.price_change": "{shop} የ{product} ዋጋ ቀይሯል፡ {oldPrice} → {newPrice}",
    "notif.complaint_escalated": "ቅርንጫፍ ቅሬታ {id} ({type}) ለዋና ኮሚቴ አስተላልፏል",
    "notif.complaint_open": "በ{shop} ላይ አዲስ ቅሬታ ቀርቧል ({type})",
    "notif.product_added": "“{name}” አዲስ ምርት በ{branch} ወደ ዝርዝሩ ታክሏል (ክልል {min}–{max})",

    // ---- audit ----
    "audit.title": "የቁጥጥር ምዝገባ (የመጨረሻ 100 ክስተቶች)",
    "audit.subtitle": "የሥልጣንና የሕይወት-ዑደት ክስተቶች ብቻ-መጨመር ምዝገባ።",
    "audit.empty": "ገና ክስተት የለም።",

    // ---- theme ----
    "theme.title": "ገጽታ ይምረጡ",
    "theme.subtitle": "የሚስማማዎትን መልክ ይምረጡ። በመለያው ይቀመጣል።",
    "theme.toast": "ገጽታ፡ {name}",
    "theme.garden": "የአትክልት ስፍራ",
    "theme.garden.desc": "ሳጅ እና ሙቅ ክሬም",
    "theme.terracotta": "ቴራኮታ",
    "theme.terracotta.desc": "ሸክላና ፔች",
    "theme.sage": "ሳጅ ጋርደን",
    "theme.sage.desc": "ለስላሳ ሳጅና ቤጅ",
    "theme.rose": "ዱስቲ ሮዝ",
    "theme.rose.desc": "ሮዝና ሙቅ ቡኒ",
    "theme.mustard": "ሙስታርድ ሜዳ",
    "theme.mustard.desc": "ሙስታርድና ወርቅ",
    "theme.plum": "ፕለም",
    "theme.plum.desc": "ዱስቲ ፕለምና ሮዝ",
    "theme.midnight": "ሌሊት",
    "theme.midnight.desc": "ሙቅ ጨለማ ከወርቅ ጋር",

    // ---- status badges ----
    "status.created": "ተፈጥሯል",
    "status.paid": "ተከፍሏል",
    "status.accepted": "ተቀብሏል",
    "status.preparing": "በዝግጅት ላይ",
    "status.dispatched": "ተልኳል",
    "status.delivered": "ደርሷል",
    "status.completed": "ተጠናቋል",
    "status.cancelled": "ተሰርዟል",
    "status.refunded": "ገንዘብ ተመልሷል",
    "status.open": "ክፍት",
    "status.escalated": "ተላልፏል",
    "status.resolved": "ተፈትቷል",
    "status.rejected": "አልተፈቀደም",
    "status.pending": "በመጠባበቅ ላይ",
    "status.approved": "ተፈቅዷል",
    "status.suspended": "ታግዷል",
    "status.assigned": "ተመድቧል",
    "status.picked_up": "ተወሰዷል",
    "status.en_route": "በጉዞ ላይ",
  },
};

export function getLang() { return localStorage.getItem("gulit:v1:lang") || "en"; }
export function setLang(l) { localStorage.setItem("gulit:v1:lang", l); }

// Developer mode toggle. Set via ?dev=1 in the URL (persists), ?dev=0 to clear.
// Used to gate destructive demo controls (e.g., "Reset demo data") from
// regular users — only the developer should ever see them.
const DEV_KEY = "gulit:v1:dev";
export function isDev() {
  try {
    const param = new URLSearchParams(location.search).get("dev");
    if (param === "1") localStorage.setItem(DEV_KEY, "1");
    if (param === "0") localStorage.removeItem(DEV_KEY);
  } catch { /* search may not parse on file://; safe to ignore */ }
  return localStorage.getItem(DEV_KEY) === "1";
}

// t(key, fallback?, params?)  OR  t(key, params)
//   Examples: t("auth.welcome")
//             t("auth.welcome_user", { name: "Hana" })
//             t("status.unknown", "—")
export function t(key, fallbackOrParams, paramsArg) {
  let fallback = key, params = null;
  if (typeof fallbackOrParams === "string") fallback = fallbackOrParams;
  else if (fallbackOrParams && typeof fallbackOrParams === "object") params = fallbackOrParams;
  if (paramsArg && typeof paramsArg === "object") params = paramsArg;

  const lang = getLang();
  let s = (STR[lang] && STR[lang][key]) || STR.en[key] || fallback;
  if (params) s = s.replace(/\{(\w+)\}/g, (_, k) => params[k] != null ? params[k] : "");
  return s;
}

// ------------------ THEME ------------------
const THEME_KEY = "gulit:v1:theme";
const THEME_IDS = ["garden", "terracotta", "sage", "rose", "mustard", "plum", "midnight"];

export const THEMES = THEME_IDS.map(id => ({
  id,
  get name() { return t(`theme.${id}`); },
  get desc() { return t(`theme.${id}.desc`); },
}));

export function getTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  return THEME_IDS.includes(stored) ? stored : "garden";
}
export function setTheme(id) {
  if (!THEME_IDS.includes(id)) return;
  localStorage.setItem(THEME_KEY, id);
  applyTheme();
}
export function applyTheme() {
  document.documentElement.setAttribute("data-theme", getTheme());
}

export function openThemePicker() {
  const cur = getTheme();
  openModal(t("theme.title"), `
    <div class="muted">${t("theme.subtitle")}</div>
    <div class="theme-grid mt12">
      ${THEMES.map(th => `
        <button class="theme-card ${th.id === cur ? "selected" : ""}" data-id="${th.id}">
          <div class="theme-swatch"></div>
          <div>
            <div class="theme-name">${th.name}</div>
            <div class="theme-desc">${th.desc}</div>
          </div>
        </button>
      `).join("")}
    </div>
  `);
  document.querySelectorAll(".theme-card").forEach(btn => {
    btn.addEventListener("click", () => {
      setTheme(btn.dataset.id);
      const name = THEMES.find(x => x.id === btn.dataset.id)?.name || "";
      toast(t("theme.toast", { name }), "success");
      openThemePicker();
    });
  });
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
    <rect x="0" y="0" width="64" height="64" rx="18" fill="rgba(0,0,0,.04)"/>
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

const EYE_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19"/><path d="m1 1 22 22"/></svg>`;

// Simple form helper: build a form node from a schema. Password fields get a
// click-to-reveal eye button via the global delegate below.
export function formField({ label, name, type = "text", value = "", placeholder = "", options = null, required = false }) {
  const id = `f_${name}`;
  let input;
  if (type === "select") {
    const opts = (options || []).map(o => `<option value="${o.value}" ${o.value === value ? "selected" : ""}>${o.label}</option>`).join("");
    input = `<select id="${id}" name="${name}" ${required ? "required" : ""}>${opts}</select>`;
  } else if (type === "textarea") {
    input = `<textarea id="${id}" name="${name}" placeholder="${placeholder}" ${required ? "required" : ""}>${value || ""}</textarea>`;
  } else if (type === "password") {
    input = `
      <div class="pwwrap">
        <input id="${id}" name="${name}" type="password" placeholder="${placeholder}" value="${value ?? ""}" ${required ? "required" : ""} />
        <button type="button" class="pwtoggle" data-toggle-pw aria-label="${t("auth.show_password")}">${EYE_SVG}</button>
      </div>
    `;
  } else {
    input = `<input id="${id}" name="${name}" type="${type}" placeholder="${placeholder}" value="${value ?? ""}" ${required ? "required" : ""} />`;
  }
  return `<div class="fieldlabel">${label}${required ? " *" : ""}</div>${input}`;
}

// Global delegate: any [data-toggle-pw] button flips its sibling input
// between password and text type.
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-toggle-pw]");
  if (!btn) return;
  const input = btn.closest(".pwwrap")?.querySelector("input");
  if (!input) return;
  const showing = input.type === "password";
  input.type = showing ? "text" : "password";
  btn.innerHTML = showing ? EYE_OFF_SVG : EYE_SVG;
  btn.setAttribute("aria-label", showing ? t("auth.hide_password") : t("auth.show_password"));
});
