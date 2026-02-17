try { require("dotenv").config(); } catch {}

/* =========================
   Imports
========================= */
const express = require("express");
const cors = require("cors");

const multer = require("multer");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const cloudinary = require("cloudinary").v2;
const crypto = require("crypto");
const { parse } = require("csv-parse/sync"); // ✅ NEU: CSV Parser (Preview/Import)


/* =========================
   Session (HMAC)
========================= */
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  console.error("❌ SESSION_SECRET fehlt in ENV");
  process.exit(1);
}

function b64url(input) {
  return Buffer.from(String(input), "utf8").toString("base64url");
}
function makeSessionPayload(user) {
  return { id: user.id, role: user.role || "privat", email: user.email || "" };
}
function sign(val) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(val).digest("base64url");
}
function encodeSession(obj) {
  const body = b64url(JSON.stringify(obj));
  const sig = sign(body);
  return `${body}.${sig}`;
}
function decodeSession(token) {
  if (!token || typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  try {
    const expected = sign(body);
    const a = Buffer.from(expected, "base64url");
    const b = Buffer.from(sig, "base64url");
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;

    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* 🔎 Search/Filter Utils (für /api/search) – einmalig hier einbinden */
/* ------------------------------------------------------------------ */
const escRe = (s) => String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const splitCsv = (v) =>
  v ? String(v).split(",").map(s => s.trim()).filter(Boolean) : [];

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, ""); // Umlaute/Diakritika entfernen

function driveCanon(raw) {
  const s = norm(raw);
  if (!s) return "";
  if (/(quattro|xdrive|4matic|4motion|awd|allrad|4x4|4wd|all[-\s]?wheel)/.test(s)) return "allrad";
  if (/(fwd|front|vorderrad|frontantrieb)/.test(s)) return "frontantrieb";
  if (/(rwd|heck|hinterrad|heckantrieb|rear)/.test(s)) return "heckantrieb";
  return s;
}

function fuelCanon(raw) {
  const s = String(raw || "").trim().toLowerCase();

  const flat = s
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[()./\\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!flat) return "";

  // 1) Spezifische Synonyme zuerst
  if (/(^|\s)autogas(\s|$)/.test(flat) || /\blpg\b/.test(s)) return "autogas";
  if (/(^|\s)erdgas(\s|$)/.test(flat) || /\bcng\b/.test(s)) return "cng";

  const isHybrid = /(hybrid|plug[\s-]?in|plugin|phev|mhev|hev)/.test(flat);
  const isDiesel = /diesel/.test(flat);
  const isBenzin = /(benzin|super|e10|e5|e95|e98|otto|petrol|gasoline)/.test(flat);

  // 2) Hybrid mit Unterarten
  if (isHybrid) {
    if (isDiesel && !isBenzin) return "hybrid-diesel";
    if (isBenzin && !isDiesel) return "hybrid-benzin";
    return "hybrid";
  }

  // 3) Standards
  if (isDiesel) return "diesel";
  if (isBenzin) return "benzin";
  if (/(elektro|electric|bev|strom|ev)/.test(flat)) return "elektrisch";

  // 4) Optional
  if (/(wasserstoff|hydrogen|h2)/.test(flat)) return "wasserstoff";
  if (/(ethanol|e85|flex\s?fuel)/.test(flat)) return "ethanol";

  return flat;
}

const FUEL_REGEX = {
  benzin: /benzin|super|e10|e5|e95|e98|otto|petrol|gasoline/i,
  diesel: /diesel/i,
  elektrisch: /elektro|electric|bev|strom|ev/i,

  hybrid: /hybrid|plug[\s-]?in|plugin|phev|mhev|hev/i,

  "hybrid-benzin": /(?=.*(hybrid|plug[\s-]?in|plugin|phev|mhev|hev))(?=.*(benzin|super|e10|e5|e95|e98|otto|petrol|gasoline))/i,
  "hybrid-diesel": /(?=.*(hybrid|plug[\s-]?in|plugin|phev|mhev|hev))(?=.*diesel)/i,

  autogas: /autogas|\blpg\b/i,
  cng: /erdgas|\bcng\b/i,
  wasserstoff: /wasserstoff|hydrogen|\bh2\b/i,
  ethanol: /ethanol|e85|flex\s*fuel/i
};

/* ------------------------------------------------------------------ */
/* --- HU: Datumshelfer (YYYY-MM, MM/YYYY, Monatsname YYYY, YYYY) --- */
/* ------------------------------------------------------------------ */
function parseYMServer(input, fallbackMonthIfYearOnly = 1) {
  if (!input) return null;
  const s = String(input).trim();

  // 1) YYYY-MM
  let m = s.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (m) {
    const y = +m[1], mo = Math.min(12, Math.max(1, +m[2]));
    return new Date(Date.UTC(y, mo - 1, 1));
  }

  // 2) MM/YYYY
  m = s.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (m) {
    const y = +m[2], mo = Math.min(12, Math.max(1, +m[1]));
    return new Date(Date.UTC(y, mo - 1, 1));
  }

  // 3) Monatsname + Jahr (de/en)
  const rxName = /(jan(?:uar)?|feb(?:ruar)?|märz|maerz|marz|apr(?:il)?|mai|may|jun(?:i)?|jul(?:i)?|aug(?:ust)?|sep(?:t|tember)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|dez(?:ember)?|dec(?:ember)?)/i;
  m = s.match(new RegExp(`^${rxName.source}\\s+(\\d{4})$`, "i"));
  if (m) {
    const name = m[1].toLowerCase(), y = +m[2];
    const toMo = (n) =>
      /^jan/.test(n) ? 1  : /^feb/.test(n) ? 2  :
      /(märz|maerz|marz)/.test(n) ? 3 :
      /^apr/.test(n) ? 4  : /(mai|may)/.test(n) ? 5  :
      /^jun/.test(n) ? 6  : /^jul/.test(n) ? 7  :
      /^aug/.test(n) ? 8  : /^sep/.test(n) ? 9  :
      /(okt|oct)/.test(n) ? 10 : /^nov/.test(n) ? 11 :
      /(dez|dec)/.test(n) ? 12 : 1;
    const mo = toMo(name);
    return new Date(Date.UTC(y, mo - 1, 1));
  }

  // 4) Nur Jahr
  m = s.match(/^(\d{4})$/);
  if (m) {
    const y = +m[1], mo = Math.min(12, Math.max(1, fallbackMonthIfYearOnly || 1));
    return new Date(Date.UTC(y, mo - 1, 1));
  }
  return null;
}

// Differenz in Monaten (1-basig, kompatibel zu hu_key = year*12+month)
function monthsLeftFromToday(d) {
  if (!(d instanceof Date)) return NaN;
  const now = new Date();
  const yNow = now.getUTCFullYear(), mNow = now.getUTCMonth() + 1;
  const yItm = d.getUTCFullYear(),   mItm = d.getUTCMonth() + 1;
  return (yItm * 12 + mItm) - (yNow * 12 + mNow);
}

/* =========================
   Express Initialisierung
========================= */
const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.set("trust proxy", 1);

/* =========================
   CORS (Expo Web / localhost + Production)
   - nötig für Browser (localhost:8082), nicht für native
========================= */
const allowedOrigins = new Set([
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:19006",
  "http://127.0.0.1:8081",
  "http://127.0.0.1:8082",
  "http://127.0.0.1:19006",
  "https://www.autovisa.de",
  "https://autovisa.de",
]);

const corsOptions = {
  origin: (origin, cb) => {
    // Native Requests (iOS/Android) haben oft keinen Origin -> erlauben
    if (!origin) return cb(null, true);

    if (allowedOrigins.has(origin)) return cb(null, true);

    // blocken (Browser würde sonst CORS-Fehler bekommen)
    return cb(null, false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // wichtig, falls du später Cookies/Login im Web nutzt
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));


// Helper: saubere URLs aus ENV
function getUrls() {
  const api = process.env.API_URL || process.env.BASE_URL || `http://localhost:${PORT}`;
  const appUrl = process.env.PUBLIC_APP_URL || api;
  return { api, appUrl };
}

/* =========================
   MongoDB Konfiguration
========================= */
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error("❌ MONGODB_URI fehlt in ENV");
  process.exit(1);
}

const client = new MongoClient(mongoUri);
let db;

client.connect()
  .then(async () => {
    db = client.db("autovisa");
    console.log("✅ MongoDB verbunden");

    await db.collection("inserate").createIndex({ standortCoords: "2dsphere" });
    await db.collection("geocache").createIndex({ key: 1 }, { unique: true });
    await db.collection("savedInserate").createIndex(
      { userId: 1, fahrzeugId: 1 },
      { unique: true }
    );
    await db.collection("inserate").createIndex(
      { sellerId: 1, stockNumber: 1 },
      { unique: true }
    );
    
    await db.collection("geosuggest").createIndex({ key: 1 }, { unique: true });
    await db.collection("geosuggest").createIndex(
      { updatedAt: 1 },
      { expireAfterSeconds: 60 * 60 * 24 * 30 }
    );

    await db.collection("nutzer").createIndex({ email: 1 }, { unique: true });

    // ✅ TTL für Fahrzeugs-Entwürfe: 30 Minuten ab letzter Änderung
    await db.collection("fahrzeugeEntwurf").createIndex(
      { updatedAt: 1 },
      { expireAfterSeconds: 60 * 30 }
    );

    // Alte Entwürfe ohne updatedAt einmalig „heilen“
    await db.collection("fahrzeugeEntwurf").updateMany(
      { updatedAt: { $exists: false } },
      { $set: { updatedAt: new Date() } }
    );

    console.log("✅ Indexe inkl. TTL für fahrzeugeEntwurf bereit");
  })
  .catch(err => console.error("❌ MongoDB-Verbindung fehlgeschlagen:", err));

/* =========================
   Cloudinary Konfiguration
========================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* =========================
   Middleware
========================= */
// Body-Limits nur für Text (Dateien sind davon unberührt)
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());

/* =========================
   Auth Helper: req.user aus Session-Cookie setzen
   (damit API-Routen "req.user" nutzen können)
========================= */
app.use((req, res, next) => {
  if (req.user) return next(); // falls du es an anderer Stelle bereits setzt
  const token = req.cookies?.session;
  const payload = decodeSession(token);
  if (payload) req.user = payload; // { id, role, email }
  next();
});

/* =========================
   Statische Dateien
========================= */
app.use(express.static(path.join(__dirname, "public")));
app.use("/data", express.static(path.join(__dirname, "data"), {
  dotfiles: "ignore",
  etag: true,
  maxAge: "1d"
}));

/* =========================
   Startseite
========================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =========================
   Multer (A): Medien (Bilder/Video) auf Disk
========================= */
const TMP_DIR = path.join(__dirname, "uploads_tmp");
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TMP_DIR),
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname) || "";
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "_").slice(0, 60);
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${base}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { files: 21 }, // 20 Bilder + 1 Video
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/");
    cb(ok ? null : new Error("Nur Bild- oder Videodateien sind erlaubt."), ok);
  }
});

// Helper: lokale Datei → Cloudinary (Bilder normal, Videos chunked)
async function uploadFileToCloudinary(filePath, { folder, resource_type }) {
  const isVideo = resource_type === "video";
  const options = { folder, resource_type };

  if (isVideo) {
    options.chunk_size = 20 * 1024 * 1024;
    return cloudinary.uploader.upload_large(filePath, options);
  }
  return cloudinary.uploader.upload(filePath, options);
}


/* =========================
   Händler CSV Import (Preview + Commit)
   - upload: memory (kein TMP)
   - upsert: (sellerId, stockNumber) -> keine Duplikate
========================= */

// Multer: CSV in Memory
const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 } // 8MB
});

// Guard: DB ready
function requireDb(req, res, next) {
  if (!db) return res.status(503).send("DB noch nicht bereit. Bitte erneut versuchen.");
  next();
}

// Nur Händler/Admin
function requireDealer(req, res, next) {
  if (!req.user) return res.status(401).send("Nicht eingeloggt");
  const role = String(req.user.role || "").toLowerCase();
  if (role !== "haendler" && role !== "admin") {
    return res.status(403).send("Nur Händlerzugriff");
  }
  next();
}

function guessDelimiter(text) {
  const firstLine = (text.split(/\r?\n/)[0] || "");
  const semis = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (tabs > semis && tabs > commas) return "\t";
  return semis >= commas ? ";" : ",";
}

const HEADER_ALIASES = {
  // IDs
  stocknumber: "stock_number",
  stockno: "stock_number",
  stocknr: "stock_number",
  stock_num: "stock_number",
  stocknummer: "stock_number",
  vin: "stock_number",
  fin: "stock_number",
  fahrgestellnummer: "stock_number",
  fahrgestell_nr: "stock_number",
  vehicleid: "stock_number",
  vehicle_id: "stock_number",
  listingid: "stock_number",
  listing_id: "stock_number",
  advertid: "stock_number",
  advert_id: "stock_number",
  inseratid: "stock_number",
  inserat_id: "stock_number",
  kundennummer: "customer_number",
  customer_number: "customer_number",
  customer_no: "customer_number",
  customerid: "customer_number",
  customer_id: "customer_number",
  internal_number: "stock_number",
  internalnumber: "stock_number",
  interne_nummer: "interne_nummer",
  interne_nr: "interne_nummer",
  intern_nr: "interne_nummer",
  inventory_number: "stock_number",
  inventoryno: "stock_number",
  inventory_nr: "stock_number",
  fahrzeugnummer: "stock_number",
  fahrzeug_nr: "stock_number",
  fahrzeugnr: "stock_number",
  fahrzeug_id: "stock_number",
  fahrzeugid: "stock_number",
  artikelnummer: "stock_number",
  artikel_nr: "stock_number",
  stock_id: "stock_number",
  stockid: "stock_number",
  // Title
  title: "title",
  titel: "title",
  bezeichnung: "title",
  fahrzeugtitel: "title",
  modellbezeichnung: "title",
  verkauf_titel: "title",
  remark: "description",
  bemerkung: "description",
  descriptiontext: "description",
  // Make / Model / Variant
  marke: "make",
  hersteller: "make",
  brand: "make",
  make: "make",
  manufacturer: "make",
  verkauf_marke: "make",
  modell: "model",
  model: "model",
  baureihe: "model",
  serie: "model",
  series: "model",
  verkauf_modell: "model",
  kategorie: "category",
  category: "category",
  fahrzeugart: "vehicle_type",
  vehiclecategory: "category",
  variante: "variant",
  variant: "variant",
  ausstattung_variante: "variant",
  modellvariante: "variant",
  trim: "variant",
  version: "variant",
  verkauf_variante: "variant",
  verkauf_ausstattung_variante: "variant",
  // Price
  priceeur: "price_eur",
  preis_eur: "price_eur",
  preiseuro: "price_eur",
  price: "price_eur",
  preis: "price_eur",
  verkaufspreis: "price_eur",
  verkauf_preis: "price_eur",
  bruttopreis: "price_gross",
  brutto_preis: "price_gross",
  gross_price: "price_gross",
  grossprice: "price_gross",
  price_gross: "price_gross",
  price_gross_eur: "price_gross",
  price_gross_text: "price_gross",
  verkauf_brutto: "price_gross",
  nettopreis: "price_net",
  netto_preis: "price_net",
  net_price: "price_net",
  netprice: "price_net",
  price_net: "price_net",
  price_net_eur: "price_net",
  price_net_text: "price_net",
  verkauf_netto: "price_net",
  // Mileage
  mileagekm: "mileage_km",
  mileage: "mileage_km",
  kilometer: "mileage_km",
  kilometerstand: "mileage_km",
  laufleistung: "mileage_km",
  km: "mileage_km",
  kilometre: "mileage_km",
  kilometres: "mileage_km",
  mileage_km: "mileage_km",
  verkauf_kilometer: "mileage_km",
  // First registration
  firstregistration: "first_registration",
  first_registration: "first_registration",
  reg_date: "first_registration",
  regdate: "first_registration",
  registration_date: "first_registration",
  registrationdate: "first_registration",
  erstzulassung: "first_registration",
  zulassung: "first_registration",
  ez: "first_registration",
  verkauf_erstzulassung: "first_registration",
  verkauf_ez_monat: "reg_month",
  verkauf_ez_jahr: "reg_year",
  ez_monat: "reg_month",
  ez_mon: "reg_month",
  zulassungsmonat: "reg_month",
  reg_month: "reg_month",
  ez_jahr: "reg_year",
  ez_year: "reg_year",
  zulassungsjahr: "reg_year",
  reg_year: "reg_year",
  baujahr: "reg_year",
  // Specs
  kraftstoff: "fuel",
  fuel: "fuel",
  fuel_type: "fuel",
  fuel_category: "fuel",
  fuel_category_text: "fuel",
  fuel_type_text: "fuel",
  verkauf_kraftstoff: "fuel",
  getriebe: "gearbox",
  transmission: "gearbox",
  gearbox: "gearbox",
  verkauf_getriebe: "gearbox",
  leistung: "power_ps",
  leistung_ps: "power_ps",
  ps: "power_ps",
  power_ps: "power_ps",
  verkauf_leistung: "power_ps",
  performance: "power_kw",
  leistung_kw: "power_kw",
  kw: "power_kw",
  power_kw: "power_kw",
  verkauf_leistung_kw: "power_kw",
  hubraum: "displacement_ccm",
  ccm: "displacement_ccm",
  displacement: "displacement_ccm",
  verkauf_hubraum: "displacement_ccm",
  tueren: "doors",
  türen: "doors",
  doors: "doors",
  verkauf_tueren: "doors",
  sitze: "seats",
  seats: "seats",
  verkauf_sitze: "seats",
  // Colors
  farbe: "color",
  color: "color",
  colour: "color",
  verkauf_farbe: "color",
  aussenfarbe: "exterior_color",
  außenfarbe: "exterior_color",
  exterior_color: "exterior_color",
  verkauf_aussenfarbe: "exterior_color",
  innenfarbe: "interior_color",
  interior_color: "interior_color",
  verkauf_innenfarbe: "interior_color",
  innenmaterial: "interior_material",
  sitzmaterial: "interior_material",
  interior_material: "interior_material",
  verkauf_innenmaterial: "interior_material",
  karosseriefarbe: "body_color",
  body_color: "body_color",
  verkauf_karosseriefarbe: "body_color",
  // Type / Body
  fahrzeugtyp: "vehicle_type",
  vehicle_type: "vehicle_type",
  karosserie: "vehicle_type",
  karosserieform: "vehicle_type",
  body_type: "vehicle_type",
  verkauf_fahrzeugtyp: "vehicle_type",
  // Description / Equipment
  beschreibung: "description",
  description: "description",
  text: "description",
  verkauf_beschreibung: "description",
  kurzbeschreibung: "short_description",
  short_description: "short_description",
  teaser: "short_description",
  verkauf_kurzbeschreibung: "short_description",
  ausstattung: "equipment",
  equipment: "equipment",
  features: "equipment",
  extras: "equipment",
  options: "equipment",
  verkauf_ausstattung: "equipment",
  // Accident / VAT
  unfallfrei: "accident_free",
  accident_free: "accident_free",
  verkauf_unfallfrei: "accident_free",
  unfall: "accident_history",
  unfallhistorie: "accident_history",
  accident_history: "accident_history",
  verkauf_unfall: "accident_history",
  verkauf_unfallhistorie: "accident_history",
  damaged_vehicle: "beschaedigt",
  beschaedigt: "beschaedigt",
  beschaedigt_fahrzeug: "beschaedigt",
  oldtimer: "classic_vehicle",
  classic_vehicle: "classic_vehicle",
  mwst: "vat",
  ust: "vat",
  vat: "vat",
  tax: "vat",
  verkauf_mwst: "vat",
  mwstsatz: "vat_rate",
  vat_rate: "vat_rate",
  // Emissions / consumption
  emissionsklasse: "emission_class",
  emission_class: "emission_class",
  verkauf_emissionsklasse: "emission_class",
  schadstoffklasse: "pollution_class",
  verkauf_schadstoffklasse: "pollution_class",
  umweltplakette: "environmental_badge",
  environmental_badge: "environmental_badge",
  verkauf_umweltplakette: "environmental_badge",
  co2: "co2_emission",
  co2_emission: "co2_emission",
  co2emission: "co2_emission",
  verkauf_co2_emission: "co2_emission",
  co2_klasse: "co2_class",
  co2klasse: "co2_class",
  verkauf_co2_klasse: "co2_class",
  verbrauch_kombiniert: "consumption_combined",
  verbrauch: "consumption_combined",
  wltp_kombiniert: "consumption_combined",
  fuel_cons_text: "consumption_combined",
  fuel_cons: "consumption_combined",
  fuel_consumption: "consumption_combined",
  verkauf_verbrauch_kombiniert: "consumption_combined",
  verbrauch_innerorts: "consumption_city",
  verkauf_verbrauch_innerorts: "consumption_city",
  verbrauch_ausserorts: "consumption_highway",
  verkauf_verbrauch_ausserorts: "consumption_highway",
  // Drive / comfort
  antrieb: "drivetrain",
  antriebsart: "drivetrain",
  drivetrain: "drivetrain",
  verkauf_antrieb: "drivetrain",
  klimatisierung: "climate",
  klima: "climate",
  ac: "climate",
  aircondition: "climate",
  verkauf_klimatisierung: "climate",
  einparkhilfe: "parking_assist",
  einparkhilfe_selbstlenkend: "parking_assist_self",
  verkauf_einparkhilfe: "parking_assist",
  verkauf_einparkhilfeselbstlenkend: "parking_assist_self",
  scheinwerfer: "headlights",
  verkauf_scheinwerfer: "headlights",
  tagfahrlicht: "daytime_running_lights",
  verkauf_tagfahrlicht: "daytime_running_lights",
  kurvenlicht: "curve_light",
  verkauf_kurvenlicht: "curve_light",
  partikelfilter: "particulate_filter",
  verkauf_partikelfilter: "particulate_filter",
  metallic: "metallic",
  verkauf_metallic: "metallic",
  // Owners / HU
  halter: "previous_owners",
  anzahlhalter: "previous_owners",
  verkauf_halter: "previous_owners",
  owners_text: "previous_owners",
  owners: "previous_owners",
  owner_count: "previous_owners",
  hu: "hu",
  mot: "hu",
  tuv: "hu",
  tuev: "hu",
  tüv: "hu",
  verkauf_hu: "hu",
  hu_bis: "hu_until",
  tuv_bis: "hu_until",
  tuev_bis: "hu_until",
  tüv_bis: "hu_until",
  verkauf_hu_bis: "hu_until",
  // Location / Contact
  standort: "location",
  location: "location",
  verkauf_standort: "location",
  waehrung: "currency",
  currency: "currency",
  bild_id: "image_id",
  image_id: "image_id",
  dealer_price: "dealer_price",
  haendlerpreis: "dealer_price",
  our_recommendation: "recommendation",
  empfehlung: "recommendation",
  one_year_old_car: "one_year_old_car",
  jahreswagen: "one_year_old_car",
  new_car: "new_car",
  neufahrzeug: "new_car",
  vorfuehrwagen: "demo_car",
  demo_car: "demo_car",
  plz: "postal_code",
  zip: "postal_code",
  postal_code: "postal_code",
  verkauf_plz: "postal_code",
  ort: "city",
  city: "city",
  verkauf_ort: "city",
  strasse: "street",
  street: "street",
  hausnummer: "street_no",
  street_no: "street_no",
  telefon: "phone",
  phone: "phone",
  verkauf_telefon: "phone",
  // Media
  image_urls: "image_urls",
  image_url: "image_urls",
  imageurl: "image_urls",
  images: "image_urls",
  bilder: "image_urls",
  bild: "image_urls",
  video_url: "video_url",
  videourl: "video_url",
  videolink: "video_url",
  video: "video_url"
};

function normalizeHeaderKey(header, index) {
  const raw = String(header || "").replace(/^\uFEFF/, "").trim();
  if (!raw) return `col_${index + 1}`;
  const normalized = raw
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[\s\-]+/g, "_")
    .replace(/[^\w]/g, "");
  if (HEADER_ALIASES[normalized]) return HEADER_ALIASES[normalized];

  // Heuristics für unbekannte Header
  if (/(^|_)preis($|_)/.test(normalized) || normalized.includes("price")) {
    if (normalized.includes("netto")) return "price_net";
    if (normalized.includes("brutto") || normalized.includes("gross")) return "price_gross";
    return "price_eur";
  }
  if (/(^|_)km($|_)/.test(normalized) || normalized.includes("kilometer") || normalized.includes("mileage")) {
    return "mileage_km";
  }
  if (normalized.includes("erstzulassung") || normalized.includes("zulassung") || normalized === "ez") {
    return "first_registration";
  }
  if (normalized.includes("marke") || normalized.includes("brand") || normalized.includes("make")) {
    return "make";
  }
  if (normalized.includes("modell") || normalized.includes("model")) {
    return "model";
  }
  if (normalized.includes("variante") || normalized.includes("trim") || normalized.includes("version")) {
    return "variant";
  }
  if (normalized.includes("kraftstoff") || normalized.includes("fuel")) {
    return "fuel";
  }
  if (normalized.includes("getriebe") || normalized.includes("gear")) {
    return "gearbox";
  }
  if (normalized.includes("leistung") || normalized.includes("ps")) {
    return normalized.includes("kw") ? "power_kw" : "power_ps";
  }
  if (normalized.includes("hubraum") || normalized.includes("ccm")) {
    return "displacement_ccm";
  }
  if (normalized.includes("tueren") || normalized.includes("turen") || normalized.includes("doors")) {
    return "doors";
  }
  if (normalized.includes("sitze") || normalized.includes("seats")) {
    return "seats";
  }
  if (normalized.includes("aussenfarbe") || normalized.includes("außenfarbe") || normalized.includes("exterior")) {
    return "exterior_color";
  }
  if (normalized.includes("innenfarbe") || normalized.includes("interior_color")) {
    return "interior_color";
  }
  if (normalized.includes("innenmaterial") || normalized.includes("interior_material")) {
    return "interior_material";
  }
  if (normalized.includes("karosserie") || normalized.includes("body")) {
    return "vehicle_type";
  }
  if (normalized.includes("beschreibung") || normalized.includes("description")) {
    return normalized.includes("kurz") ? "short_description" : "description";
  }
  if (normalized.includes("ausstattung") || normalized.includes("equipment") || normalized.includes("features")) {
    return "equipment";
  }
  if (normalized.includes("unfallfrei") || normalized.includes("accidentfree")) {
    return "accident_free";
  }
  if (normalized.includes("unfall")) {
    return "accident_history";
  }
  if (normalized.includes("emission")) {
    return "emission_class";
  }
  if (normalized.includes("schadstoff")) {
    return "pollution_class";
  }
  if (normalized.includes("co2")) {
    return normalized.includes("klasse") ? "co2_class" : "co2_emission";
  }
  if (normalized.includes("verbrauch")) {
    if (normalized.includes("inner")) return "consumption_city";
    if (normalized.includes("ausser") || normalized.includes("außer")) return "consumption_highway";
    return "consumption_combined";
  }
  if (normalized.includes("antrieb") || normalized.includes("drivetrain")) {
    return "drivetrain";
  }
  if (normalized.includes("klima")) {
    return "climate";
  }
  if (normalized.includes("einpark")) {
    return normalized.includes("selbst") ? "parking_assist_self" : "parking_assist";
  }
  if (normalized.includes("scheinwerfer")) {
    return "headlights";
  }
  if (normalized.includes("tagfahr")) {
    return "daytime_running_lights";
  }
  if (normalized.includes("kurvenlicht")) {
    return "curve_light";
  }
  if (normalized.includes("umweltplakette")) {
    return "environmental_badge";
  }
  if (normalized.includes("partikelfilter")) {
    return "particulate_filter";
  }
  if (normalized.includes("metallic")) {
    return "metallic";
  }
  if (normalized.includes("halter") || normalized.includes("owner")) {
    return "previous_owners";
  }
  if (normalized.includes("tuv") || normalized.includes("tuev") || normalized.includes("tüv") || normalized === "hu") {
    return normalized.includes("bis") ? "hu_until" : "hu";
  }
  if (normalized.includes("standort") || normalized.includes("location")) {
    return "location";
  }
  if (normalized.includes("plz") || normalized.includes("postal") || normalized.includes("zip")) {
    return "postal_code";
  }
  if (normalized === "ort" || normalized === "city") {
    return "city";
  }
  if (normalized.includes("strasse") || normalized.includes("street")) {
    return "street";
  }
  if (normalized.includes("hausnummer") || normalized.includes("street_no")) {
    return "street_no";
  }
  if (normalized.includes("telefon") || normalized.includes("phone")) {
    return "phone";
  }

  return normalized;
}

function normalizeHeaders(headers = []) {
  return headers.map((h, i) => normalizeHeaderKey(h, i));
}

function normalizeRecordKeys(record = {}) {
  const out = {};
  if (!record || typeof record !== "object") return out;
  Object.entries(record).forEach(([key, value]) => {
    const nk = normalizeHeaderKey(key, 0);
    if (out[nk] === undefined || out[nk] === null || out[nk] === "") {
      out[nk] = value;
    }
  });
  return out;
}

function unwrapRecord(record) {
  if (!record || typeof record !== "object") return {};
  let base = { ...record };
  const candidates = ["vehicle", "listing", "inserat", "car", "data", "item", "record", "raw"];
  candidates.forEach((key) => {
    const val = record[key];
    if (val && typeof val === "object" && !Array.isArray(val)) {
      base = { ...val, ...base };
    }
  });
  return base;
}

function normalizeRecord(record) {
  return normalizeRecordKeys(unwrapRecord(record));
}

const EQUIPMENT_KEYS = new Set([
  "abstandsregeltempomat","applecarplay","androidauto","frontscheibenheizung","heckklappe","led","multifunktion",
  "navigation","sitzheizung","rueckfahrkamera","nichtraucher","scheckheft","garantie","mettalic","abs","esp","asr",
  "berganfahrassistent","muedigkeitswarner","spurhalteassistent","totwinkelassistent","notbremsassistent","notrufsystem",
  "verkehrszeichenerkennung","isofixhinten","isofixbeifahrer","scheinwerferreinigung","blendfreiesfernlicht",
  "fernlichtassistent","innenspiegelabblendend","nachtsichtassistent","nebelscheinwerfer","lichtsensor","regensensor",
  "alarmanlage","wegfahrsperre","keylesszv","zentralverriegelung","standheizung","frontscheibebeheizbar","lenkradbeheizbar",
  "einparkhilfeselbstlenkend","kamerahinten","kamera360","sitzheizungvorne","sitzheizunghinten","sitzeelektrisch",
  "sportsitze","armlehne","lordosenstuetze","massagesitze","sitzbelueftung","beifahrersitzumklappbar","elektrfensterheber",
  "elektrspiegel","elektheckklappe","servolenkung","ambientebeleuchtung","lederlenkrad","radio","dab","cd","tv","navi",
  "soundsystem","touchscreen","sprachsteuerung","multifunktionslenkrad","freisprecheinrichtung","usb","bluetooth","wlan",
  "streaming","induktionsladen","bordcomputer","headup","volldigital","alufelgen","sommerreifen","winterreifen","allwetterreifen",
  "reifendruckkontrolle","winterpaket","raucherpaket","sportpaket","sportfahrwerk","luftfederung","gepaeckabtrennung",
  "skisack","schiebedach","panoramadach","dachreling","behindertengerecht","taxi","anhaengerkupplung"
]);

const EQUIPMENT_ALIASES = {
  navigationssystem: ["navigation","navi"],
  navigation_system: ["navigation","navi"],
  navi: ["navi"],
  navigation: ["navigation"],
  leichtmetallfelgen: ["alufelgen"],
  alu_felgen: ["alufelgen"],
  alu_felge: ["alufelgen"],
  elektrische_fensterheber: ["elektrfensterheber"],
  elektr_fensterheber: ["elektrfensterheber"],
  fensterheber: ["elektrfensterheber"],
  elektrische_spiegel: ["elektrspiegel"],
  elektrisch_verstellbare_spiegel: ["elektrspiegel"],
  schiebedach: ["schiebedach"],
  panoramadach: ["panoramadach"],
  dachreling: ["dachreling"],
  zentralverriegelung: ["zentralverriegelung"],
  wegfahrsperre: ["wegfahrsperre"],
  standheizung: ["standheizung"],
  garantie: ["garantie"],
  scheckheftgepflegt: ["scheckheft"],
  nichtraucherfahrzeug: ["nichtraucher"],
  rueckfahrkamera: ["rueckfahrkamera"],
  anhangerkupplung: ["anhaengerkupplung"],
  anhaengerkupplung: ["anhaengerkupplung"]
};

function normalizeEquipmentKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[\s\-]+/g, "_")
    .replace(/[^\w]/g, "");
}

function isTruthyValue(v) {
  if (v == null) return false;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (!s) return false;
  if (["1","true","ja","yes","y","x"].includes(s)) return true;
  if (["0","false","nein","no","n"].includes(s)) return false;
  const num = Number(s.replace(",", "."));
  if (Number.isFinite(num)) return num > 0;
  return false;
}

function buildEquipment(raw = {}) {
  const keys = new Set();
  const text = new Set();

  EQUIPMENT_KEYS.forEach((k) => {
    if (isTruthyValue(raw[k])) keys.add(k);
  });

  Object.entries(EQUIPMENT_ALIASES).forEach(([from, targets]) => {
    if (!isTruthyValue(raw[from])) return;
    (Array.isArray(targets) ? targets : [targets]).forEach((t) => {
      if (t) keys.add(t);
    });
  });

  const list = splitList(raw.equipment ?? raw.ausstattung ?? raw.features ?? raw.extras ?? raw.options);
  list.forEach((item) => {
    const norm = normalizeEquipmentKey(item);
    if (EQUIPMENT_KEYS.has(norm)) keys.add(norm);
    else if (item) text.add(String(item).trim());
  });

  return { keys: [...keys], text: [...text] };
}

function isMobileRecord(raw = {}) {
  if (raw.__format === "mobile_csv") return true;
  const markers = [
    "customer_number","category","image_id","mwstsatz","dealer_price",
    "our_recommendation","one_year_old_car","new_car","bemerkung","remark"
  ];
  return markers.some((k) => raw[k] != null && String(raw[k]).trim() !== "");
}

function parseClimateValue(value) {
  if (value == null) return "";
  const s = String(value).trim();
  if (!s) return "";
  const n = Number(s.replace(",", "."));
  if (Number.isFinite(n)) {
    if (n >= 2) return "Klimaautomatik";
    if (n >= 1) return "Klimaanlage";
    return "";
  }
  return s;
}

function detectImportFormat(file, text) {
  const name = String(file?.originalname || "").toLowerCase();
  const mime = String(file?.mimetype || "").toLowerCase();
  const trimmed = String(text || "").trim();

  if (name.endsWith(".jsonl") || name.endsWith(".ndjson")) return "jsonl";
  if (name.endsWith(".json")) return "json";

  if (mime.includes("json")) {
    if (trimmed.startsWith("[")) return "json";
    if (trimmed.startsWith("{")) {
      try {
        JSON.parse(trimmed);
        return "json";
      } catch {
        return "jsonl";
      }
    }
  }

  if (trimmed.startsWith("[")) return "json";
  if (trimmed.startsWith("{")) {
    const lines = trimmed.split(/\r?\n/).filter(Boolean);
    if (lines.length > 1) return "jsonl";
    return "json";
  }

  return "csv";
}

const MOBILE_DE_FIELD_ORDER = [
  "customer_number",      // 0
  "stock_number",         // 1 interne_nummer
  "category",             // 2 kategorie
  "make",                 // 3 marke
  "model",                // 4 modell
  "power_kw",             // 5 leistung (kW)
  "hu",                   // 6 hu / mot
  null,                   // 7 reserved
  "first_registration",   // 8 ez / reg-date
  "mileage_km",           // 9 kilometer / kilometre
  "price_eur",            // 10 preis / price
  "vat",                  // 11 mwst / VAT
  null,                   // 12 reserved
  "classic_vehicle",      // 13 oldtimer / classic vehicle
  "vin",                  // 14 vin
  "beschaedigt",          // 15 beschaedigtes_fahrzeug / damaged_vehicle
  "color",                // 16 farbe / colour
  "climate",              // 17 klima / a/c
  "taxi",                 // 18 taxi
  "behindertengerecht",   // 19 adapted for disabled
  "one_year_old_car",     // 20 jahreswagen / one-year-old car
  "new_car",              // 21 neufahrzeug / new car
  "recommendation",       // 22 unsere empfehlung / our recommendation
  "dealer_price",         // 23 haendlerpreis / dealer price
  null                    // 24 reserved
];

function looksLikeHeaderLine(line = "") {
  const l = String(line).toLowerCase();
  const tokens = [
    "kundennummer","interne_nummer","kategorie","marke","modell","leistung","hu","ez",
    "kilometer","preis","mwst","oldtimer","vin","beschaedigtes_fahrzeug","farbe",
    "customer-number","internal number","category","make","model","performance","mot",
    "reg-date","kilometre","price","vat","classic vehicle","damaged_vehicle","colour","a/c"
  ];
  return tokens.some((t) => l.includes(t));
}

function mapMobileCsvRow(row = []) {
  const obj = {};
  row.forEach((val, idx) => {
    const key = MOBILE_DE_FIELD_ORDER[idx];
    if (key) obj[key] = val;
    else obj[`col_${idx}`] = val;
  });
  obj.__raw_cols = row;
  obj.__format = "mobile_csv";
  return obj;
}

function parseImportRecords(file, text) {
  const format = detectImportFormat(file, text);

  if (format === "json" || format === "jsonl") {
    let records = [];
    if (format === "json") {
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        throw new Error("Ungültiges JSON-Format.");
      }
      if (Array.isArray(parsed)) records = parsed;
      else if (parsed && typeof parsed === "object") {
        const list =
          parsed.items ||
          parsed.data ||
          parsed.records ||
          parsed.vehicles ||
          parsed.inserate ||
          parsed.listings;
        records = Array.isArray(list) ? list : [parsed];
      }
    } else {
      const lines = String(text || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      records = lines.map((line, idx) => {
        try {
          return JSON.parse(line);
        } catch {
          throw new Error(`Ungültige JSONL-Zeile ${idx + 1}.`);
        }
      });
    }

    const normalized = records.map(normalizeRecord);
    return { records: normalized, format };
  }

  const delimiter = guessDelimiter(text);
  const firstLine = (String(text || "").split(/\r?\n/)[0] || "");
  const hasHeader = looksLikeHeaderLine(firstLine);

  if (!hasHeader) {
    const rows = parse(text, {
      columns: false,
      skip_empty_lines: true,
      delimiter,
      relax_quotes: true,
      relax_column_count: true,
      trim: true
    });
    const records = rows.map(mapMobileCsvRow);
    return { records, format: "mobile_csv", delimiter };
  }

  const records = parse(text, {
    columns: normalizeHeaders,
    skip_empty_lines: true,
    delimiter,
    relax_quotes: true,
    relax_column_count: true,
    trim: true
  });

  return { records, format: delimiter === "\t" ? "tsv" : "csv", delimiter };
}

function toNumber(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;

  // Entferne Währungszeichen/Einheiten, behalte nur Ziffern/Separatoren/Minus
  const cleaned = s.replace(/[^\d,.\-]/g, "");
  if (!cleaned) return null;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let norm = cleaned;

  if (hasComma && hasDot) {
    // Entscheide nach dem letzten Separator
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      norm = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      norm = cleaned.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    norm = cleaned.replace(",", ".");
  } else if (hasDot && !hasComma) {
    const parts = cleaned.split(".");
    if (parts.length === 2 && parts[1].length <= 2) {
      norm = cleaned; // Dezimalpunkt
    } else {
      norm = cleaned.replace(/\./g, "");
    }
  }

  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

function toInt(v) {
  const n = toNumber(v);
  return n == null ? null : Math.round(n);
}

function pickFirst(...vals) {
  for (const v of vals) {
    if (v === 0) return 0;
    if (v == null) continue;
    const s = String(v).trim();
    if (s !== "") return v;
  }
  return "";
}

function pickStr(...vals) {
  const v = pickFirst(...vals);
  return v === 0 ? "0" : String(v || "").trim();
}

function parseBool(v) {
  if (v == null) return null;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;
  if (["1","true","ja","yes","y","x"].includes(s)) return true;
  if (["0","false","nein","no","n"].includes(s)) return false;
  return null;
}

function splitList(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean);
  return String(v)
    .split(/[|,;\n]/g)
    .map(x => x.trim())
    .filter(Boolean);
}

// erwartet YYYY-MM oder MM/YYYY oder MM.YYYY
function normalizeFirstRegistration(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{1,2})[\/\.](\d{4})$/); // 03/2018 oder 03.2018
  if (m) {
    const mm = String(m[1]).padStart(2, "0");
    const yyyy = m[2];
    return `${yyyy}-${mm}`;
  }
  return null;
}

function toFirstRegistrationDisplay(v) {
  if (!v) return "";
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${m[2]}/${m[1]}`;
  return s;
}

function splitUrls(v) {
  if (!v) return [];
  return String(v)
    .split(/[|,;\n]/g)
    .map(x => x.trim())
    .filter(Boolean);
}

/**
 * Unterstützte Spalten:
 * Pflicht: stock_number, title, price_eur, mileage_km, first_registration
 * Optional: image_urls (URL1|URL2|...), video_url
 */
function mapRow(raw) {
  const mobileLike = isMobileRecord(raw);
  const equipment = buildEquipment(raw);

  const stock_number = pickStr(
    raw.stock_number,
    raw.interne_nummer,
    raw.stock_id,
    raw.vin,
    raw.fin,
    raw.fahrgestellnummer
  );

  const make = pickStr(raw.make, raw.marke, raw.brand, raw.hersteller, raw.manufacturer);
  const model = pickStr(raw.model, raw.modell, raw.baureihe, raw.serie);
  const variant = pickStr(raw.variant, raw.variante, raw.ausstattung_variante, raw.trim, raw.version);

  let title = pickStr(raw.title, raw.titel, raw.bezeichnung, raw.fahrzeugtitel);
  if (!title) title = [make, model, variant].filter(Boolean).join(" ").trim();
  if (!title) title = stock_number ? `Inserat ${stock_number}` : "Inserat";

  const price_gross = toNumber(raw.price_gross ?? raw.brutto_preis ?? raw.bruttopreis);
  const price_net = toNumber(raw.price_net ?? raw.netto_preis ?? raw.nettopreis);
  let price_eur = toNumber(raw.price_eur ?? raw.price ?? raw.preis);
  if (price_eur == null) price_eur = price_gross ?? price_net;

  const mileage_km = toInt(raw.mileage_km ?? raw.kilometer ?? raw.km ?? raw.mileage);

  let first_registration = normalizeFirstRegistration(
    raw.first_registration ?? raw.ez ?? raw.erstzulassung
  );
  if (!first_registration) {
    const regMonth = pickFirst(raw.reg_month, raw.ez_monat);
    const regYear = pickFirst(raw.reg_year, raw.ez_jahr, raw.baujahr);
    if (regMonth && regYear) {
      first_registration = normalizeFirstRegistration(`${regMonth}/${regYear}`);
    } else if (regYear) {
      first_registration = normalizeFirstRegistration(`01/${regYear}`);
    }
  }

  const image_urls = splitUrls(raw.image_urls ?? raw.images ?? raw.bilder);
  const video_url = pickStr(raw.video_url, raw.video) || null;

  let powerKw = toNumber(pickFirst(raw.power_kw, raw.performance, raw.leistung_kw));
  let powerPs = toNumber(pickFirst(raw.power_ps, raw.ps, raw.leistung_ps));
  if (mobileLike && powerKw == null && raw.power_ps != null) {
    powerKw = toNumber(raw.power_ps);
    powerPs = null;
  }
  if (powerPs == null && powerKw != null) {
    powerPs = Math.round(powerKw * 1.35962);
  }

  const climate = parseClimateValue(pickFirst(raw.climate, raw.klima, raw.klimaautomatik, raw.klimaanlage));

  let condition = pickStr(raw.zustand, raw.condition);
  if (!condition) {
    if (isTruthyValue(raw.new_car)) condition = "Neuwagen";
    else if (isTruthyValue(raw.one_year_old_car)) condition = "Jahreswagen";
    else if (isTruthyValue(raw.demo_car)) condition = "Vorführwagen";
  }

  const damaged = parseBool(raw.beschaedigt ?? raw.damaged_vehicle);

  const vehicle_type = pickStr(raw.vehicle_type, raw.category, raw.kategorie, raw.fahrzeugart, raw.karosserie);
  const description = pickStr(raw.description, raw.beschreibung, raw.bemerkung, raw.remark, raw.text);
  const short_description = pickStr(raw.short_description, raw.kurzbeschreibung, raw.teaser);

  return {
    stock_number,
    title,
    price_eur,
    price_net,
    price_gross,
    mileage_km,
    first_registration,
    make,
    model,
    variant,
    fuel: pickStr(raw.fuel, raw.kraftstoff),
    gearbox: pickStr(raw.gearbox, raw.getriebe),
    power_ps: powerPs,
    power_kw: powerKw,
    displacement_ccm: toNumber(raw.displacement_ccm ?? raw.ccm ?? raw.hubraum),
    doors: toInt(raw.doors ?? raw.tueren ?? raw["türen"]),
    seats: toInt(raw.seats ?? raw.sitze),
    color: pickStr(raw.color, raw.farbe),
    exterior_color: pickStr(raw.exterior_color, raw.aussenfarbe, raw["außenfarbe"]),
    interior_color: pickStr(raw.interior_color, raw.innenfarbe),
    interior_material: pickStr(raw.interior_material, raw.innenmaterial, raw.sitzmaterial),
    body_color: pickStr(raw.body_color, raw.karosseriefarbe),
    vehicle_type: vehicle_type,
    description,
    short_description,
    equipment: splitList(raw.equipment ?? raw.ausstattung ?? raw.features ?? raw.extras),
    equipment_keys: equipment.keys,
    equipment_text: equipment.text,
    accident_free: parseBool(raw.accident_free ?? raw.unfallfrei),
    accident_history: pickStr(raw.accident_history ?? raw.unfall ?? raw.unfallhistorie),
    vat: raw.vat ?? raw.mwst ?? raw.ust,
    vat_rate: pickStr(raw.vat_rate, raw.mwstsatz),
    currency: pickStr(raw.currency, raw.waehrung),
    damaged,
    condition,
    emission_class: pickStr(raw.emission_class, raw.emissionsklasse),
    pollution_class: pickStr(raw.pollution_class, raw.schadstoffklasse),
    environmental_badge: pickStr(raw.environmental_badge, raw.umweltplakette),
    co2_emission: pickStr(raw.co2_emission, raw.co2),
    co2_class: pickStr(raw.co2_class, raw.co2klasse),
    consumption_combined: pickStr(raw.consumption_combined, raw.verbrauch_kombiniert, raw.verbrauch),
    consumption_city: pickStr(raw.consumption_city, raw.verbrauch_innerorts),
    consumption_highway: pickStr(raw.consumption_highway, raw.verbrauch_ausserorts),
    drivetrain: pickStr(raw.drivetrain, raw.antrieb, raw.antriebsart),
    climate,
    parking_assist: pickStr(raw.parking_assist, raw.einparkhilfe),
    parking_assist_self: pickStr(raw.parking_assist_self, raw.einparkhilfe_selbstlenkend),
    headlights: pickStr(raw.headlights, raw.scheinwerfer),
    daytime_running_lights: pickStr(raw.daytime_running_lights, raw.tagfahrlicht),
    curve_light: pickStr(raw.curve_light, raw.kurvenlicht),
    particulate_filter: pickStr(raw.particulate_filter, raw.partikelfilter),
    metallic: parseBool(raw.metallic),
    previous_owners: pickStr(raw.previous_owners, raw.halter, raw.anzahlhalter),
    hu: pickStr(raw.hu, raw.tuv, raw["tüv"]),
    hu_until: pickStr(raw.hu_until, raw.tuv_bis, raw["tüv_bis"]),
    location: pickStr(raw.location, raw.standort),
    postal_code: pickStr(raw.postal_code, raw.plz),
    city: pickStr(raw.city, raw.ort),
    street: pickStr(raw.street, raw.strasse),
    street_no: pickStr(raw.street_no, raw.hausnummer),
    phone: pickStr(raw.phone, raw.telefon),
    image_urls,
    video_url,
    raw_import: raw,
    mobile_like: mobileLike,
    image_id: pickStr(raw.image_id, raw.bild_id),
    dealer_price: pickStr(raw.dealer_price, raw.haendlerpreis),
    recommendation: pickStr(raw.recommendation, raw.empfehlung),
    customer_number: pickStr(raw.customer_number, raw.kundennummer)
  };
}

function validateRow(r) {
  const errors = [];
  if (!r.stock_number) errors.push("stock_number fehlt");
  if (!r.title) errors.push("title fehlt");
  // Preis/Kilometer/EZ sind hilfreich, aber nicht zwingend für den Import.
  return errors;
}

/* ---------- PREVIEW ---------- */
app.post("/api/haendler/import/preview", requireDb, requireDealer, uploadCsv.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send("Keine Datei erhalten");

    const text = req.file.buffer.toString("utf8");
    const { records, delimiter, format } = parseImportRecords(req.file, text);

    const mapped = records.map(mapRow);

    // Fehler sammeln / valid rows
    const errors = [];
    const valid = [];
    mapped.forEach((r, idx) => {
      const rowErrors = validateRow(r);
      if (rowErrors.length) {
        errors.push({ row: idx + 2, message: rowErrors.join(", ") }); // +2 wegen Header + 1-index
      } else {
        valid.push(r);
      }
    });

    const sellerId = String(req.user.id);
    const ids = valid.map(v => v.stock_number);

    // existierende Inserate -> neu/update
    const existing = await db.collection("inserate")
      .find(
        {
          stockNumber: { $in: ids },
          $or: [{ verkaeuferId: sellerId }, { sellerId }]
        },
        { projection: { stockNumber: 1 } }
      )
      .toArray();

    const existingSet = new Set(existing.map(x => x.stockNumber));

    const rows = valid.map(v => ({
      ...v,
      image_count: v.image_urls.length,
      status: existingSet.has(v.stock_number) ? "update" : "new"
    }));

    const summary = {
      delimiter,
      format,
      total: records.length,
      newCount: rows.filter(r => r.status === "new").length,
      updateCount: rows.filter(r => r.status === "update").length,
      errorCount: errors.length
    };

    res.json({ summary, errors, rows });
  } catch (e) {
    res.status(500).send(e.message || "Preview error");
  }
});

/* ---------- COMMIT ---------- */
app.post("/api/haendler/import/commit", requireDb, requireDealer, uploadCsv.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send("Keine Datei erhalten");

    const text = req.file.buffer.toString("utf8");
    const { records } = parseImportRecords(req.file, text);

    const mapped = records.map(mapRow);

    const sellerId = String(req.user.id);
    const nutzer = await db.collection("nutzer").findOne(
      { id: sellerId },
      {
        projection: {
          id: 1,
          role: 1,
          firma: 1,
          name: 1,
          logoUrl: 1,
          strasse: 1,
          hausnummer: 1,
          plz: 1,
          ort: 1,
          land: 1,
          adresse: 1,
          standort: 1,
          telefon: 1,
          telefon2: 1,
          impressum: 1,
          oeffnungszeiten: 1,
          "öffnungszeiten": 1,
          sprachen: 1
        }
      }
    );

    const sellerRoleRaw = nutzer?.role || "haendler";
    const isHaendler = isHaendlerRole(sellerRoleRaw);

    const sellerName = nutzer?.firma || nutzer?.name || (isHaendler ? "Händler" : "Privatverkäufer");
    const street = [nutzer?.strasse, nutzer?.hausnummer].filter(Boolean).join(" ");
    const zipCity = [nutzer?.plz, nutzer?.ort].filter(Boolean).join(" ");
    const address = [street, zipCity].filter(Boolean).join(", ");

    const sellerStandort = nutzer?.standort || nutzer?.adresse || address || "";
    const sellerTelefon = nutzer?.telefon || nutzer?.telefon2 || "";

    const sellerSnapshot = {
      type: isHaendler ? "haendler" : "privat",
      id: sellerId,
      name: sellerName,
      logoUrl: nutzer?.logoUrl || "",
      strasse: nutzer?.strasse || "",
      hausnummer: nutzer?.hausnummer || "",
      plz: nutzer?.plz || "",
      ort: nutzer?.ort || "",
      land: nutzer?.land || "",
      impressum: nutzer?.impressum || "",
      oeffnungszeiten: nutzer?.oeffnungszeiten || nutzer?.["öffnungszeiten"] || "",
      sprachen: Array.isArray(nutzer?.sprachen) ? nutzer.sprachen : []
    };

    const ops = [];
    let failed = 0;

    for (let i = 0; i < mapped.length; i++) {
      const r = mapped[i];
      const errs = validateRow(r);
      if (errs.length) {
        failed++;
        continue;
      }

      const ezDisplay = toFirstRegistrationDisplay(r.first_registration);
      const images = Array.isArray(r.image_urls) ? r.image_urls : [];
      const equipment = Array.isArray(r.equipment) ? r.equipment : [];
      const equipKeys = Array.isArray(r.equipment_keys) ? r.equipment_keys : [];
      const equipText = Array.isArray(r.equipment_text) ? r.equipment_text : [];
      const equipList = [...new Set([...equipKeys, ...equipText, ...equipment])].filter(Boolean);
      const equipFlags = {};
      equipKeys.forEach((k) => {
        if (k) equipFlags[`verkauf_${k}`] = true;
      });

      const rowStreet = [r.street, r.street_no].filter(Boolean).join(" ");
      const rowZipCity = [r.postal_code, r.city].filter(Boolean).join(" ");
      const rowStandort = r.location || [rowStreet, rowZipCity].filter(Boolean).join(", ");
      const finalStandort = rowStandort || sellerStandort;
      const finalTelefon = r.phone || sellerTelefon;

      const unfallfrei = r.accident_free;
      let unfallText = "";
      if (r.accident_history) unfallText = r.accident_history;
      else if (unfallfrei === true) unfallText = "keine";
      else if (unfallfrei === false) unfallText = "ja";

      const mwstBool = parseBool(r.vat);
      let mwstText = "";
      if (r.mobile_like && r.vat != null) {
        const sv = String(r.vat).trim();
        if (sv === "0") mwstText = "inkl. MwSt.";
        else if (sv === "1") mwstText = "nicht ausweisbar";
      }
      if (!mwstText) {
        if (mwstBool === true) mwstText = "inkl. MwSt.";
        else if (mwstBool === false) mwstText = "keine";
        else if (r.vat != null && String(r.vat).trim()) mwstText = String(r.vat).trim();
      }

      const kurz = r.short_description || r.description || "";
      const besch = r.description || "";

      // ✅ Für den Start: status="offline", damit nichts ungeprüft öffentlich ist.
      // Du kannst später "online" setzen oder eine Review-UI bauen.
      ops.push({
        updateOne: {
          filter: {
            stockNumber: r.stock_number,
            $or: [{ verkaeuferId: sellerId }, { sellerId }]
          },
          update: {
            $set: {
              source: "csv",
              status: "offline",
              verkauf_status: "offline",

              verkaeuferId: sellerId,
              sellerId: sellerId,
              stockNumber: r.stock_number,

              titel: r.title,
              verkauf_titel: r.title,

              verkauf_verkaeufer: isHaendler ? "Händler" : "Privatverkäufer",
              verkauf_name: sellerName,

              preis: r.price_eur,
              verkauf_preis: r.price_eur,
              verkauf_brutto: r.price_gross ?? null,
              verkauf_netto: r.price_net ?? null,
              verkauf_mwst: mwstText,

              verkauf_kilometer: r.mileage_km,
              verkauf_erstzulassung: ezDisplay || r.first_registration || "",

              verkauf_marke: r.make || "",
              verkauf_modell: r.model || "",
              verkauf_variante: r.variant || "",
              verkauf_ausstattung_variante: r.variant || "",

              verkauf_fahrzeugtyp: r.vehicle_type || "",
              verkauf_kraftstoff: r.fuel || "",
              verkauf_getriebe: r.gearbox || "",
              verkauf_leistung: r.power_ps ?? "",
              verkauf_leistung_kw: r.power_kw ?? "",
              verkauf_hubraum: r.displacement_ccm ?? "",
              verkauf_tueren: r.doors ?? "",
              verkauf_sitze: r.seats ?? "",

              verkauf_farbe: r.color || "",
              verkauf_aussenfarbe: r.exterior_color || r.color || "",
              verkauf_karosseriefarbe: r.body_color || r.exterior_color || r.color || "",
              verkauf_innenfarbe: r.interior_color || "",
              verkauf_innenmaterial: r.interior_material || "",

              zustand: r.condition || "",
              verkauf_beschaedigt: r.damaged ?? "",
              beschaedigt: r.damaged ?? "",

              verkauf_beschreibung: besch,
              verkauf_kurzbeschreibung: kurz,
              verkauf_ausstattung: equipList,

              verkauf_unfallfrei: unfallfrei,
              verkauf_unfall: unfallText,
              verkauf_unfallhistorie: unfallText,

              verkauf_emissionsklasse: r.emission_class || "",
              verkauf_schadstoffklasse: r.pollution_class || "",
              verkauf_umweltplakette: r.environmental_badge || "",
              verkauf_co2_emission: r.co2_emission || "",
              verkauf_co2_klasse: r.co2_class || "",
              verkauf_verbrauch_kombiniert: r.consumption_combined || "",
              verkauf_verbrauch_innerorts: r.consumption_city || "",
              verkauf_verbrauch_ausserorts: r.consumption_highway || "",
              verkauf_antrieb: r.drivetrain || "",
              verkauf_klimatisierung: r.climate || "",
              verkauf_einparkhilfe: r.parking_assist || "",
              verkauf_einparkhilfeselbstlenkend: r.parking_assist_self || "",
              verkauf_scheinwerfer: r.headlights || "",
              verkauf_tagfahrlicht: r.daytime_running_lights || "",
              verkauf_kurvenlicht: r.curve_light || "",
              verkauf_partikelfilter: r.particulate_filter || "",
              verkauf_metallic: r.metallic === true ? "ja" : (r.metallic === false ? "nein" : ""),

              verkauf_halter: r.previous_owners || "",
              verkauf_hu: r.hu || "",
              verkauf_hu_bis: r.hu_until || "",

              verkauf_standort: finalStandort,
              verkauf_plz: r.postal_code || nutzer?.plz || "",
              verkauf_ort: r.city || nutzer?.ort || "",

              images,
              bilder: images,
              video: r.video_url || null,

              standort: finalStandort,
              telefon: finalTelefon,
              seller: sellerSnapshot,

              import_raw: r.raw_import || null,
              import_customer_number: r.customer_number || "",
              import_dealer_price: r.dealer_price || "",
              import_recommendation: r.recommendation || "",
              import_currency: r.currency || "",
              import_vat_rate: r.vat_rate || "",
              import_image_id: r.image_id || "",

              ...equipFlags,

              updatedAt: new Date()
            },
            $setOnInsert: { createdAt: new Date() }
          },
          upsert: true
        }
      });
    }

    let created = 0;
    let updated = 0;

    if (ops.length) {
      const result = await db.collection("inserate").bulkWrite(ops, { ordered: false });
      created = result.upsertedCount || 0;
      updated = result.modifiedCount || 0;
    }

    res.json({ created, updated, failed });
  } catch (e) {
    res.status(500).send(e.message || "Commit error");
  }
});

/* =========================
   Draft Save: Fahrzeugdaten
========================= */
app.post("/saveFahrzeugdaten", checkLogin, async (req, res) => {
  try {
    const daten = req.body || {};
    const { draftId, ...payload } = daten;

    const collection = db.collection("fahrzeugeEntwurf");
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

    // ✅ 1) Wenn draftId kommt → genau diesen Draft updaten
    if (draftId) {
      let _id;
      try { _id = new ObjectId(String(draftId)); }
      catch { return res.status(400).json({ error: "Ungültige draftId." }); }

      const draft = await collection.findOne({ _id, nutzerId: req.nutzer.id });
      if (!draft) return res.status(404).json({ error: "Draft nicht gefunden." });

      await collection.updateOne(
        { _id },
        { $set: { ...payload, updatedAt: new Date() } }
      );
      return res.json({ success: true, fahrzeugId: _id });
    }

    // ✅ 2) Sonst: wie bisher letzten frischen Draft verwenden
    const letzter = await collection.findOne(
      { nutzerId: req.nutzer.id, updatedAt: { $gte: thirtyMinAgo } },
      { sort: { updatedAt: -1, _id: -1 } }
    );

    if (letzter) {
      await collection.updateOne(
        { _id: letzter._id },
        { $set: { ...payload, updatedAt: new Date() } }
      );
      return res.json({ success: true, fahrzeugId: letzter._id });
    } else {
      const r = await collection.insertOne({
        ...payload,
        nutzerId: req.nutzer.id,
        erstelltAm: new Date(),
        updatedAt: new Date()
      });
      return res.json({ success: true, fahrzeugId: r.insertedId });
    }
  } catch (err) {
    console.error("❌ Fehler bei /saveFahrzeugdaten:", err);
    res.status(500).json({ error: "Serverfehler beim Speichern." });
  }
});

/* =========================
   Draft Save: Details
========================= */
app.post("/saveDetails", checkLogin, async (req, res) => {
  try {
    const details = req.body || {};
    const { draftId, ...payload } = details;

    const collection = db.collection("fahrzeugeEntwurf");
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

    if (draftId) {
      let _id;
      try { _id = new ObjectId(String(draftId)); }
      catch { return res.status(400).json({ error: "Ungültige draftId." }); }

      const draft = await collection.findOne({ _id, nutzerId: req.nutzer.id });
      if (!draft) return res.status(404).json({ error: "Draft nicht gefunden." });

      await collection.updateOne(
        { _id },
        { $set: { ...payload, updatedAt: new Date() } }
      );
      return res.json({ success: true });
    }

    const letzter = await collection.findOne(
      { nutzerId: req.nutzer.id, updatedAt: { $gte: thirtyMinAgo } },
      { sort: { updatedAt: -1, _id: -1 } }
    );
    if (!letzter) return res.status(400).json({ error: "Kein (frischer) Fahrzeugentwurf gefunden." });

    await collection.updateOne(
      { _id: letzter._id },
      { $set: { ...payload, updatedAt: new Date() } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Fehler in /saveDetails:", err);
    res.status(500).json({ error: "Fehler beim Speichern der Details." });
  }
});

/* =========================
   Draft Save: Media
========================= */
app.post(
  "/saveMedia",
  checkLogin,
  upload.fields([{ name: "images", maxCount: 20 }, { name: "video", maxCount: 1 }]),
  async (req, res) => {
    const cleanup = (arr = []) =>
      arr.forEach(f => { try { fs.unlinkSync(f.path); } catch {} });

    try {
      const collection = db.collection("fahrzeugeEntwurf");

      // 1) Draft-Auswahl: draftId > letzter frischer Draft
      const bodyDraftId = (req.body?.draftId || "").toString().trim();
      let letzter = null;

      if (bodyDraftId) {
        try {
          const _id = new ObjectId(bodyDraftId);
          letzter = await collection.findOne({ _id, nutzerId: req.nutzer.id });
        } catch {
          letzter = null;
        }
      }

      if (!letzter) {
        const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
        letzter = await collection.findOne(
          { nutzerId: req.nutzer.id, updatedAt: { $gte: thirtyMinAgo } },
          { sort: { updatedAt: -1, _id: -1 } }
        );
      }

      if (!letzter) {
        cleanup([...(req.files?.images || []), ...(req.files?.video || [])]);
        return res.status(400).json({ error: "Kein (frischer) Fahrzeugentwurf gefunden." });
      }

      // 2) Dateien aus Multer lesen
      const files = req.files || {};
      const imageFiles = Array.isArray(files.images) ? files.images : [];
      const videoFile =
        Array.isArray(files.video) && files.video.length
          ? files.video[0]
          : null;

      // 3) Limit-Prüfung: max 20 Bilder gesamt
      const existingImages = Array.isArray(letzter.images) ? letzter.images.length : 0;

      if (imageFiles.length && existingImages + imageFiles.length > 20) {
        cleanup([...imageFiles, ...(videoFile ? [videoFile] : [])]);
        return res.status(400).json({ error: "Maximal 20 Bilder pro Inserat." });
      }

      const baseFolder = `autovisa/${req.nutzer.id}`;

      // 4) Upload Images
      let uploadedImageUrls = [];
      if (imageFiles.length) {
        try {
          const results = await Promise.all(
            imageFiles.map(f =>
              uploadFileToCloudinary(f.path, {
                folder: `${baseFolder}/images`,
                resource_type: "image"
              })
            )
          );
          uploadedImageUrls = results.map(r => r.secure_url);
        } finally {
          cleanup(imageFiles);
        }
      }

      // 5) Upload Video
      let uploadedVideoUrl = null;
      if (videoFile) {
        try {
          const r = await uploadFileToCloudinary(videoFile.path, {
            folder: `${baseFolder}/videos`,
            resource_type: "video"
          });
          uploadedVideoUrl = r.secure_url;
        } finally {
          cleanup([videoFile]);
        }
      }

      // 6) Wenn nichts neu hochgeladen wurde
      if (!uploadedImageUrls.length && !uploadedVideoUrl) {
        return res.json({
          success: true,
          message: "Keine neuen Dateien – bestehende Medien unverändert.",
          images: Array.isArray(letzter.images) ? letzter.images : [],
          video: letzter.video || null,
          draftId: String(letzter._id)
        });
      }

      // 7) Update-Dokument bauen
      const updateDoc = {};

      if (uploadedImageUrls.length) {
        updateDoc.images = Array.isArray(letzter.images)
          ? [...letzter.images, ...uploadedImageUrls]
          : [...uploadedImageUrls];
      }

      if (uploadedVideoUrl) {
        updateDoc.video = uploadedVideoUrl;
      }

      updateDoc.updatedAt = new Date();

      await collection.updateOne(
        { _id: letzter._id, nutzerId: req.nutzer.id },
        { $set: updateDoc }
      );

      // 8) Antwort
      const finalImages = updateDoc.images ?? (Array.isArray(letzter.images) ? letzter.images : []);
      const finalVideo  = updateDoc.video  ?? (letzter.video || null);

      return res.json({
        success: true,
        message: "Medien gespeichert.",
        images: finalImages,
        video: finalVideo,
        draftId: String(letzter._id)
      });

    } catch (err) {
      console.error("❌ Fehler beim Speichern der Medien (Cloudinary):", err);
      try {
        const cleanup = (arr = []) =>
          arr.forEach(f => { try { fs.unlinkSync(f.path); } catch {} });
        cleanup([...(req.files?.images || []), ...(req.files?.video || [])]);
      } catch {}

      return res.status(500).json({
        error: err.message || "Fehler beim Speichern der Medien."
      });
    }
  }
);

/* =========================
   Vorschau: Drafts laden + Seller-Snapshot
========================= */
app.get("/getVehicleData", checkLogin, async (req, res) => {
  try {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

    const drafts = await db.collection("fahrzeugeEntwurf")
      .find({
        nutzerId: req.nutzer.id,
        updatedAt: { $gte: thirtyMinAgo }
      })
      .sort({ updatedAt: -1, _id: -1 })
      .toArray();

    const user = await db.collection("nutzer").findOne(
      { id: req.nutzer.id },
      { projection: { role: 1, firma: 1, name: 1, logoUrl: 1 } }
    );

    const seller = {
      type: user?.role || "privat",
      name: user?.firma || user?.name || "Unbekannt",
      logoUrl: user?.logoUrl || ""
    };

    const withSeller = drafts.map(d => ({ ...d, __status: "draft", seller }));

    res.json(withSeller);
  } catch (err) {
    console.error("❌ Fehler beim Laden der Fahrzeugdaten:", err);
    res.status(500).json({ error: "Fehler beim Laden der Daten." });
  }
});

/* =========================
   Draft -> Inserat Helper
========================= */
async function publishOrUpdateFromDraft({
  draft,
  sellerId,
  seller,
  req,
  entwurfColl,
  inserateColl,
}) {
  const editId = String(draft.__editInseratId || "").trim();

  const {
    _id,
    updatedAt,
    erstelltAm,
    __status,
    __editInseratId,
    ...payload
  } = draft;

  const baseUpdate = {
    ...payload,
    seller,
    status: "online",
    lastEditedAt: new Date(),
    verkauf_kurzbeschreibung: getZufaelligeAusstattung(payload.verkauf_ausstattung || []),
  };

  if (editId) {
    let editOid;
    try { editOid = new ObjectId(editId); }
    catch { throw new Error("Ungültige Edit-ID im Draft."); }

    const existing = await inserateColl.findOne({ _id: editOid });
    const ownerId = existing?.verkaeuferId || existing?.nutzerId;
    if (!existing || ownerId !== sellerId) {
      throw new Error("Original-Inserat nicht gefunden oder kein Zugriff.");
    }

    await inserateColl.updateOne(
      { _id: editOid },
      { $set: baseUpdate }
    );

    await entwurfColl.deleteOne({ _id: draft._id, nutzerId: sellerId });

    return { updated: true, inseratId: editId };
  }

  const neuesInserat = {
    ...baseUpdate,
    verkaeuferId: sellerId,
    sellerId: sellerId,
    veroeffentlichtAm: new Date(),
    viewCount: 0,

    verkauf_verkaeufer: (seller.type === "haendler") ? "Händler" : "Privatverkäufer",
    verkauf_name: req.body?.name || payload.verkauf_name || seller.name,

    standort: (req.body?.plz && req.body?.ort)
      ? `${req.body.plz} ${req.body.ort}`
      : (payload.standort || "Nicht angegeben"),

    telefon: req.body?.telefon || payload.telefon || "",
  };

  delete neuesInserat._id;

  await inserateColl.insertOne(neuesInserat);
  await entwurfColl.deleteOne({ _id: draft._id, nutzerId: sellerId });

  return { created: true };
}

/* =========================
   Edit-Workflow Start
========================= */
app.post("/api/inserat/:id/start-edit", checkLogin, async (req, res) => {
  try {
    const inseratId = String(req.params.id || "").trim();
    if (!inseratId) return res.status(400).json({ error: "ID fehlt." });

    let oid;
    try { oid = new ObjectId(inseratId); }
    catch { return res.status(400).json({ error: "Ungültige ID." }); }

    const inserateColl = db.collection("inserate");
    const draftColl    = db.collection("fahrzeugeEntwurf");

    const doc = await inserateColl.findOne({ _id: oid });
    if (!doc) return res.status(404).json({ error: "Inserat nicht gefunden." });

    const ownerId = doc.verkaeuferId || doc.nutzerId;
    if (ownerId !== req.nutzer.id) {
      return res.status(403).json({ error: "Kein Zugriff auf dieses Inserat." });
    }

    const {
      _id,
      status,
      veroeffentlichtAm,
      standortCoords,
      seller,
      verkauf_kurzbeschreibung,
      ...payload
    } = doc;

    const r = await draftColl.insertOne({
      ...payload,

      nutzerId: req.nutzer.id,
      __status: "edit",
      __editInseratId: inseratId,

      erstelltAm: new Date(),
      updatedAt: new Date(),
    });

    return res.json({
      ok: true,
      editInseratId: inseratId,
      draftId: String(r.insertedId),
    });

  } catch (err) {
    console.error("❌ start-edit Fehler:", err);
    return res.status(500).json({ error: "Serverfehler beim Starten des Edit-Modus." });
  }
});

/* =========================
   Abbrechen (letzten Draft löschen)
========================= */
app.post("/abbrechen", checkLogin, async (req, res) => {
  try {
    const collection = db.collection("fahrzeugeEntwurf");
    const letzter = await collection.findOne({ nutzerId: req.nutzer.id }, { sort: { _id: -1 } });
    if (!letzter) return res.json({ message: "Keine Fahrzeuge vorhanden." });

    await collection.deleteOne({ _id: letzter._id, nutzerId: req.nutzer.id });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Fehler beim Abbrechen:", err);
    res.status(500).json({ error: "Fehler beim Abbrechen." });
  }
});

/* =========================
   Tarif temporär speichern (lokal)
========================= */
const tarifPath = path.join(__dirname, "nutzerTarif.json");

app.post("/saveTarif", (req, res) => {
  const { tarif } = req.body;

  if (!tarif) {
    return res.status(400).json({ error: "❌ Kein Tarif angegeben." });
  }

  try {
    fs.writeFileSync(tarifPath, JSON.stringify({ tarif }, null, 2));
    console.log("✅ Tarif erfolgreich gespeichert:", tarif);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Fehler beim Speichern des Tarifs:", err);
    res.status(500).json({ error: "Fehler beim Speichern des Tarifs." });
  }
});

app.get("/getTarif", (req, res) => {
  try {
    if (!fs.existsSync(tarifPath)) {
      return res.json({ tarif: "" });
    }

    const data = fs.readFileSync(tarifPath, "utf8");
    const parsed = JSON.parse(data);
    res.json({ tarif: parsed.tarif || "" });

  } catch (err) {
    console.error("❌ Fehler beim Laden/Verarbeiten der Tarifdatei:", err);
    res.status(500).json({ error: "Fehler beim Verarbeiten der Tarifdatei." });
  }
});

/* =========================
   Übersicht: veröffentlichte Inserate laden (public)
========================= */
app.get("/meineInserate.json", async (req, res) => {
  try {
    const inserateCollection = db.collection("inserate");
    const inserate = await inserateCollection
      .find({ status: "online" })
      .project({
        token: 0, password: 0, iban: 0, bic: 0, kontoinhaber: 0
      })
      .sort({ veroeffentlichtAm: -1, _id: -1 })
      .toArray();

    res.json(inserate);
  } catch (err) {
    console.error("❌ Fehler beim Laden der veröffentlichten Inserate:", err);
    res.status(500).json({ error: "Fehler beim Laden der veröffentlichten Inserate." });
  }
});

/* =========================
   Kurzbeschreibung aus Ausstattung
========================= */
const erlaubteAusstattungen = [
  "Gepäckraumabtrennung",
  "Skisack",
  "Schiebedach",
  "Panorama-Dach",
  "Dachreling",
  "Behindertengerecht",
  "Taxi",
  "Winterpaket",
  "Raucherpaket",
  "Sportpaket",
  "Sportfahrwerk",
  "Luftfederung",
  "TV",
  "Navigationssystem",
  "Soundsystem",
  "Touchscreen",
  "Sprachsteuerung",
  "Multifunktionslenkrad",
  "Bluetooth",
  "Apple CarPlay",
  "Android Auto",
  "WLAN / Wifi Hotspot",
  "Musikstreaming integriert",
  "Induktionsladen für Smartphones",
  "Bordcomputer",
  "Head-up Display",
  "Volldigitales Kombiinstrument",
  "Leichtmetallfelgen",
  "Sommerreifen",
  "Winterreifen",
  "Allwetterreifen"
];

function getZufaelligeAusstattung(ausstattungArray) {
  if (!Array.isArray(ausstattungArray)) return "Besondere Ausstattung";
  const gefiltert = ausstattungArray.filter(item => erlaubteAusstattungen.includes(item));
  if (gefiltert.length === 0) return "Besondere Ausstattung";
  return gefiltert.sort(() => 0.5 - Math.random()).slice(0, 3).join(" • ");
}

/* =========================
   Entwurf -> veröffentlichen (ID-basiert)
========================= */
app.post("/entwurf/:id/publish", checkLogin, async (req, res) => {
  const { id } = req.params;

  let _id;
  try {
    _id = new ObjectId(id);
  } catch {
    return res.status(400).send("Ungültige ID.");
  }

  try {
    const entwurfCollection  = db.collection("fahrzeugeEntwurf");
    const inserateCollection = db.collection("inserate");
    const nutzerCollection   = db.collection("nutzer");

    const draft = await entwurfCollection.findOne({ _id, nutzerId: req.nutzer.id });
    if (!draft) return res.status(404).send("Entwurf nicht gefunden.");

    const haendler = await nutzerCollection.findOne(
      { id: req.nutzer.id },
      {
        projection: {
          id: 1,
          role: 1,
          firma: 1,
          name: 1,
          logoUrl: 1,
          impressum: 1,
          oeffnungszeiten: 1,
          sprachen: 1
        }
      }
    );

    const seller = {
      type: haendler?.role || "privat",
      id:   haendler?.id || req.nutzer.id,
      name: haendler?.firma || haendler?.name || "Anbieter",
      logoUrl: haendler?.logoUrl || "",
      impressum: haendler?.impressum || "",
      oeffnungszeiten: haendler?.oeffnungszeiten || "",
      sprachen: Array.isArray(haendler?.sprachen) ? haendler.sprachen : []
    };

    const neuesInserat = {
      ...draft,
      verkaeuferId: req.nutzer.id,
      sellerId: req.nutzer.id,
      status: "online",
      veroeffentlichtAm: new Date(),
      viewCount: 0,
      verkauf_kurzbeschreibung: getZufaelligeAusstattung(draft.verkauf_ausstattung || []),
      seller
    };

    delete neuesInserat._id;

    await inserateCollection.insertOne(neuesInserat);
    await entwurfCollection.deleteOne({ _id });

    return res.json({ success: true, message: "Inserat erfolgreich veröffentlicht." });
  } catch (err) {
    console.error("❌ Fehler bei /entwurf/:id/publish:", err);
    return res.status(500).send("Fehler beim Veröffentlichen.");
  }
});

/* =========================
   🛡️ Login-Prüfung Middleware (signierte Session + DB-Check)
========================= */
async function checkLogin(req, res, next) {
  try {
    if (!db) {
      return res.status(503).json({ error: "DB noch nicht bereit. Bitte erneut versuchen." });
    }

    const token = req.cookies.session;
    const sess  = decodeSession(token);
    if (!sess?.id) return res.status(401).json({ error: "Nicht eingeloggt." });

    const user = await db.collection("nutzer").findOne(
      { id: sess.id },
      { projection: { id: 1, role: 1, email: 1, verified: 1 } }
    );
    if (!user) return res.status(401).json({ error: "Ungültiger Login." });
    if (!user.verified) return res.status(403).json({ error: "Bitte bestätige zuerst deine E-Mail." });

    req.nutzer = { id: user.id, role: user.role || "privat", email: user.email || "" };
    return next();
  } catch (err) {
    console.error("checkLogin error:", err);
    return res.status(401).json({ error: "Ungültiger Login." });
  }
}

/* =========================
   📧 Mail (SMTP)
========================= */
const MAIL_FROM = process.env.MAIL_FROM || "Autovisa <no-reply@autovisa.de>";
const MAIL_REPLY_TO = process.env.MAIL_REPLY_TO || "support@autovisa.de";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || "false") === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

transporter.verify((error) => {
  if (error) console.error("❌ SMTP-Fehler:", error);
  else console.log("✅ SMTP bereit");
});

/* =========================
   🔧 Email-Template Helper
========================= */
const EMAIL_LOGO_PATH = path.join(__dirname, "public", "autovisa-logo.png");

function getEmailLogoAsset() {
  try {
    if (fs.existsSync(EMAIL_LOGO_PATH)) {
      return {
        logoSrc: "cid:autovisa-logo",
        attachments: [
          {
            filename: "autovisa-logo.png",
            path: EMAIL_LOGO_PATH,
            cid: "autovisa-logo"
          }
        ]
      };
    }
  } catch {}
  return { logoSrc: "", attachments: [] };
}

function getBaseUrlFromReq(req) {
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https")
    .split(",")[0]
    .trim();
  const host = req.get("host");
  const { appUrl } = getUrls();
  const base = (host ? `${proto}://${host}` : appUrl || "").replace(/\/+$/, "");
  return base || "";
}

function sanitizeRedirectPath(input) {
  if (!input || typeof input !== "string") return "/index.html";
  if (input.startsWith("http://") || input.startsWith("https://") || input.startsWith("//")) {
    return "/index.html";
  }
  if (!input.startsWith("/")) return "/index.html";
  return input;
}

function buildAutovisaEmail({
  subject = "Autovisa Nachricht",
  logoSrc,
  logoUrl,
  greeting = "",
  title = "",
  htmlText = "",
  buttonText = "",
  buttonUrl = "",
  footerNote = "Wenn du diese E-Mail nicht erwartet hast, kannst du sie ignorieren."
}) {
  const preheader = (greeting || title).slice(0, 120);
  const logo = logoSrc || logoUrl || "";

  return `
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background:#f5f8fc; font-family:Arial,Helvetica,sans-serif; color:#1a2a33;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${preheader}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f8fc; padding:24px 0;">
    <tr>
      <td align="center" style="padding:0 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 8px 28px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:20px 24px; background:#0f2027;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" style="vertical-align:middle;">
                    ${logo
                      ? `<img src="${logo}" alt="Autovisa" width="120" style="display:block; border:0; outline:none; text-decoration:none; max-width:120px; height:auto;">`
                      : `<div style="font-weight:800; font-size:20px; color:#ffffff; letter-spacing:.08em;">AUTOVISA</div>`}
                  </td>
                  <td align="right" style="vertical-align:middle; text-align:right; font-size:11px; letter-spacing:.22em; text-transform:uppercase; color:#b8d0d4;">
                    Fahrzeuge kaufen &amp; verkaufen
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:26px 28px 10px;">
              ${greeting ? `<div style="font-size:16px; margin-bottom:8px; color:#1a2a33;">${greeting}</div>` : ""}
              ${title ? `<h1 style="margin:0 0 12px; font-size:22px; line-height:1.35; color:#1a2a33;">${title}</h1>` : ""}
              ${htmlText ? `<div style="font-size:15px; line-height:1.65; color:#38444f;">${htmlText}</div>` : ""}
            </td>
          </tr>

          ${buttonText && buttonUrl ? `
          <tr>
            <td align="center" style="padding:8px 28px 6px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" bgcolor="#00b8a9" style="border-radius:10px;">
                    <a href="${buttonUrl}"
                       style="display:inline-block; padding:12px 22px; font-size:14px; font-weight:700; color:#ffffff; text-decoration:none; border-radius:10px;">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 10px;">
              <div style="font-size:12px; line-height:1.5; color:#6b7a86; word-break:break-all;">
                Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br>
                <a href="${buttonUrl}" style="color:#0f7a70;">${buttonUrl}</a>
              </div>
            </td>
          </tr>` : ""}

          <tr>
            <td style="padding:18px 28px 28px;">
              <div style="border-top:1px solid #e3e9ef; padding-top:14px; font-size:12px; color:#6b7a86;">
                ${footerNote}
              </div>
              <div style="margin-top:6px; font-size:12px; color:#6b7a86;">
                © ${new Date().getFullYear()} Autovisa
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* =========================
   📬 Kontaktformular
========================= */
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "kontakt@autovisa.de";
const CONTACT_MAX_LEN = 5000;

app.post("/kontakt", async (req, res) => {
  try {
    let { name, email, subject, message } = req.body || {};
    name = String(name || "").trim();
    email = String(email || "").trim().toLowerCase();
    subject = String(subject || "").trim();
    message = String(message || "").trim();

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: "Bitte alle Felder ausfüllen." });
    }
    if (message.length > CONTACT_MAX_LEN) {
      return res.status(400).json({ error: "Nachricht ist zu lang." });
    }
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Bitte eine gültige E-Mail-Adresse eingeben." });
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject) || "Ohne Betreff";
    const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

    const { logoSrc, attachments } = getEmailLogoAsset();

    const mailSubject = `Kontaktanfrage: ${subject || "Ohne Betreff"}`;
    const html = buildAutovisaEmail({
      subject: mailSubject,
      logoSrc,
      greeting: "Neue Kontaktanfrage",
      title: safeSubject,
      htmlText: `
        <p><b>Name:</b> ${safeName}</p>
        <p><b>E-Mail:</b> ${safeEmail}</p>
        <p><b>Betreff:</b> ${safeSubject}</p>
        <p><b>Nachricht:</b><br>${safeMessage}</p>
      `,
      footerNote: "Diese Nachricht wurde über das Kontaktformular auf autovisa.de gesendet."
    });

    const text =
`Neue Kontaktanfrage
Name: ${name}
E-Mail: ${email}
Betreff: ${subject || "Ohne Betreff"}

Nachricht:
${message}`;

    await transporter.sendMail({
      from: MAIL_FROM,
      replyTo: `${name} <${email}>`,
      to: CONTACT_EMAIL,
      subject: mailSubject,
      html,
      text,
      attachments
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ Fehler bei /kontakt:", err);
    return res.status(500).json({ error: "Nachricht konnte nicht gesendet werden." });
  }
});

/* =========================
   📝 Registrierung
========================= */
app.post("/register", async (req, res) => {
  let { name, email, password } = req.body;

  name  = (name  || "").trim();
  email = (email || "").trim().toLowerCase();

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Alle Felder sind erforderlich." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Passwort muss mindestens 8 Zeichen haben." });
  }

  try {
    const nutzerColl = db.collection("nutzer");

    const exists = await nutzerColl.findOne({ email });
    if (exists) {
      return res.status(400).json({ error: "E-Mail bereits registriert." });
    }

    const token = crypto.randomBytes(20).toString("hex");
    const hash  = await bcrypt.hash(password, 12);

    const neuerNutzer = {
      id: Date.now().toString(),
      name,
      email,
      password: hash,
      verified: false,
      token,
      role: "privat",
      createdAt: new Date(),
    };

    await nutzerColl.insertOne(neuerNutzer);

    const urls = getUrls();
    const verifyLink = `${urls.api}/verify?token=${token}`;
    const { logoSrc, attachments } = getEmailLogoAsset();

    const subject = "Bitte bestätige deine Registrierung";
    const html = buildAutovisaEmail({
      subject,
      logoSrc,
      greeting: `Willkommen bei Autovisa, ${name}!`,
      title: "E-Mail-Adresse bestätigen",
      htmlText: "Klicke auf den Button, um deine Registrierung abzuschließen.",
      buttonText: "E-Mail bestätigen",
      buttonUrl: verifyLink,
      footerNote: "Wenn du dich nicht bei Autovisa registriert hast, kannst du diese E-Mail ignorieren."
    });

    const text =
`Willkommen bei Autovisa, ${name}!
Bitte bestätige deine E-Mail, um die Registrierung abzuschließen:
${verifyLink}

Wenn du dich nicht registriert hast, ignoriere diese E-Mail.`;

    const info = await transporter.sendMail({
      from: MAIL_FROM,
      replyTo: MAIL_REPLY_TO,
      to: email,
      subject,
      html,
      text,
      attachments,
    });

    console.log("✅ Bestätigungsmail gesendet:", info.messageId || info.response);
    return res.json({ success: true, message: "E-Mail zur Bestätigung wurde gesendet." });

  } catch (mailOrDbErr) {
    console.error("❌ Fehler bei Registrierung/Versand:", mailOrDbErr);

    try { if (email) await db.collection("nutzer").deleteOne({ email, verified: false }); } catch {}

    return res.status(500).json({ error: "Interner Fehler oder E-Mail-Versand fehlgeschlagen." });
  }
});

/* =========================
   🔐 Login (bcrypt + Migration + signierte Session)
========================= */
app.post("/login", async (req, res) => {
  let { email, password } = req.body;

  email = (email || "").trim().toLowerCase();
  if (!email || !password) {
    return res.status(400).json({ error: "❌ E-Mail und Passwort erforderlich." });
  }

  try {
    const nutzerColl = db.collection("nutzer");
    const user = await nutzerColl.findOne({ email });

    if (!user) {
      return res.status(401).json({ error: "❌ E-Mail oder Passwort falsch." });
    }

    let passOK = false;

    if (typeof user.password === "string" && user.password.startsWith("$2")) {
      passOK = await bcrypt.compare(password, user.password);
    } else {
      passOK = user.password === password;
      if (passOK) {
        const newHash = await bcrypt.hash(password, 12);
        await nutzerColl.updateOne({ _id: user._id }, { $set: { password: newHash } });
      }
    }

    if (!passOK) {
      return res.status(401).json({ error: "❌ E-Mail oder Passwort falsch." });
    }

    if (!user.verified) {
      return res.status(403).json({ error: "❌ Bitte bestätige zuerst deine E-Mail." });
    }

    const { appUrl } = getUrls();
    const isSecureCookie = appUrl.startsWith("https") || process.env.NODE_ENV === "production";

    const payload = makeSessionPayload(user);
    const sessionToken = encodeSession(payload);

    res.cookie("session", sessionToken, {
      httpOnly: true,
      sameSite: "Lax",
      secure: isSecureCookie,
      maxAge: 1000 * 60 * 60 * 24,
      path: "/"
    });

    res.cookie("isLoggedIn", "true", {
      httpOnly: false,
      sameSite: "Lax",
      secure: isSecureCookie,
      maxAge: 1000 * 60 * 60 * 24,
      path: "/"
    });

    return res.json({
      success: true,
      role: user.role || "privat",
      id: user.id,
      name: user.name || user.firma || "Unbekannt"
    });

  } catch (err) {
    console.error("❌ Fehler beim Login:", err);
    return res.status(500).json({ error: "❌ Interner Serverfehler." });
  }
});

/* =========================
   🔐 Google OAuth (Privat)
========================= */
app.get("/auth/google", (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    const baseUrl = getBaseUrlFromReq(req);
    return res.redirect(`${baseUrl}/login.html?oauth=missing`);
  }

  const baseUrl = getBaseUrlFromReq(req);
  const redirectUri = `${baseUrl}/auth/google/callback`;
  const state = crypto.randomBytes(16).toString("hex");
  const redirectPath = sanitizeRedirectPath(req.query.redirect);

  const isSecureCookie = baseUrl.startsWith("https") || process.env.NODE_ENV === "production";
  res.cookie("g_oauth_state", state, {
    httpOnly: true,
    sameSite: "Lax",
    secure: isSecureCookie,
    maxAge: 1000 * 60 * 10,
    path: "/"
  });
  res.cookie("g_oauth_redirect", redirectPath, {
    httpOnly: true,
    sameSite: "Lax",
    secure: isSecureCookie,
    maxAge: 1000 * 60 * 10,
    path: "/"
  });

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return res.redirect(authUrl);
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    const baseUrl = getBaseUrlFromReq(req);
    const redirectUri = `${baseUrl}/auth/google/callback`;
    const stateCookie = req.cookies?.g_oauth_state || "";
    const redirectCookie = req.cookies?.g_oauth_redirect || "";

    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    if (!code || !state || !stateCookie || state !== stateCookie) {
      return res.redirect(`${baseUrl}/login.html?oauth=invalid`);
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok) {
      console.error("❌ Google token error:", tokenData);
      return res.redirect(`${baseUrl}/login.html?oauth=error`);
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return res.redirect(`${baseUrl}/login.html?oauth=error`);
    }

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const profile = await profileRes.json().catch(() => ({}));
    if (!profileRes.ok) {
      console.error("❌ Google userinfo error:", profile);
      return res.redirect(`${baseUrl}/login.html?oauth=error`);
    }

    const email = String(profile.email || "").trim().toLowerCase();
    if (!email) {
      return res.redirect(`${baseUrl}/login.html?oauth=error`);
    }

    const emailVerified = profile.verified_email ?? profile.email_verified;
    if (emailVerified === false) {
      return res.redirect(`${baseUrl}/login.html?oauth=error`);
    }

    const displayName =
      String(profile.name || "").trim() ||
      [profile.given_name, profile.family_name].filter(Boolean).join(" ").trim() ||
      "Autovisa Nutzer";

    const nutzerColl = db.collection("nutzer");
    let user = await nutzerColl.findOne({ email });

    if (user) {
      const roleRaw = String(user.role || "").toLowerCase();
      if (roleRaw.includes("haend")) {
        return res.redirect(`${baseUrl}/login.html?oauth=forbidden`);
      }

      await nutzerColl.updateOne(
        { _id: user._id },
        {
          $set: {
            verified: true,
            googleId: profile.id || profile.sub || user.googleId,
            authProvider: "google",
            name: user.name || displayName
          }
        }
      );
      user = await nutzerColl.findOne({ _id: user._id });
    } else {
      const dummyPassword = await bcrypt.hash(
        crypto.randomBytes(24).toString("hex"),
        12
      );
      const newUser = {
        id: Date.now().toString(),
        name: displayName,
        email,
        password: dummyPassword,
        verified: true,
        role: "privat",
        createdAt: new Date(),
        googleId: profile.id || profile.sub || "",
        authProvider: "google"
      };
      await nutzerColl.insertOne(newUser);
      user = newUser;
    }

    const isSecureCookie = baseUrl.startsWith("https") || process.env.NODE_ENV === "production";
    const payload = makeSessionPayload(user);
    const sessionToken = encodeSession(payload);

    res.cookie("session", sessionToken, {
      httpOnly: true,
      sameSite: "Lax",
      secure: isSecureCookie,
      maxAge: 1000 * 60 * 60 * 24,
      path: "/"
    });
    res.cookie("isLoggedIn", "true", {
      httpOnly: false,
      sameSite: "Lax",
      secure: isSecureCookie,
      maxAge: 1000 * 60 * 60 * 24,
      path: "/"
    });

    res.clearCookie("g_oauth_state", { path: "/" });
    res.clearCookie("g_oauth_redirect", { path: "/" });

    const redirectPath = sanitizeRedirectPath(redirectCookie);
    return res.redirect(`${baseUrl}${redirectPath}`);
  } catch (err) {
    console.error("❌ Google OAuth error:", err);
    const baseUrl = getBaseUrlFromReq(req);
    return res.redirect(`${baseUrl}/login.html?oauth=error`);
  }
});

/* =========================
   🔁 Passwort-Reset anfordern
========================= */
app.post("/forgot-password", async (req, res) => {
  let { email } = req.body;
  email = (email || "").trim().toLowerCase();

  if (!email) {
    return res.status(400).json({ error: "E-Mail erforderlich." });
  }

  try {
    const nutzerColl = db.collection("nutzer");
    const user = await nutzerColl.findOne({ email });

    if (user) {
      const resetToken   = crypto.randomBytes(32).toString("hex");
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

      await nutzerColl.updateOne(
        { _id: user._id },
        { $set: { resetToken, resetTokenExpires: resetExpires } }
      );

      const { appUrl } = getUrls();

      const resetLink = `${appUrl}/reset-passwort.html?token=${resetToken}`;
      const { logoSrc, attachments } = getEmailLogoAsset();
      const subject   = "Passwort für Autovisa zurücksetzen";
      const name      = user.name || user.firma || "";

      const html = buildAutovisaEmail({
        subject,
        logoSrc,
        greeting: name ? `Hallo ${name},` : "",
        title: "Passwort zurücksetzen",
        htmlText: "Du hast angefordert, dein Passwort für Autovisa zurückzusetzen. Klicke auf den Button, um ein neues Passwort zu vergeben.",
        buttonText: "Neues Passwort festlegen",
        buttonUrl: resetLink,
        footerNote: "Wenn du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren."
      });

      const text =
        `Hallo ${name || ""},\n\n` +
        `du kannst dein Autovisa-Passwort über diesen Link zurücksetzen:\n${resetLink}\n\n` +
        "Wenn du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail.";

      await transporter.sendMail({
        from: MAIL_FROM,
        replyTo: MAIL_REPLY_TO,
        to: email,
        subject,
        html,
        text,
        attachments,
      });
    }

    return res.json({
      success: true,
      message: "Wenn die E-Mail bei Autovisa registriert ist, haben wir dir einen Link geschickt.",
    });
  } catch (err) {
    console.error("❌ Fehler bei /forgot-password:", err);
    return res.status(500).json({ error: "Interner Fehler." });
  }
});

/* =========================
   🔁 Neues Passwort setzen
========================= */
app.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: "Token und neues Passwort erforderlich." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Passwort muss mindestens 8 Zeichen lang sein." });
  }

  try {
    const nutzerColl = db.collection("nutzer");
    const now = new Date();

    const user = await nutzerColl.findOne({
      resetToken: token,
      resetTokenExpires: { $gt: now },
    });

    if (!user) {
      return res.status(400).json({ error: "Dieser Link ist ungültig oder abgelaufen." });
    }

    const hash = await bcrypt.hash(password, 12);

    await nutzerColl.updateOne(
      { _id: user._id },
      {
        $set:   { password: hash },
        $unset: { resetToken: "", resetTokenExpires: "" },
      }
    );

    return res.json({ success: true, message: "Passwort wurde aktualisiert." });
  } catch (err) {
    console.error("❌ Fehler bei /reset-password:", err);
    return res.status(500).json({ error: "Interner Fehler." });
  }
});

function projectWithSeller() {
  return [
    {
      $lookup: {
        from: "nutzer",
        let: { vid: "$verkaeuferId" },
        pipeline: [
          { $match: { $expr: { $eq: ["$id", "$$vid"] } } },
          { $project: { _id: 0, id: 1, role: 1, firma: 1, name: 1, logoUrl: 1 } }
        ],
        as: "sellerUser"
      }
    },
    { $unwind: { path: "$sellerUser", preserveNullAndEmptyArrays: true } },

    // seller-Fallback, falls im Inserat kein seller Snapshot steckt
    {
      $addFields: {
        seller: {
          $ifNull: [
            "$seller",
            {
              type: { $ifNull: ["$sellerUser.role", "privat"] },
              id: { $ifNull: ["$sellerUser.id", ""] },
              name: {
                $ifNull: [
                  "$sellerUser.firma",
                  { $ifNull: ["$sellerUser.name", "Händler"] }
                ]
              },
              logoUrl: { $ifNull: ["$sellerUser.logoUrl", ""] }
            }
          ]
        }
      }
    },

    // ✅ Händler-Bewertung (avg + count) nur wenn vorhanden
    {
      $lookup: {
        from: "bewertungen",
        let: { sid: "$seller.id", stype: "$seller.type" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$$stype", "haendler"] },
                  {
                    $or: [
                      { $eq: ["$sellerId", "$$sid"] },
                      { $eq: ["$haendlerId", "$$sid"] }
                    ]
                  }
                ]
              }
            }
          },
          {
            $project: {
              _id: 0,
              ratingNum: {
                $convert: { input: "$rating", to: "double", onError: null, onNull: null }
              }
            }
          },
          { $match: { ratingNum: { $gt: 0 } } },
          { $group: { _id: null, avg: { $avg: "$ratingNum" }, count: { $sum: 1 } } }
        ],
        as: "sellerRatingAgg"
      }
    },
    { $unwind: { path: "$sellerRatingAgg", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        "seller.ratingAvg": {
          $cond: [
            { $gt: ["$sellerRatingAgg.count", 0] },
            { $round: ["$sellerRatingAgg.avg", 1] },
            null
          ]
        },
        "seller.ratingCount": { $ifNull: ["$sellerRatingAgg.count", 0] }
      }
    },

    {
      $project: {
        token: 0, password: 0, iban: 0, bic: 0, kontoinhaber: 0,
        sellerUser: 0,
        sellerRatingAgg: 0
      }
    }
  ];
}


/* =========================
   Private Liste veröffentlichter Inserate des Verkäufers
========================= */
app.get("/meine-inserate", checkLogin, async (req, res) => {
  try {
    const userId = req.nutzer.id;
    const items = await db.collection("inserate")
      .aggregate([
        { $match: { verkaeuferId: userId } },
        { $sort: { veroeffentlichtAm: -1, _id: -1 } },
        ...projectWithSeller()
      ]).toArray();
    res.json(items);
  } catch (err) {
    console.error("❌ Fehler bei /meine-inserate:", err);
    res.status(500).json({ error: "Fehler beim Laden der veröffentlichten Inserate." });
  }
});

/* =========================
   Gespeicherte Inserate
========================= */
app.post("/saved/toggle", checkLogin, async (req, res) => {
  try {
    const userId = req.nutzer.id;
    const fahrzeugId = String(req.body.fahrzeugId || "").trim();

    if (!fahrzeugId) {
      return res.status(400).json({ error: "fahrzeugId fehlt." });
    }

    const coll = db.collection("savedInserate");
    const existing = await coll.findOne({ userId, fahrzeugId });

    if (existing) {
      await coll.deleteOne({ _id: existing._id });
      return res.json({ saved: false });
    }

    try {
      await coll.insertOne({
        userId,
        fahrzeugId,
        createdAt: new Date(),
      });
      return res.json({ saved: true });
    } catch (err) {
      if (err && err.code === 11000) {
        return res.json({ saved: true });
      }
      throw err;
    }
  } catch (err) {
    console.error("❌ Fehler bei /saved/toggle:", err);
    return res.status(500).json({
      error:
        "Serverfehler beim Speichern (" +
        (err.code || err.message || "Unbekannter Fehler") +
        ")",
    });
  }
});

app.get("/saved/status/:fahrzeugId", checkLogin, async (req, res) => {
  try {
    const userId = req.nutzer.id;
    const fahrzeugId = String(req.params.fahrzeugId || "").trim();
    if (!fahrzeugId) {
      return res.status(400).json({ error: "ID fehlt." });
    }

    const coll = db.collection("savedInserate");
    const existing = await coll.findOne({ userId, fahrzeugId });

    res.json({ saved: !!existing });
  } catch (err) {
    console.error("❌ Fehler bei /saved/status:", err);
    res.status(500).json({ error: "Serverfehler beim Status." });
  }
});
// Liste gespeicherter Inserate (online) – inkl. Seller-Fallback
app.get("/saved/list", checkLogin, async (req, res) => {
  try {
    const savedColl    = db.collection("savedInserate");
    const inserateColl = db.collection("inserate");

    // ✅ WICHTIG: userId (und optional legacy nutzerId als Fallback)
    const savedDocs = await savedColl
      .find({ $or: [{ userId: req.nutzer.id }, { nutzerId: req.nutzer.id }] })
      .project({ fahrzeugId: 1, _id: 0 })
      .toArray();

    const ids = (savedDocs || [])
      .map(d => {
        try { return new ObjectId(String(d.fahrzeugId)); }
        catch { return null; }
      })
      .filter(Boolean);

    if (!ids.length) return res.json([]);

    const inserate = await inserateColl.aggregate([
      { $match: { _id: { $in: ids }, status: "online" } },
      { $sort: { veroeffentlichtAm: -1, _id: -1 } },

      // ✅ WICHTIG: Funktion AUFRUFEN
      ...projectWithSeller()
    ]).toArray();

    res.json(inserate);
  } catch (e) {
    console.error("saved/list error:", e);
    res.status(500).json({ error: "Fehler beim Laden gespeicherter Inserate" });
  }
});


/* =========================
   Nutzer-Info aus Session (Privat + Händler)
========================= */
app.get("/getNutzerInfo", async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ eingeloggt: false, error: "DB noch nicht bereit." });
    }

    const sess = decodeSession(req.cookies.session);
    if (!sess?.id) {
      return res.json({ eingeloggt: false });
    }

    const nutzer = await db.collection("nutzer").findOne(
      { id: sess.id },
      {
        projection: {
          id: 1,
          role: 1,
          name: 1,
          firma: 1,
          logoUrl: 1,
          createdAt: 1,
          erstelltAm: 1,

          strasse: 1,
          hausnummer: 1,
          plz: 1,
          ort: 1,
          land: 1,
          adresse: 1,
          standort: 1,

          telefon: 1,
          telefon2: 1,
          email: 1,

          website: 1,
          webseite: 1,
          homepage: 1,

          oeffnungszeiten: 1,
          "öffnungszeiten": 1,
          oeffnungszeitenDetails: 1,

          sprachen: 1,
          impressum: 1
        }
      }
    );

    if (!nutzer) {
      return res.json({ eingeloggt: false });
    }

    const rolleRaw = (nutzer.role || "privat").toLowerCase();
    const isHaendler =
      rolleRaw === "haendler" ||
      rolleRaw === "händler" ||
      rolleRaw.includes("haend") ||
      rolleRaw.includes("händ");

    const created = nutzer.erstelltAm || nutzer.createdAt || null;

    const website =
      nutzer.website || nutzer.webseite || nutzer.homepage || "";

    let ratingAvg = null;
    let ratingCount = 0;

    if (isHaendler) {
      try {
        const agg = await db.collection("bewertungen")
          .aggregate([
            {
              $match: {
                $or: [
                  { haendlerId: nutzer.id },
                  { sellerId: nutzer.id }
                ],
                rating: { $gt: 0 }
              }
            },
            {
              $group: {
                _id: null,
                avg: { $avg: "$rating" },
                count: { $sum: 1 }
              }
            }
          ])
          .toArray();

        if (agg.length > 0) {
          ratingAvg = agg[0].avg;
          ratingCount = agg[0].count;
        }
      } catch (ratingErr) {
        console.error("Fehler beim Laden der Händler-Bewertungen:", ratingErr);
      }
    }

    return res.json({
      eingeloggt: true,
      nutzerId: nutzer.id,

      rolle: rolleRaw,
      role: nutzer.role || "privat",
      isHaendler,

      name: nutzer.name || "",
      firma: nutzer.firma || "",
      anzeigeName: nutzer.firma || nutzer.name || "Unbekannt",

      logoUrl: nutzer.logoUrl || "",
      createdAt: created,

      strasse: nutzer.strasse || "",
      hausnummer: nutzer.hausnummer || "",
      plz: nutzer.plz || "",
      ort: nutzer.ort || "",
      land: nutzer.land || "",
      adresse: nutzer.adresse || "",
      standort: nutzer.standort || "",

      telefon:  nutzer.telefon  || "",
      telefon2: nutzer.telefon2 || "",
      email:    nutzer.email    || "",

      website,

      oeffnungszeiten:
        nutzer.oeffnungszeiten || nutzer["öffnungszeiten"] || "",
      oeffnungszeitenDetails: nutzer.oeffnungszeitenDetails || null,

      sprachen: Array.isArray(nutzer.sprachen) ? nutzer.sprachen : [],
      impressum: nutzer.impressum || "",

      ratingAvg,
      ratingCount
    });
  } catch (err) {
    console.error("❌ Fehler bei /getNutzerInfo:", err);
    return res
      .status(500)
      .json({ eingeloggt: false, error: "Interner Serverfehler." });
  }
});


// ============================================================
// ✅ 2. Hälfte – bereinigt & kompatibel zur 1. Hälfte
// ============================================================


// ------------------------------------------------------------
// Profil-Felder (Adresse, Telefon, Website, Öffnungszeiten) speichern
// -> jetzt mit checkLogin, damit verified + req.nutzer sauber genutzt wird
// ------------------------------------------------------------
async function normalizeProfileAddress(rawAddress) {
  const q = String(rawAddress || "").trim();
  if (!q) return null;

  const key = `addr:${q.toLowerCase()}`;
  const cacheColl = db.collection("geocache");
  const cached = await cacheColl.findOne({ key });
  if (cached?.address) return cached.address;

  const headers = {
    "User-Agent": "autovisa/1.0 (contact: info@autovisa.de)",
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.6",
  };

  const fetchJson = async (url, timeoutMs = 4000) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: ctrl.signal });
      if (!res.ok) return null;
      return await res.json().catch(() => null);
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  };

  const pickCity = (a = {}) =>
    a.city || a.town || a.village || a.hamlet || a.suburb || a.locality || a.municipality || "";

  const pickStreet = (a = {}) =>
    a.road || a.pedestrian || a.residential || a.footway || a.path || a.cycleway || a.highway || "";

  const formatAddress = ({ street, houseNumber, postcode, city, country }, fallback) => {
    const line1 = [street, houseNumber].filter(Boolean).join(" ");
    const line2 = [postcode, city].filter(Boolean).join(" ");
    const formatted = [line1, line2, country].filter(Boolean).join(", ");
    return formatted || fallback || q;
  };

  let result = null;

  // 1) Nominatim (DE, addressdetails)
  const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&countrycodes=de&q=${encodeURIComponent(q)}`;
  const nomArr = await fetchJson(nomUrl, 4000);
  const nomItem = Array.isArray(nomArr) ? nomArr[0] : null;
  if (nomItem) {
    const a = nomItem.address || {};
    const street = pickStreet(a);
    const houseNumber = a.house_number || "";
    const postcode = a.postcode || "";
    const city = pickCity(a);
    const country = a.country || "Deutschland";
    const lat = Number(nomItem.lat);
    const lon = Number(nomItem.lon);

    result = {
      street,
      houseNumber,
      postcode,
      city,
      country,
      lat: Number.isFinite(lat) ? lat : null,
      lon: Number.isFinite(lon) ? lon : null,
      formatted: formatAddress(
        { street, houseNumber, postcode, city, country },
        nomItem.display_name
      ),
    };
  }

  // 2) Photon Fallback
  if (!result) {
    const phoUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=de&limit=1`;
    const pho = await fetchJson(phoUrl, 4000);
    const feat = Array.isArray(pho?.features) ? pho.features[0] : null;
    if (feat) {
      const p = feat.properties || {};
      const street = p.street || p.name || "";
      const houseNumber = p.housenumber || "";
      const postcode = p.postcode || "";
      const city =
        p.city || p.town || p.village || p.locality || p.state || p.county || "";
      const country = p.country || "Deutschland";
      const coords = feat.geometry?.coordinates || [];
      const lon = Number(coords[0]);
      const lat = Number(coords[1]);

      result = {
        street,
        houseNumber,
        postcode,
        city,
        country,
        lat: Number.isFinite(lat) ? lat : null,
        lon: Number.isFinite(lon) ? lon : null,
        formatted: formatAddress(
          { street, houseNumber, postcode, city, country },
          p.name
        ),
      };
    }
  }

  if (!result) return null;

  await cacheColl.updateOne(
    { key },
    { $set: { key, address: result, updatedAt: new Date() } },
    { upsert: true }
  );

  return result;
}

app.post("/profil/update", checkLogin, async (req, res) => {
  try {
    const { field, value } = req.body || {};
    if (!field) {
      return res.status(400).json({ error: "Kein Feld angegeben." });
    }

    const v = (value ?? "").toString().trim();
    const update = {};
    let normalizedAddress = "";
    let addressPayload = null;
    let standortValue = "";
    let coords = null;

    switch (field) {
      case "address": {
        if (!v) {
          return res.status(400).json({ error: "Adresse darf nicht leer sein." });
        }

        const geo = await normalizeProfileAddress(v);
        if (!geo || !geo.postcode || !geo.city) {
          return res.status(400).json({
            error: "Adresse nicht gefunden. Bitte Straße, PLZ und Ort eingeben."
          });
        }

        normalizedAddress = geo.formatted || v;
        addressPayload = {
          street: geo.street || "",
          houseNumber: geo.houseNumber || "",
          postcode: geo.postcode || "",
          city: geo.city || "",
          country: geo.country || "Deutschland",
        };
        standortValue = [addressPayload.postcode, addressPayload.city].filter(Boolean).join(" ");
        coords = (Number.isFinite(geo?.lat) && Number.isFinite(geo?.lon))
          ? { type: "Point", coordinates: [Number(geo.lon), Number(geo.lat)] }
          : null;

        update.adresse = normalizedAddress;
        update.strasse = addressPayload.street;
        update.hausnummer = addressPayload.houseNumber;
        update.plz = addressPayload.postcode;
        update.ort = addressPayload.city;
        update.land = addressPayload.country;
        update.standort = standortValue;
        break;
      }
      case "phone":
        update.telefon = v;
        break;
      case "phone2":
        update.telefon2 = v;
        break;
      case "website":
        update.website = v;
        break;
      case "openingHours":
        update.oeffnungszeiten = v; // bearbeiteter Text inkl. Template
        break;
      case "impressum":
        update.impressum = v;
        break;
      case "languages": {
        const raw = String(value ?? "").replace(/\n+/g, ",");
        const list = raw
          .split(",")
          .map(s => s.trim())
          .filter(Boolean);
        update.sprachen = list;
        break;
      }
      default:
        return res.status(400).json({
          error: "Dieses Feld darf nicht aktualisiert werden."
        });
    }

    await db.collection("nutzer").updateOne(
      { id: req.nutzer.id },
      { $set: update }
    );

    if (field === "address") {
      try {
        const inserateUpdate = {
          standort: standortValue,
          "seller.strasse": addressPayload?.street || "",
          "seller.hausnummer": addressPayload?.houseNumber || "",
          "seller.plz": addressPayload?.postcode || "",
          "seller.ort": addressPayload?.city || "",
          "seller.land": addressPayload?.country || "Deutschland",
        };
        if (coords) inserateUpdate.standortCoords = coords;

        await db.collection("inserate").updateMany(
          { verkaeuferId: req.nutzer.id },
          { $set: inserateUpdate }
        );
      } catch (e) {
        console.warn("❌ Inserate-Update nach Adressänderung fehlgeschlagen:", e?.message || e);
      }
    } else if (field === "impressum") {
      try {
        await db.collection("inserate").updateMany(
          { verkaeuferId: req.nutzer.id },
          { $set: { "seller.impressum": v, impressum: v } }
        );
      } catch (e) {
        console.warn("❌ Inserate-Update nach Impressum-Änderung fehlgeschlagen:", e?.message || e);
      }
    }

    const payload = { success: true };
    if (field === "address") {
      payload.normalizedAddress = normalizedAddress;
      payload.address = addressPayload;
    }

    return res.json(payload);
  } catch (err) {
    console.error("❌ Fehler bei /profil/update:", err);
    return res.status(500).json({ error: "Interner Serverfehler." });
  }
});


// ------------------------------------------------------------
// Multer-Instanz für Logo-Upload (nutzt storage aus Teil 1)
// ------------------------------------------------------------
const uploadLogo = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.startsWith("image/");
    cb(ok ? null : new Error("Nur Bilddateien (PNG/JPG/WEBP) erlaubt."), ok);
  }
});


// ------------------------------------------------------------
// Händlerregistrierung mit optionalem Logo-Upload
// ------------------------------------------------------------
app.post("/haendler-registrieren", uploadLogo.single("logo"), async (req, res) => {
  const {
    firma,
    strasse,
    hausnummer,
    plz,
    ort,
    land,
    telefon,
    telefon2,
    email,
    whatsapp,
    tarif,
    zahlungsmethode,
    kontoinhaber,
    iban,
    bic,
    impressum,
    agb,
    datenschutz,
    password,
    confirmPassword,
    website
  } = req.body;

  // Normalisierung
  const _firma           = (firma || "").trim();
  const _email           = (email || "").trim().toLowerCase();
  const _strasse         = (strasse || "").trim();
  const _hausnummer      = (hausnummer || "").trim();
  const _plz             = (plz || "").trim();
  const _ort             = (ort || "").trim();
  const _land            = (land || "").trim();
  const _telefon         = (telefon || "").trim();
  const _telefon2        = (telefon2 || "").trim();
  const _tarif           = (tarif || "").trim();
  const _zahlungsmethode = (zahlungsmethode || "").trim();
  const _kontoinhaber    = (kontoinhaber || "").trim();
  const _iban            = (iban || "").replace(/\s+/g, "").toUpperCase();
  const _bic             = (bic || "").replace(/\s+/g, "").toUpperCase();
  const _impressum       = (impressum || "").trim();
  const _website         = (website || "").trim();

  const toBool = (v) =>
    v === true || v === "true" || v === "on" || v === 1 || v === "1";

  const _whatsapp    = toBool(whatsapp);
  const _agb         = toBool(agb);
  const _datenschutz = toBool(datenschutz);

  // ✅ Öffnungszeiten aus Input-Feldern bauen
  const dayLabels = {
    mo: "Montag",
    di: "Dienstag",
    mi: "Mittwoch",
    do: "Donnerstag",
    fr: "Freitag",
    sa: "Samstag",
    so: "Sonntag",
  };

  const openingDetails = {};
  const openingLines   = [];

  for (const [key, label] of Object.entries(dayLabels)) {
    const vonRaw    = req.body[`oeffnungszeiten_${key}_von`] || "";
    const bisRaw    = req.body[`oeffnungszeiten_${key}_bis`] || "";
    const closedRaw = req.body[`oeffnungszeiten_${key}_closed`];

    const von    = String(vonRaw || "").trim();
    const bis    = String(bisRaw || "").trim();
    const closed = toBool(closedRaw);

    openingDetails[key] = { von, bis, closed };

    // Wenn gar nichts eingetragen wurde, Tag überspringen
    if (!von && !bis && !closed) continue;

    if (closed || (!von && !bis)) {
      openingLines.push(`${label}: geschlossen`);
    } else {
      openingLines.push(`${label}: ${von || "—"}–${bis || "—"}`);
    }
  }

  const _oeffnungszeiten = openingLines.join("\n");

  // ✅ Sprachen: Checkboxen → Array
  let sprachenArr = req.body.sprachen || [];
  if (!Array.isArray(sprachenArr)) {
    sprachenArr = sprachenArr ? [sprachenArr] : [];
  }
  sprachenArr = sprachenArr
    .map((s) => String(s || "").trim())
    .filter(Boolean);

  // Pflichtfelder prüfen
  if (!_firma || !_email || !password || !_agb || !_datenschutz) {
    return res.status(400).json({
      error: "Bitte füllen Sie alle Pflichtfelder aus und akzeptieren Sie AGB & Datenschutz.",
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwörter stimmen nicht überein." });
  }

  if (!_telefon) {
    return res.status(400).json({
      error: "Bitte eine Telefonnummer für Kundenanfragen angeben.",
    });
  }

  try {
    const nutzerColl = db.collection("nutzer");

    // E-Mail darf nur einmal vorkommen
    const existing = await nutzerColl.findOne({ email: _email });
    if (existing) {
      return res.status(400).json({
        error: "Diese E-Mail-Adresse wird bereits verwendet.",
      });
    }

    if (!_strasse || !_hausnummer || !_plz || !_ort) {
      return res.status(400).json({
        error: "Bitte Straße, Hausnummer, PLZ und Ort vollständig angeben.",
      });
    }

    const normPlz = (v) => String(v || "").replace(/\s+/g, "");
    const normCity = (v) =>
      String(v || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9]/g, "");

    const addressQuery = [
      _strasse,
      _hausnummer,
      `${_plz} ${_ort}`.trim(),
      _land,
    ]
      .filter(Boolean)
      .join(", ");

    const geo = await normalizeProfileAddress(addressQuery);
    if (!geo || !geo.postcode || !geo.city) {
      return res.status(400).json({
        error:
          "Adresse nicht gefunden. Bitte Straße, PLZ und Ort prüfen und erneut versuchen.",
      });
    }

    if (normPlz(_plz) && geo.postcode && normPlz(_plz) !== normPlz(geo.postcode)) {
      return res.status(400).json({
        error: "Die PLZ passt nicht zur eingegebenen Adresse.",
      });
    }

    const inputCity = normCity(_ort);
    const geoCity = normCity(geo.city);
    if (inputCity && geoCity && !geoCity.includes(inputCity) && !inputCity.includes(geoCity)) {
      return res.status(400).json({
        error: "Der Ort passt nicht zur eingegebenen Adresse.",
      });
    }

    const normalizedAddress = geo.formatted || addressQuery;
    const addressStreet = geo.street || _strasse;
    const addressHouse = geo.houseNumber || _hausnummer;
    const addressPlz = geo.postcode || _plz;
    const addressCity = geo.city || _ort;
    const addressCountry = geo.country || _land || "Deutschland";

    const newId = crypto.randomUUID();
    const token = crypto.randomBytes(32).toString("hex");
    const hash  = await bcrypt.hash(password, 12);

    // Logo aus Multer + Cloudinary
    let logoUrl      = null;
    let logoPublicId = null;

    if (req.file) {
      try {
        const uploadRes = await cloudinary.uploader.upload(req.file.path, {
          folder: "autovisa/haendler-logos",
          overwrite: true,
          resource_type: "image",
        });
        logoUrl      = uploadRes.secure_url;
        logoPublicId = uploadRes.public_id;
      } catch (err) {
        console.error("❌ Fehler beim Logo-Upload:", err);
      } finally {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
    }

    const neuerHaendler = {
      id:        newId,
      role:      "haendler",
      verified:  false,
      token,
      createdAt: new Date(),

      // Firma / Kontakt
      firma:       _firma,
      strasse:     addressStreet,
      hausnummer:  addressHouse,
      plz:         addressPlz,
      ort:         addressCity,
      land:        addressCountry,
      adresse:     normalizedAddress,
      standort:    [addressPlz, addressCity].filter(Boolean).join(" "),
      telefon:     _telefon,
      telefon2:    _telefon2,
      email:       _email,
      whatsapp:    _whatsapp,

      // Profil / Extras
      ...( _website ? { website: _website } : {} ),
      ...( sprachenArr.length ? { sprachen: sprachenArr } : {} ),
      ...( _oeffnungszeiten
        ? {
            oeffnungszeiten:        _oeffnungszeiten,
            oeffnungszeitenDetails: openingDetails,
          }
        : { oeffnungszeitenDetails: openingDetails }
      ),

      // Tarif / Zahlung
      tarif:           _tarif,
      zahlungsmethode: _zahlungsmethode,
      kontoinhaber:    _kontoinhaber,
      iban:            _iban,
      bic:             _bic,

      // Rechtliches
      impressum:   _impressum,
      agb:         _agb,
      datenschutz: _datenschutz,

      // Auth
      password: hash,

      // Logo (optional)
      ...(logoUrl ? { logoUrl, logoPublicId, logoUpdatedAt: new Date() } : {}),
    };

    await nutzerColl.insertOne(neuerHaendler);

    // 🔗 Verifizierungs-Link bauen – Host-First
    const { appUrl: envAppUrl } = getAppUrls();
    const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https")
      .split(",")[0];
    const host = req.get("host");
    const baseUrl = (host ? `${proto}://${host}` : envAppUrl || "")
      .replace(/\/+$/, "");

    const verifyUrl   = `${baseUrl}/verify?token=${token}`;
    const subject     = "Bitte bestätigen Sie Ihre Händlerregistrierung";
    const { logoSrc, attachments } = getEmailLogoAsset();

    const html = buildAutovisaEmail({
      subject,
      logoSrc,
      greeting: `Hallo ${escapeHtml(_firma || "Autohaus")},`,
      title: "Bitte E-Mail-Adresse bestätigen",
      htmlText: `
        <p>vielen Dank für Ihre Registrierung bei Autovisa.</p>
        <p>Bitte bestätigen Sie Ihre E-Mail-Adresse über den folgenden Button:</p>
      `,
      buttonText: "E-Mail-Adresse bestätigen",
      buttonUrl: verifyUrl,
      footerNote:
        "Falls Sie sich nicht bei Autovisa registriert haben, können Sie diese E-Mail ignorieren.",
    });

    const text = `Hallo ${_firma || "Autohaus"},

vielen Dank für Ihre Registrierung bei Autovisa.
Bitte bestätigen Sie Ihre E-Mail-Adresse über den folgenden Link:

${verifyUrl}

Falls Sie sich nicht registriert haben, können Sie diese E-Mail ignorieren.`;

    await transporter.sendMail({
      from: MAIL_FROM,
      replyTo: MAIL_REPLY_TO,
      to: _email,
      subject,
      html,
      text,
      attachments,
    });

    return res.json({
      ok: true,
      message: "Registrierung erfolgreich. Bitte prüfen Sie Ihre E-Mails.",
    });

  } catch (err) {
    console.error("❌ Fehler bei /haendler-registrieren:", err);
    return res.status(500).json({
      error: "Serverfehler bei der Händlerregistrierung."
    });
  }
});


// ------------------------------------------------------------
// Händler-Logo nachträglich ändern
// ------------------------------------------------------------
app.post("/haendler/logo", checkLogin, uploadLogo.single("logo"), async (req, res) => {
  try {
    if (req.nutzer.role !== "haendler") {
      return res.status(403).json({ error: "Nur für Händler verfügbar." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Keine Datei hochgeladen." });
    }

    const folder = `autovisa/${req.nutzer.id}/logo`;
    const result = await uploadFileToCloudinary(req.file.path, {
      folder,
      resource_type: "image"
    });

    try { fs.unlinkSync(req.file.path); } catch {}

    const nutzerColl = db.collection("nutzer");
    const old = await nutzerColl.findOne(
      { id: req.nutzer.id },
      { projection: { logoPublicId: 1 } }
    );

    // optional: altes Logo löschen
    if (old?.logoPublicId && old.logoPublicId !== result.public_id) {
      try {
        await cloudinary.uploader.destroy(old.logoPublicId, {
          resource_type: "image"
        });
      } catch {}
    }

    await nutzerColl.updateOne(
      { id: req.nutzer.id },
      {
        $set: {
          logoUrl: result.secure_url,
          logoPublicId: result.public_id,
          logoUpdatedAt: new Date(),
        },
      }
    );

    // Logo in Inseraten/Entwürfen spiegeln
    await db.collection("inserate").updateMany(
      { verkaeuferId: req.nutzer.id },
      { $set: { "seller.logoUrl": result.secure_url } }
    );
    await db.collection("fahrzeugeEntwurf").updateMany(
      { nutzerId: req.nutzer.id },
      { $set: { "seller.logoUrl": result.secure_url } }
    );

    res.json({ success: true, logoUrl: result.secure_url });
  } catch (e) {
    console.error("❌ Fehler /haendler/logo:", e);
    res.status(500).json({ error: e.message || "Fehler beim Logo-Upload." });
  }
});


// ------------------------------------------------------------
// ✅ Verifikations-Route (Redirect auf Frontend)
// ------------------------------------------------------------
app.get("/verify", async (req, res) => {
  const { token } = req.query;

  const { appUrl: envAppUrl } = getAppUrls();
  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https")
    .split(",")[0];
  const host = req.get("host");
  const baseUrl = (host ? `${proto}://${host}` : envAppUrl || "")
    .replace(/\/+$/, "");

  res.set("Cache-Control", "no-store");

  if (!token || typeof token !== "string") {
    return res.redirect(`${baseUrl}/login.html?verified=0&reason=invalid`);
  }

  try {
    const nutzerColl = db.collection("nutzer");
    const user = await nutzerColl.findOne({ token });

    if (!user) {
      return res.redirect(`${baseUrl}/login.html?verified=0&reason=token`);
    }

    await nutzerColl.updateOne(
      { _id: user._id },
      {
        $set: { verified: true, verifiedAt: new Date() },
        $unset: { token: "" },
      }
    );

    return res.redirect(`${baseUrl}/login.html?verified=1`);
  } catch (err) {
    console.error("❌ Fehler bei /verify:", err);
    return res.redirect(`${baseUrl}/login.html?verified=0&reason=server`);
  }
});


// ------------------------------------------------------------
// ====== E-Mail-Benachrichtigung bei neuer Chat-Nachricht ======
// ------------------------------------------------------------
const NOTIFY_ENABLED = (process.env.NOTIFY_EMAILS ?? "1") !== "0";
const NOTIFY_MIN_INTERVAL_MIN = parseInt(process.env.NOTIFY_MIN_INTERVAL_MIN || "10", 10);

function getAppUrls() {
  try { return getUrls(); }
  catch {
    const api = process.env.API_URL || process.env.BASE_URL || `http://localhost:${PORT}`;
    const appUrl = process.env.PUBLIC_APP_URL || api;
    return { api, appUrl };
  }
}

function escapeHtml(input = "") {
  const s = String(input);
  return s.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

async function sendNewMessageEmail({ to, recipientName, senderName, messagePreview, chatUrl }) {
  if (!to) return;
  const { logoSrc, attachments } = getEmailLogoAsset();

  const subject = `Neue Nachricht von ${senderName} auf Autovisa`;
  const html = buildAutovisaEmail({
    subject,
    logoSrc,
    greeting: `Hallo ${escapeHtml(recipientName || "")},`,
    title: "Du hast eine neue Nachricht",
    htmlText: `
      <p><b>${escapeHtml(senderName)}</b> hat dir eine neue Nachricht geschickt:</p>
      <blockquote style="margin:12px 0; padding:10px 12px; background:#f6faf9; border-left:3px solid #00b8a9;">
        ${escapeHtml(String(messagePreview || "").slice(0, 400))}
      </blockquote>
      <p>Antworte direkt im Chat.</p>
    `,
    buttonText: "Zum Chat",
    buttonUrl: chatUrl,
    footerNote:
      "Diese Benachrichtigung wurde automatisch gesendet. Du kannst E-Mail-Benachrichtigungen jederzeit in deinen Einstellungen deaktivieren."
  });

  const text =
`Hallo ${recipientName || ""},

${senderName} hat dir auf Autovisa eine neue Nachricht geschickt:

"${String(messagePreview || "").slice(0, 400)}"

Zum Chat:
${chatUrl}
`;

  await transporter.sendMail({
    from: MAIL_FROM,
    replyTo: MAIL_REPLY_TO,
    to,
    subject,
    html,
    text,
    attachments
  });
}

// Throttling: max. 1 Mail pro Intervall je (empfaengerId, senderId, fahrzeugId)
async function shouldSendNowAndTouchThrottle({ empfaengerId, senderId, fahrzeugId }) {
  try {
    const coll = db.collection("notifyThrottle");
    const key = `${empfaengerId}:${senderId}:${fahrzeugId}`;
    const now = new Date();
    const minAgo = new Date(Date.now() - NOTIFY_MIN_INTERVAL_MIN * 60 * 1000);

    const r = await coll.findOneAndUpdate(
      { key },
      [
        {
          $set: {
            key,
            previous: { $ifNull: ["$last", new Date(0)] },
            last: now
          }
        }
      ],
      { upsert: true, returnDocument: "after" }
    );

    const previous = r?.value?.previous || new Date(0);
    return previous < minAgo;
  } catch (e) {
    console.warn("Notify throttle error:", e?.message || e);
    return true;
  }
}


// ------------------------------------------------------------
// === Nachricht senden ===
// SenderId nur aus Session (checkLogin)
// absenderName optional – wird serverseitig sauber gefüllt
// ------------------------------------------------------------
app.post("/nachricht-senden", checkLogin, async (req, res) => {
  const { empfaengerId, fahrzeugId, absenderName, nachricht } = req.body || {};
  const senderId = req.nutzer.id;

  if (!senderId || !empfaengerId || !fahrzeugId || !nachricht) {
    return res.status(400).json({ error: "Fehlende Felder." });
  }
  if (String(senderId) === String(empfaengerId)) {
    return res.status(400).json({ error: "Absender und Empfänger dürfen nicht identisch sein." });
  }

  try {
    const nachrichtenColl = db.collection("nachrichten");
    const nutzerColl = db.collection("nutzer");

    const senderUser = await nutzerColl.findOne(
      { id: String(senderId) },
      { projection: { name: 1, firma: 1 } }
    );

    const absenderNameFinal = String(
      absenderName || senderUser?.firma || senderUser?.name || "Interessent"
    ).trim().slice(0, 128);

    const neueNachricht = {
      id: Date.now().toString(),
      senderId: String(senderId),
      empfaengerId: String(empfaengerId),
      fahrzeugId: String(fahrzeugId),
      absenderName: absenderNameFinal,
      nachricht: String(nachricht).trim().slice(0, 5000),
      zeit: new Date().toISOString(),
      gelesen: false
    };

    await nachrichtenColl.insertOne(neueNachricht);

    // === E-Mail-Benachrichtigung an Empfänger (gedrosselt) ===
    try {
      if (NOTIFY_ENABLED) {
        const okToSend = await shouldSendNowAndTouchThrottle({
          empfaengerId: String(empfaengerId),
          senderId: String(senderId),
          fahrzeugId: String(fahrzeugId)
        });

        if (okToSend) {
          const empf = await nutzerColl.findOne(
            { id: String(empfaengerId) },
            { projection: { email: 1, name: 1, firma: 1 } }
          );

          const recipientEmail = empf?.email || "";
          const recipientName  = empf?.firma || empf?.name || "Nutzer";

          if (recipientEmail) {
            const { appUrl } = getAppUrls();
            const chatUrl =
              `${appUrl}/nachricht.html?user1=${encodeURIComponent(empfaengerId)}` +
              `&user2=${encodeURIComponent(senderId)}` +
              `&fahrzeugId=${encodeURIComponent(fahrzeugId)}`;

            await sendNewMessageEmail({
              to: recipientEmail,
              recipientName,
              senderName: absenderNameFinal,
              messagePreview: neueNachricht.nachricht,
              chatUrl
            });
          }
        }
      }
    } catch (mailErr) {
      console.error("⚠️ Konnte Benachrichtigung nicht senden:", mailErr);
    }

    return res.json({ success: true });

  } catch (err) {
    console.error("❌ Fehler beim Speichern der Nachricht:", err);
    return res.status(500).json({ error: "Fehler beim Speichern der Nachricht." });
  }
});


// ------------------------------------------------------------
// === Inserat-Details (inkl. "isSaved" für aktuellen Nutzer)
// -> savedInserate Schema korrigiert: userId + fahrzeugId
// ------------------------------------------------------------
app.get("/inserat-details/:id", async (req, res) => {
  try {
    const oid = new ObjectId(String(req.params.id));
    const coll = db.collection("inserate");

    const doc = await coll.findOne({ _id: oid });
    if (!doc) return res.status(404).json({ error: "Nicht gefunden" });

    // Optional: eingeloggten Nutzer aus Session lesen
    let currentUserId = null;
    try {
      const sess = decodeSession(req.cookies.session);
      currentUserId = sess?.id || null;
    } catch {}

    // Verkäufer-ID
    const sellerId = String(
      doc.seller?.id ||
      doc.verkaeuferId ||
      doc.nutzerId ||
      doc.sellerId ||
      doc.anbieterId ||
      ""
    ).trim();

    // Vollständiges Profil laden (Privat + Händler)
    let sellerProfile = null;
    if (sellerId) {
      sellerProfile = await db.collection("nutzer").findOne(
        { id: sellerId },
        {
          projection: {
            id: 1,
            role: 1,
            firma: 1,
            name: 1,
            logoUrl: 1,
            strasse: 1,
            hausnummer: 1,
            plz: 1,
            ort: 1,
            land: 1,
            telefon: 1,
            telefon2: 1,
            email: 1,
            website: 1,
            webseite: 1,
            sprachen: 1,
            languages: 1,
            createdAt: 1,
            erstelltAm: 1,
            oeffnungszeiten: 1,
            impressum: 1,
          },
        }
      );
    }

    // isSaved prüfen (Schema: userId + fahrzeugId)
    let isSaved = false;
    if (currentUserId) {
      try {
        const savedDoc = await db.collection("savedInserate").findOne({
          userId: String(currentUserId),
          fahrzeugId: String(oid)
        });
        isSaved = !!savedDoc;
      } catch (e) {
        console.warn("Fehler beim Prüfen von savedInserate:", e?.message || e);
      }
    }

    const sellerType =
      sellerProfile?.role ||
      doc.seller?.type ||
      (String(doc.verkauf_verkaeufer || "").toLowerCase() === "händler"
        ? "haendler"
        : "privat");

    const sellerName =
      sellerProfile?.firma ||
      sellerProfile?.name ||
      doc.seller?.name ||
      doc.verkauf_name ||
      "";

    const sellerLogo =
      sellerProfile?.logoUrl || doc.seller?.logoUrl || "";

    let sellerLangs = [];
    if (Array.isArray(sellerProfile?.sprachen)) {
      sellerLangs = sellerProfile.sprachen;
    } else if (Array.isArray(sellerProfile?.languages)) {
      sellerLangs = sellerProfile.languages;
    } else if (typeof sellerProfile?.languages === "string") {
      sellerLangs = sellerProfile.languages
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
    }

    const sellerCreatedAt =
      sellerProfile?.createdAt || sellerProfile?.erstelltAm || null;

    const docId = doc._id?.toString?.() || String(doc._id || "");
    const baseDoc = {
      ...doc,
      _id: docId,
      id: docId,
    };

    const sellerMerged = {
      ...(doc.seller || {}),
      id: sellerId || doc.seller?.id || "",
      type: sellerType,
      name: sellerName,
      logoUrl: sellerLogo,

      strasse: sellerProfile?.strasse || doc.seller?.strasse || "",
      hausnummer: sellerProfile?.hausnummer || doc.seller?.hausnummer || "",
      plz: sellerProfile?.plz || doc.seller?.plz || "",
      ort: sellerProfile?.ort || doc.seller?.ort || "",
      land: sellerProfile?.land || doc.seller?.land || "",

      telefon: sellerProfile?.telefon || sellerProfile?.telefon2 || doc.seller?.telefon || "",
      email: sellerProfile?.email || doc.seller?.email || "",

      website: sellerProfile?.website || sellerProfile?.webseite || doc.seller?.website || doc.seller?.webseite || "",
      sprachen: sellerLangs.length ? sellerLangs : (doc.seller?.sprachen || doc.seller?.languages || []),
      createdAt: sellerCreatedAt || doc.seller?.createdAt || doc.seller?.erstelltAm || null,
      oeffnungszeiten: sellerProfile?.oeffnungszeiten || doc.seller?.oeffnungszeiten || "",
      impressum: sellerProfile?.impressum || doc.seller?.impressum || "",
    };

    res.json({
      ...baseDoc,
      seller: sellerMerged,
      isSaved,
    });
  } catch (e) {
    console.error("❌ Fehler /inserat-details:", e);
    res.status(400).json({ error: "Ungültige ID" });
  }
});

// ------------------------------------------------------------
// === Public Seller Profile (für Anzeige/Impressum)
// ------------------------------------------------------------
app.get("/api/seller", async (req, res) => {
  try {
    const sellerId = String(req.query?.id || "").trim();
    if (!sellerId) return res.status(400).json({ error: "ID fehlt." });

    const seller = await db.collection("nutzer").findOne(
      { id: sellerId },
      {
        projection: {
          id: 1,
          role: 1,
          firma: 1,
          name: 1,
          logoUrl: 1,
          strasse: 1,
          hausnummer: 1,
          plz: 1,
          ort: 1,
          land: 1,
          telefon: 1,
          telefon2: 1,
          email: 1,
          website: 1,
          webseite: 1,
          sprachen: 1,
          languages: 1,
          createdAt: 1,
          erstelltAm: 1,
          oeffnungszeiten: 1,
          impressum: 1,
        }
      }
    );

    if (!seller) return res.status(404).json({ error: "Nicht gefunden" });

    const role = seller?.role || "privat";
    const isHaendler = isHaendlerRole(role);

    res.json({
      id: seller.id || sellerId,
      type: isHaendler ? "haendler" : "privat",
      role,
      firma: seller.firma || "",
      name: seller.name || "",
      logoUrl: seller.logoUrl || "",
      strasse: seller.strasse || "",
      hausnummer: seller.hausnummer || "",
      plz: seller.plz || "",
      ort: seller.ort || "",
      land: seller.land || "",
      telefon: seller.telefon || seller.telefon2 || "",
      email: seller.email || "",
      website: seller.website || seller.webseite || "",
      sprachen: seller.sprachen || seller.languages || [],
      createdAt: seller.createdAt || seller.erstelltAm || null,
      oeffnungszeiten: seller.oeffnungszeiten || "",
      impressum: seller.impressum || ""
    });
  } catch (err) {
    console.error("❌ Fehler bei /api/seller:", err);
    return res.status(500).json({ error: "Serverfehler" });
  }
});


// ------------------------------------------------------------
// === Legacy: Inserat speichern/entspeichern
// -> nutzt jetzt dasselbe Schema wie /saved/* aus Teil 1
// ------------------------------------------------------------
app.post("/inserat/save", checkLogin, async (req, res) => {
  const { fahrzeugId } = req.body || {};
  const fid = String(fahrzeugId || "").trim();
  if (!fid) return res.status(400).json({ error: "Fahrzeug-ID fehlt." });

  // Nur Validierungs-Check (optional)
  try { new ObjectId(fid); } catch {
    return res.status(400).json({ error: "Ungültige Fahrzeug-ID." });
  }

  try {
    const coll = db.collection("savedInserate");
    await coll.updateOne(
      { userId: req.nutzer.id, fahrzeugId: fid },
      {
        $setOnInsert: { createdAt: new Date() },
        $set: { userId: req.nutzer.id, fahrzeugId: fid }
      },
      { upsert: true }
    );

    return res.json({ success: true, saved: true });
  } catch (err) {
    console.error("❌ Fehler /inserat/save:", err);
    return res.status(500).json({ error: "Speichern fehlgeschlagen." });
  }
});

app.post("/inserat/unsave", checkLogin, async (req, res) => {
  const { fahrzeugId } = req.body || {};
  const fid = String(fahrzeugId || "").trim();
  if (!fid) return res.status(400).json({ error: "Fahrzeug-ID fehlt." });

  try { new ObjectId(fid); } catch {
    return res.status(400).json({ error: "Ungültige Fahrzeug-ID." });
  }

  try {
    const coll = db.collection("savedInserate");
    await coll.deleteOne({ userId: req.nutzer.id, fahrzeugId: fid });

    return res.json({ success: true, saved: false });
  } catch (err) {
    console.error("❌ Fehler /inserat/unsave:", err);
    return res.status(500).json({ error: "Löschen fehlgeschlagen." });
  }
});

// ------------------------------------------------------------
// === Inserat als verkauft markieren
// ------------------------------------------------------------
app.post("/inserat/:id/sold", checkLogin, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "ID fehlt." });

    let oid;
    try { oid = new ObjectId(id); }
    catch { return res.status(400).json({ error: "Ungültige ID." }); }

    const coll = db.collection("inserate");
    const doc = await coll.findOne({ _id: oid });
    if (!doc) return res.status(404).json({ error: "Inserat nicht gefunden." });

    const ownerId = doc.verkaeuferId || doc.nutzerId;
    if (String(ownerId) !== String(req.nutzer.id)) {
      return res.status(403).json({ error: "Kein Zugriff auf dieses Inserat." });
    }

    await coll.updateOne(
      { _id: oid },
      {
        $set: {
          status: "verkauft",
          verkauf_status: "verkauft",
          verkauft: true,
          verkauftAm: new Date()
        }
      }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ Fehler bei /inserat/:id/sold:", err);
    return res.status(500).json({ error: "Serverfehler" });
  }
});

// ------------------------------------------------------------
// === Inserat wieder online stellen
// ------------------------------------------------------------
app.post("/inserat/:id/relist", checkLogin, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "ID fehlt." });

    let oid;
    try { oid = new ObjectId(id); }
    catch { return res.status(400).json({ error: "Ungültige ID." }); }

    const coll = db.collection("inserate");
    const doc = await coll.findOne({ _id: oid });
    if (!doc) return res.status(404).json({ error: "Inserat nicht gefunden." });

    const ownerId = doc.verkaeuferId || doc.nutzerId;
    if (String(ownerId) !== String(req.nutzer.id)) {
      return res.status(403).json({ error: "Kein Zugriff auf dieses Inserat." });
    }

    await coll.updateOne(
      { _id: oid },
      {
        $set: {
          status: "online",
          verkauf_status: "online",
          verkauft: false,
          veroeffentlichtAm: new Date()
        },
        $unset: { verkauftAm: "" }
      }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ Fehler bei /inserat/:id/relist:", err);
    return res.status(500).json({ error: "Serverfehler" });
  }
});

function extractCloudinaryPublicId(url) {
  try {
    const u = new URL(String(url || ""));
    const m = u.pathname.match(/\/(image|video)\/upload\/(.+)$/);
    if (!m) return null;
    const resourceType = m[1];
    const parts = m[2].split("/").filter(Boolean);
    const vIdx = parts.findIndex(p => /^v\d+$/.test(p));
    const publicParts = vIdx >= 0 ? parts.slice(vIdx + 1) : parts;
    if (!publicParts.length) return null;
    let publicId = publicParts.join("/");
    publicId = publicId.replace(/\.[a-z0-9]+$/i, "");
    return { publicId, resourceType };
  } catch {
    return null;
  }
}

async function deleteCloudinaryAssetsFromDoc(doc) {
  const urls = [];
  if (Array.isArray(doc?.images)) urls.push(...doc.images);
  if (Array.isArray(doc?.bilder)) urls.push(...doc.bilder);
  if (Array.isArray(doc?.mediaImages)) urls.push(...doc.mediaImages);
  if (doc?.video) urls.push(doc.video);
  if (Array.isArray(doc?.videos)) urls.push(...doc.videos);
  if (Array.isArray(doc?.mediaVideos)) urls.push(...doc.mediaVideos);

  const unique = [...new Set(urls.filter(Boolean))];
  if (!unique.length) return;

  await Promise.all(unique.map(async (url) => {
    const info = extractCloudinaryPublicId(url);
    if (!info?.publicId) return;
    try {
      await cloudinary.uploader.destroy(info.publicId, {
        resource_type: info.resourceType || "image"
      });
    } catch (err) {
      console.warn("Cloudinary delete failed:", info.publicId, err?.message || err);
    }
  }));
}

// ------------------------------------------------------------
// === Inserat löschen (DB + Cloudinary)
// ------------------------------------------------------------
app.post("/inserat/:id/delete", checkLogin, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "ID fehlt." });

    let oid;
    try { oid = new ObjectId(id); }
    catch { return res.status(400).json({ error: "Ungültige ID." }); }

    // 1) Online-Inserate
    const inserateColl = db.collection("inserate");
    const onlineDoc = await inserateColl.findOne({ _id: oid });
    if (onlineDoc) {
      const ownerId = onlineDoc.verkaeuferId || onlineDoc.nutzerId;
      if (String(ownerId) !== String(req.nutzer.id)) {
        return res.status(403).json({ error: "Kein Zugriff auf dieses Inserat." });
      }

      await deleteCloudinaryAssetsFromDoc(onlineDoc);
      await inserateColl.deleteOne({ _id: oid });
      await db.collection("savedInserate").deleteMany({ fahrzeugId: String(id) });

      return res.json({ success: true, deletedFrom: "inserate" });
    }

    // 2) Drafts (Entwürfe)
    const draftsColl = db.collection("fahrzeugeEntwurf");
    const draftDoc = await draftsColl.findOne({ _id: oid, nutzerId: req.nutzer.id });
    if (draftDoc) {
      await deleteCloudinaryAssetsFromDoc(draftDoc);
      await draftsColl.deleteOne({ _id: oid, nutzerId: req.nutzer.id });
      return res.json({ success: true, deletedFrom: "entwurf" });
    }

    return res.status(404).json({ error: "Inserat nicht gefunden." });
  } catch (err) {
    console.error("❌ Fehler bei /inserat/:id/delete:", err);
    return res.status(500).json({ error: "Serverfehler" });
  }
});

// ------------------------------------------------------------
// === Inserat-Views zählen (jedes Öffnen zählt)
// ------------------------------------------------------------
app.post("/inserat/:id/view", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "ID fehlt." });

    let oid;
    try { oid = new ObjectId(id); }
    catch { return res.status(400).json({ error: "Ungültige ID." }); }

    const coll = db.collection("inserate");
    await coll.updateOne(
      { _id: oid },
      { $inc: { viewCount: 1 } }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ Fehler bei /inserat/:id/view:", err);
    return res.status(500).json({ error: "Serverfehler" });
  }
});

// ------------------------------------------------------------
// === Inserat-Stats (Views + Saved-Count) für mehrere IDs
// -> nur für eingeloggte Nutzer (Übersicht)
// ------------------------------------------------------------
app.get("/inserat/stats", checkLogin, async (req, res) => {
  try {
    const idsParam = String(req.query.ids || "").trim();
    const ids = idsParam
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    if (!ids.length) return res.json({});

    const objectIds = [];
    for (const id of ids) {
      try { objectIds.push(new ObjectId(id)); }
      catch {}
    }

    const inserateColl = db.collection("inserate");
    const savedColl = db.collection("savedInserate");

    const docs = objectIds.length
      ? await inserateColl
          .find({ _id: { $in: objectIds } })
          .project({ viewCount: 1 })
          .toArray()
      : [];

    const viewsMap = new Map(
      docs.map(d => [String(d._id), Number(d.viewCount || 0)])
    );

    const savedAgg = await savedColl.aggregate([
      { $match: { fahrzeugId: { $in: ids } } },
      { $group: { _id: "$fahrzeugId", count: { $sum: 1 } } }
    ]).toArray();

    const savedMap = new Map(
      savedAgg.map(d => [String(d._id), Number(d.count || 0)])
    );

    const out = {};
    for (const id of ids) {
      out[id] = {
        views: viewsMap.get(id) || 0,
        saves: savedMap.get(id) || 0
      };
    }

    return res.json(out);
  } catch (err) {
    console.error("❌ Fehler bei /inserat/stats:", err);
    return res.status(500).json({ error: "Serverfehler" });
  }
});


// ------------------------------------------------------------
// === Nachrichten für Empfänger abrufen
// ------------------------------------------------------------
app.get("/nachrichten/:empfaengerId", checkLogin, async (req, res) => {
  const { empfaengerId } = req.params;
  if (!empfaengerId) {
    return res.status(400).json({ error: "Keine ID übergeben." });
  }

  if (req.nutzer.id !== empfaengerId) {
    return res.status(403).json({ error: "Zugriff verweigert." });
  }

  try {
    const nachrichtenColl = db.collection("nachrichten");
    const empfangene = await nachrichtenColl
      .find({ empfaengerId: String(empfaengerId) })
      .sort({ zeit: 1 })
      .toArray();
    res.json(empfangene);
  } catch (err) {
    console.error("❌ Fehler beim Abrufen der Nachrichten:", err);
    res.status(500).json({ error: "Fehler beim Abrufen der Nachrichten." });
  }
});

// Nachricht als gelesen markieren
app.patch("/nachrichten/:id/gelesen", checkLogin, async (req, res) => {
  try {
    const coll = db.collection("nachrichten");
    const msg = await coll.findOne({ id: String(req.params.id) });
    if (!msg) return res.status(404).json({ error: "Nicht gefunden" });

    if (msg.empfaengerId !== req.nutzer.id) {
      return res.status(403).json({ error: "Nur der Empfänger darf das ändern." });
    }

    await coll.updateOne(
      { id: String(req.params.id) },
      { $set: { gelesen: true } }
    );

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Update fehlgeschlagen" });
  }
});

// Chatverlauf abrufen
app.get("/chat", checkLogin, async (req, res) => {
  const { user1, user2, fahrzeugId } = req.query;

  if (!user1 || !user2 || !fahrzeugId) {
    return res.status(400).json({ error: "Unvollständige Anfrage." });
  }

  const requester = req.nutzer.id;
  if (requester !== user1 && requester !== user2) {
    return res.status(403).json({ error: "Zugriff verweigert." });
  }

  try {
    const nachrichtenColl = db.collection("nachrichten");

    const verlauf = await nachrichtenColl.find({
      $or: [
        { senderId: String(user1), empfaengerId: String(user2) },
        { senderId: String(user2), empfaengerId: String(user1) }
      ],
      fahrzeugId: String(fahrzeugId)
    }).sort({ zeit: 1 }).toArray();

    res.json(verlauf);
  } catch (err) {
    console.error("❌ Fehler beim Abrufen des Chatverlaufs:", err);
    res.status(500).json({ error: "Fehler beim Abrufen des Chatverlaufs." });
  }
});

// Chat: alle Nachrichten für Thread als gelesen markieren
app.post("/chat/mark-read", checkLogin, async (req, res) => {
  try {
    const { user1, user2, fahrzeugId } = req.body || {};
    if (!user1 || !user2 || !fahrzeugId) {
      return res.status(400).json({ error: "Unvollständige Anfrage." });
    }

    const requester = String(req.nutzer.id);
    if (requester !== String(user1) && requester !== String(user2)) {
      return res.status(403).json({ error: "Zugriff verweigert." });
    }

    const otherId = requester === String(user1) ? String(user2) : String(user1);

    const coll = db.collection("nachrichten");
    const result = await coll.updateMany(
      {
        senderId: otherId,
        empfaengerId: requester,
        fahrzeugId: String(fahrzeugId),
        gelesen: { $ne: true }
      },
      { $set: { gelesen: true } }
    );

    return res.json({ success: true, updated: result?.modifiedCount || 0 });
  } catch (err) {
    console.error("❌ Fehler bei /chat/mark-read:", err);
    return res.status(500).json({ error: "Update fehlgeschlagen" });
  }
});

// Alle Nachrichten, an denen der eingeloggte Nutzer beteiligt ist
app.get("/meine-nachrichten", checkLogin, async (req, res) => {
  try {
    const uid = req.nutzer.id;
    const coll = db.collection("nachrichten");
    const list = await coll.find({
      $or: [{ senderId: uid }, { empfaengerId: uid }]
    }).toArray();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: "Fehler beim Laden" });
  }
});


async function geocodeToPoint(query) {
  const q = String(query || "").trim();
  if (!q) return null;

  const key = q.toLowerCase();
  const cacheColl = db.collection("geocache");
  const cached = await cacheColl.findOne({ key });
  if (cached?.coords?.type === "Point") return cached.coords;

  const headers = {
    "User-Agent": "autovisa/1.0 (contact: info@autovisa.de)",
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.6",
  };

  const fetchJson = async (url, timeoutMs = 4000) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { headers, signal: ctrl.signal });
      if (!r.ok) return null;
      return await r.json().catch(() => null);
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  };

  // 1) Nominatim (DE, limit 1)
  const nomUrl =
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=de&q=${encodeURIComponent(q)}`;

  let lat = null;
  let lon = null;
  let display = q;

  const arr = await fetchJson(nomUrl, 4000);
  if (Array.isArray(arr) && arr[0]) {
    lat = Number(arr[0].lat);
    lon = Number(arr[0].lon);
    display = arr[0].display_name || q;
  }

  // 2) Photon Fallback
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    const phoUrl =
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=de&limit=1`;
    const pj = await fetchJson(phoUrl, 4000);
    const feat = pj?.features?.[0];
    const coords = feat?.geometry?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      lon = Number(coords[0]);
      lat = Number(coords[1]);
      display = feat?.properties?.name || q;
    }
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const point = { type: "Point", coordinates: [lon, lat] };

  await cacheColl.updateOne(
    { key },
    { $set: { key, coords: point, display_name: display, updatedAt: new Date() } },
    { upsert: true }
  );

  return point;
}


function isHaendlerRole(role) {
  const r = String(role || "").toLowerCase();
  return r === "haendler" || r === "händler" || r.includes("haend") || r.includes("händ");
}


// ------------------------------------------------------------
// Veröffentlichung aus Draft (ohne Edit-Logik, kompatibel zu deinen Legacy-Endpunkten)
// ------------------------------------------------------------
async function publishFromDraft(req, res, { requireId = false } = {}) {
  try {
    const sellerId = req.nutzer?.id;
    if (!sellerId) return res.status(401).json({ error: "Nicht eingeloggt." });

    const entwurfColl  = db.collection("fahrzeugeEntwurf");
    const inserateColl = db.collection("inserate");
    const nutzerColl   = db.collection("nutzer");

    const requestedId = String(req.body?.draftId || req.body?.id || "").trim();
    let draft = null;

    if (requestedId) {
      let _id;
      try { _id = new ObjectId(requestedId); }
      catch { return res.status(400).json({ error: "Ungültige Draft-ID." }); }

      draft = await entwurfColl.findOne({ _id, nutzerId: sellerId });
      if (!draft) {
        return res.status(404).json({ error: "Entwurf nicht gefunden oder gehört nicht zu dir." });
      }
    } else {
      if (requireId) {
        return res.status(400).json({ error: "ID fehlt." });
      }

      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      draft = await entwurfColl.findOne(
        { nutzerId: sellerId, updatedAt: { $gte: thirtyMinAgo } },
        { sort: { updatedAt: -1, _id: -1 } }
      );

      if (!draft) {
        return res.status(400).json({ error: "Kein (frischer) Entwurf zum Veröffentlichen gefunden." });
      }
    }

    // Verkäufer-Snapshot
    const haendler = await nutzerColl.findOne(
      { id: sellerId },
      {
        projection: {
          id: 1, role: 1, firma: 1, name: 1, logoUrl: 1,
          strasse: 1, hausnummer: 1, plz: 1, ort: 1, land: 1,
        }
      }
    );

    const sellerTypeRaw = haendler?.role || "privat";
    const isHaendler = isHaendlerRole(sellerTypeRaw);

    const seller = {
      type:    isHaendler ? "haendler" : "privat",
      id:      haendler?.id || sellerId,
      name:    haendler?.firma || haendler?.name || (isHaendler ? "Händler" : "Privatverkäufer"),
      logoUrl: haendler?.logoUrl || "",
      strasse:    haendler?.strasse    || "",
      hausnummer: haendler?.hausnummer || "",
      plz:        haendler?.plz        || "",
      ort:        haendler?.ort        || "",
      land:       haendler?.land       || "",
      impressum: haendler?.impressum || "",
      oeffnungszeiten: haendler?.oeffnungszeiten || "",
      sprachen: Array.isArray(haendler?.sprachen) ? haendler.sprachen : []
    };

    const draftMongoId = draft._id;

    const {
      _id,
      updatedAt,
      erstelltAm,
      __status,
      seller: sellerFromDraft,
      ...payload
    } = draft;

    const neuesInserat = {
      ...payload,

      verkaeuferId: sellerId,
      sellerId: sellerId,
      status: "online",
      veroeffentlichtAm: new Date(),
      viewCount: 0,

      verkauf_kurzbeschreibung: getZufaelligeAusstattung(payload.verkauf_ausstattung || []),

      verkauf_verkaeufer: isHaendler ? "Händler" : "Privatverkäufer",
      verkauf_name: req.body?.name || payload.verkauf_name || seller.name,

      standort: (req.body?.plz && req.body?.ort)
        ? `${String(req.body.plz).trim()} ${String(req.body.ort).trim()}`
        : (payload.standort || "Nicht angegeben"),

      telefon: req.body?.telefon || payload.telefon || "",

      seller,
    };

    // Geocoding
    const locString = (() => {
      const s = (v) => (v == null ? "" : String(v).trim());

      if (isHaendler) {
        const street  = [s(haendler?.strasse), s(haendler?.hausnummer)].filter(Boolean).join(" ");
        const zipCity = [s(haendler?.plz), s(haendler?.ort)].filter(Boolean).join(" ");
        const country = s(haendler?.land || "Deutschland");
        const full    = [street, zipCity, country].filter(Boolean).join(", ");
        if (full) return full;
      }

      if (req.body?.plz || req.body?.ort) {
        const zipCity = [s(req.body.plz), s(req.body.ort)].filter(Boolean).join(" ");
        if (zipCity) return zipCity;
      }

      return s(neuesInserat.standort);
    })();

    if (locString) {
      try {
        const point = await geocodeToPoint(locString);
        if (point) neuesInserat.standortCoords = point;
      } catch (e) {
        console.warn("Geocoding fehlgeschlagen:", e?.message || e);
      }
    }

    // ✅ Insert + insertedId sauber zurückgeben
    const insertRes = await inserateColl.insertOne(neuesInserat);
    const insertedId = insertRes?.insertedId;

    await entwurfColl.deleteOne({ _id: draftMongoId, nutzerId: sellerId });

    return res.json({
      success: true,
      message: "Inserat erfolgreich veröffentlicht.",
      inseratId: insertedId ? String(insertedId) : "",
      draftId: String(draftMongoId)
    });

  } catch (err) {
    console.error("❌ Fehler beim Veröffentlichen:", err);
    return res.status(500).json({ error: "Fehler beim Veröffentlichen." });
  }
}

app.post("/veroeffentlichen", checkLogin, async (req, res) => {
  return publishFromDraft(req, res, { requireId: false });
});


app.put("/veroeffentlichen/:id", checkLogin, async (req, res) => {
  try {
    const sellerId = req.nutzer?.id;
    if (!sellerId) return res.status(401).json({ error: "Nicht eingeloggt." });

    const entwurfColl  = db.collection("fahrzeugeEntwurf");
    const inserateColl = db.collection("inserate");
    const nutzerColl   = db.collection("nutzer");

    const insertId = req.params.id;
    if (!insertId) return res.status(400).json({ error: "ID fehlt" });

    let draft = null;
    const draftRaw = await entwurfColl.findOne({ nutzerId: sellerId });
    if (!draftRaw) return res.status(404).json({ error: "Kein Entwurf gefunden" });

    draft = { ...draftRaw };

    const haendler = await nutzerColl.findOne({ id: sellerId });
    const isHaendler = isHaendlerRole(haendler?.role || "privat");

    const seller = {
      type:    isHaendler ? "haendler" : "privat",
      id:      haendler?.id || sellerId,
      name:    haendler?.firma || haendler?.name || (isHaendler ? "Händler" : "Privatverkäufer"),
      logoUrl: haendler?.logoUrl || "",
      strasse:    haendler?.strasse    || "",
      hausnummer: haendler?.hausnummer || "",
      plz:        haendler?.plz        || "",
      ort:        haendler?.ort        || "",
      land:       haendler?.land       || "",
    };

    const {
      _id,
      updatedAt,
      erstelltAm,
      __status,
      seller: sellerFromDraft,
      ...payload
    } = draft;

    const neuesInserat = {
      ...payload,

      verkaeuferId: sellerId,
      status: "online",
      veroeffentlichtAm: new Date(),

      verkauf_kurzbeschreibung: getZufaelligeAusstattung(payload.verkauf_ausstattung || []),

      verkauf_verkaeufer: isHaendler ? "Händler" : "Privatverkäufer",
      verkauf_name: req.body?.name || payload.verkauf_name || seller.name,

      standort: (req.body?.plz && req.body?.ort)
        ? `${String(req.body.plz).trim()} ${String(req.body.ort).trim()}`
        : (payload.standort || "Nicht angegeben"),

      telefon: req.body?.telefon || payload.telefon || "",

      seller,
      updatedAt: new Date()
    };

    // Geocoding (optional, wie in publishFromDraft)
    const locString = (() => {
      const s = (v) => (v == null ? "" : String(v).trim());
      const zipCity = [s(haendler?.plz), s(haendler?.ort)].filter(Boolean).join(" ");
      const country = s(haendler?.land || "Deutschland");
      const full = [s(haendler?.strasse), s(haendler?.hausnummer), zipCity, country].filter(Boolean).join(", ");
      return full;
    })();

    try {
      const point = await geocodeToPoint(locString);
      if (point) neuesInserat.standortCoords = point;
    } catch (e) {
      console.warn("Geocoding fehlgeschlagen:", e?.message || e);
    }

    const result = await inserateColl.updateOne(
      { _id: new ObjectId(insertId), verkaeuferId: sellerId },
      { $set: neuesInserat }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Inserat nicht gefunden oder kein Zugriff" });
    }

    // ✅ Entwurf löschen
    await entwurfColl.deleteOne({ _id: draft._id, nutzerId: sellerId });

    return res.json({
      success: true,
      message: "Inserat erfolgreich aktualisiert.",
      inseratId: insertId,
      draftId: String(draft._id)
    });
  } catch (err) {
    console.error("❌ Fehler beim Aktualisieren:", err);
    return res.status(500).json({ error: "Fehler beim Aktualisieren des Inserats." });
  }
});

app.post("/inserat-veroeffentlichen", checkLogin, async (req, res) => {
  return publishFromDraft(req, res, { requireId: true });
});


// ------------------------------------------------------------
// Öffentlich: Inserate mit Paging
// ------------------------------------------------------------
app.get("/inserate", async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const skip  = (page - 1) * limit;

    const coll = db.collection("inserate");
    const [items, total] = await Promise.all([
      coll.aggregate([
        { $match: { status: "online" } },
        { $sort: { veroeffentlichtAm: -1, _id: -1 } },
        { $skip: skip }, { $limit: limit },
        ...projectWithSeller()
      ]).toArray(),
      coll.countDocuments({ status: "online" })
    ]);

    res.json({ page, limit, total, items });
  } catch (err) {
    console.error("❌ Fehler bei GET /inserate:", err);
    res.status(500).json({ error: "Fehler beim Abrufen der Inserate." });
  }
});

// Legacy-Weiterleitung
app.get("/fahrzeuge-online", (req, res) => {
  const { page, limit } = req.query;
  const qs = new URLSearchParams();
  if (page)  qs.set("page", page);
  if (limit) qs.set("limit", limit);
  res.redirect(302, `/inserate${qs.toString() ? `?${qs}` : ""}`);
});


// ------------------------------------------------------------
// Logout
// ------------------------------------------------------------
app.post("/logout", (req, res) => {
  const { appUrl } = getUrls();
  const isSecureCookie = appUrl.startsWith("https") || process.env.NODE_ENV === "production";

  res.clearCookie("session", {
    httpOnly: true,
    sameSite: "Lax",
    secure: isSecureCookie,
    path: "/"
  });

  res.clearCookie("isLoggedIn", {
    httpOnly: false,
    sameSite: "Lax",
    secure: isSecureCookie,
    path: "/"
  });

  return res.json({ success: true });
});


// ------------------------------------------------------------
// kleine Helfer + Edit-Data Endpoint
// ------------------------------------------------------------
const pick = (obj, keys) =>
  keys.reduce((acc, k) => {
    if (obj && obj[k] !== undefined) acc[k] = obj[k];
    return acc;
  }, {});

app.get("/api/inserat/:id/edit-data", checkLogin, async (req, res) => {
  try {
    const inseratId = req.params.id;

    let doc = null;
    try {
      doc = await db.collection("inserate").findOne({ _id: new ObjectId(inseratId) });
    } catch {
      doc = await db.collection("inserate").findOne({ id: inseratId });
    }

    if (!doc) return res.status(404).json({ error: "Inserat nicht gefunden." });

    const ownerId = doc.verkaeuferId || doc.nutzerId;
    if (ownerId !== req.nutzer.id) {
      return res.status(403).json({ error: "Kein Zugriff auf dieses Inserat." });
    }

    const step1Keys = [
      "marke","modell","titel","preis",
      "brutto-preis","netto-preis",
      "verkauf_brutto","verkauf_netto","verkauf_preis","verkauf_mwst",
      "verkauf_ez_monat","verkauf_ez_jahr",
      "erstzulassung","verkauf_erstzulassung",
      "verkauf_kilometer","verkauf_leistung","verkauf_leistung_kw",
      "hubraum","verkauf_hubraum",
      "antriebsart","verkauf_antrieb",
      "verkauf_getriebe",
      "fahrzeugtyp","verkauf_fahrzeugtyp",
      "türen","tueren","verkauf_tueren",
      "verkauf_kraftstoff",
      "partikelfilter","verkauf_partikelfilter",
      "verbrauch_kombiniert","verbrauch_innerorts","verbrauch_ausserorts",
      "co2_emission",
      "schadstoffklasse","umweltplakette","emissionsklasse",
      "verkauf_verbrauch_kombiniert","verkauf_verbrauch_innerorts",
      "verkauf_verbrauch_ausserorts","verkauf_co2_emission",
      "verkauf_schadstoffklasse","verkauf_umweltplakette",
      "verkauf_emissionsklasse"
    ];

    const fahrzeugdaten = pick(doc, step1Keys);

    if (!fahrzeugdaten.erstzulassung && doc.verkauf_erstzulassung) {
      fahrzeugdaten.erstzulassung = doc.verkauf_erstzulassung;
    }
    if (!fahrzeugdaten.verkauf_erstzulassung && doc.erstzulassung) {
      fahrzeugdaten.verkauf_erstzulassung = doc.erstzulassung;
    }

    const { images, video, seller, standortCoords, ...rest } = doc;
    const fahrzeugdetails = rest;

    const medien = {
      images: Array.isArray(doc.images) ? doc.images : [],
      video: doc.video || ""
    };

    return res.json({
      ok: true,
      inseratId: String(doc._id || doc.id || inseratId),
      fahrzeugdaten,
      fahrzeugdetails,
      medien
    });
  } catch (err) {
    console.error("❌ edit-data Fehler:", err);
    res.status(500).json({ error: "Serverfehler." });
  }
});


// ------------------------------------------------------------
// Healthcheck & Server starten (ganz ans Ende)
// ------------------------------------------------------------
app.get("/healthz", (req, res) => res.status(200).send("ok"));

console.log("Render PORT env =", process.env.PORT);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server läuft auf Port ${PORT} (host 0.0.0.0)`);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ UnhandledRejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("❌ UncaughtException:", err);
});





// === Geocoding mit einfachem Mongo-Cache (Node >= 18: global fetch vorhanden)
async function geocodeToPoint(query) {
  const q = String(query || "").trim();
  if (!q) return null;

  const key = q.toLowerCase();
  const cacheColl = db.collection("geocache");
  const cached = await cacheColl.findOne({ key });
  if (cached?.coords?.type === "Point") return cached.coords;

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": "autovisa/1.0" } }).catch(() => null);
  if (!res || !res.ok) return null;

  const arr = await res.json().catch(() => []);
  const first = Array.isArray(arr) && arr[0];
  if (!first) return null;

  const lon = parseFloat(first.lon), lat = parseFloat(first.lat);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;

  const coords = { type: "Point", coordinates: [lon, lat] };
  await cacheColl.updateOne(
    { key },
    { $set: { key, coords, display_name: first.display_name || q, updatedAt: new Date() } },
    { upsert: true }
  );
  return coords;
}
/* ============================================================
   SCHNELLE Ortsvorschläge: /api/geosuggest?q=...&limit=...
   - Memory-Cache + Mongo-Cache (keine leeren Ergebnisse cachen)
   - Quelle 1: Nominatim (OSM)
   - Quelle 2 (Fallback): Photon/Komoot
   ============================================================ */
   const GEO_TTL_MS = 1000 * 60 * 60 * 24; // 24h
   const NOMINATIM_TIMEOUT_MS = 4000;
   const geoMem = new Map(); // key -> { v, t }
   
   const getGeoMem = (key) => {
     const e = geoMem.get(key);
     if (!e) return null;
     if (Date.now() - e.t > GEO_TTL_MS) { geoMem.delete(key); return null; }
     return e.v;
   };
   const setGeoMem = (key, v) => {
     geoMem.set(key, { v, t: Date.now() });
     if (geoMem.size > 500) geoMem.delete(geoMem.keys().next().value);
   };
   
   function dedupeByLabel(list) {
     const seen = new Set();
     return list.filter(s => {
       const k = s.label;
       if (seen.has(k)) return false;
       seen.add(k);
       return true;
     });
   }// ============================================================
// /api/geosuggest  —  schnelle Ortsvorschläge (DE, OSM → Photon Fallback)
// Voraussetzungen (oben im File vorhanden):
//  - const GEO_TTL_MS, const NOMINATIM_TIMEOUT_MS
//  - geoMem Map + getGeoMem/setGeoMem
//  - dedupeByLabel(list)
//  - globale "db" Verbindung
// ============================================================
app.get("/api/geosuggest", async (req, res) => {
  // ✅ wichtig: damit catch nicht crasht
  let suggestions = [];

  try {
    const qRaw = String(req.query.q || "").trim();
    if (!qRaw) return res.json({ suggestions: [], items: [] });

    const key = qRaw.toLowerCase();
    const reqLimit = parseInt(req.query.limit, 10);
    const lim = Math.min(
      Math.max(Number.isFinite(reqLimit) ? reqLimit : (key.length <= 3 ? 20 : 10), 1),
      25
    );

    // 1) Memory-Cache
    const mem = getGeoMem(key);
    if (mem && mem.length) {
      res.set("Cache-Control", "public, max-age=120");
      return res.json({ suggestions: mem.slice(0, lim), items: mem.slice(0, lim) });
    }

    // 2) Mongo-Cache (keine leeren Ergebnisse nutzen)
    const coll = db.collection("geosuggest");
    const cached = await coll.findOne({ key });
    if (
      cached &&
      Array.isArray(cached.suggestions) &&
      cached.suggestions.length &&
      (Date.now() - new Date(cached.updatedAt).getTime()) < GEO_TTL_MS
    ) {
      setGeoMem(key, cached.suggestions);
      res.set("Cache-Control", "public, max-age=120");
      return res.json({
        suggestions: cached.suggestions.slice(0, lim),
        items: cached.suggestions.slice(0, lim),
      });
    }

    // Einheitliches Suggest-Format
    const mapToSuggestion = (postcode, city, state, lat, lon, display) => {
      const label = [postcode, city].filter(Boolean).join(" ") || display || city || postcode || "";
      const latNum = Number(lat);
      const lonNum = Number(lon);
      if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return null;
      return {
        value: label,
        label,
        city: city || "",
        postcode: postcode || "",
        state: state || "",
        lat: latNum,
        lon: lonNum,
      };
    };

    // 3) Quelle 1: Nominatim
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), NOMINATIM_TIMEOUT_MS);

      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=de&limit=${lim}&q=${encodeURIComponent(qRaw)}`;
      const r = await fetch(url, {
        headers: {
          "User-Agent": "autovisa/1.0 (contact: info@autovisa.de)",
          "Accept-Language": "de-DE,de;q=0.9",
        },
        signal: ctrl.signal,
      }).catch(() => null);

      clearTimeout(timer);

      if (r && r.ok) {
        const arr = await r.json().catch(() => []);
        suggestions = (Array.isArray(arr) ? arr : [])
          .map((it) => {
            const a = it.address || {};
            const city =
              a.city ||
              a.town ||
              a.village ||
              a.hamlet ||
              a.suburb ||
              a.neighbourhood ||
              a.locality ||
              "";
            const postcode = a.postcode || "";
            const state = a.state || a.county || "";
            return mapToSuggestion(postcode, city, state, it.lat, it.lon, it.display_name);
          })
          .filter(Boolean)
          .filter((s) => s.label);
      } else {
        console.warn("Nominatim not ok / blocked");
      }
    } catch (e) {
      console.warn("Nominatim error:", e?.name === "AbortError" ? "Timeout" : e?.message || e);
    }

    // 4) Fallback: Photon/Komoot, wenn leer
    if (!suggestions.length) {
      try {
        const url2 = `https://photon.komoot.io/api/?q=${encodeURIComponent(qRaw)}&lang=de&limit=${lim}`;
        const r2 = await fetch(url2, {
          headers: { "User-Agent": "autovisa/1.0 (contact: info@autovisa.de)" },
        }).catch(() => null);

        if (r2 && r2.ok) {
          const data = await r2.json().catch(() => null);
          const feats = Array.isArray(data?.features) ? data.features : [];

          suggestions = feats
            .map((f) => {
              const p = f.properties || {};
              const city = p.city || p.name || p.locality || p.town || p.village || "";
              const postcode = p.postcode || "";
              const state = p.state || p.county || p.district || "";
              const [lon, lat] = Array.isArray(f.geometry?.coordinates)
                ? f.geometry.coordinates
                : [null, null];

              return mapToSuggestion(postcode, city, state, lat, lon, p.name);
            })
            .filter(Boolean)
            .filter((s) => s.label);
        } else {
          console.warn("Photon not ok");
        }
      } catch (e) {
        console.warn("Photon error:", e?.message || e);
      }
    }

    // 5) Dedupe + leichtes Scoring (Prefix bevorzugen)
    const q = key;
    suggestions = dedupeByLabel(suggestions)
      .map((s) => {
        const lc = s.label.toLowerCase();
        const score =
          (String(s.postcode || "").startsWith(q) ? 3 : 0) +
          (String(s.city || "").toLowerCase().startsWith(q) ? 3 : 0) +
          (lc.startsWith(q) ? 1 : 0);
        return { ...s, _score: score };
      })
      .sort((a, b) => b._score - a._score || a.label.length - b.label.length)
      .slice(0, lim)
      .map(({ _score, ...rest }) => rest);

    // 6) Nur nicht-leere Ergebnisse cachen
    if (suggestions.length) {
      setGeoMem(key, suggestions);
      await coll.updateOne(
        { key },
        { $set: { key, suggestions, updatedAt: new Date() } },
        { upsert: true }
      );
      res.set("Cache-Control", "public, max-age=120");
    }

    // ✅ Response: suggestions + items (Frontend-Kompatibilität)
    return res.json({ suggestions, items: suggestions });
  } catch (err) {
    console.error("❌ /api/geosuggest fatal:", err);
    // ✅ niemals auf undefinierte Variablen zugreifen
    return res.status(500).json({ suggestions: [], items: [] });
  }
});

// ============================================================
// /api/search — Suche mit optionalem Geo-Radius & vielen Filtern
// Voraussetzungen (oben im File vorhanden):
//  - escapeRegex(string)
//  - geocodeToPoint(query: string) -> { type:"Point", coordinates:[lon,lat] } | null
//  - globale "db" Verbindung (MongoDB) + 2dsphere-Index auf standortCoords
//     db.inserate.createIndex({ standortCoords: "2dsphere" })
// ============================================================
app.get("/api/search", async (req, res) => {
  try {
    const {
      marke,
      modell,
      ezFrom,
      ezTo,
      km_min,
      km_max,
      price_min,
      price_max,
      getriebe,
      kraftstoff,
      sort,
      land = "",
      ort,
      umkreis,
      ort_lat,
      ort_lon,
      page = "1",
      limit = "20",
      modellausfuehrung,
      fahrzeugtyp,
      tueren,
      ps_min,
      ps_max,
      kw_min,
      kw_max,
      ccm_min,
      ccm_max,
      verbrauch_max,
      verbrauch,        // Fallback für ältere/alternative Params
      antrieb,
      schadstoffklasse,
      umweltplakette,
      partikelfilter,
      scheckheft,       // aktuell nicht direkt benutzt, aber okay
      // NEU: alles, was unten verwendet wird, hier destrukturieren
      hu,
      hu_bis,
      hu_min_monate,
      halter_max,
      farbe,
      plakette,
      merkmale,
      unfallfrei,
      sitze_min,
      sitze,
      anbieter,
      mwst,
      ausstattung,
      // Anbieter-Filter (vom Inserat aus)
      sellerId,
      haendlerId,
      anbieterId
    } = req.query;

    const p    = Math.max(parseInt(page, 10)  || 1, 1);
    const lim  = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (p - 1) * lim;

    // Aktueller Monatsschlüssel (UTC): YYYY*12 + MM
    const NOW = new Date();
    const nowKey = NOW.getUTCFullYear() * 12 + (NOW.getUTCMonth() + 1);

    // ---- Basisfilter (immer)
    const baseMatch = { status: "online" };

    // Marke exakt (case-insensitive)
    if (marke) baseMatch.marke = new RegExp(`^${escRe(marke)}$`, "i");

    // Modell: mehrere erlaubt (CSV), jeweils exakt
    if (modell) {
      const arr = String(modell)
        .split(",").map(m => m.trim()).filter(Boolean)
        .map(m => new RegExp(`^${escRe(m)}$`, "i"));
      if (arr.length) baseMatch.modell = { $in: arr };
    }

    // ---- Unfallfrei-Filter (Basis: Feld "unfall")
    const wantsAccidentFree =
      typeof unfallfrei !== "undefined" &&
      ["1", "true", "ja", "yes", "on"]
        .includes(String(unfallfrei).trim().toLowerCase());

        if (wantsAccidentFree) {
          baseMatch.$or = [
            { unfall: { $regex: /^keine$/i } },
            { unfall: { $regex: /unfallfrei/i } },
            { unfall: { $regex: /^nein$/i } },
            { unfall: false },
            { unfall: 0 }
          ];
        }

    // ---- Anbieter/Händler-Filter (z. B. aus anzeige.html)
    const sellerIdRaw = sellerId || haendlerId || anbieterId;
    const sellerIdNorm = String(sellerIdRaw || "").trim();
    if (sellerIdNorm) {
      const sellerOr = [
        { verkaeuferId: sellerIdNorm },
        { "seller.id": sellerIdNorm },
        { sellerId: sellerIdNorm }
      ];

      if (baseMatch.$or) {
        baseMatch.$and = [
          { $or: baseMatch.$or },
          { $or: sellerOr }
        ];
        delete baseMatch.$or;
      } else if (Array.isArray(baseMatch.$and)) {
        baseMatch.$and.push({ $or: sellerOr });
      } else {
        baseMatch.$and = [{ $or: sellerOr }];
      }
    }
        

    // ---- Zahlen aus Query
    const priceMaxNum  = parseInt(price_max, 10);
    const priceMinNum  = parseInt(price_min, 10);
    const kmMaxNum     = parseInt(km_max, 10);
    const kmMinNum     = parseInt(km_min, 10);
    let psMinNum     = parseInt(ps_min, 10);
    let psMaxNum     = parseInt(ps_max, 10);
    const kwMinNum   = parseFloat(kw_min);
    const kwMaxNum   = parseFloat(kw_max);
    const KW_TO_PS   = 1.35962;
    if (Number.isFinite(kwMinNum)) {
      const fromKw = Math.ceil(kwMinNum * KW_TO_PS);
      psMinNum = Number.isFinite(psMinNum) ? Math.max(psMinNum, fromKw) : fromKw;
    }
    if (Number.isFinite(kwMaxNum)) {
      const fromKw = Math.floor(kwMaxNum * KW_TO_PS);
      psMaxNum = Number.isFinite(psMaxNum) ? Math.min(psMaxNum, fromKw) : fromKw;
    }
    const ccmMinNum    = parseInt(ccm_min, 10);
    const ccmMaxNum    = parseInt(ccm_max, 10);

    // Verbrauch: bevorzugt verbrauch_max, sonst (falls gesetzt) „verbrauch“
    const rawVerb = (verbrauch_max != null && verbrauch_max !== "")
      ? verbrauch_max
      : (verbrauch != null ? verbrauch : null);

    const verbMaxNum = (rawVerb != null && rawVerb !== "")
      ? parseFloat(String(rawVerb).replace(",", "."))
      : NaN;

    const halterMaxNum = parseInt(halter_max, 10);
    const seatsMinNum  = parseInt(sitze_min || sitze, 10);

    // ---- HU-Parameter (mind. Monate ODER gültig bis)
    const huMinMon = (() => {
      if (hu_min_monate != null && hu_min_monate !== "")
        return parseInt(hu_min_monate, 10);
      if (req.query.hu_min_months != null && req.query.hu_min_months !== "")
        return parseInt(req.query.hu_min_months, 10);
      if (hu) {
        const m = String(hu).toLowerCase().match(/(\d{1,2})/);
        if (m) return parseInt(m[1], 10);
      }
      return NaN;
    })();

    const huBisDate = hu_bis ? parseYMServer(hu_bis) : null;
    const huBisKey  =
      (huBisDate instanceof Date && !isNaN(huBisDate))
        ? (huBisDate.getUTCFullYear() * 12 + (huBisDate.getUTCMonth() + 1))
        : null;

    // ---- Sortierung
    const sortStages =
      (sort === "preis_asc")
        ? [
            { $addFields: { _preis_null: { $cond: [{ $eq: ["$preis_num", null] }, 1, 0] } } },
            { $sort: { _preis_null: 1, preis_num: 1, _id: -1 } }
          ]
        : (sort === "preis_desc")
        ? [
            { $addFields: { _preis_null: { $cond: [{ $eq: ["$preis_num", null] }, 1, 0] } } },
            { $sort: { _preis_null: 1, preis_num: -1, _id: -1 } }
          ]
        : (sort === "km_asc")
        ? [
            { $addFields: { _km_null: { $cond: [{ $eq: ["$km_num", null] }, 1, 0] } } },
            { $sort: { _km_null: 1, km_num: 1, _id: -1 } }
          ]
        : [{ $sort: { veroeffentlichtAm: -1, _id: -1 } }];

    /* ---------------- Parsing / Normalisierung ---------------- */
    const parseNumberStages = [
      { $addFields: {
          _preis_raw: {
            $ifNull: [
              "$brutto-preis",
              { $ifNull: [
                "$brutto_preis",
                { $ifNull: [ "$verkauf_brutto", { $ifNull: [ "$preis", { $ifNull: [ "$verkauf_preis", "$verkauf_netto" ] } ] } ] }
              ] }
            ]
          },
          _km_raw:     { $ifNull: ["$verkauf_kilometer", { $ifNull: ["$kilometer", "$km"] }] },
          _ps_raw:     { $ifNull: [ "$verkauf_leistung", { $ifNull: [ "$leistung", "$ps" ] } ] },
          _seats_raw:  { $ifNull: [ "$verkauf_sitze", { $ifNull: [ "$sitze", { $ifNull: [ "$seats", "$sitzplaetze" ] } ] } ] },
          _ccm_raw:    { $ifNull: [ "$verkauf_hubraum",  { $ifNull: [ "$hubraum",  "$ccm" ] } ] },
          _verb_raw:   { $ifNull: [ "$verkauf_verbrauch_kombiniert", { $ifNull: [ "$verbrauch_kombiniert", "$verbrauch" ] } ] },
          _halter_raw: { $ifNull: [ "$halter", { $ifNull: [ "$halteranzahl", "$fahrzeughalter" ] } ] }
        }
      },
      { $addFields: {
          _preis_clean: {
            $replaceAll: {
              input: { $replaceAll: {
                input: { $replaceAll: {
                  input: { $replaceAll: {
                    input: { $trim: { input: { $toString: "$_preis_raw" } } },
                    find: ".", replacement: ""
                  } },
                  find: "€", replacement: ""
                } },
                find: " ", replacement: ""
              } },
              find: ",", replacement: ""
            }
          },
          _km_clean: {
            $replaceAll: {
              input: { $replaceAll: {
                input: { $trim: { input: { $toString: "$_km_raw" } } },
                find: ".", replacement: ""
              } },
              find: " ", replacement: ""
            }
          }
        }
      },
      { $addFields: {
          _ps_match:   { $regexFind:  { input: { $toString: "$_ps_raw"  }, regex: /(\d{2,4})/ } },
          _seats_match:{ $regexFind:  { input: { $toString: "$_seats_raw" }, regex: /(\d{1,2})/ } },
          _ccm_match:  { $regexFind:  { input: { $toString: "$_ccm_raw" }, regex: /(\d{3,5})/ } },
          _verb_norm:  { $replaceAll: { input: { $toString: "$_verb_raw" }, find: ",", replacement: "." } },
          _verb_liters:{ $regexFindAll:{ input: "$_verb_norm", regex: /(\d+(?:\.\d+)?)(?=\s*(?:l|L)\s*\/\s*100\s*km)/i } },
          _verb_kwh:   { $regexFindAll:{ input: "$_verb_norm", regex: /(\d+(?:\.\d+)?)(?=\s*kwh\s*\/\s*100\s*km)/i } },
          _verb_all_any:{ $regexFindAll:{ input: "$_verb_norm", regex: /(\d+(?:\.\d+)?)/ } },
          _halter_match:{ $regexFind:   { input: { $toString: "$_halter_raw" }, regex: /(\d{1,2})/ } }
        }
      },
      { $addFields: {
          preis_num: { $convert: { input: "$_preis_clean", to: "int", onError: null, onNull: null } },
          km_num:    { $convert: { input: "$_km_clean",    to: "int", onError: null, onNull: null } },
          ps_num:    { $convert: { input: { $ifNull: ["$_ps_match.match",  null] }, to: "int", onError: null, onNull: null } },
          seats_num: { $convert: { input: { $ifNull: ["$_seats_match.match", null] }, to: "int", onError: null, onNull: null } },
          ccm_num:   { $convert: { input: { $ifNull: ["$_ccm_match.match", null] }, to: "int", onError: null, onNull: null } },
          verb_num: {
            $let: {
              vars: {
                liters: {
                  $map: {
                    input: { $ifNull: ["$_verb_liters", []] },
                    as: "m",
                    in: { $convert: { input: "$$m.match", to: "double", onError: null, onNull: null } }
                  }
                },
                kwhs: {
                  $map: {
                    input: { $ifNull: ["$_verb_kwh", []] },
                    as: "m",
                    in: { $convert: { input: "$$m.match", to: "double", onError: null, onNull: null } }
                  }
                },
                anyNums: {
                  $map: {
                    input: { $ifNull: ["$_verb_all_any", []] },
                    as: "m",
                    in: { $convert: { input: "$$m.match", to: "double", onError: null, onNull: null } }
                  }
                }
              },
              in: {
                $cond: [
                  { $gt: [ { $size: { $concatArrays: [ "$$liters", "$$kwhs" ] } }, 0 ] },
                  { $max: { $concatArrays: [ "$$liters", "$$kwhs" ] } },
                  {
                    $let: {
                      vars: { under60: { $filter: { input: "$$anyNums", as: "x", cond: { $lt: [ "$$x", 60 ] } } } },
                      in: { $cond: [ { $gt: [ { $size: "$$under60" }, 0 ] }, { $max: "$$under60" }, null ] }
                    }
                  }
                ]
              }
            }
          },
          halter_num: { $convert: { input: { $ifNull: ["$_halter_match.match", null] }, to: "int", onError: null, onNull: null } }
        }
      }
    ];

    // ---- HU: Rohwert -> (y,m) -> hu_key (y*12+m)
    const huParseStages = [
      { $addFields: {
          _hu_raw: {
            $ifNull: [
              "$hu",
              { $ifNull: [
                "$verkauf_hu",
                { $ifNull: [
                  "$hu_bis",
                  { $ifNull: [
                    "$verkauf_hu_bis",
                    { $ifNull: [
                      "$hu_gueltig_bis",
                      { $ifNull: [
                        "$hauptuntersuchung",
                        { $ifNull: [ "$tuev", { $ifNull: [ "$tüv", { $ifNull: [ "$tuv", null ] } ] } ] }
                      ] }
                    ] }
                  ] }
                ] }
              ] }
            ]
          },
          _hu_field_y: {
            $convert: {
              input: { $ifNull: [ "$tuevJahr", { $ifNull: [ "$tüvJahr", "$tuvJahr" ] } ] },
              to: "int", onError: null, onNull: null
            }
          },
          _hu_field_m_str: {
            $toLower: {
              $trim: { input: { $toString: { $ifNull: [ "$tuevMonat", { $ifNull: [ "$tüvMonat", "$tuvMonat" ] } ] } } }
            }
          }
        }
      },
      { $addFields: {
          _hu_str: { $toString: { $ifNull: ["$_hu_raw", ""] } },
          _hu_rx_y_m: { $regexFind: { input: "$_hu_str", regex: /(\d{4})[-/.](\d{1,2})/ } },
          _hu_rx_m_y: { $regexFind: { input: "$_hu_str", regex: /(\d{1,2})[-/.](\d{4})/ } },
          _hu_rx_y:   { $regexFind: { input: "$_hu_str", regex: /(\d{4})/ } },
          _hu_rx_name_y1: { $regexFind: {
            input: "$_hu_str",
            regex: /(jan(?:uar)?|feb(?:ruar)?|m(?:ä|ae|a)rz|apr(?:il)?|mai|may|jun(?:i)?|jul(?:i)?|aug(?:ust)?|sep(?:t|tember)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|dez(?:ember)?|dec(?:ember)?)\s+(\d{4})/i
          } },
          _hu_rx_name_y2: { $regexFind: {
            input: "$_hu_str",
            regex: /(\d{4})\s+(jan(?:uar)?|feb(?:ruar)?|m(?:ä|ae|a)rz|apr(?:il)?|mai|may|jun(?:i)?|jul(?:i)?|aug(?:ust)?|sep(?:t|tember)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|dez(?:ember)?|dec(?:ember)?)/i
          } }
        }
      },
      { $addFields: {
          _hu_name: {
            $toLower: {
              $ifNull: [
                { $arrayElemAt: ["$_hu_rx_name_y1.captures", 0] },
                { $arrayElemAt: ["$_hu_rx_name_y2.captures", 1] }
              ]
            }
          },
          _hu_name_y: {
            $toInt: {
              $ifNull: [
                { $arrayElemAt: ["$_hu_rx_name_y1.captures", 1] },
                { $arrayElemAt: ["$_hu_rx_name_y2.captures", 0] }
              ]
            }
          }
        }
      },
      { $addFields: {
          _hu_name_m: {
            $switch: {
              branches: [
                { case: { $regexMatch: { input: "$_hu_name", regex: /^jan/ } }, then: 1 },
                { case: { $regexMatch: { input: "$_hu_name", regex: /^feb/ } }, then: 2 },
                { case: { $regexMatch: { input: "$_hu_name", regex: /(m(ä|ae|a)rz)/ } }, then: 3 },
                { case: { $regexMatch: { input: "$_hu_name", regex: /^apr/ } }, then: 4 },
                { case: { $regexMatch: { input: "$_hu_name", regex: /(mai|may)/ } }, then: 5 },
                { case: { $regexMatch: { input: "$_hu_name", regex: /^jun/ } }, then: 6 },
                { case: { $regexMatch: { input: "$_hu_name", regex: /^jul/ } }, then: 7 },
                { case: { $regexMatch: { input: "$_hu_name", regex: /^aug/ } }, then: 8 },
                { case: { $regexMatch: { input: "$_hu_name", regex: /^sep/ } }, then: 9 },
                { case: { $regexMatch: { input: "$_hu_name", regex: /(okt|oct)/ } }, then: 10 },
                { case: { $regexMatch: { input: "$_hu_name", regex: /^nov/ } }, then: 11 },
                { case: { $regexMatch: { input: "$_hu_name", regex: /(dez|dec)/ } }, then: 12 }
              ],
              default: null
            }
          }
        }
      },
      { $addFields: {
          _hu_y: {
            $let: {
              vars: { a: "$_hu_rx_y_m", b: "$_hu_rx_m_y", c: "$_hu_rx_y" },
              in: {
                $cond: [
                  { $ne: ["$$a", null] },
                  { $toInt: { $arrayElemAt: ["$$a.captures", 0] } },
                  { $cond: [
                    { $ne: ["$$b", null] },
                    { $toInt: { $arrayElemAt: ["$$b.captures", 1] } },
                    { $cond: [
                      { $ne: ["$$c", null] },
                      { $toInt: { $arrayElemAt: ["$$c.captures", 0] } },
                      null
                    ] }
                  ] }
                ]
              }
            }
          },
          _hu_m: {
            $let: {
              vars: { a: "$_hu_rx_y_m", b: "$_hu_rx_m_y" },
              in: {
                $cond: [
                  { $ne: ["$$a", null] },
                  { $toInt: { $arrayElemAt: ["$$a.captures", 1] } },
                  { $cond: [
                    { $ne: ["$$b", null] },
                    { $toInt: { $arrayElemAt: ["$$b.captures", 0] } },
                    1
                  ] }
                ]
              }
            }
          }
        }
      },
      { $addFields: {
          _hu_field_m: {
            $switch: {
              branches: [
                { case: { $regexMatch: { input: "$_hu_field_m_str", regex: /^(1|01|jan)/ } }, then: 1 },
                { case: { $regexMatch: { input: "$_hu_field_m_str", regex: /^(2|02|feb)/ } }, then: 2 },
                { case: { $regexMatch: { input: "$_hu_field_m_str", regex: /(m(ä|ae|a)rz|^3|03)/ } }, then: 3 },
                { case: { $regexMatch: { input: "$_hu_field_m_str", regex: /^(4|04|apr)/ } }, then: 4 },
                { case: { $regexMatch: { input: "$_hu_field_m_str", regex: /(mai|may|^5|05)/ } }, then: 5 },
                { case: { $regexMatch: { input: "$_hu_field_m_str", regex: /^(6|06|jun)/ } }, then: 6 },
                { case: { $regexMatch: { input: "$_hu_field_m_str", regex: /^(7|07|jul)/ } }, then: 7 },
                { case: { $regexMatch: { input: "$_hu_field_m_str", regex: /^(8|08|aug)/ } }, then: 8 },
                { case: { $regexMatch: { input: "$_hu_field_m_str", regex: /^(9|09|sep)/ } }, then: 9 },
                { case: { $regexMatch: { input: "$_hu_field_m_str", regex: /(okt|oct|^10)/ } }, then: 10 },
                { case: { $regexMatch: { input: "$_hu_field_m_str", regex: /^(11|nov)/ } }, then: 11 },
                { case: { $regexMatch: { input: "$_hu_field_m_str", regex: /(dez|dec|^12)/ } }, then: 12 }
              ],
              default: null
            }
          }
        }
      },
      { $addFields: {
          _hu_final_y: { $ifNull: ["$_hu_field_y", { $ifNull: ["$_hu_name_y", "$_hu_y"] }] },
          _hu_final_m: { $ifNull: ["$_hu_field_m", { $ifNull: ["$_hu_name_m", "$_hu_m"] }] }
        }
      },
      { $addFields: {
          hu_key: {
            $cond: [
              { $and: [
                { $ne: ["$_hu_final_y", null] },
                { $ne: ["$_hu_final_m", null] },
                { $gte: ["$_hu_final_m", 1] },
                { $lte: ["$_hu_final_m", 12] }
              ] },
              { $add: [ { $multiply: ["$_hu_final_y", 12] }, "$_hu_final_m" ] },
              null
            ]
          }
        }
      }
    ];

    // ---- numerische Filter (Preis/KM) + Basisfilter
    const numberFilterStages = [
      { $match: baseMatch },
      ...(Number.isFinite(priceMinNum) ? [{ $match: { preis_num: { $ne: null, $gte: priceMinNum } } }] : []),
      ...(Number.isFinite(priceMaxNum) ? [{ $match: { preis_num: { $ne: null, $lte: priceMaxNum } } }] : []),
      ...(Number.isFinite(kmMinNum)    ? [{ $match: { km_num:    { $ne: null, $gte: kmMinNum } } }] : []),
      ...(Number.isFinite(kmMaxNum)    ? [{ $match: { km_num:    { $ne: null, $lte: kmMaxNum } } }] : [])
    ];

    // ---- EZ (YYYY-MM)
    let ezStages = [];
    if (ezFrom || ezTo) {
      ezStages = [
        { $addFields: { _ez: { $ifNull: ["$erstzulassung", { $ifNull: ["$verkauf_erstzulassung", null] }] } } },
        { $match: {
            ...(ezFrom ? { _ez: { $gte: ezFrom } } : {}),
            ...(ezTo   ? { _ez: { ...(ezFrom ? { $gte: ezFrom } : {}), $lte: ezTo } } : {})
          }
        }
      ];
    }

    // ---- Modellvariante (Freitext)
    const modVarRaw = String(modellausfuehrung || "").trim();
    let variantStages = [];
    if (modVarRaw) {
      const tokens = modVarRaw.split(/[,\s]+/).map(s => s.trim()).filter(Boolean).slice(0, 6);
      if (tokens.length) {
        const andClauses = tokens.map(w => {
          const rx = new RegExp(escRe(w), "i");
          return { $or: [
            { titel: rx }, { modell: rx }, { beschreibung: rx },
            { modellvariante: rx }, { verkauf_modellvariante: rx }
          ]};
        });
        variantStages = [{ $match: { $and: andClauses } }];
      }
    }

    // ---- Fahrzeugtyp
    function makeVehTypeRegexes(inputCsv = "") {
      const rawList = String(inputCsv).split(",").map(s => s.trim()).filter(Boolean);
      const rxes = [];
      for (const raw of rawList) {
        const v = raw.toLowerCase();
        if (v.includes("cabrio") || v.includes("roadster")) rxes.push(/cabrio(?:\s*\/\s*roadster)?/i, /roadster/i);
        else if (v.includes("kleinwagen")) rxes.push(/kleinwagen|kleinstwagen/i);
        else if (v.includes("limousine"))  rxes.push(/limousine/i);
        else if (v.includes("van") || v.includes("minibus")) rxes.push(/van|minibus|großraumlimousine|grossraumlimousine/i);
        else if (v.includes("suv"))        rxes.push(/\bsuv\b|geländewagen|gelaendewagen|offroader/i);
        else if (v.includes("kombi"))      rxes.push(/kombi|estate|station\s*wagon/i);
        else if (v.includes("coup"))       rxes.push(/coup[eé]/i);
        else if (v.includes("pickup"))     rxes.push(/pick[-\s]?up|pritsche|pickup/i);
        else rxes.push(new RegExp(escRe(raw), "i"));
      }
      return rxes;
    }

    let vehTypeStages = [];
    if (fahrzeugtyp) {
      const rxes = makeVehTypeRegexes(fahrzeugtyp);
      if (rxes.length) {
        vehTypeStages = [{
          $match: {
            $or: [
              { fahrzeugtyp:   { $in: rxes } },
              { fahrzeug_art:  { $in: rxes } },
              { fahrzeugart:   { $in: rxes } },
              { karosserie:    { $in: rxes } },
              { karosserieart: { $in: rxes } },
              { titel:         { $in: rxes } },
              { beschreibung:  { $in: rxes } }
            ]
          }
        }];
      }
    }

    // ---- Türen
    function buildTuerenStages(val) {
      const raw = String(val || "").trim();
      if (!raw) return [];
      let allowed = [];
      if (/^2\s*\/\s*3$/.test(raw)) allowed = [2, 3];
      else if (/^4\s*\/\s*5$/.test(raw)) allowed = [4, 5];
      else {
        const n = parseInt(raw, 10);
        if (Number.isFinite(n)) allowed = [n];
      }
      if (!allowed.length) return [];

      const allowedStr  = allowed.map(String);
      const slashCombo  = allowedStr.join("/");
      const fields = [
        "tueren","türen","anzahl_tueren","anzahl-tueren","tueranzahl",
        "tueren_anzahl","türen_anzahl","doors","verkauf_tueren","verkauf_türen"
      ];

      const or = [];
      for (const f of fields) or.push({ [f]: { $in: [...allowed, ...allowedStr, slashCombo] } });

      const numbersAlt = allowed.join("|");
      const descRx = new RegExp(`\\b(?:${numbersAlt})(?:\\s*[\\-/]\\s*(?:${numbersAlt}))?\\s*(t[üu]r|t[üu]rer|t[üu]ren)\\b`, "i");
      or.push({ titel: descRx }, { beschreibung: descRx });

      return [{ $match: { $or: or } }];
    }
    const tuerenStages = buildTuerenStages(tueren);

    // ---- PS / Hubraum / Verbrauch
    const powerFilterStages = [
      ...(Number.isFinite(psMinNum) ? [{ $match: { ps_num:  { $ne: null, $gte: psMinNum } } }] : []),
      ...(Number.isFinite(psMaxNum) ? [{ $match: { ps_num:  { $ne: null, $lte: psMaxNum } } }] : [])
    ];
    const ccmFilterStages = [
      ...(Number.isFinite(ccmMinNum) ? [{ $match: { ccm_num: { $ne: null, $gte: ccmMinNum } } }] : []),
      ...(Number.isFinite(ccmMaxNum) ? [{ $match: { ccm_num: { $ne: null, $lte: ccmMaxNum } } }] : [])
    ];
    const consumptionFilterStages =
      Number.isFinite(verbMaxNum)
        ? [{ $match: { verb_num: { $ne: null, $lte: verbMaxNum } } }]
        : [];

    // ---- Antrieb
    let driveStages = [];
    if (antrieb) {
      const wanted = String(antrieb).split(",").map(s => s.trim()).map(driveCanon).filter(Boolean);
      const rxes = [];
      if (wanted.includes("frontantrieb")) rxes.push(/front/i, /vorder/i, /vorderrad/i, /\bfwd\b/i);
      if (wanted.includes("heckantrieb"))  rxes.push(/heck/i, /hinter/i, /hinterrad/i, /\brwd\b/i, /rear/i);
      if (wanted.includes("allrad"))       rxes.push(/allrad/i, /\b4x4\b/i, /\b4wd\b/i, /\bawd\b/i,
                                                    /quattro/i, /xdrive/i, /4matic/i, /4motion/i, /all[-\s]?wheel/i);
      if (!rxes.length) for (const w of wanted) rxes.push(new RegExp(escRe(w), "i"));
      driveStages = [{
        $match: {
          $or: [
            { antrieb:         { $in: rxes } },
            { antriebsart:     { $in: rxes } },
            { antriebs_typ:    { $in: rxes } },
            { verkauf_antrieb: { $in: rxes } },
            { titel:           { $in: rxes } },
            { beschreibung:    { $in: rxes } }
          ]
        }
      }];
    }

    // ---- Getriebe
    let gearboxStages = [];
    if (getriebe) {
      const g = String(getriebe).toLowerCase();
      const rx = g.includes("auto") ? /auto/i :
                 g.includes("schalt") ? /schalt/i :
                 new RegExp(escRe(getriebe), "i");
      gearboxStages = [{
        $match: { $or: [ { getriebe: rx }, { verkauf_getriebe: rx }, { getriebeart: rx } ] }
      }];
    }

    // ---- Kraftstoff
    let fuelStages = [];
    if (kraftstoff) {
      const fuels = splitCsv(kraftstoff).map(fuelCanon).filter(Boolean);

      const FIELDS = ["verkauf_kraftstoff", "kraftstoff", "kraftstoffart", "beschreibung"];
      const OR_FIELDS  = (rx) => ({ $or: FIELDS.map(f => ({ [f]: rx })) });
      const NOR_FIELDS = (rx) => ({ $nor: FIELDS.map(f => ({ [f]: rx })) });

      const RX = {
        benzin:      /benzin|super|e10|e5|e95|e98|otto|petrol|gasoline/i,
        diesel:      /diesel/i,
        elektro:     /elektro|electric|bev|strom|ev/i,
        hybridAny:   /hybrid|mhev|hev|phev|plug[\s-]*in|plugin/i,
        phev:        /phev|plug[\s-]*in|plugin/i,
        autogas:     /autogas|\blpg\b/i,
        cng:         /erdgas|\bcng\b/i,
        ethanol:     /ethanol|e85|flex\s*fuel/i,
        wasserstoff: /wasserstoff|hydrogen|\bh2\b|fuel\s*cell/i
      };

      const conds = [];
      for (const t of fuels) {
        if (t === "plug-in-hybrid-benzin" || t === "phev-benzin") {
          conds.push({ $and: [ OR_FIELDS(RX.phev), OR_FIELDS(RX.benzin) ] });
          continue;
        }
        if (t === "plug-in-hybrid-diesel" || t === "phev-diesel") {
          conds.push({ $and: [ OR_FIELDS(RX.phev), OR_FIELDS(RX.diesel) ] });
          continue;
        }
        if (t === "plug-in-hybrid" || t === "phev") {
          conds.push(OR_FIELDS(RX.phev));
          continue;
        }
        if (t === "hybrid-benzin") {
          conds.push({ $and: [ OR_FIELDS(RX.hybridAny), OR_FIELDS(RX.benzin) ] });
          continue;
        }
        if (t === "hybrid-diesel") {
          conds.push({ $and: [ OR_FIELDS(RX.hybridAny), OR_FIELDS(RX.diesel) ] });
          continue;
        }
        if (t === "hybrid") {
          conds.push(OR_FIELDS(RX.hybridAny));
          continue;
        }

        if (t === "elektrisch" || t === "elektro" || t === "bev" || t === "ev") {
          conds.push({ $and: [ OR_FIELDS(RX.elektro), NOR_FIELDS(RX.hybridAny) ] });
          continue;
        }
        if (t === "benzin" || t === "otto") {
          conds.push({ $and: [ OR_FIELDS(RX.benzin), NOR_FIELDS(RX.hybridAny) ] });
          continue;
        }
        if (t === "diesel") {
          conds.push({ $and: [ OR_FIELDS(RX.diesel), NOR_FIELDS(RX.hybridAny) ] });
          continue;
        }

        if (t === "autogas" || t === "lpg") { conds.push(OR_FIELDS(RX.autogas)); continue; }
        if (t === "cng"     || t === "erdgas"){ conds.push(OR_FIELDS(RX.cng));    continue; }
        if (t === "ethanol" || t === "e85") { conds.push(OR_FIELDS(RX.ethanol));  continue; }
        if (t === "wasserstoff" || t === "h2") { conds.push(OR_FIELDS(RX.wasserstoff)); continue; }

        conds.push(OR_FIELDS(new RegExp(escRe(t), "i")));
      }

      fuelStages = conds.length ? [{ $match: { $or: conds } }] : [];
    }

    // ---- Schadstoffklasse
    let emissionStages = [];
    if (schadstoffklasse) {
      const rx = new RegExp(escRe(String(schadstoffklasse)), "i");
      emissionStages = [{ $match: { $or: [
        { schadstoffklasse: { $regex: rx } },
        { umwelt_schadstoffklasse: { $regex: rx } }
      ] } }];
    }

    // ---- Umweltplakette
    let plaketteStages = [];
    const plaketteParam = plakette || umweltplakette;
    if (plaketteParam) {
      const ptxt = String(plaketteParam).toLowerCase();
      let rx = null;
      if (ptxt.includes("grün") || ptxt.includes("gruen") || ptxt.includes("(4)")) rx = /(gr[üu]n|\b4\b)/i;
      else if (ptxt.includes("gelb") || ptxt.includes("(3)")) rx = /(gelb|\b3\b)/i;
      else if (ptxt.includes("rot")  || ptxt.includes("(2)")) rx = /(rot|\b2\b)/i;
      else if (ptxt.includes("keine")) rx = /(keine|ohne)/i;
      if (rx) {
        plaketteStages = [{
          $match: {
            $or: [
              { plakette:         { $regex: rx } },
              { umweltplakette:   { $regex: rx } },
              { feinstaubplakette:{ $regex: rx } }
            ]
          }
        }];
      }
    }

    // ---- Partikelfilter
    const particulateStages =
      String(partikelfilter) === "1" ? [{
        $match: {
          $or: [
            { partikelfilter:      { $in: [true, "true", "ja", "Ja", "JA"] } },
            { dpf:                 { $in: [true, "true", "ja", "Ja", "JA"] } },
            { russpartikelfilter:  { $in: [true, "true", "ja", "Ja", "JA"] } },
            { ausstattung:         { $elemMatch: { $regex: /(partikel|ru[ßs]|dpf)/i } } },
            { beschreibung:        { $regex: /(partikel|ru[ßs]|dpf)/i } }
          ]
        }
      }] : [];

    // ---- Halter max
    const halterStages =
      Number.isFinite(halterMaxNum) ? [{ $match: { halter_num: { $ne: null, $lte: halterMaxNum } } }] : [];

    // ---- Sitze (mindestens)
    const seatsStages =
      Number.isFinite(seatsMinNum) ? [{ $match: { seats_num: { $ne: null, $gte: seatsMinNum } } }] : [];

    // ---- Farben
    function colorRegexFor(token) {
      const t = token.toLowerCase();
      if (/schwarz|black/.test(t))   return /schwarz|black/i;
      if (/weiß|weiss|white/.test(t))return /wei[ßs]|white/i;
      if (/grau|gray|grey|anth/.test(t)) return /grau|gray|grey|anthrazit|anthracite/i;
      if (/silber|silver/.test(t))   return /silber|silver/i;
      if (/blau|blue/.test(t))       return /blau|blue/i;
      if (/rot|red/.test(t))         return /rot|red/i;
      if (/grün|gruen|green/.test(t))return /gr[üu]n|green/i;
      if (/braun|brown/.test(t))     return /braun|brown/i;
      if (/beige|sand/.test(t))      return /beige|sand/i;
      if (/gelb|yellow/.test(t))     return /gelb|yellow/i;
      if (/orange/.test(t))          return /orange/i;
      if (/violett|lila|purple/.test(t)) return /violett|lila|purple/i;
      if (/gold/.test(t))            return /gold/i;
      if (/türkis|tuerkis|turquoise/.test(t)) return /t[üu]rkis|turquoise/i;
      return new RegExp(escRe(token), "i");
    }

    let colorStages = [];
    if (farbe) {
      const rxes = String(farbe).split(",").map(s => s.trim()).filter(Boolean).map(colorRegexFor);
      if (rxes.length) {
        colorStages = [{
          $match: {
            $or: [
              { farbe:              { $in: rxes } },
              { außenfarbe:         { $in: rxes } },
              { aussenfarbe:        { $in: rxes } },
              { karosseriefarbe:    { $in: rxes } },
              { farbe_text:         { $in: rxes } },
              { lackierung:         { $in: rxes } },
              { lack:               { $in: rxes } },
              { exterior_color:     { $in: rxes } },
              { exterieur_farbe:    { $in: rxes } },
              { beschreibung:       { $in: rxes } },
              { titel:              { $in: rxes } }
            ]
          }
        }];
      }
    }

    // ---- Merkmale (inkl. Fahrtauglich)
    let featureStages = [];
    let driveabilityStages = [];
    if (merkmale) {
      const rawList = String(merkmale).split(",").map(s => s.trim()).filter(Boolean);
      const wantDriveable = rawList.some(m => /fahrtaug|fahrbereit/i.test(m));
      const NEG_RX = /(nicht\s*fahr|fahrun*taug|bastler|defekt|nicht\s*fahrbereit)/i;

      const other = rawList.filter(m => !/fahrtaug|fahrbereit/i.test(m));
      if (other.length) {
        const rxes = other.map(w => new RegExp(escRe(w), "i"));
        featureStages.push({
          $match: {
            $or: [
              { beschreibung: { $in: rxes } },
              { titel:        { $in: rxes } },
              { ausstattung:  { $elemMatch: { $in: rxes } } }
            ]
          }
        });
      }
      if (wantDriveable) {
        driveabilityStages.push({
          $match: { $nor: [ { beschreibung: NEG_RX }, { titel: NEG_RX }, { zustand: NEG_RX } ] }
        });
      }
    }

    // ---- Anbieter (Händler/Privat)
    let sellerTypeStages = [];
    const anbieterRaw = String(anbieter || "").trim().toLowerCase();
    if (anbieterRaw) {
      const isHaendler = /(haend|händ|dealer)/i.test(anbieterRaw);
      const rx = isHaendler ? /haendler|händler|dealer/i : /privat/i;
      sellerTypeStages = [{
        $match: {
          $or: [
            { "seller.type":       { $regex: rx } },
            { verkauf_verkaeufer:  { $regex: rx } },
            { verkaeufer:          { $regex: rx } },
            { sellerType:          { $regex: rx } }
          ]
        }
      }];
    }

    // ---- MwSt. ausweisbar
    let mwstStages = [];
    const wantsMwst =
      typeof mwst !== "undefined" &&
      ["1", "true", "ja", "yes", "on"].includes(String(mwst).trim().toLowerCase());
    if (wantsMwst) {
      const yesRx = /(inkl|zzgl|mwst|ust|vat)/i;
      const noRx  = /(keine|nicht|ohne)/i;
      mwstStages = [{
        $match: {
          $and: [
            { $or: [
              { verkauf_mwst: { $regex: yesRx } },
              { mwst:         { $in: [true, "true", "ja", 1, "1"] } },
              { vat:          { $in: [true, "true", "ja", 1, "1"] } },
              { mwst_type:    { $regex: yesRx } },
              { vat_rate:     { $exists: true, $ne: null, $ne: "" } }
            ] },
            { $nor: [
              { verkauf_mwst: { $regex: noRx } },
              { mwst:         { $in: [false, "false", "nein", 0, "0"] } },
              { vat:          { $in: [false, "false", "nein", 0, "0"] } }
            ] }
          ]
        }
      }];
    }

    // ---- Ausstattung (Mehrfach)
    let equipmentStages = [];
    if (ausstattung) {
      const equipRegexFor = (token) => {
        const raw = String(token || "").trim().toLowerCase();
        if (!raw) return null;
        const tNorm = raw
          .replace(/ä/g, "ae")
          .replace(/ö/g, "oe")
          .replace(/ü/g, "ue")
          .replace(/ß/g, "ss");
        const t = tNorm || raw;
        const map = {
          navigation:     /navi|navigation/i,
          sitzheizung:    /sitzheizung/i,
          rueckfahrkamera:/r[üu]ckfahrkamera|rueckfahrkamera|r[üu]ckfahr|rueckfahr|kamera\s*(hinten|rear)|rear\s*view|rear\s*camera|backup\s*camera|back[-\s]?up\s*cam|parking\s*camera|revers(e|ing)\s*camera/i,
          tempomat:       /tempomat|abstandsregel|acc/i,
          bluetooth:      /bluetooth|freispre/i,
          klima:          /klima|klimaanlage|klimatisierung|\ba\/c\b|air\s*condition/i,
          parkhilfe:      /parkhilfe|einpark|pdc|parkpilot/i,
          scheinwerfer:   /scheinwerfer|xenon|bi[-\s]?xenon|matrix|led|laser/i,
          led:            /scheinwerfer|xenon|bi[-\s]?xenon|matrix|led|laser/i,
          xenon:          /scheinwerfer|xenon|bi[-\s]?xenon|matrix|led|laser/i,
          panorama:       /panorama|schiebedach|glass\s*roof/i,
          applecarplay:   /carplay/i,
          androidauto:    /android\s*auto/i,
          isofix:         /isofix/i
        };
        if (map[t]) return map[t];
        if (map[raw]) return map[raw];
        let pattern = escRe(t);
        pattern = pattern
          .replace(/ae/g, "(ä|ae)")
          .replace(/oe/g, "(ö|oe)")
          .replace(/ue/g, "(ü|ue)")
          .replace(/ss/g, "(ss|ß)");
        return new RegExp(pattern, "i");
      };

      const tokens = splitCsv(ausstattung);
      const conds = tokens
        .map((tok) => equipRegexFor(tok))
        .filter(Boolean)
        .map((rx) => ({
          $or: [
            { ausstattung:        { $elemMatch: { $regex: rx } } },
            { ausstattung:        { $regex: rx } },
            { verkauf_ausstattung:{ $elemMatch: { $regex: rx } } },
            { verkauf_ausstattung:{ $regex: rx } },
            { equipment_keys:     { $elemMatch: { $regex: rx } } },
            { equipment_text:     { $elemMatch: { $regex: rx } } },
            { scheinwerfer:       { $regex: rx } },
            { verkauf_scheinwerfer:{ $regex: rx } },
            { headlights:         { $regex: rx } },
            { verkauf_headlights: { $regex: rx } },
            { rueckfahrkamera:    { $regex: rx } },
            { verkauf_rueckfahrkamera:{ $regex: rx } },
            { beschreibung:       { $regex: rx } },
            { titel:              { $regex: rx } }
          ]
        }));

      if (conds.length) equipmentStages = [{ $match: { $and: conds } }];
    }

    // ---- HU-Filter (nach Parsing); nutzt nowKey
    const huFilterStages =
      (Number.isFinite(huMinMon) && huMinMon > 0)
        ? [
            { $match: { hu_key: { $ne: null } } },
            { $match: { $expr: { $gte: [ { $subtract: [ "$hu_key", nowKey ] }, huMinMon ] } } }
          ]
        : (Number.isFinite(huBisKey))
        ? [
            { $match: { hu_key: { $ne: null } } },
            { $match: { $expr: { $gte: [ "$hu_key", huBisKey ] } } }
          ]
        : [];

    // ---- Projektion & Facet (Paging)
    const endStages = [
      ...sortStages,
      {
        $facet: {
          data: [
            { $project: {
                token: 0, password: 0, iban: 0, bic: 0, kontoinhaber: 0,
                _preis_raw: 0, _km_raw: 0, _preis_clean: 0, _km_clean: 0,
                _ps_raw: 0, _seats_raw: 0, _ccm_raw: 0, _verb_raw: 0, _halter_raw: 0,
                _ps_match: 0, _seats_match: 0, _ccm_match: 0, _verb_norm: 0, _verb_all_any: 0,
                _halter_match: 0, _preis_null: 0, _ez: 0,
                _hu_raw: 0, _hu_str: 0, _hu_rx_y_m: 0, _hu_rx_m_y: 0, _hu_rx_y: 0,
                _hu_name: 0, _hu_name_y: 0, _hu_name_m: 0,
                _hu_y: 0, _hu_m: 0, _hu_final_y: 0, _hu_final_m: 0
              }
            },
            { $skip: skip },
            { $limit: lim },
            ...projectWithSeller()
          ],
          total: [{ $count: "count" }]
        }
      },
      { $project: { data: 1, total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] } } }
    ];

    // ---- Optionaler Geo-Teil
    const umkreisKm = Math.max(parseInt(umkreis, 10) || 0, 0);
    let pipeline;

    let point = null;
    const lat = parseFloat(ort_lat);
    const lon = parseFloat(ort_lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      point = { type: "Point", coordinates: [lon, lat] };
    } else {
      const ortStr  = String(ort || "").trim();
      const landStr = String(land || "").trim();
      const geoQuery = (ortStr && landStr) ? `${ortStr}, ${landStr}` : ortStr;
      if (geoQuery) point = await geocodeToPoint(geoQuery);
    }

    const commonStages = [
      ...parseNumberStages,
      ...huParseStages,
      ...numberFilterStages,
      ...powerFilterStages,
      ...ccmFilterStages,
      ...consumptionFilterStages,
      ...ezStages,
      ...gearboxStages,
      ...fuelStages,
      ...driveStages,
      ...emissionStages,
      ...plaketteStages,
      ...particulateStages,
      ...halterStages,
      ...seatsStages,
      ...colorStages,
      ...featureStages,
      ...driveabilityStages,
      ...equipmentStages,
      ...sellerTypeStages,
      ...mwstStages,
      ...variantStages,
      ...vehTypeStages,
      ...tuerenStages,
      ...huFilterStages,
      ...endStages
    ];

    if (point) {
      pipeline = [
        { $geoNear: {
            near: point,
            key: "standortCoords",
            distanceField: "dist",
            spherical: true,
            ...(umkreisKm > 0 ? { maxDistance: umkreisKm * 1000 } : {})
          }
        },
        ...commonStages
      ];
    } else {
      pipeline = [...commonStages];
    }

    const [{ data = [], total = 0 } = {}] =
      await db.collection("inserate").aggregate(pipeline).toArray();

    res.json({ page: p, limit: lim, total, results: data });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Interner Fehler bei der Suche." });
  }
});






// Händler bewerten
app.post("/api/bewertung", checkLogin, async (req, res) => {
  const { sellerId, rating, text } = req.body;
  const userId = req.nutzer?.id;

  if (!sellerId || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Ungültige Bewertung." });
  }

  const ratingsColl = db.collection("bewertungen");

  const existing = await ratingsColl.findOne({ sellerId, userId });
  if (existing) {
    await ratingsColl.updateOne(
      { sellerId, userId },
      { $set: { rating, text, updatedAt: new Date() } }
    );
  } else {
    await ratingsColl.insertOne({
      sellerId,
      userId,
      rating,
      text,
      createdAt: new Date()
    });
  }

  return res.json({ success: true });
});

// Durchschnitt + Anzahl laden
app.get("/api/bewertung/:sellerId", async (req, res) => {
  const sellerId = req.params.sellerId;
  if (!sellerId) return res.status(400).json({ error: "ID fehlt." });

  const ratingsColl = db.collection("bewertungen");

  const result = await ratingsColl
    .aggregate([
      { $match: { sellerId } },
      {
        $group: {
          _id: "$sellerId",
          avg: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  if (!result.length) {
    return res.json({ avg: null, count: 0 });
  }

  return res.json({
    avg: Math.round(result[0].avg * 10) / 10,
    count: result[0].count,
  });
});

// ⭐ Einzelne Bewertungen abrufen (inkl. Texte)
app.get("/api/bewertungen/:sellerId", async (req, res) => {
  const sellerId = req.params.sellerId;
  if (!sellerId) return res.status(400).json({ error: "ID fehlt." });

  const ratings = await db.collection("bewertungen")
    .find({ sellerId, text: { $exists: true, $ne: "" } }) // Nur Bewertungen mit Text
    .sort({ createdAt: -1 })  // Neueste zuerst
    .limit(20)                // Optional: Maximal 20 Einträge
    .project({ rating: 1, text: 1, createdAt: 1 }) // Du kannst hier z. B. auch userId mit reinnehmen
    .toArray();

  res.json(ratings);
});
