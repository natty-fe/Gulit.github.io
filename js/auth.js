// js/auth.js
// Password hashing (SHA-256 via Web Crypto), opaque session tokens stored in
// localStorage, and current-user helpers.

import { DB } from "./db.js";

const TOKEN_KEY = "gulit:v1:token";

// Accepted email providers. Anything outside this list is rejected at
// register / updateProfile time. Extend as new providers come online.
export const ALLOWED_EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com"];

export function isAcceptedEmail(email) {
  if (!email) return true; // empty is allowed (signup permits phone-only).
  const parts = String(email).trim().toLowerCase().split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  return ALLOWED_EMAIL_DOMAINS.includes(parts[1]);
}

// Per-role Work ID format. Owners get the largest range, committee members
// the smallest, mirroring the population of each role.
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

export const Auth = {
  async register({ name, email, phone, password, role, subCity, committeeId, workId, faydaFan }) {
    if (!name || !password) throw new Error("Name and password required.");
    if (!role) throw new Error("Role required.");
    if (email && !isAcceptedEmail(email)) {
      throw new Error(`Email must use a supported provider: ${ALLOWED_EMAIL_DOMAINS.join(", ")}.`);
    }
    const existing = DB.find("users", (u) => (email && u.email === email) || (phone && u.phone === phone));
    if (existing) throw new Error("An account with that email or phone already exists.");

    // Every non-customer role requires staff verification: a work ID number
    // matching its role-specific format. The Fayda FAN is auto-generated at
    // signup; the user can replace it with their real number from the
    // profile editor afterwards.
    let normWorkId = null;
    let normFan = null;
    if (role !== "customer") {
      const pattern = WORK_ID_PATTERNS[role];
      const candidate = String(workId || "").trim().toUpperCase();
      if (!pattern || !pattern.regex.test(candidate)) {
        throw new Error(`Work ID must match the format ${pattern?.example || "a role-specific code"}.`);
      }
      const dupWorkId = DB.find("users", (u) => u.workId === candidate);
      if (dupWorkId) throw new Error("That Work ID is already registered.");
      normWorkId = candidate;
      const fanDigits = String(faydaFan || "").replace(/\s+/g, "");
      if (!/^\d{16}$/.test(fanDigits)) throw new Error("Fayda FAN must be exactly 16 digits.");
      const dupFan = DB.find("users", (u) => u.faydaFan === fanDigits);
      if (dupFan) throw new Error("That Fayda FAN is already registered to another account.");
      normFan = fanDigits;
    }

    const passwordHash = await hashPassword(password);
    const user = DB.insert("users", {
      name, email: email || null, phone: phone || null, passwordHash,
      role, subCity: subCity || null, committeeId: committeeId || null,
      workId: normWorkId, faydaFan: normFan,
    });

    DB.insert("auditLogs", {
      actorId: user.id, action: "REGISTER", entity: "user", entityId: user.id,
      timestamp: new Date().toISOString(),
    });

    return Auth.login({ identifier: email || phone, password });
  },

  async login({ identifier, password }) {
    const user = DB.find(
      "users",
      (u) => u.email === identifier || u.phone === identifier
    );
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

  logout() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      const s = DB.find("sessions", (x) => x.token === token);
      if (s) DB.remove("sessions", s.id);
    }
    localStorage.removeItem(TOKEN_KEY);
  },

  currentUser() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    const session = DB.find("sessions", (s) => s.token === token);
    if (!session) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    const user = DB.byId("users", session.userId);
    return user ? Auth.publicUser(user) : null;
  },

  publicUser(u) {
    if (!u) return null;
    const { passwordHash, ...rest } = u;
    return rest;
  },

  // Role guard. Throws if current user is not in `roles` (array).
  require(roles) {
    const u = Auth.currentUser();
    if (!u) throw new Error("Authentication required.");
    if (roles && !roles.includes(u.role)) {
      throw new Error("You do not have permission to perform this action.");
    }
    return u;
  },

  // Update profile fields. Password change is gated on the current password.
  async updateProfile({ name, email, phone, subCity, currentPassword, newPassword, faydaFan }) {
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

    // Email/phone uniqueness + provider check when changed.
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

    // Sub-city changes for non-customer roles must go through committee
    // approval (LocationChanges API). Customers can edit theirs freely.
    let nextSubCity = fullUser.subCity;
    if (subCity && subCity !== fullUser.subCity) {
      if (fullUser.role === "customer") {
        nextSubCity = subCity;
      } else {
        throw new Error("Sub-city changes require committee approval. Use “Request location change”.");
      }
    }

    const patch = { name: name || fullUser.name, email: email || null, phone: phone || null, subCity: nextSubCity };
    if (wantsPasswordChange) patch.passwordHash = await hashPassword(newPassword);

    // Fayda FAN is editable post-signup but only for staff accounts (customer
    // accounts never have one). Same validation as register: 16 digits, unique.
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
