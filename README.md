# GULIT — Bilingual Market Price Management System

A full-stack-shaped, **frontend-only** marketplace prototype for the Ethiopian *gulit* (local market) ecosystem. Implements regulated pricing, multi-role workflows (customer, shop owner, delivery, branch committee, main committee), order/delivery lifecycles, and dispute handling with audit trails — all persisted in the browser via `localStorage` so it deploys cleanly to **GitHub Pages**.

The architecture mirrors a real backend: a `db.js` table layer underneath an `api.js` REST-like surface. To upgrade to a real backend (Spring Boot, Node, etc.) you swap `js/api.js` for `fetch()` calls — views, state, and routing don't need to change.

---

## Features

### Roles
| Role             | Capabilities |
|------------------|--------------|
| **Customer**     | Browse regulated prices by sub-city, view shops/reviews, cart & checkout (pay-now or COD), order tracking with OTP, submit complaints / refund requests |
| **Shop Owner**   | Register shops (pending committee approval), manage inventory with price-range validation, accept/reject orders, assign deliveries, update fulfilment |
| **Delivery**     | View assigned deliveries, advance status, confirm with customer OTP |
| **Branch Committee** | Approve/reject pending shops in jurisdiction, decide complaints (approve refund / reject / escalate) |
| **Main Committee**   | Set regulated min/max price ranges per product, review escalated cases, browse audit log |

### System
- **Auth** — SHA-256 password hashing (Web Crypto), opaque session tokens, persisted across reloads.
- **RBAC** — every API method enforces role checks (`Auth.require([...])`).
- **Price-range enforcement** — listing and ordering reject prices outside the regulated band.
- **Audit log** — append-only events for registration, login, shop status, price changes, order/delivery status, complaint decisions, refunds.
- **Bilingual** — EN / አማርኛ toggle in the topbar.
- **Mobile-first** — responsive layout, role-aware bottom navigation.

---

## Quick start

### 1. Run locally
ES modules require an HTTP origin (don't open `index.html` via `file://` — browsers block module imports there).

```bash
# any of these works:
python -m http.server 8080
# or
npx http-server -p 8080
# or
php -S localhost:8080
```

Then open <http://localhost:8080>.

### 2. Demo accounts
All demo accounts use password **`demo1234`**:

| Role     | Email                 |
|----------|------------------------|
| Customer | hana@example.com       |
| Owner    | abebe@example.com      |
| Delivery | yonas@example.com      |
| Branch   | branch@example.com     |
| Main     | main@example.com       |

You can create your own customer / owner / delivery account from the **Create account** tab. Branch and Main Committee accounts are provisioned by administrators (seed-only in this demo).

### 3. Reset
Sign in → **Account** → **Reset demo data** wipes `localStorage` and re-seeds.

---

## End-to-end demo flow

1. Sign in as **hana** (customer) → Browse → add Onion + Tomato to cart → Checkout (Pay now).
2. Sign out → sign in as **abebe** (owner) → see the new order in the queue → **Accept** → **Mark preparing** → **Assign delivery** to *yonas* (an OTP is generated).
3. Sign in as **hana** again → Track → tap the order → see your **OTP** displayed.
4. Sign in as **yonas** (delivery) → mark *accepted → picked up → en route* → **Confirm with OTP** (enter the OTP from step 3).
5. Sign in as **hana** → submit a complaint on the order.
6. Sign in as **branch** → see the complaint → **Approve refund** (since payment was prepay, a refund is auto-issued and the order moves to *Refunded*).
7. Sign in as **main** → open **Audit log** to see the full trail.

---

## Architecture

```
index.html
├── css/styles.css
└── js/
    ├── main.js          ← bootstrap (seed → hydrate → topbar/nav → router)
    ├── router.js        ← hash routes, role guards
    ├── state.js         ← tiny pub-sub for user + cart + filters
    ├── db.js            ← table layer over localStorage (insert/find/update)
    ├── seed.js          ← initial data + demo accounts (idempotent, force-able)
    ├── auth.js          ← SHA-256 hash, sessions, role guard
    ├── api.js           ← REST-like surface: Products, Shops, Inventory,
    │                       PriceRanges, Orders, Deliveries, Complaints, Audit
    └── views/
        ├── shared.js    ← toast, modal, icons, formatters, i18n, status badge
        ├── customer.js  ← auth, home, shops, cart, checkout, tracking, account
        ├── owner.js     ← orders queue, inventory, shop registration
        ├── delivery.js  ← deliveries list with OTP confirmation
        └── committee.js ← branch (shop approvals, complaints), main (ranges, audit)
```

### Data model

| Table         | Purpose                                            |
|---------------|----------------------------------------------------|
| users         | Customers, owners, delivery, committee members     |
| committees    | Main + per-sub-city branch committees              |
| shops         | Owner-operated shops (pending → approved)          |
| products      | Catalog (name, category, unit, icon)               |
| priceRanges   | Regulated min/max per product (newest wins)        |
| inventory     | Per-shop stock + price (validated against range)   |
| orders        | Header + line items + payment + status             |
| deliveries    | Order ↔ courier link with OTP and status           |
| complaints    | Disputes scoped to a branch committee              |
| refunds       | Auto-issued when committee approves a prepaid case |
| auditLogs     | Append-only governance/lifecycle events            |
| sessions      | Active session tokens                              |
| meta          | Singleton (seed version, etc.)                     |

### REST-like surface

```
Products.list, Products.byId
Shops.list, Shops.byId, Shops.byOwner, Shops.register, Shops.setStatus, Shops.addReview
Inventory.byShop, Inventory.byId, Inventory.upsert, Inventory.listingsForBrowse
PriceRanges.list, PriceRanges.byProduct, PriceRanges.set
Orders.create, Orders.list, Orders.byId, Orders.updateStatus, Orders.assignDelivery
Deliveries.list, Deliveries.byId, Deliveries.updateStatus, Deliveries.confirm
Complaints.create, Complaints.list, Complaints.decide
Audit.list
Users.listByRole
Committees.list
```

### Order lifecycle

```
created ──► paid ──► accepted ──► preparing ──► dispatched ──► delivered ──► completed
   │                       │
   └──► cancelled          └──► refunded (when committee approves a prepay complaint)
```

### Delivery lifecycle

```
assigned ──► accepted ──► picked_up ──► en_route ──► delivered (OTP-confirmed)
```

---

## Deploy to GitHub Pages

This repository follows the `username.github.io` convention, so the project root is served directly:

1. Push to `main` (or `master`).
2. **Settings → Pages →** *Source: Deploy from a branch*, *Branch: `main` / `(root)`*.
3. Open `https://natty-fe.github.io/Gulit.github.io/` (or the URL Pages reports).

No build step. The app is plain ES modules, plain CSS, and plain HTML.

---

## Upgrading to a real backend

The PDF spec describes a Spring Boot + PostgreSQL implementation. To plug one in:

1. Stand up the backend with the same endpoint surface as `js/api.js`.
2. Replace each method body with a `fetch()` call:
   ```js
   async list({ subCity } = {}) {
     const r = await fetch(`/api/shops?subCity=${encodeURIComponent(subCity || '')}`,
                          { headers: { Authorization: `Bearer ${token()}` } });
     if (!r.ok) throw new Error((await r.json()).message);
     return r.json();
   },
   ```
3. Replace `Auth` with token storage from your real `/auth/login` response.

No view code needs to change — they only call into `Products.*`, `Orders.*`, etc.

---

## Project context

This is the implementation companion to **GulitApp – Bilingual Market Price Management System**, a Software Engineering final project at American College of Technology (Section B, Group 7). The architecture, data model, role permissions, and audit requirements follow the project's UML and database design documents.

---

## License

MIT — see source headers. Free to use as a starting point for similar marketplace + governance systems.
