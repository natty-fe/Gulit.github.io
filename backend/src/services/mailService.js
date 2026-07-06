import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let transporter = null;

function isMailConfigured() {
  return Boolean(env.smtpHost && env.smtpPort && env.smtpUser && env.smtpPass && env.smtpFrom);
}

function getTransporter() {
  if (!isMailConfigured()) return null;
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });
  return transporter;
}

export async function sendMail({ to, subject, text, html }) {
  const tx = getTransporter();
  if (!tx || !to) return { sent: false, reason: "SMTP is not configured." };

  await tx.sendMail({
    from: env.smtpFrom,
    to,
    subject,
    text,
    html,
  });
  return { sent: true };
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
