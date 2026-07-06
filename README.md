# GULIT - Multilingual Agricultural Marketplace

Gulit is a multilingual agricultural marketplace for customers, shop owners, delivery staff, branch committees, and the main committee. The frontend is a plain HTML/CSS/JavaScript application, and the project now includes a Node.js + Express REST API using MVC architecture in front of Supabase PostgreSQL.

## Architecture

```text
Frontend
  -> Express REST API
  -> Routes
  -> Controllers
  -> Models
  -> Supabase PostgreSQL
```

The browser no longer needs to call Supabase directly. Authentication, authorization, validation, password hashing, JWT handling, logging, and database access are owned by the Express backend.

## Technology Stack

- Frontend: HTML, CSS, JavaScript ES modules
- Backend: Node.js, Express.js
- Database: Supabase PostgreSQL
- Auth: bcrypt password hashing and JWT
- Security: Helmet, CORS, input validation, environment variables
- Logging: Morgan request logging plus audit log records
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

Backend variables:

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

For GitHub Pages, the frontend is static and cannot run Express by itself. Deploy the `backend/` folder to a Node host such as Render, Railway, Fly.io, or a VPS, then set the API URL before `js/main.js` loads:

```html
<script>
  window.GULIT_API_BASE_URL = "https://your-backend.example.com/api";
</script>
```

For quick testing from the browser console, you can also run:

```js
localStorage.setItem("gulit:v1:apiBaseUrl", "https://your-backend.example.com/api");
```

## Deploying With GitHub Pages + Render

GitHub Pages hosts only the static frontend. The Express API must run on a Node host.

1. Push this repository to GitHub.
2. In Render, create a new **Blueprint** or **Web Service** from the repository.
3. If using the included `render.yaml`, Render reads:
   - root directory: `backend`
   - build command: `npm install`
   - start command: `npm start`
   - health check: `/health`
4. Add the secret environment variables in Render:
  - `JWT_SECRET`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - Optional SMTP fallback: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
5. After Render deploys, copy the backend URL, for example:
   `https://gulit-api.onrender.com`
6. In the GitHub Pages frontend, set the API URL from the browser console once:

```js
localStorage.setItem("gulit:v1:apiBaseUrl", "https://gulit-api.onrender.com/api");
location.reload();
```

For a permanent frontend setting, add this before `js/main.js` in `index.html`:

```html
<script>
  window.GULIT_API_BASE_URL = "https://gulit-api.onrender.com/api";
</script>
```

## Forgot Password Email

The backend sends forgot-password messages from `POST /api/auth/forgot-password`.

Recommended free setup:

1. Create a Resend account.
2. Create an API key in Resend.
3. Add these variables in Render:

```text
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM=Gulit <onboarding@resend.dev>
```

For testing, Resend's default sender can be used. For real users, verify your own sender/domain in Resend and set `EMAIL_FROM` to that verified sender.

Brevo SMTP variables are still supported as a fallback, but Resend is preferred because it uses HTTPS API email sending and does not need SMTP IP allowlisting.

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

Open:

```text
http://localhost:8080
```

## Database Schema

Run `backend/schema.sql` in Supabase SQL Editor. It creates backend-facing relational tables for:

- `users`
- `products`
- `shops`
- `orders`
- `complaints`
- `audit_logs`

The previous `supabase-migration.sql` remains available for the earlier Supabase profile migration, but the Express API uses `backend/schema.sql`.

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

- Passwords are hashed with bcrypt before storage.
- JWTs are signed by the backend and verified by protected routes.
- Role authorization is enforced with `authorizeRole(...)`.
- Helmet is enabled.
- CORS is restricted by `CORS_ORIGIN`.
- Validation errors return HTTP 400 with useful details.
- Sensitive Supabase service-role credentials must stay only in backend `.env`.

## Extra Features Preserved

- Multiple user roles
- Responsive UI
- Bilingual interface
- Shop approval workflow
- Order and delivery workflow
- Complaint handling
- Audit logging
- Product browsing and regulated marketplace flows
