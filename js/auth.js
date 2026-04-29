// js/auth.js
// Password hashing (SHA-256 via Web Crypto), opaque session tokens stored in
// localStorage, and current-user helpers.

import { DB } from "./db.js";

const TOKEN_KEY = "gulit:v1:token";

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
  async register({ name, email, phone, password, role, subCity, committeeId }) {
    if (!name || !password) throw new Error("Name and password required.");
    if (!role) throw new Error("Role required.");
    const existing = DB.find("users", (u) => (email && u.email === email) || (phone && u.phone === phone));
    if (existing) throw new Error("An account with that email or phone already exists.");
    const passwordHash = await hashPassword(password);
    const user = DB.insert("users", {
      name, email: email || null, phone: phone || null, passwordHash,
      role, subCity: subCity || null, committeeId: committeeId || null,
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
};
