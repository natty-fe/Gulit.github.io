import nodemailer from "nodemailer";
import dns from "node:dns";
import { env } from "../config/env.js";

dns.setDefaultResultOrder("ipv4first");

let transporter = null;

function lookupIpv4(hostname, options, callback) {
  dns.lookup(hostname, { ...options, family: 4 }, callback);
}

function isResendConfigured() {
  return Boolean(env.resendApiKey && env.emailFrom);
}

function isBrevoConfigured() {
  return Boolean(env.brevoApiKey && env.brevoFrom);
}

function isSmtpConfigured() {
  return Boolean(env.smtpHost && env.smtpPort && env.smtpUser && env.smtpPass && env.smtpFrom);
}

function parseSender(value) {
  const match = String(value || "").match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    return {
      name: match[1] || "Gulit",
      email: match[2],
    };
  }
  return {
    name: "Gulit",
    email: value,
  };
}

function getTransporter() {
  if (!isSmtpConfigured()) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    family: 4,
    lookup: lookupIpv4,
    tls: {
      servername: env.smtpHost,
    },
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });
  return transporter;
}

async function sendWithResend({ to, subject, text, html }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.emailFrom,
      to,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend email failed with status ${response.status}: ${body}`);
  }

  return { sent: true, provider: "resend" };
}

async function sendWithBrevo({ to, subject, text, html }) {
  const sender = parseSender(env.brevoFrom);
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": env.brevoApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender,
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brevo email failed with status ${response.status}: ${body}`);
  }

  return { sent: true, provider: "brevo" };
}

async function sendWithSmtp({ to, subject, text, html }) {
  const tx = getTransporter();
  if (!tx) return { sent: false, reason: "Email is not configured." };

  await tx.sendMail({
    from: env.smtpFrom,
    to,
    subject,
    text,
    html,
  });
  return { sent: true, provider: "smtp" };
}

export async function sendMail({ to, subject, text, html }) {
  if (!to) return { sent: false, reason: "Recipient email is missing." };

  if (isBrevoConfigured()) {
    return sendWithBrevo({ to, subject, text, html });
  }

  if (isResendConfigured()) {
    return sendWithResend({ to, subject, text, html });
  }

  if (isSmtpConfigured()) {
    return sendWithSmtp({ to, subject, text, html });
  }

  return { sent: false, reason: "Email is not configured." };
}

export async function sendWelcomeEmail(user) {
  if (!user?.email) return { sent: false, reason: "User has no email." };
  return sendMail({
    to: user.email,
    subject: "Welcome to Gulit",
    text: `Hello ${user.name}, your Gulit account has been created successfully.`,
    html: `<p>Hello ${user.name},</p><p>Your Gulit account has been created successfully.</p>`,
  });
}

export async function sendPasswordResetEmail(user, resetToken) {
  if (!user?.email) return { sent: false, reason: "User has no email." };
  const resetUrl = `${env.frontendUrl.replace(/\/$/, "")}/#/auth`;
  return sendMail({
    to: user.email,
    subject: "Reset your Gulit password",
    text: [
      `Hello ${user.name},`,
      "",
      "Use this reset token in the Gulit forgot-password form:",
      resetToken,
      "",
      `Open Gulit: ${resetUrl}`,
      "",
      "This token expires in 15 minutes.",
    ].join("\n"),
    html: `
      <p>Hello ${user.name},</p>
      <p>Use this reset token in the Gulit forgot-password form:</p>
      <p><strong>${resetToken}</strong></p>
      <p><a href="${resetUrl}">Open Gulit</a></p>
      <p>This token expires in 15 minutes.</p>
    `,
  });
}
