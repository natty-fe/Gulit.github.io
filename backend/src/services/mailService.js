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

function firstNameOf(user) {
  return String(user?.name || "there").trim().split(/\s+/)[0] || "there";
}

function lastNameOf(user) {
  const parts = String(user?.name || "").trim().split(/\s+/).filter(Boolean);
  return parts.slice(1).join(" ");
}

function fullNameOf(user) {
  const firstName = firstNameOf(user);
  const lastName = lastNameOf(user);
  return `${firstName}${lastName ? ` ${lastName}` : ""}`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
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
  const fullName = fullNameOf(user);
  const supportEmail = "nathanfeyisa6@gmail.com";
  const appUrl = `${env.frontendUrl.replace(/\/$/, "")}/`;
  const text = [
    "\u2705 Your GULIT account has been created successfully!",
    "",
    `Hi ${fullName},`,
    "",
    "Welcome to GULIT, the marketplace bringing the traditional market online, with fair, regulated pricing, verified shops, and orders you can track from checkout to delivery.",
    "",
    `Start Browsing \u2192 ${appUrl}`,
    "",
    `Questions or issues? We're here: ${supportEmail}`,
  ].join("\n");

  return sendMail({
    to: user.email,
    subject: "Welcome to GULIT \u2014 your account is ready",
    text,
    html: `
      <p>&#9989; <strong>Your GULIT account has been created successfully!</strong></p>
      <p>Hi ${escapeHtml(fullName)},</p>
      <p>Welcome to GULIT, the marketplace bringing the traditional market online, with fair, regulated pricing, verified shops, and orders you can track from checkout to delivery.</p>
      <p><strong><a href="${appUrl}">Start Browsing &rarr;</a></strong> ${appUrl}</p>
      <p>Questions or issues? We're here: <a href="mailto:${supportEmail}">${supportEmail}</a></p>
    `,
  });
}

export async function sendPasswordResetEmail(user, resetToken) {
  if (!user?.email) return { sent: false, reason: "User has no email." };
  const fullName = fullNameOf(user);
  const resetUrl = `${env.frontendUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const supportEmail = "nathanfeyisa6@gmail.com";

  return sendMail({
    to: user.email,
    subject: "Reset your GULIT password",
    text: [
      "\uD83D\uDD11 Password reset requested",
      "",
      `Hi ${fullName},`,
      "",
      "We got a request to reset your GULIT password. Click below to choose a new one, this link expires in 10 minutes.",
      "",
      `Reset Password \u2192 ${resetUrl}`,
      "",
      `use this token = ${resetToken}`,
      "",
      "Didn't request this? You can safely ignore this email, your password won't change.",
      "",
      `Need help? We're here: ${supportEmail}`,
    ].join("\n"),
    html: `
      <p>&#128273; <strong>Password reset requested</strong></p>
      <p>Hi ${escapeHtml(fullName)},</p>
      <p>We got a request to reset your GULIT password. Click below to choose a new one, this link expires in 10 minutes.</p>
      <p><strong><a href="${resetUrl}">Reset Password &rarr;</a></strong></p>
      <p>use this token = <a href="${resetUrl}"><strong>${escapeHtml(resetToken)}</strong></a></p>
      <p>Didn't request this? You can safely ignore this email, your password won't change.</p>
      <p>Need help? We're here: <a href="mailto:${supportEmail}">${supportEmail}</a></p>
    `,
  });
}
