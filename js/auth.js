// js/auth.js
// Authentication layer. In full-stack mode auth flows route through the
// Express API. When js/api-config.js is empty, the app falls back to the
// original localStorage-backed demo mode.

import { DB } from "./db.js";
import { apiRequest, getApiToken, isBackendApiEnabled, setApiToken } from "./http.js";

const TOKEN_KEY = "gulit:v1:token";

export const ALLOWED_EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"];

export function isAcceptedEmail(email) {
  if (!email) return true;
  const parts = String(email).trim().toLowerCase().split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  return ALLOWED_EMAIL_DOMAINS.includes(parts[1]);
}

export const WORK_ID_PATTERNS = {
  owner:    { regex: /^SO-\d{5}$/,  example: "SO-00001", prefix: "SO-", digits: 5 },
  delivery: { regex: /^D-\d{6}$/,   example: "D-000001", prefix: "D-",  digits: 6 },
  branch:   { regex: /^BC-\d{4}$/,  example: "BC-0001",  prefix: "BC-", digits: 4 },
  main:     { regex: /^MC-\d{3}$/,  example: "MC-001",   prefix: "MC-", digits: 3 },
};

export async function hashPassword(plain) {
  const enc = new TextEncoder().encode(plain);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newToken() {
  const rand = crypto.getRandomValues(new Uint8Array(24));
  return [...rand].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ------------------------------------------------------------
// Backend helpers
// ------------------------------------------------------------
let _cachedUser = null;

function _userToAppShape(u) {
  return {
    ...u,
    subCity: u.subCity ?? u.sub_city ?? null,
    committeeId: u.committeeId ?? u.committee_id ?? null,
    workId: u.workId ?? u.work_id ?? null,
    faydaFan: u.faydaFan ?? u.fayda_fan ?? null,
    avatar: u.avatar || null,
    createdAt: u.createdAt ?? u.created_at ?? null,
  };
}

function _localCurrentUser() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  const session = DB.find("sessions", (s) => s.token === token);
  if (!session) { localStorage.removeItem(TOKEN_KEY); return null; }
  const user = DB.byId("users", session.userId);
  return user ? Auth.publicUser(user) : null;
}

function _recordLocalPresence(user) {
  if (!user?.id) return;
  const now = new Date().toISOString();
  const token = getApiToken() || `backend_${user.id}`;
  const existing = DB.find("sessions", (s) => s.userId === user.id);
  if (existing) {
    DB.update("sessions", existing.id, { token, userId: user.id, lastSeen: now });
    return;
  }
  DB.insert("sessions", { token, userId: user.id, lastSeen: now });
}

function _removeLocalPresence(userId) {
  if (!userId) return;
  for (const s of DB.all("sessions")) {
    if (s.userId === userId) DB.remove("sessions", s.id);
  }
}

// Bridge between backend identities and the localStorage demo data. The
// demo seed creates owners/couriers in localStorage with their own ids, and
// shops/deliveries/orders are linked to those ids. When the same person
// signs in through the backend they get a different (uuid) id, so without this
// step their owner dashboard looks empty. We re-key the matching
// localStorage rows to the backend id once per device.
function _adoptLocalDemoData(user) {
  if (!user || !user.email) return;
  const local = DB.find("users", (u) => u.email === user.email);
  if (!local || local.id === user.id) return;
  const oldId = local.id;
  // Re-id the local user row itself so direct lookups by backend id resolve
  // (needed e.g. for rating a delivery courier by id).
  DB.remove("users", oldId);
  DB.insert("users", { ...local, id: user.id });
  for (const s of DB.filter("shops", (x) => x.ownerId === oldId)) {
    DB.update("shops", s.id, { ownerId: user.id });
  }
  for (const d of DB.filter("deliveries", (x) => x.courierId === oldId)) {
    DB.update("deliveries", d.id, { courierId: user.id });
  }
  for (const o of DB.filter("orders", (x) => x.customerId === oldId)) {
    DB.update("orders", o.id, { customerId: user.id });
  }
}

// ------------------------------------------------------------
// Auth
// ------------------------------------------------------------
export const Auth = {
  // Called once at bootstrap. Hydrates the in-memory user cache so the rest
  // of the app's synchronous Auth.currentUser() calls still work.
  async init() {
    if (!isBackendApiEnabled()) {
      _cachedUser = _localCurrentUser();
      return _cachedUser;
    }
    if (!getApiToken()) {
      _cachedUser = null;
      return null;
    }
    try {
      const { user } = await apiRequest("/auth/me");
      _cachedUser = user ? _userToAppShape(user) : null;
      if (_cachedUser) _adoptLocalDemoData(_cachedUser);
      if (_cachedUser) _recordLocalPresence(_cachedUser);
    } catch {
      setApiToken(null);
      _cachedUser = null;
    }
    return _cachedUser;
  },

  async register({ name, email, phone, password, role, subCity, committeeId, workId, faydaFan, avatar = null }) {
    if (!name || !password) throw new Error("Name and password required.");
    if (!role) throw new Error("Role required.");
    if (email && !isAcceptedEmail(email)) {
      throw new Error(`Email must use a supported provider: ${ALLOWED_EMAIL_DOMAINS.join(", ")}.`);
    }

    // Per-role staff validation (workId format + fayda 16 digits).
    let normWorkId = null;
    let normFan = null;
    if (role !== "customer") {
      const pattern = WORK_ID_PATTERNS[role];
      const candidate = String(workId || "").trim().toUpperCase();
      if (!pattern || !pattern.regex.test(candidate)) {
        throw new Error(`Work ID must match the format ${pattern?.example || "a role-specific code"}.`);
      }
      normWorkId = candidate;
      const fanDigits = String(faydaFan || "").replace(/\s+/g, "");
      if (!/^\d{16}$/.test(fanDigits)) throw new Error("Fayda FAN must be exactly 16 digits.");
      normFan = fanDigits;
    }

    if (isBackendApiEnabled()) {
      const result = await apiRequest("/auth/register", {
        method: "POST",
        body: { name, email, phone, password, role, subCity, committeeId, workId: normWorkId, faydaFan: normFan, avatar },
      });
      setApiToken(result.token);
      _cachedUser = _userToAppShape(result.user);
      if (_cachedUser) _adoptLocalDemoData(_cachedUser);
      if (_cachedUser) _recordLocalPresence(_cachedUser);
      return { token: result.token, user: _cachedUser };
    }

    // ------- Local fallback -------
    if (role !== "customer") {
      const dupWorkId = DB.find("users", (u) => u.workId === normWorkId);
      if (dupWorkId) throw new Error("That Work ID is already registered.");
      const dupFan = DB.find("users", (u) => u.faydaFan === normFan);
      if (dupFan) throw new Error("That Fayda FAN is already registered to another account.");
    }
    const existing = DB.find("users", (u) => (email && u.email === email) || (phone && u.phone === phone));
    if (existing) throw new Error("An account with that email or phone already exists.");

    const passwordHash = await hashPassword(password);
    const user = DB.insert("users", {
      name, email: email || null, phone: phone || null, passwordHash,
      role, subCity: subCity || null, committeeId: committeeId || null,
      workId: normWorkId, faydaFan: normFan,
      avatar: avatar || null,
    });
    DB.insert("auditLogs", {
      actorId: user.id, action: "REGISTER", entity: "user", entityId: user.id,
      timestamp: new Date().toISOString(),
    });
    return Auth.login({ identifier: email || phone, password });
  },

  async login({ identifier, password }) {
    if (isBackendApiEnabled()) {
      const result = await apiRequest("/auth/login", {
        method: "POST",
        body: { identifier, password },
      });
      setApiToken(result.token);
      _cachedUser = _userToAppShape(result.user);
      _adoptLocalDemoData(_cachedUser);
      _recordLocalPresence(_cachedUser);
      return { token: result.token, user: _cachedUser };
    }

    const user = DB.find("users", (u) => u.email === identifier || u.phone === identifier);
    if (!user) throw new Error("Account not found.");
    const hash = await hashPassword(password);
    if (hash !== user.passwordHash) throw new Error("Incorrect password.");
    const token = newToken();
    DB.insert("sessions", { token, userId: user.id, lastSeen: new Date().toISOString() });
    localStorage.setItem(TOKEN_KEY, token);
    DB.insert("auditLogs", {
      actorId: user.id, action: "LOGIN", entity: "user", entityId: user.id,
      timestamp: new Date().toISOString(),
    });
    return { token, user: Auth.publicUser(user) };
  },

  async requestPasswordReset({ identifier }) {
    if (!identifier) throw new Error("Email or phone is required.");
    if (isBackendApiEnabled()) {
      return apiRequest("/auth/forgot-password", {
        method: "POST",
        body: { identifier },
      });
    }
    const user = DB.find("users", (u) => u.email === identifier || u.phone === identifier);
    if (!user) return { message: "If an account exists, reset instructions will be provided." };
    const resetToken = newToken();
    DB.update("users", user.id, {
      resetToken,
      resetTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
    return { message: "Use the reset token to set a new password.", resetToken };
  },

  async resetPassword({ token, password }) {
    if (!token || !password) throw new Error("Reset token and new password are required.");
    if (isBackendApiEnabled()) {
      return apiRequest("/auth/reset-password", {
        method: "POST",
        body: { token, password },
      });
    }
    const now = new Date().toISOString();
    const user = DB.find("users", (u) => u.resetToken === token && u.resetTokenExpiresAt > now);
    if (!user) throw new Error("Invalid or expired reset token.");
    DB.update("users", user.id, {
      passwordHash: await hashPassword(password),
      resetToken: null,
      resetTokenExpiresAt: null,
    });
    return { message: "Password reset successfully." };
  },

  // Permanently delete the current user's account. Requires re-authentication
  // (password) and a name confirmation to prevent accidental clicks.
  async deleteAccount({ password, confirmName }) {
    const cur = Auth.currentUser();
    if (!cur) throw new Error("Not signed in.");
    if (!confirmName || confirmName.trim().toLowerCase() !== String(cur.name || "").trim().toLowerCase()) {
      throw new Error("The name you entered doesn't match your account.");
    }
    if (!password) throw new Error("Password required.");

    if (isBackendApiEnabled()) {
      const cur = _cachedUser;
      await apiRequest("/users/me", {
        method: "DELETE",
        body: { password, confirmName },
      });
      _removeLocalPresence(cur?.id);
      setApiToken(null);
      _cachedUser = null;
      return;
    }

    // Local fallback
    const fullUser = DB.byId("users", cur.id);
    if (!fullUser) throw new Error("Account not found.");
    const hash = await hashPassword(password);
    if (hash !== fullUser.passwordHash) throw new Error("Password is incorrect.");
    for (const s of DB.all("sessions")) {
      if (s.userId === cur.id) DB.remove("sessions", s.id);
    }
    DB.remove("users", cur.id);
    localStorage.removeItem(TOKEN_KEY);
  },

  async logout() {
    if (isBackendApiEnabled()) {
      _removeLocalPresence(_cachedUser?.id);
      _cachedUser = null;
      setApiToken(null);
      return;
    }
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      const s = DB.find("sessions", (x) => x.token === token);
      if (s) DB.remove("sessions", s.id);
    }
    localStorage.removeItem(TOKEN_KEY);
  },

  currentUser() {
    if (isBackendApiEnabled()) return _cachedUser;
    return _localCurrentUser();
  },

  publicUser(u) {
    if (!u) return null;
    const { passwordHash, ...rest } = u;
    return rest;
  },

  require(roles) {
    const u = Auth.currentUser();
    if (!u) throw new Error("Authentication required.");
    if (roles && !roles.includes(u.role)) {
      throw new Error("You do not have permission to perform this action.");
    }
    return u;
  },

  async updateProfile({ name, email, phone, subCity, currentPassword, newPassword, faydaFan, avatar }) {
    if (isBackendApiEnabled()) {
      const cur = _cachedUser;
      if (!cur) throw new Error("Authentication required.");
      const result = await apiRequest("/users/me", {
        method: "PUT",
        body: { name, email, phone, subCity, currentPassword, newPassword, faydaFan, avatar },
      });
      _cachedUser = _userToAppShape(result.user);
      return _cachedUser;
    }

    // ------- Local fallback -------
    const me = Auth.currentUser();
    if (!me) throw new Error("Authentication required.");
    const fullUser = DB.byId("users", me.id);
    if (!fullUser) throw new Error("User not found.");

    const wantsPasswordChange = !!(newPassword && newPassword.length);
    if (wantsPasswordChange) {
      if (!currentPassword) throw new Error("Current password required to change password.");
      const cur = await hashPassword(currentPassword);
      if (cur !== fullUser.passwordHash) throw new Error("Current password is incorrect.");
      if (newPassword.length < 6) throw new Error("New password must be at least 6 characters.");
    }

    if (email && email !== fullUser.email) {
      if (!isAcceptedEmail(email)) {
        throw new Error(`Email must use a supported provider: ${ALLOWED_EMAIL_DOMAINS.join(", ")}.`);
      }
      const dup = DB.find("users", (u) => u.id !== fullUser.id && u.email === email);
      if (dup) throw new Error("That email is already in use.");
    }
    if (phone && phone !== fullUser.phone) {
      const dup = DB.find("users", (u) => u.id !== fullUser.id && u.phone === phone);
      if (dup) throw new Error("That phone is already in use.");
    }

    let nextSubCity = fullUser.subCity;
    if (subCity && subCity !== fullUser.subCity) {
      if (fullUser.role === "customer") nextSubCity = subCity;
      else throw new Error("Sub-city changes require committee approval. Use “Request location change”.");
    }

    const patch = { name: name || fullUser.name, email: email || null, phone: phone || null, subCity: nextSubCity };
    if (wantsPasswordChange) patch.passwordHash = await hashPassword(newPassword);
    if (avatar !== undefined) patch.avatar = avatar || null;

    if (faydaFan !== undefined && fullUser.role !== "customer") {
      const fanDigits = String(faydaFan || "").replace(/\s+/g, "");
      if (fanDigits && fanDigits !== fullUser.faydaFan) {
        if (!/^\d{16}$/.test(fanDigits)) throw new Error("Fayda FAN must be exactly 16 digits.");
        const dupFan = DB.find("users", (u) => u.id !== fullUser.id && u.faydaFan === fanDigits);
        if (dupFan) throw new Error("That Fayda FAN is already registered to another account.");
        patch.faydaFan = fanDigits;
      }
    }

    const updated = DB.update("users", fullUser.id, patch);
    DB.insert("auditLogs", {
      actorId: fullUser.id, action: "PROFILE_UPDATED", entity: "user", entityId: fullUser.id,
      details: { changedPassword: wantsPasswordChange }, timestamp: new Date().toISOString(),
    });
    return Auth.publicUser(updated);
  },
};
