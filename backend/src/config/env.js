import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "replace-with-a-long-random-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:8080")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  smtpFrom: process.env.SMTP_FROM || process.env.SMTP_USER,
  brevoApiKey: process.env.BREVO_API_KEY,
  brevoFrom: process.env.BREVO_FROM || process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER,
  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER,
  frontendUrl: process.env.FRONTEND_URL || "https://natty-fe.github.io/Gulit.github.io",
};

if (!env.supabaseUrl) {
  throw new Error("SUPABASE_URL is required.");
}

if (!env.supabaseServiceRoleKey) {
  console.warn("SUPABASE_SERVICE_ROLE_KEY is not set. Supabase writes will fail until it is configured.");
}
