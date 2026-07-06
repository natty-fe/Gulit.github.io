import bcrypt from "bcrypt";
import { UserModel } from "../models/userModel.js";
import { writeAuditLog } from "../services/auditService.js";
import { httpError } from "../utils/httpError.js";

function publicUser(user) {
  if (!user) return null;
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

export async function checkUnique(req, res) {
  const { workId, faydaFan, excludeUserId } = req.body;
  const out = {};

  if (workId) {
    const found = await UserModel.findOne({ work_id: String(workId).trim().toUpperCase() });
    out.workIdTaken = Boolean(found && found.id !== excludeUserId);
  }

  if (faydaFan) {
    const found = await UserModel.findOne({ fayda_fan: String(faydaFan).replace(/\s+/g, "") });
    out.faydaFanTaken = Boolean(found && found.id !== excludeUserId);
  }

  res.json(out);
}

export async function listUsers(req, res) {
  const filters = {};
  if (req.query.role) filters.role = req.query.role;
  const users = await UserModel.list(filters);
  res.json(users.map(publicUser));
}

export async function updateMe(req, res) {
  const current = await UserModel.findById(req.user.id);
  if (!current) throw httpError(404, "User not found.");

  const patch = {};
  const { name, email, phone, subCity, currentPassword, newPassword, faydaFan, avatar } = req.body;

  if (name !== undefined) patch.name = name;
  if (email !== undefined) patch.email = email || null;
  if (phone !== undefined) patch.phone = phone || null;
  if (avatar !== undefined) patch.avatar = avatar || null;

  if (subCity !== undefined && subCity !== current.sub_city) {
    if (current.role !== "customer") {
      throw httpError(403, "Sub-city changes require committee approval.");
    }
    patch.sub_city = subCity || null;
  }

  if (faydaFan !== undefined && current.role !== "customer") {
    const fanDigits = String(faydaFan || "").replace(/\s+/g, "");
    if (fanDigits && !/^\d{16}$/.test(fanDigits)) {
      throw httpError(400, "Fayda FAN must be exactly 16 digits.");
    }
    patch.fayda_fan = fanDigits || null;
  }

  if (newPassword) {
    if (!currentPassword) throw httpError(400, "Current password required to change password.");
    const ok = await bcrypt.compare(currentPassword, current.password_hash || "");
    if (!ok) throw httpError(401, "Current password is incorrect.");
    patch.password_hash = await bcrypt.hash(newPassword, 12);
  }

  const updated = await UserModel.update(req.user.id, patch);
  await writeAuditLog(req.user.id, "PROFILE_UPDATED", "user", req.user.id, { changedPassword: Boolean(newPassword) });
  res.json({ user: publicUser(updated) });
}

export async function deleteMe(req, res) {
  const current = await UserModel.findById(req.user.id);
  if (!current) throw httpError(404, "User not found.");

  const { password, confirmName } = req.body;
  if (!confirmName || confirmName.trim().toLowerCase() !== String(current.name || "").trim().toLowerCase()) {
    throw httpError(400, "The name you entered doesn't match your account.");
  }

  const ok = await bcrypt.compare(password || "", current.password_hash || "");
  if (!ok) throw httpError(401, "Password is incorrect.");

  await writeAuditLog(req.user.id, "ACCOUNT_DELETED", "user", req.user.id);
  await UserModel.remove(req.user.id);
  res.status(204).send();
}
