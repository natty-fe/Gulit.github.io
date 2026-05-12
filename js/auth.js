// js/auth.js
// Authentication layer. When js/supabase-config.js has real credentials, all
// auth flows route through Supabase (cross-device). When it doesn't, the file
// falls back to the original localStorage-backed flow so the app keeps
// working offline / on GitHub Pages without a backend.

import { DB } from "./db.js";
import { getSupabase, isSupabaseEnabled } from "./supabase-client.js";

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
// Supabase helpers
// ------------------------------------------------------------
let _cachedUser = null;

function _profileToAppShape(authUser, p) {
  return {
    id: p.id || authUser.id,
    email: authUser?.email || p.email || null,
    name: p.name,
    phone: p.phone,
    role: p.role,
    subCity: p.sub_city,
    committeeId: p.committee_id,
    workId: p.work_id,
    faydaFan: p.fayda_fan,
    avatar: p.avatar || null,
    createdAt: p.created_at,
  };
}

async function _fetchProfile(authUser) {
  const sb = getSupabase();
  if (!sb || !authUser) return null;
  const { data, error } = await sb.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
  if (error || !data) return null;
  return _profileToAppShape(authUser, data);
}

function _localCurrentUser() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  const session = DB.find("sessions", (s) => s.token === token);
  if (!session) { localStorage.removeItem(TOKEN_KEY); return null; }
  const user = DB.byId("users", session.userId);
  return user ? Auth.publicUser(user) : null;
}

// Bridge between Supabase identities and the localStorage demo data. The
// demo seed creates owners/couriers in localStorage with their own ids, and
// shops/deliveries/orders are linked to those ids. When the same person
// signs in via Supabase they get a different (uuid) id, so without this
// step their owner dashboard looks empty. We re-key the matching
// localStorage rows to the Supabase id once per device.
function _adoptLocalDemoData(user) {
  if (!user || !user.email) return;
  const local = DB.find("users", (u) => u.email === user.email);
  if (!local || local.id === user.id) return;
  const oldId = local.id;
  // Re-id the local user row itself so direct lookups by Supabase id resolve
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
    if (!isSupabaseEnabled()) {
      _cachedUser = _localCurrentUser();
      return _cachedUser;
    }
    const sb = getSupabase();
    try {
      const { data: { session } } = await sb.auth.getSession();
      _cachedUser = session?.user ? await _fetchProfile(session.user) : null;
      if (_cachedUser) _adoptLocalDemoData(_cachedUser);
      sb.auth.onAuthStateChange(async (_event, s) => {
        _cachedUser = s?.user ? await _fetchProfile(s.user) : null;
        if (_cachedUser) _adoptLocalDemoData(_cachedUser);
      });
    } catch {
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

    if (isSupabaseEnabled()) {
      if (!email) throw new Error("Email is required for cross-device accounts.");
      const sb = getSupabase();

      if (role !== "customer") {
        const filters = [];
        if (normWorkId) filters.push(`work_id.eq.${normWorkId}`);
        if (normFan)    filters.push(`fayda_fan.eq.${normFan}`);
        const { data: dups, error } = await sb.from("profiles").select("work_id, fayda_fan").or(filters.join(","));
        if (error) throw new Error(error.message);
        if (dups && dups.length > 0) {
          if (dups.some((d) => d.work_id === normWorkId)) throw new Error("That Work ID is already registered.");
          throw new Error("That Fayda FAN is already registered to another account.");
        }
      }

      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) throw new Error(error.message);
      if (!data.user) throw new Error("Signup failed.");

      const profileRow = {
        id: data.user.id, name, phone: phone || null,
        role, sub_city: subCity || null, committee_id: committeeId || null,
        work_id: normWorkId, fayda_fan: normFan,
        avatar: avatar || null,
      };
      const { error: pErr } = await sb.from("profiles").insert(profileRow);
      if (pErr) throw new Error("Profile creation failed: " + pErr.message);

      if (!data.session) {
        throw new Error("Account created. Please check your email to confirm before signing in.");
      }
      _cachedUser = _profileToAppShape(data.user, profileRow);
      return { token: data.session.access_token, user: _cachedUser };
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
    if (isSupabaseEnabled()) {
      const sb = getSupabase();
      const { data, error } = await sb.auth.signInWithPassword({ email: identifier, password });
      if (error) throw new Error(error.message);
      _cachedUser = await _fetchProfile(data.user);
      if (!_cachedUser) throw new Error("Profile not found for this account.");
      _adoptLocalDemoData(_cachedUser);
      return { token: data.session.access_token, user: _cachedUser };
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

  // Permanently delete the current user's account. Requires re-authentication
  // (password) and a name confirmation to prevent accidental clicks.
  async deleteAccount({ password, confirmName }) {
    const cur = Auth.currentUser();
    if (!cur) throw new Error("Not signed in.");
    if (!confirmName || confirmName.trim().toLowerCase() !== String(cur.name || "").trim().toLowerCase()) {
      throw new Error("The name you entered doesn't match your account.");
    }
    if (!password) throw new Error("Password required.");

    if (isSupabaseEnabled()) {
      const sb = getSupabase();
      const { error: vErr } = await sb.auth.signInWithPassword({ email: cur.email, password });
      if (vErr) throw new Error("Password is incorrect.");
      const { error: dErr } = await sb.rpc("delete_self");
      if (dErr) throw new Error(dErr.message);
      try { await sb.auth.signOut(); } catch { /* ignore */ }
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
    if (isSupabaseEnabled()) {
      _cachedUser = null;
      // Local-scope sign out: clears the device's session tokens immediately
      // without hitting /logout on the server. ~50ms instead of 1-2s. The
      // refresh token stays valid server-side until it expires, which is
      // fine for a demo.
      try { await getSupabase().auth.signOut({ scope: "local" }); } catch { /* ignore */ }
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
    if (isSupabaseEnabled()) return _cachedUser;
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
    if (isSupabaseEnabled()) {
      const sb = getSupabase();
      const cur = _cachedUser;
      if (!cur) throw new Error("Authentication required.");

      let nextSubCity = cur.subCity;
      if (subCity && subCity !== cur.subCity) {
        if (cur.role === "customer") nextSubCity = subCity;
        else throw new Error("Sub-city changes require committee approval. Use “Request location change”.");
      }

      if (email && email !== cur.email && !isAcceptedEmail(email)) {
        throw new Error(`Email must use a supported provider: ${ALLOWED_EMAIL_DOMAINS.join(", ")}.`);
      }

      let normFan = null;
      if (faydaFan !== undefined && cur.role !== "customer") {
        const fanDigits = String(faydaFan || "").replace(/\s+/g, "");
        if (fanDigits && fanDigits !== cur.faydaFan) {
          if (!/^\d{16}$/.test(fanDigits)) throw new Error("Fayda FAN must be exactly 16 digits.");
          const { data: dup } = await sb.from("profiles").select("id").eq("fayda_fan", fanDigits).neq("id", cur.id).maybeSingle();
          if (dup) throw new Error("That Fayda FAN is already registered to another account.");
          normFan = fanDigits;
        }
      }

      if (newPassword && newPassword.length) {
        if (newPassword.length < 6) throw new Error("New password must be at least 6 characters.");
        if (currentPassword) {
          // Re-authenticate to verify current password — Supabase doesn't do this automatically.
          const { error: vErr } = await sb.auth.signInWithPassword({ email: cur.email, password: currentPassword });
          if (vErr) throw new Error("Current password is incorrect.");
        }
        const { error: pwErr } = await sb.auth.updateUser({ password: newPassword });
        if (pwErr) throw new Error(pwErr.message);
      }

      let nextEmail = cur.email;
      if (email && email !== cur.email) {
        const { error: eErr } = await sb.auth.updateUser({ email });
        if (eErr) throw new Error(eErr.message);
        // Supabase sends a confirmation link to the new address; until it's
        // confirmed the actual email on auth.users stays the old one.
        nextEmail = email;
      }

      const patch = { name: name || cur.name, phone: phone || null, sub_city: nextSubCity || null };
      if (normFan) patch.fayda_fan = normFan;
      if (avatar !== undefined) patch.avatar = avatar || null;
      const { error: upErr } = await sb.from("profiles").update(patch).eq("id", cur.id);
      if (upErr) throw new Error(upErr.message);

      _cachedUser = await _fetchProfile({ id: cur.id, email: nextEmail });
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
