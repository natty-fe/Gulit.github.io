// js/db.js
// Persistent table-based store on top of localStorage.
// Each "table" is a namespaced JSON array. The DB exposes CRUD primitives
// that the API layer (api.js) builds REST endpoints on top of.

const NS = "gulit:v1:";

const TABLES = [
  "users",
  "committees",
  "shops",
  "products",
  "priceRanges",
  "inventory",
  "orders",
  "deliveries",
  "complaints",
  "refunds",
  "auditLogs",
  "sessions",
  "meta",
];

function k(table) { return NS + table; }

function read(table) {
  try {
    const raw = localStorage.getItem(k(table));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(table, rows) {
  localStorage.setItem(k(table), JSON.stringify(rows));
}

function ensure() {
  for (const t of TABLES) {
    if (localStorage.getItem(k(t)) === null) write(t, []);
  }
}

export const DB = {
  ensure,

  // Generate a sortable, mostly-unique id (no crypto dep needed for prototype).
  id(prefix = "id") {
    const rand = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${Date.now().toString(36)}_${rand}`;
  },

  all(table) {
    return read(table);
  },

  find(table, predicate) {
    return read(table).find(predicate) || null;
  },

  filter(table, predicate) {
    return read(table).filter(predicate);
  },

  byId(table, id) {
    return read(table).find((r) => r.id === id) || null;
  },

  insert(table, row) {
    if (!row.id) row.id = DB.id(table.slice(0, 3));
    if (!row.createdAt) row.createdAt = new Date().toISOString();
    const rows = read(table);
    rows.push(row);
    write(table, rows);
    return row;
  },

  update(table, id, patch) {
    const rows = read(table);
    const i = rows.findIndex((r) => r.id === id);
    if (i === -1) return null;
    rows[i] = { ...rows[i], ...patch, updatedAt: new Date().toISOString() };
    write(table, rows);
    return rows[i];
  },

  remove(table, id) {
    const rows = read(table);
    const next = rows.filter((r) => r.id !== id);
    write(table, next);
    return rows.length !== next.length;
  },

  // Bulk insert used by seed step (does not overwrite if seeded already).
  seed(table, rows, force = false) {
    if (force || read(table).length === 0) write(table, rows);
  },

  // Read/write the singleton "meta" row.
  getMeta(key) {
    const meta = read("meta")[0] || {};
    return meta[key];
  },
  setMeta(key, value) {
    const rows = read("meta");
    const cur = rows[0] || { id: "meta_singleton" };
    cur[key] = value;
    if (rows.length === 0) rows.push(cur); else rows[0] = cur;
    write("meta", rows);
  },

  // Wipe and reseed (used by /reset link in account screen).
  hardReset() {
    for (const t of TABLES) localStorage.removeItem(k(t));
  },
};
