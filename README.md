# GULIT - Market Price Management System

GULIT is a bilingual marketplace and price management system built for agricultural markets. It handles customers, shop owners, delivery workers, branch committee members, and the main committee, and covers approved shops, regulated product prices, inventory, orders, deliveries, complaints, and password reset emails.

## Background

The first version of this project was a Supabase + HTML/CSS/JavaScript app. It already had the frontend pages, product browsing, the different user role screens, the shop workflow, the delivery workflow, complaint screens, a bilingual UI, themes, and local fallback data.

For the Web Programming II final project, it got rebuilt into a full-stack app with a Node.js/Express backend: a REST API, MVC structure, JWT authentication, password hashing, authorization, logging, and SQL schema files.

## Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- Database: Supabase (PostgreSQL)
- API: REST
- Auth: JWT
- Password security: bcrypt
- Validation: express-validator
- Logging: Morgan + audit logs
- Email: SMTP / Resend-compatible service
- Deployment: GitHub Pages (frontend), Render (backend)
- Version control: Git and GitHub

## Features

- Role-based accounts for customers, owners, delivery workers, branch committee, and main committee
- Login, registration, JWT sessions, and forgot-password email
- Product catalog with regulated price ranges
- Shop registration and approval
- Owner inventory listing
- Customer product browsing and ordering
- Order queue for shop owners
- Delivery assignment and a queue for delivery workers
- Complaint creation and review
- Audit logs for important actions
- Bilingual, responsive interface with multiple themes

## Architecture

MVC-style backend:

```text
Frontend
  -> Express REST API routes
  -> Controllers
  -> Models
  -> Supabase PostgreSQL
```

Folder layout:

```text
backend/src/routes/        API route definitions
backend/src/controllers/   Business logic
backend/src/models/        Database access
backend/src/middleware/    Auth, validation, and error middleware
backend/src/services/      JWT, email, and audit services
js/views/                  Frontend screens
```

## Setup

Clone the repo:

```bash
git clone https://github.com/natty-fe/Gulit.github.io.git
cd Gulit.github.io
```

Install backend dependencies:

```bash
cd backend
npm install
```

Copy the environment file:

```bash
copy .env.example .env
```

Fill in `backend/.env`:

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1d
CORS_ORIGIN=http://localhost:8080,https://natty-fe.github.io
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=http://localhost:8080
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-email-app-password
SMTP_FROM=Gulit <your-email@gmail.com>
```

Start the backend:

```bash
cd backend
npm start
```

Start the frontend from the project root:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Database

The main schema lives in `backend/schema.sql`. A few migration/helper files add extra tables and columns on top of that:

```text
backend/add-inventory-table.sql
backend/add-deliveries-table.sql
backend/add-product-price-range-columns.sql
backend/reset-users-and-marketplace-data.sql
```

Tables: `users`, `products`, `shops`, `inventory`, `orders`, `deliveries`, `complaints`, `audit_logs`.

## API

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/me

GET/POST/PUT/DELETE /api/products
GET/POST/PUT        /api/shops
GET/POST/PUT        /api/inventory
GET/POST/PUT        /api/orders
GET/POST/PUT        /api/deliveries
GET/POST            /api/complaints
GET/PUT/DELETE      /api/users
```

## Security and logging

Passwords are hashed with bcrypt, and JWT handles token-based sessions. Protected routes require a valid token, and role-based authorization decides what each user type can actually do. The Supabase service-role key stays in backend environment variables only, and `.env` is git-ignored. Morgan logs HTTP requests, and important actions get written to an audit log in the database.

## Beyond the basic requirements

On top of what the course asked for, this build adds Supabase PostgreSQL integration, GitHub Pages + Render deployment, forgot-password and welcome emails, price regulation by the main committee, shop approval, inventory display rules, delivery assignment, a complaint workflow, a bilingual and responsive UI with theme switching, and local fallback data.

## Deployment

Frontend runs on GitHub Pages, backend on Render. Render config is in `render.yaml`.

## Repository

https://github.com/natty-fe/Gulit.github.io
