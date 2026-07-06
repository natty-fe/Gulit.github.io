// seed_supabase_demo_accounts.mjs
// Bulk-create the 57 demo staff accounts (the same ones in
// Gulit-Demo-Credentials.pdf) directly into your Supabase project so they
// work cross-device.
//
// USAGE
// -----
//   1. Get your service-role key from Supabase → Settings → API
//      (it's the one labeled "service_role secret", NOT the publishable key).
//      Treat it like a password — never commit it to the repo.
//
//   2. In a PowerShell or bash terminal:
//
//      Bash / git-bash:
//        SUPABASE_URL="https://avmfjhufcjlhedgoqhxz.supabase.co" \
//        SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..." \
//        node seed_supabase_demo_accounts.mjs
//
//      PowerShell:
//        $env:SUPABASE_URL = "https://avmfjhufcjlhedgoqhxz.supabase.co"
//        $env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOi..."
//        node seed_supabase_demo_accounts.mjs
//
//   3. The script idempotently creates each user (skips any that already
//      exist) and inserts the matching profile row. Run multiple times
//      safely.
//
// REQUIREMENTS: Node 18+ (uses built-in fetch). No npm install needed.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = "demo1234";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var.");
  console.error("See the comment at the top of this file for usage.");
  process.exit(1);
}

// --- Committee IDs ---------------------------------------------------------
// We need the committee row ids inside Supabase so we can foreign-key
// profiles to them. Since committees live only in localStorage (Phase 2
// hasn't moved them yet), we store the same kebab-style ids the localStorage
// seed generates, qualified by jurisdiction. This is enough for the demo —
// the field is just text in the profiles table.
const SUB_CITIES = [
  "Bole", "Kirkos", "Arada", "Yeka", "Lideta", "Akaki Kality", "Addis Ketema",
  "Gulele", "Nifas Silk-Lafto", "Kolfe Keranio", "Lemi Kura",
];

// --- Demo cohort -----------------------------------------------------------
// Mirrors DEMO_STAFF + EXTRA_STAFF from js/seed.js. Keep in sync if you
// change the seed in the app.
const ACCOUNTS = [
  // Main committee
  { name: "Sara Tesfaye",   email: "main@gmail.com",        phone: "+251911000004", role: "main",     subCity: "Addis Ababa", workId: "MC-001", faydaFan: "1000000000000004" },
  // Bole
  { name: "Mulugeta Alemu", email: "branch.bole@gmail.com", phone: "+251911000003", role: "branch",   subCity: "Bole",        workId: "BC-0001", faydaFan: "1000000000000003" },
  { name: "Yonas Tadesse",  email: "yonas@gmail.com",       phone: "+251911000002", role: "delivery", subCity: "Bole",        workId: "D-000001", faydaFan: "1000000000000002" },
  { name: "Abebe Kebede",   email: "abebe@gmail.com",       phone: "+251911000001", role: "owner",    subCity: "Bole",        workId: "SO-00001", faydaFan: "1000000000000001" },
  { name: "Hana Bekele",    email: "hana.bekele@gmail.com",    phone: "+251911000005", role: "owner", subCity: "Bole",    workId: "SO-00002", faydaFan: "1000000000000005" },
  { name: "Daniel Bekele",  email: "daniel.bekele@gmail.com",  phone: "+251911000006", role: "owner", subCity: "Bole",    workId: "SO-00003", faydaFan: "1000000000000006" },
  { name: "Eden Bekele",    email: "eden.bekele@gmail.com",    phone: "+251911000007", role: "owner", subCity: "Bole",    workId: "SO-00004", faydaFan: "1000000000000007" },
  // Kirkos
  { name: "Solomon Bekele", email: "branch.kirkos@gmail.com",  phone: "+251911000008", role: "branch", subCity: "Kirkos", workId: "BC-0002", faydaFan: "1000000000000008" },
  { name: "Mekdes Bekele",  email: "mekdes.bekele@gmail.com",  phone: "+251911000009", role: "owner",  subCity: "Kirkos", workId: "SO-00005", faydaFan: "1000000000000009" },
  { name: "Selam Bekele",   email: "selam.bekele@gmail.com",   phone: "+251911000010", role: "owner",  subCity: "Kirkos", workId: "SO-00006", faydaFan: "1000000000000010" },
  { name: "Henok Bekele",   email: "henok.bekele@gmail.com",   phone: "+251911000011", role: "owner",  subCity: "Kirkos", workId: "SO-00007", faydaFan: "1000000000000011" },
  { name: "Rahel Bekele",   email: "rahel.bekele@gmail.com",   phone: "+251911000012", role: "owner",  subCity: "Kirkos", workId: "SO-00008", faydaFan: "1000000000000012" },
  // Arada
  { name: "Bereket Bekele", email: "branch.arada@gmail.com",   phone: "+251911000013", role: "branch", subCity: "Arada",  workId: "BC-0003", faydaFan: "1000000000000013" },
  { name: "Senait Bekele",  email: "senait.bekele@gmail.com",  phone: "+251911000014", role: "owner",  subCity: "Arada",  workId: "SO-00009", faydaFan: "1000000000000014" },
  { name: "Dawit Bekele",   email: "dawit.bekele@gmail.com",   phone: "+251911000015", role: "owner",  subCity: "Arada",  workId: "SO-00010", faydaFan: "1000000000000015" },
  { name: "Marta Bekele",   email: "marta.bekele@gmail.com",   phone: "+251911000016", role: "owner",  subCity: "Arada",  workId: "SO-00011", faydaFan: "1000000000000016" },
  { name: "Tewodros Bekele",email: "tewodros.bekele@gmail.com",phone: "+251911000017", role: "owner",  subCity: "Arada",  workId: "SO-00012", faydaFan: "1000000000000017" },
  // Yeka
  { name: "Almaz Bekele",   email: "branch.yeka@gmail.com",    phone: "+251911000018", role: "branch", subCity: "Yeka",   workId: "BC-0004", faydaFan: "1000000000000018" },
  { name: "Helen Bekele",   email: "helen.bekele@gmail.com",   phone: "+251911000019", role: "owner",  subCity: "Yeka",   workId: "SO-00013", faydaFan: "1000000000000019" },
  { name: "Zelalem Bekele", email: "zelalem.bekele@gmail.com", phone: "+251911000020", role: "owner",  subCity: "Yeka",   workId: "SO-00014", faydaFan: "1000000000000020" },
  { name: "Bethel Bekele",  email: "bethel.bekele@gmail.com",  phone: "+251911000021", role: "owner",  subCity: "Yeka",   workId: "SO-00015", faydaFan: "1000000000000021" },
  { name: "Nahom Bekele",   email: "nahom.bekele@gmail.com",   phone: "+251911000022", role: "owner",  subCity: "Yeka",   workId: "SO-00016", faydaFan: "1000000000000022" },
  // Lideta
  { name: "Frehiwot Bekele",email: "branch.lideta@gmail.com",  phone: "+251911000023", role: "branch", subCity: "Lideta", workId: "BC-0005", faydaFan: "1000000000000023" },
  { name: "Mesfin Bekele",  email: "mesfin.bekele@gmail.com",  phone: "+251911000024", role: "owner",  subCity: "Lideta", workId: "SO-00017", faydaFan: "1000000000000024" },
  { name: "Tirsit Bekele",  email: "tirsit.bekele@gmail.com",  phone: "+251911000025", role: "owner",  subCity: "Lideta", workId: "SO-00018", faydaFan: "1000000000000025" },
  { name: "Yared Bekele",   email: "yared.bekele@gmail.com",   phone: "+251911000026", role: "owner",  subCity: "Lideta", workId: "SO-00019", faydaFan: "1000000000000026" },
  { name: "Lily Bekele",    email: "lily.bekele@gmail.com",    phone: "+251911000027", role: "owner",  subCity: "Lideta", workId: "SO-00020", faydaFan: "1000000000000027" },
  // Akaki Kality
  { name: "Robel Bekele",      email: "branch.akakikality@gmail.com",phone: "+251911000028", role: "branch", subCity: "Akaki Kality", workId: "BC-0006", faydaFan: "1000000000000028" },
  { name: "Birtukan Bekele",   email: "birtukan.bekele@gmail.com",   phone: "+251911000029", role: "owner",  subCity: "Akaki Kality", workId: "SO-00021", faydaFan: "1000000000000029" },
  { name: "Samson Bekele",     email: "samson.bekele@gmail.com",     phone: "+251911000030", role: "owner",  subCity: "Akaki Kality", workId: "SO-00022", faydaFan: "1000000000000030" },
  { name: "Eyerusalem Bekele", email: "eyerusalem.bekele@gmail.com", phone: "+251911000031", role: "owner",  subCity: "Akaki Kality", workId: "SO-00023", faydaFan: "1000000000000031" },
  { name: "Dereje Bekele",     email: "dereje.bekele@gmail.com",     phone: "+251911000032", role: "owner",  subCity: "Akaki Kality", workId: "SO-00024", faydaFan: "1000000000000032" },
  // Addis Ketema
  { name: "Lulit Bekele",      email: "branch.addisketema@gmail.com",phone: "+251911000033", role: "branch", subCity: "Addis Ketema", workId: "BC-0007", faydaFan: "1000000000000033" },
  { name: "Kalkidan Bekele",   email: "kalkidan.bekele@gmail.com",   phone: "+251911000034", role: "owner",  subCity: "Addis Ketema", workId: "SO-00025", faydaFan: "1000000000000034" },
  { name: "Bemnet Bekele",     email: "bemnet.bekele@gmail.com",     phone: "+251911000035", role: "owner",  subCity: "Addis Ketema", workId: "SO-00026", faydaFan: "1000000000000035" },
  { name: "Yohanna Bekele",    email: "yohanna.bekele@gmail.com",    phone: "+251911000036", role: "owner",  subCity: "Addis Ketema", workId: "SO-00027", faydaFan: "1000000000000036" },
  { name: "Samuel Bekele",     email: "samuel.bekele@gmail.com",     phone: "+251911000037", role: "owner",  subCity: "Addis Ketema", workId: "SO-00028", faydaFan: "1000000000000037" },
  // Gulele
  { name: "Alemnesh Bekele",   email: "branch.gulele@gmail.com",     phone: "+251911000038", role: "branch", subCity: "Gulele",       workId: "BC-0008", faydaFan: "1000000000000038" },
  { name: "Wendwosen Bekele",  email: "wendwosen.bekele@gmail.com",  phone: "+251911000039", role: "owner",  subCity: "Gulele",       workId: "SO-00029", faydaFan: "1000000000000039" },
  { name: "Tibebu Bekele",     email: "tibebu.bekele@gmail.com",     phone: "+251911000040", role: "owner",  subCity: "Gulele",       workId: "SO-00030", faydaFan: "1000000000000040" },
  { name: "Helina Bekele",     email: "helina.bekele@gmail.com",     phone: "+251911000041", role: "owner",  subCity: "Gulele",       workId: "SO-00031", faydaFan: "1000000000000041" },
  { name: "Gelila Bekele",     email: "gelila.bekele@gmail.com",     phone: "+251911000042", role: "owner",  subCity: "Gulele",       workId: "SO-00032", faydaFan: "1000000000000042" },
  // Nifas Silk-Lafto
  { name: "Beza Bekele",       email: "branch.nifassilklafto@gmail.com", phone: "+251911000043", role: "branch", subCity: "Nifas Silk-Lafto", workId: "BC-0009", faydaFan: "1000000000000043" },
  { name: "Hiwot Bekele",      email: "hiwot.bekele@gmail.com",      phone: "+251911000044", role: "owner",  subCity: "Nifas Silk-Lafto", workId: "SO-00033", faydaFan: "1000000000000044" },
  { name: "Endalk Bekele",     email: "endalk.bekele@gmail.com",     phone: "+251911000045", role: "owner",  subCity: "Nifas Silk-Lafto", workId: "SO-00034", faydaFan: "1000000000000045" },
  { name: "Aster Bekele",      email: "aster.bekele@gmail.com",      phone: "+251911000046", role: "owner",  subCity: "Nifas Silk-Lafto", workId: "SO-00035", faydaFan: "1000000000000046" },
  { name: "Genet Bekele",      email: "genet.bekele@gmail.com",      phone: "+251911000047", role: "owner",  subCity: "Nifas Silk-Lafto", workId: "SO-00036", faydaFan: "1000000000000047" },
  // Kolfe Keranio
  { name: "Berhanu Bekele",    email: "branch.kolfekeranio@gmail.com",phone: "+251911000048", role: "branch", subCity: "Kolfe Keranio", workId: "BC-0010", faydaFan: "1000000000000048" },
  { name: "Meron Bekele",      email: "meron.bekele@gmail.com",      phone: "+251911000049", role: "owner",  subCity: "Kolfe Keranio", workId: "SO-00037", faydaFan: "1000000000000049" },
  { name: "Saba Bekele",       email: "saba.bekele@gmail.com",       phone: "+251911000050", role: "owner",  subCity: "Kolfe Keranio", workId: "SO-00038", faydaFan: "1000000000000050" },
  { name: "Hawi Bekele",       email: "hawi.bekele@gmail.com",       phone: "+251911000051", role: "owner",  subCity: "Kolfe Keranio", workId: "SO-00039", faydaFan: "1000000000000051" },
  { name: "Joseph Bekele",     email: "joseph.bekele@gmail.com",     phone: "+251911000052", role: "owner",  subCity: "Kolfe Keranio", workId: "SO-00040", faydaFan: "1000000000000052" },
  // Lemi Kura
  { name: "Hilina Bekele",     email: "branch.lemikura@gmail.com",   phone: "+251911000053", role: "branch", subCity: "Lemi Kura",    workId: "BC-0011", faydaFan: "1000000000000053" },
  { name: "Kidist Bekele",     email: "kidist.bekele@gmail.com",     phone: "+251911000054", role: "owner",  subCity: "Lemi Kura",    workId: "SO-00041", faydaFan: "1000000000000054" },
  { name: "Maeza Bekele",      email: "maeza.bekele@gmail.com",      phone: "+251911000055", role: "owner",  subCity: "Lemi Kura",    workId: "SO-00042", faydaFan: "1000000000000055" },
  { name: "Mahder Bekele",     email: "mahder.bekele@gmail.com",     phone: "+251911000056", role: "owner",  subCity: "Lemi Kura",    workId: "SO-00043", faydaFan: "1000000000000056" },
  { name: "Yabsira Bekele",    email: "yabsira.bekele@gmail.com",    phone: "+251911000057", role: "owner",  subCity: "Lemi Kura",    workId: "SO-00044", faydaFan: "1000000000000057" },
];

async function adminFetch(path, init = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function findUserIdByEmail(email) {
  // Supabase admin /users API supports filtering by email (page-based).
  const r = await adminFetch(`/auth/v1/admin/users?filter=email.eq.${encodeURIComponent(email)}`);
  if (!r.ok) return null;
  const data = await r.json();
  return (data.users || []).find(u => u.email === email)?.id || null;
}

async function createUser(email, password) {
  const r = await adminFetch(`/auth/v1/admin/users`, {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const body = await r.json();
  if (!r.ok) {
    if (body.msg?.includes("already") || body.error_code === "email_exists") return null;
    throw new Error(`${email}: ${JSON.stringify(body)}`);
  }
  return body.id || body.user?.id;
}

async function upsertProfile(id, a) {
  const row = {
    id,
    name: a.name,
    phone: a.phone,
    role: a.role,
    sub_city: a.subCity,
    committee_id: a.committeeId || null,
    work_id: a.workId,
    fayda_fan: a.faydaFan,
  };
  const r = await adminFetch(`/rest/v1/profiles?on_conflict=id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`profile ${a.email}: ${await r.text()}`);
}

(async () => {
  let created = 0, existed = 0, failed = 0;
  for (const a of ACCOUNTS) {
    try {
      let id = await findUserIdByEmail(a.email);
      if (id) {
        existed++;
      } else {
        id = await createUser(a.email, PASSWORD);
        if (!id) { existed++; id = await findUserIdByEmail(a.email); }
        else created++;
      }
      if (!id) throw new Error("no id");
      await upsertProfile(id, a);
      console.log(`OK  ${a.email}  (${a.role}, ${a.workId})`);
    } catch (e) {
      failed++;
      console.error(`ERR ${a.email}: ${e.message}`);
    }
  }
  console.log(`\nDone. created=${created} existed=${existed} failed=${failed}`);
})();
