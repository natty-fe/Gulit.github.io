import bcrypt from "bcrypt";
import crypto from "crypto";
import { UserModel } from "../models/userModel.js";
import { signToken } from "../services/tokenService.js";
import { writeAuditLog } from "../services/auditService.js";
import { sendPasswordResetEmail, sendWelcomeEmail } from "../services/mailService.js";
import { httpError } from "../utils/httpError.js";

const SALT_ROUNDS = 12;
const RESET_TOKEN_MINUTES = 15;

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function publicUser(user) {
  const { password_hash, passwordHash, ...safe } = user;
  return {
    ...safe,
    subCity: safe.sub_city ?? safe.subCity ?? null,
    committeeId: safe.committee_id ?? safe.committeeId ?? null,
    workId: safe.work_id ?? safe.workId ?? null,
    faydaFan: safe.fayda_fan ?? safe.faydaFan ?? null,
    createdAt: safe.created_at ?? safe.createdAt ?? null,
  };
}

export async function register(req, res) {
  const { name, email, phone, password, role, subCity, committeeId, workId, faydaFan, avatar } = req.body;
  const exists = await UserModel.emailOrPhoneExists({ email, phone });
  if (exists) throw httpError(409, "An account with that email or phone already exists.");

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await UserModel.create({
    name,
    email: email || null,
    phone: phone || null,
    password_hash: passwordHash,
    role,
    sub_city: subCity || null,
    committee_id: committeeId || null,
    work_id: workId || null,
    fayda_fan: faydaFan || null,
    avatar: avatar || null,
  });

  await writeAuditLog(user.id, "REGISTER", "user", user.id);
  try {
    await sendWelcomeEmail(user);
  } catch (err) {
    console.warn("Welcome email failed:", err.message);
  }
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
}

export async function login(req, res) {
  const { identifier, password } = req.body;
  const user = await UserModel.findByIdentifier(identifier);
  if (!user) throw httpError(401, "Invalid email/phone or password.");

  const passwordHash = user.password_hash || user.passwordHash;
  const ok = passwordHash ? await bcrypt.compare(password, passwordHash) : false;
  if (!ok) throw httpError(401, "Invalid email/phone or password.");

  let seenUser = user;
  try {
    seenUser = await UserModel.update(user.id, { updated_at: new Date().toISOString() }) || user;
  } catch (err) {
    console.warn("Failed to update user last-seen timestamp:", err.message);
  }

  await writeAuditLog(user.id, "LOGIN", "user", user.id);
  res.json({ token: signToken(seenUser), user: publicUser(seenUser) });
}

export async function forgotPassword(req, res) {
  const { identifier } = req.body;
  const user = await UserModel.findByIdentifier(identifier);
  const genericMessage = "If an account exists, password reset instructions have been prepared.";

  if (!user) {
    return res.json({ message: genericMessage });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  await UserModel.update(user.id, {
    password_reset_token_hash: hashResetToken(resetToken),
    password_reset_expires_at: new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000).toISOString(),
  });
  await writeAuditLog(user.id, "PASSWORD_RESET_REQUESTED", "user", user.id);
  let emailResult = { sent: false, reason: "Email service was not attempted." };
  try {
    emailResult = await sendPasswordResetEmail(user, resetToken);
    console.info("Password reset email result:", {
      sent: Boolean(emailResult.sent),
      provider: emailResult.provider || "none",
      reason: emailResult.reason || null,
      to: user.email,
    });
  } catch (err) {
    emailResult = { sent: false, reason: err.message };
    console.warn("Password reset email failed:", err.message);
  }
  const emailSent = Boolean(emailResult.sent);

  res.json({
    message: emailSent
      ? "Password reset email sent."
      : `Reset token was created, but email was not sent: ${emailResult.reason || "Email service failed."}`,
    emailSent,
    emailProvider: emailResult.provider || null,
    ...(process.env.NODE_ENV !== "production" ? { resetToken, expiresInMinutes: RESET_TOKEN_MINUTES } : {}),
  });
}

export async function resetPassword(req, res) {
  const { token, password } = req.body;
  const user = await UserModel.findByResetTokenHash(hashResetToken(token));
  if (!user || !user.password_reset_expires_at || new Date(user.password_reset_expires_at).getTime() < Date.now()) {
    throw httpError(400, "Invalid or expired reset token.");
  }

  await UserModel.update(user.id, {
    password_hash: await bcrypt.hash(password, SALT_ROUNDS),
    password_reset_token_hash: null,
    password_reset_expires_at: null,
  });
  await writeAuditLog(user.id, "PASSWORD_RESET_COMPLETED", "user", user.id);

  res.json({ message: "Password reset successfully." });
}

export async function me(req, res) {
  res.json({ user: req.user });
}
