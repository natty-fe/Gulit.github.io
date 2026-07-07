# GULIT - Multilingual Agricultural Marketplace

Gulit is a multilingual agricultural marketplace built for customers, shop owners, delivery staff, branch committees, and the main committee. The frontend is plain HTML/CSS/JavaScript, and it now talks to a Node.js + Express REST API (MVC-style) sitting in front of Supabase PostgreSQL.

## Architecture

```text
Frontend
  -> Express REST API
  -> Routes
  -> Controllers
  -> Models
  -> Supabase PostgreSQL
```

The browser doesn't talk to Supabase directly. Auth, authorization, validation, password hashing, JWTs, logging, and all database access live in the Express backend.

## Tech Stack

- Frontend: HTML, CSS, JavaScript ES modules
- Backend: Node.js, Express.js
- Database: Supabase PostgreSQL
- Auth: bcrypt for password hashing, JWT for sessions
- Security: Helmet, CORS, input validation, environment variables
- Logging: Morgan for requests, plus audit log records
- Validation: express-validator

## Folder Structure

```text
.
├── index.html
├── css/
├── js/
│   ├── api.js
│   ├── auth.js
│   ├── http.js
│   └── views/
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── schema.sql
│   ├── .env.example
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── models/
│       ├── routes/
│       ├── services/
│       └── utils/
└── supabase-migration.sql
```

## Installation

Install backend dependencies:

```bash
cd backend
npm install
```

Copy the backend environment example:

```bash
copy .env.example .env
```

Then fill in `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and a strong `JWT_SECRET`.

## Environment Variables

Backend:

```text
PORT=3000
NODE_ENV=development
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1d
CORS_ORIGIN=http://localhost:8080,https://natty-fe.github.io
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=http://localhost:8080
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM="Gulit <onboarding@resend.dev>"
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-brevo-smtp-login
SMTP_PASS=your-brevo-smtp-key
SMTP_FROM="Gulit <your-verified-sender@example.com>"
```

Frontend API URL:

```js
// js/api-config.js
export const API_BASE_URL = override || (isLocal ? "http://localhost:3000/api" : "");
```

GitHub Pages only serves static files, so it can't run Express on its own. Deploy the `backend/` folder to a Node host like Render, Railway, Fly.io, or a VPS, then point the frontend at it before `js/main.js` loads:

```html
<script>
  window.GULIT_API_BASE_URL = "https://your-backend.example.com/api";
</script>
```

For quick testing from the browser console, this also works:

```js
localStorage.setItem("gulit:v1:apiBaseUrl", "https://your-backend.example.com/api");
```

## Deploying With GitHub Pages + Render

GitHub Pages hosts the static frontend only — the Express API needs to run on a Node host.

1. Push this repository to GitHub.
2. In Render, create a new **Blueprint** or **Web Service** from the repository.
3. If you're using the included `render.yaml`, Render will read:
   - root directory: `backend`
   - build command: `npm install`
   - start command: `npm start`
   - health check: `/health`
4. Add these secret environment variables in Render:
   - `JWT_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - Optional SMTP fallback: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
5. Once Render deploys, grab the backend URL, e.g.:
   `https://gulit-api.onrender.com`
6. From the GitHub Pages frontend, point it at that backend once via the browser console:

```js
localStorage.setItem("gulit:v1:apiBaseUrl", "https://gulit-api.onrender.com/api");
location.reload();
```

To make that permanent, add this before `js/main.js` in `index.html`:

```html
<script>
  window.GULIT_API_BASE_URL = "https://gulit-api.onrender.com/api";
</script>
```

## Forgot Password Email

The backend sends forgot-password emails from `POST /api/auth/forgot-password`.

Recommended free setup:

1. Create a Resend account.
2. Generate an API key in Resend.
3. Add these variables in Render:

```text
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=Gulit <onboarding@resend.dev>
```

Resend's default sender works fine for testing. For real users, verify your own sender/domain in Resend and point `EMAIL_FROM` at it.

Brevo SMTP is still supported as a fallback, but Resend is the better default since it sends over HTTPS and skips SMTP IP allowlisting entirely.

## Running

Start the backend:

```bash
cd backend
npm start
```

Start the frontend from the project root:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Database Schema

Run `backend/schema.sql` in the Supabase SQL Editor. It creates the backend-facing relational tables:

- `users`
- `products`
- `shops`
- `orders`
- `complaints`
- `audit_logs`

`supabase-migration.sql` is still around for the earlier Supabase profile migration, but the Express API runs on `backend/schema.sql`.

## REST API

Authentication:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/me
```

Products:

```text
GET    /api/products
GET    /api/products/:id
POST   /api/products
PUT    /api/products/:id
DELETE /api/products/:id
```

Orders:

```text
GET  /api/orders
GET  /api/orders/:id
POST /api/orders
PUT  /api/orders/:id
```

Complaints:

```text
GET  /api/complaints
POST /api/complaints
```

Shops:

```text
GET  /api/shops
GET  /api/shops/:id
POST /api/shops
PUT  /api/shops/:id
PUT  /api/shops/:id/approve
```

Users:

```text
GET    /api/users?role=delivery
POST   /api/users/check-unique
PUT    /api/users/me
DELETE /api/users/me
```

## Security Notes

- Passwords are hashed with bcrypt before they're stored.
- JWTs are signed by the backend and verified on every protected route.
- Role authorization is enforced with `authorizeRole(...)`.
- Helmet is on.
- CORS is locked down via `CORS_ORIGIN`.
- Validation errors come back as HTTP 400 with useful details.
- Supabase service-role credentials should never leave the backend `.env`.

## Features That Existed Before This Update

These were already part of Gulit before the Express + Supabase backend was added, and they all still work the same way from a user's perspective.

**Multiple user roles**
Customers, shop owners, delivery staff, branch committees, and the main committee each get their own view and permissions. The app behaves differently depending on who's logged in.

**Responsive UI**
The layout adjusts to phones, tablets, and desktops, so people can browse and manage orders from whatever device they have on hand.

**Bilingual interface**
The whole app can switch between two languages, so both language groups in the target market can use it comfortably.

**Shop approval workflow**
New shops don't go live automatically. A committee member has to review and approve them first, which keeps the marketplace from filling up with unverified sellers.

**Order and delivery workflow**
Orders move through clear stages, from placed to delivered, and delivery staff have their own screens to track and update what they're carrying.

**Complaint handling**
Customers can file complaints about orders or shops, and committees have a place to review and act on them instead of things getting lost in chat or email.

**Audit logging**
Key actions get recorded, so there's a trail to check later if something needs to be investigated or double-checked.

**Product browsing and regulated marketplace flows**
Shoppers can browse listings like a normal marketplace, but certain product types follow extra rules to keep the marketplace compliant with agricultural regulations.