// js/seed.js
// Reference data only: committees, products, regulated price ranges.
// User accounts, shops, and inventory are all created at runtime by the
// signup / shop registration / inventory flows — there are no demo accounts.

import { DB } from "./db.js";

export const SUB_CITIES = [
  "Bole", "Kirkos", "Arada", "Yeka", "Lideta", "Akaki Kality", "Addis Ketema",
  "Gulele", "Nifas Silk-Lafto", "Kolfe Keranio", "Lemi Kura",
];

export const CATEGORIES = ["All", "Vegetables", "Grains", "Cereals", "Fruits", "Protein", "Spices"];

const PRODUCTS = [
  { id: "prd_onion",    name: "Onion",        nameAm: "ሽንኩርት",       category: "Vegetables", unit: "kg",    icon: "onion" },
  { id: "prd_tomato",   name: "Tomato",       nameAm: "ቲማቲም",       category: "Vegetables", unit: "kg",    icon: "tomato" },
  { id: "prd_potato",   name: "Potato",       nameAm: "ድንች",         category: "Vegetables", unit: "kg",    icon: "potato" },
  { id: "prd_carrot",   name: "Carrot",       nameAm: "ካሮት",         category: "Vegetables", unit: "kg",    icon: "carrot" },
  { id: "prd_pepper",   name: "Green Pepper", nameAm: "ቃሪያ",         category: "Vegetables", unit: "kg",    icon: "pepper" },
  { id: "prd_cabbage",  name: "Cabbage",      nameAm: "ጥቅል ጎመን",     category: "Vegetables", unit: "kg",    icon: "cabbage" },
  { id: "prd_egg",      name: "Egg (tray)",   nameAm: "እንቁላል (ትሬ)",  category: "Protein",    unit: "tray",  icon: "egg" },
  { id: "prd_teff",     name: "Teff",         nameAm: "ጤፍ",          category: "Grains",     unit: "kg",    icon: "grain" },
  { id: "prd_rice",     name: "Rice",         nameAm: "ሩዝ",          category: "Cereals",    unit: "kg",    icon: "grain" },
  { id: "prd_lentils",  name: "Lentils",      nameAm: "ምስር",         category: "Grains",     unit: "kg",    icon: "grain" },
  { id: "prd_banana",   name: "Banana",       nameAm: "ሙዝ",          category: "Fruits",     unit: "dozen", icon: "banana" },
  { id: "prd_berbere",  name: "Berbere",      nameAm: "በርበሬ",        category: "Spices",     unit: "pack",  icon: "spice" },
];

// Initial regulated price bands (ETB). setBy is null because no main-committee
// user exists at seed time; the first registered main user can override these
// from the regulated-ranges panel.
const PRICE_RANGES = [
  { productId: "prd_onion",   min: 2.50, max: 4.50 },
  { productId: "prd_tomato",  min: 3.00, max: 5.00 },
  { productId: "prd_potato",  min: 2.80, max: 4.50 },
  { productId: "prd_carrot",  min: 2.50, max: 4.20 },
  { productId: "prd_pepper",  min: 3.50, max: 6.00 },
  { productId: "prd_cabbage", min: 2.40, max: 3.80 },
  { productId: "prd_egg",     min: 75.00, max: 110.00 },
  { productId: "prd_teff",    min: 65.00, max: 95.00 },
  { productId: "prd_rice",    min: 60.00, max: 95.00 },
  { productId: "prd_lentils", min: 50.00, max: 80.00 },
  { productId: "prd_banana",  min: 12.00, max: 22.00 },
  { productId: "prd_berbere", min: 40.00, max: 65.00 },
];

export async function runSeed({ force = false } = {}) {
  DB.ensure();
  if (!force && DB.getMeta("seeded")) return;

  if (force) DB.hardReset();
  DB.ensure();

  // ---- Committees (governance structure; no users attached yet) ----
  const mainCommittee = DB.insert("committees", {
    type: "main",
    name: "Addis Ababa Main Committee",
    jurisdiction: "Addis Ababa",
  });

  for (const sc of SUB_CITIES) {
    DB.insert("committees", {
      type: "branch",
      name: `${sc} Branch Committee`,
      jurisdiction: sc,
      parentId: mainCommittee.id,
    });
  }

  // ---- Catalog ----
  for (const p of PRODUCTS) DB.insert("products", { ...p });

  // ---- Initial regulated price bands ----
  for (const pr of PRICE_RANGES) {
    DB.insert("priceRanges", {
      productId: pr.productId,
      minPrice: pr.min,
      maxPrice: pr.max,
      effectiveDate: new Date().toISOString(),
      setBy: null,
    });
  }

  DB.setMeta("seeded", true);
  DB.setMeta("seedVersion", 3);
}

// Backfill keys added after the initial seed so existing browser installs
// pick them up without needing a hard reset.
const PRODUCT_NAMES_AM_BACKFILL = {
  prd_onion:   "ሽንኩርት",
  prd_tomato:  "ቲማቲም",
  prd_potato:  "ድንች",
  prd_carrot:  "ካሮት",
  prd_pepper:  "ቃሪያ",
  prd_cabbage: "ጥቅል ጎመን",
  prd_egg:     "እንቁላል (ትሬ)",
  prd_teff:    "ጤፍ",
  prd_rice:    "ሩዝ",
  prd_lentils: "ምስር",
  prd_banana:  "ሙዝ",
  prd_berbere: "በርበሬ",
};

const DEMO_EMAILS = new Set([
  "hana@example.com",
  "abebe@example.com",
  "yonas@example.com",
  "branch@example.com",
  "main@example.com",
]);

export async function runMigrations() {
  DB.ensure();
  const v = DB.getMeta("seedVersion") || 0;

  // v1 → v2: products gained a nameAm field; backfill from the static map.
  if (v < 2) {
    const products = DB.all("products");
    for (const p of products) {
      if (p.nameAm) continue;
      const nameAm = PRODUCT_NAMES_AM_BACKFILL[p.id];
      if (nameAm) DB.update("products", p.id, { nameAm });
    }
    DB.setMeta("seedVersion", 2);
  }

  // v2 → v3: drop the seeded demo accounts and their dependent shops/
  // inventory/sessions so existing browser installs match new ones (no
  // pre-baked accounts; the operator creates their own).
  if (v < 3) {
    const demoUsers = DB.filter("users", (u) => DEMO_EMAILS.has(u.email));
    const demoUserIds = new Set(demoUsers.map((u) => u.id));

    if (demoUserIds.size) {
      // Sessions for those users
      for (const s of DB.all("sessions")) {
        if (demoUserIds.has(s.userId)) DB.remove("sessions", s.id);
      }
      // Shops owned by the demo owner
      const demoShops = DB.filter("shops", (s) => demoUserIds.has(s.ownerId));
      const demoShopIds = new Set(demoShops.map((s) => s.id));
      for (const i of DB.all("inventory")) {
        if (demoShopIds.has(i.shopId)) DB.remove("inventory", i.id);
      }
      for (const s of demoShops) DB.remove("shops", s.id);
      // Users themselves
      for (const u of demoUsers) DB.remove("users", u.id);
    }
    DB.setMeta("seedVersion", 3);
  }
}
