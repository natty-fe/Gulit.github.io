// js/seed.js
// Initial reference data + a few demo accounts. Runs once on first load,
// or on demand from the Account "Reset demo data" button.

import { DB } from "./db.js";
import { hashPassword } from "./auth.js";

export const SUB_CITIES = [
  "Bole", "Kirkos", "Arada", "Yeka", "Lideta", "Akaki Kality", "Addis Ketema",
  "Gulele", "Nifas Silk-Lafto", "Kolfe Keranio", "Lemi Kura",
];

export const CATEGORIES = ["All", "Vegetables", "Grains", "Cereals", "Fruits", "Protein", "Spices"];

const PRODUCTS = [
  { id: "prd_onion",    name: "Onion",        category: "Vegetables", unit: "kg",    icon: "onion" },
  { id: "prd_tomato",   name: "Tomato",       category: "Vegetables", unit: "kg",    icon: "tomato" },
  { id: "prd_potato",   name: "Potato",       category: "Vegetables", unit: "kg",    icon: "potato" },
  { id: "prd_carrot",   name: "Carrot",       category: "Vegetables", unit: "kg",    icon: "carrot" },
  { id: "prd_pepper",   name: "Green Pepper", category: "Vegetables", unit: "kg",    icon: "pepper" },
  { id: "prd_cabbage",  name: "Cabbage",      category: "Vegetables", unit: "kg",    icon: "cabbage" },
  { id: "prd_egg",      name: "Egg (tray)",   category: "Protein",    unit: "tray",  icon: "egg" },
  { id: "prd_teff",     name: "Teff",         category: "Grains",     unit: "kg",    icon: "grain" },
  { id: "prd_rice",     name: "Rice",         category: "Cereals",    unit: "kg",    icon: "grain" },
  { id: "prd_lentils",  name: "Lentils",      category: "Grains",     unit: "kg",    icon: "grain" },
  { id: "prd_banana",   name: "Banana",       category: "Fruits",     unit: "dozen", icon: "banana" },
  { id: "prd_berbere",  name: "Berbere",      category: "Spices",     unit: "pack",  icon: "spice" },
];

// Regulated price bands set by the city main committee (ETB).
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

  // ---- Committees ----
  const mainCommittee = DB.insert("committees", {
    type: "main",
    name: "Addis Ababa Main Committee",
    jurisdiction: "Addis Ababa",
  });

  const branchByCity = {};
  for (const sc of SUB_CITIES) {
    const branch = DB.insert("committees", {
      type: "branch",
      name: `${sc} Branch Committee`,
      jurisdiction: sc,
      parentId: mainCommittee.id,
    });
    branchByCity[sc] = branch.id;
  }

  // ---- Demo users (one per role) ----
  const passHash = await hashPassword("demo1234");
  const customer = DB.insert("users", {
    name: "Hana Tesfaye",
    email: "hana@example.com",
    phone: "+251911234567",
    role: "customer",
    subCity: "Bole",
    passwordHash: passHash,
  });
  const owner = DB.insert("users", {
    name: "Abebe Kebede",
    email: "abebe@example.com",
    phone: "+251911000001",
    role: "owner",
    subCity: "Bole",
    passwordHash: passHash,
  });
  const courier = DB.insert("users", {
    name: "Yonas Tadesse",
    email: "yonas@example.com",
    phone: "+251911000002",
    role: "delivery",
    subCity: "Bole",
    passwordHash: passHash,
  });
  const branchMember = DB.insert("users", {
    name: "Mulugeta Alemu",
    email: "branch@example.com",
    phone: "+251911000003",
    role: "branch",
    subCity: "Bole",
    committeeId: branchByCity["Bole"],
    passwordHash: passHash,
  });
  const mainMember = DB.insert("users", {
    name: "Sara Tesfaye",
    email: "main@example.com",
    phone: "+251911000004",
    role: "main",
    subCity: "Addis Ababa",
    committeeId: mainCommittee.id,
    passwordHash: passHash,
  });

  // ---- Catalog ----
  for (const p of PRODUCTS) DB.insert("products", { ...p });

  // ---- Price ranges (signed by main committee) ----
  for (const pr of PRICE_RANGES) {
    DB.insert("priceRanges", {
      productId: pr.productId,
      minPrice: pr.min,
      maxPrice: pr.max,
      effectiveDate: new Date().toISOString(),
      setBy: mainMember.id,
    });
  }

  // ---- Shops ----
  const ownerShop = DB.insert("shops", {
    ownerId: owner.id,
    name: "Bole Fresh Veggies",
    subCity: "Bole",
    branchCommitteeId: branchByCity["Bole"],
    status: "approved",
    approvedBy: branchMember.id,
    approvedAt: new Date().toISOString(),
    rating: 4.7,
    reviews: [
      { by: "Hana Tesfaye",  text: "Fresh onions and fair prices. Fast packing.",   stars: 5, date: "2026-04-12" },
      { by: "Dawit Girma",   text: "Good tomatoes, delivery arrived on time.",      stars: 5, date: "2026-04-10" },
      { by: "Mekdes Alemu",  text: "Very polite seller and clean packaging.",       stars: 4, date: "2026-04-04" },
    ],
  });

  const otherShops = [
    {
      ownerId: owner.id, name: "Kirkos Market Corner", subCity: "Kirkos",
      branchCommitteeId: branchByCity["Kirkos"], status: "approved", rating: 4.5,
      reviews: [
        { by: "Mulugeta Alemu", text: "Great potatoes, consistent stock.", stars: 5, date: "2026-04-09" },
        { by: "Rahel Abate",    text: "Friendly and quick dispatch.",       stars: 4, date: "2026-04-02" },
      ],
    },
    {
      ownerId: owner.id, name: "Arada Daily Goods", subCity: "Arada",
      branchCommitteeId: branchByCity["Arada"], status: "approved", rating: 4.4,
      reviews: [
        { by: "Kidus Mihret",   text: "Good peppers and grains. Fair ranges.", stars: 5, date: "2026-04-15" },
        { by: "Saron Getachew", text: "Sometimes busy, but quality is high.",  stars: 4, date: "2026-04-01" },
      ],
    },
    {
      ownerId: owner.id, name: "Yeka Grain & Eggs", subCity: "Yeka",
      branchCommitteeId: branchByCity["Yeka"], status: "approved", rating: 4.6,
      reviews: [
        { by: "Eden Abebe",    text: "Teff quality is excellent and clean.",     stars: 5, date: "2026-04-13" },
        { by: "Hana Tesfaye",  text: "Egg tray arrived safely. Great packaging.", stars: 5, date: "2026-04-11" },
      ],
    },
  ];
  const shopIds = [ownerShop.id];
  for (const s of otherShops) shopIds.push(DB.insert("shops", s).id);

  // ---- Inventory: each shop carries a subset of products at prices inside range ----
  const inRange = (pid) => {
    const r = PRICE_RANGES.find((p) => p.productId === pid);
    // pick a price ~ middle of range
    return Number((r.min + (r.max - r.min) * (0.3 + Math.random() * 0.5)).toFixed(2));
  };

  const inventoryMap = [
    [shopIds[0], ["prd_onion", "prd_tomato", "prd_cabbage", "prd_berbere"]],
    [shopIds[1], ["prd_potato", "prd_carrot", "prd_lentils"]],
    [shopIds[2], ["prd_pepper", "prd_rice", "prd_banana"]],
    [shopIds[3], ["prd_egg", "prd_teff"]],
  ];
  for (const [shopId, products] of inventoryMap) {
    for (const pid of products) {
      const price = inRange(pid);
      DB.insert("inventory", {
        shopId,
        productId: pid,
        qty: 30 + Math.floor(Math.random() * 80),
        price,
        oldPrice: Number((price * 1.6).toFixed(2)),
      });
    }
  }

  // ---- Audit ----
  DB.insert("auditLogs", {
    actorId: mainMember.id,
    action: "SEED",
    entity: "system",
    entityId: null,
    details: { note: "Initial demo data seeded." },
    timestamp: new Date().toISOString(),
  });

  DB.setMeta("seeded", true);
  DB.setMeta("seedVersion", 1);
}
