try { require("dotenv").config(); } catch {}

const express = require("express");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const cloudinary = require("cloudinary").v2;
const crypto = require("crypto");

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  console.error("❌ SESSION_SECRET fehlt in ENV");
  process.exit(1);
}
function b64url(buf){ return Buffer.from(buf).toString("base64url"); }
function makeSessionPayload(user){
  return { id: user.id, role: user.role || "privat", email: user.email || "" };
}
function sign(val){
  return crypto.createHmac("sha256", SESSION_SECRET).update(val).digest("base64url");
}
function encodeSession(obj){
  const body = b64url(JSON.stringify(obj));
  const sig  = sign(body);
  return `${body}.${sig}`;
}
function decodeSession(token){
  if (!token || typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  try {
    const expected = sign(body); // base64url-String
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
  const s = norm(raw);
  if (!s) return "";
  if (/\b(hybrid|phev|plug[\s-]?in|plugin|mhev|hev)\b/.test(s)) return "hybrid";
  if (/\b(diesel)\b/.test(s)) return "diesel";
  if (/\b(benzin|super|e10|e5|e95|e98|otto|petrol|gasoline)\b/.test(s)) return "benzin";
  if (/\b(elektr|bev|strom|ev)\b/.test(s)) return "elektrisch";
  return s;
}

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
  const yNow = now.getUTCFullYear(),  mNow = now.getUTCMonth() + 1; // 1..12
  const yItm = d.getUTCFullYear(),    mItm = d.getUTCMonth() + 1;   // 1..12
  return (yItm * 12 + mItm) - (yNow * 12 + mNow);
}

/* === Express Initialisierung === */
const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.set("trust proxy", 1);
// Helper: saubere URLs aus ENV
function getUrls() {
  const api = process.env.API_URL || process.env.BASE_URL || `http://localhost:${PORT}`;
  const appUrl = process.env.PUBLIC_APP_URL || api;
  return { api, appUrl };
}

/* === MongoDB Konfiguration === */
const mongoUri = process.env.MONGODB_URI;
const client = new MongoClient(mongoUri);
let db;
client.connect()
  .then(async () => {
    db = client.db("autovisa");
    console.log("✅ MongoDB verbunden");

    await db.collection("inserate").createIndex({ standortCoords: "2dsphere" });
    await db.collection("geocache").createIndex({ key: 1 }, { unique: true });

    await db.collection("geosuggest").createIndex({ key: 1 }, { unique: true });
    await db.collection("geosuggest").createIndex(
      { updatedAt: 1 },
      { expireAfterSeconds: 60 * 60 * 24 * 30 }
    );
    await db.collection("nutzer").createIndex({ email: 1 }, { unique: true });

    // ✅ TTL für Fahrzeugs-Entwürfe: 30 Minuten ab letzter Änderung
    await db.collection("fahrzeugeEntwurf").createIndex(
      { updatedAt: 1 },
      { expireAfterSeconds: 60 * 30 } // 30 Minuten
    );
    // Alte Entwürfe ohne updatedAt einmalig „heilen“
    await db.collection("fahrzeugeEntwurf").updateMany(
      { updatedAt: { $exists: false } },
      { $set: { updatedAt: new Date() } }
    );

    console.log("✅ Indexe inkl. TTL für fahrzeugeEntwurf bereit");
  })
  .catch(err => console.error("❌ MongoDB-Verbindung fehlgeschlagen:", err));

/* === Cloudinary Konfiguration === */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Body-Limits nur für Text (Dateien sind davon unberührt)
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());

/* === Statische Dateien ausliefern === */
app.use(express.static(path.join(__dirname, "public")));
app.use("/data", express.static(path.join(__dirname, "data"), {
  dotfiles: "ignore",
  etag: true,
  maxAge: "1d"
}));


/* === Startseite === */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* === Multer (A): Medien (Bilder/Video) auf Disk === */
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
function uploadFileToCloudinary(filePath, { folder, resource_type }) {
  return new Promise((resolve, reject) => {
    const isVideo = resource_type === "video";
    const fn = isVideo ? cloudinary.uploader.upload_large : cloudinary.uploader.upload;
    const options = { folder, resource_type };
    if (isVideo) options.chunk_size = 20 * 1024 * 1024;
    fn(filePath, options, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

/* ===================== Fahrzeugspeichern / Medien ===================== */
app.post("/saveFahrzeugdaten", checkLogin, async (req, res) => {
  try {
    const daten = req.body;
    const collection = db.collection("fahrzeugeEntwurf");

    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const letzter = await collection.findOne(
      { nutzerId: req.nutzer.id, updatedAt: { $gte: thirtyMinAgo } },
      { sort: { updatedAt: -1, _id: -1 } }
    );

    if (letzter) {
      await collection.updateOne(
        { _id: letzter._id },
        { $set: { ...daten, updatedAt: new Date() } }
      );
      return res.json({ success: true, fahrzeugId: letzter._id });
    } else {
      const r = await collection.insertOne({
        ...daten,
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


app.post("/saveDetails", checkLogin, async (req, res) => {
  try {
    const details = req.body;
    const collection = db.collection("fahrzeugeEntwurf");

    // nur frische Entwürfe finden (≤ 30 Min)
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const letzter = await collection.findOne(
      { nutzerId: req.nutzer.id, updatedAt: { $gte: thirtyMinAgo } },
      { sort: { updatedAt: -1, _id: -1 } }
    );
    if (!letzter) return res.status(400).json({ error: "Kein (frischer) Fahrzeugentwurf gefunden." });

    await collection.updateOne(
      { _id: letzter._id },
      { $set: { ...details, updatedAt: new Date() } } // ⬅️ updatedAt refreshen
    );
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Fehler in /saveDetails:", err);
    res.status(500).json({ error: "Fehler beim Speichern der Details." });
  }
});

app.post(
  "/saveMedia",
  checkLogin,
  upload.fields([{ name: "images", maxCount: 20 }, { name: "video", maxCount: 1 }]),
  async (req, res) => {
    const cleanup = (arr = []) => arr.forEach(f => { try { fs.unlinkSync(f.path); } catch {} });

    try {
      const collection = db.collection("fahrzeugeEntwurf");

      // nur frische Entwürfe finden (≤ 30 Min)
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      const letzter = await collection.findOne(
        { nutzerId: req.nutzer.id, updatedAt: { $gte: thirtyMinAgo } },
        { sort: { updatedAt: -1, _id: -1 } }
      );
      if (!letzter) {
        cleanup([...(req.files?.images || []), ...(req.files?.video || [])]);
        return res.status(400).json({ error: "Kein (frischer) Fahrzeugentwurf gefunden." });
      }

      const files = req.files || {};
      const imageFiles = Array.isArray(files.images) ? files.images : [];
      const videoFile  = Array.isArray(files.video)  ? (files.video[0] || null) : null;

      const existingImages = Array.isArray(letzter.images) ? letzter.images.length : 0;
      if (imageFiles.length && existingImages + imageFiles.length > 20) {
        cleanup([...imageFiles, ...(videoFile ? [videoFile] : [])]);
        return res.status(400).json({ error: "Maximal 20 Bilder pro Inserat." });
      }

      const baseFolder = `autovisa/${req.nutzer.id}`;

      let uploadedImageUrls = [];
      if (imageFiles.length) {
        try {
          const results = await Promise.all(
            imageFiles.map(f =>
              uploadFileToCloudinary(f.path, { folder: `${baseFolder}/images`, resource_type: "image" })
            )
          );
          uploadedImageUrls = results.map(r => r.secure_url);
        } finally {
          cleanup(imageFiles);
        }
      }

      let uploadedVideoUrl = null;
      if (videoFile) {
        try {
          const r = await uploadFileToCloudinary(videoFile.path, { folder: `${baseFolder}/videos`, resource_type: "video" });
          uploadedVideoUrl = r.secure_url;
        } finally {
          cleanup([videoFile]);
        }
      }

      if (!uploadedImageUrls.length && !uploadedVideoUrl) {
        return res.json({
          success: true,
          message: "Keine neuen Dateien – bestehende Medien unverändert.",
          images: letzter.images || [],
          video:  letzter.video  || null
        });
      }

      const updateDoc = {};
      if (uploadedImageUrls.length) {
        updateDoc.images = Array.isArray(letzter.images)
          ? [...letzter.images, ...uploadedImageUrls]
          : [...uploadedImageUrls];
      }
      if (uploadedVideoUrl) updateDoc.video = uploadedVideoUrl;

      updateDoc.updatedAt = new Date(); // ⬅️ TTL-Refresh bei Medienänderung
      await collection.updateOne({ _id: letzter._id }, { $set: updateDoc });

      res.json({
        success: true,
        message: "Medien gespeichert.",
        images: updateDoc.images ?? letzter.images ?? [],
        video:  updateDoc.video  ?? letzter.video  ?? null
      });
    } catch (err) {
      console.error("❌ Fehler beim Speichern der Medien (Cloudinary):", err);
      res.status(500).json({ error: err.message || "Fehler beim Speichern der Medien." });
    }
  }
);

// === Vorschau: Nur frische Entwürfe dieses Nutzers (≤ 30 Min) laden + Seller-Snapshot
app.get("/getVehicleData", checkLogin, async (req, res) => {
  try {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

    const drafts = await db.collection("fahrzeugeEntwurf")
      .find({
        nutzerId: req.nutzer.id,
        updatedAt: { $gte: thirtyMinAgo }      // ⬅️ nur frische Drafts
      })
      .sort({ updatedAt: -1, _id: -1 })        // neueste zuerst
      .toArray();

    // Verkäuferdaten für Snapshot holen
    const user = await db.collection("nutzer").findOne(
      { id: req.nutzer.id },
      { projection: { role: 1, firma: 1, name: 1, logoUrl: 1 } }
    );

    const seller = {
      type: user?.role || "haendler",
      name: user?.firma || user?.name || "Händler",
      logoUrl: user?.logoUrl || ""
    };

    // jedem Entwurf __status + seller anhängen
    const withSeller = drafts.map(d => ({ ...d, __status: "draft", seller }));

    res.json(withSeller);
  } catch (err) {
    console.error("❌ Fehler beim Laden der Fahrzeugdaten:", err);
    res.status(500).json({ error: "Fehler beim Laden der Daten." });
  }
});

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



// === 📄 Tarif temporär speichern (noch lokal) ===
const tarifPath = path.join(__dirname, "nutzerTarif.json");

// Tarif speichern
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

// Tarif abrufen
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

// === Übersicht: veröffentlichte Inserate laden ===
app.get("/meineInserate.json", async (req, res) => {
  try {
    const inserateCollection = db.collection("inserate");
    const inserate = await inserateCollection
      .find({ status: "online" })
      .project({
        token: 0, password: 0, iban: 0, bic: 0, kontoinhaber: 0 // sicherheitshalber ausblenden
      })
      .sort({ veroeffentlichtAm: -1, _id: -1 })
      .toArray();
    res.json(inserate);
  } catch (err) {
    console.error("❌ Fehler beim Laden der veröffentlichten Inserate:", err);
    res.status(500).json({ error: "Fehler beim Laden der veröffentlichten Inserate." });
  }
});

// Erlaubte Ausstattungseinträge für Kurzbeschreibung
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

// Funktion: 3 zufällige erlaubte Ausstattungen auswählen
function getZufaelligeAusstattung(ausstattungArray) {
  if (!Array.isArray(ausstattungArray)) return "Besondere Ausstattung";
  const gefiltert = ausstattungArray.filter(item => erlaubteAusstattungen.includes(item));
  if (gefiltert.length === 0) return "Besondere Ausstattung";
  return gefiltert.sort(() => 0.5 - Math.random()).slice(0, 3).join(" • ");
}
// Entwurf -> veröffentlichen (ID-basiert, sicher)
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

    // Entwurf muss dem eingeloggten Nutzer gehören
    const draft = await entwurfCollection.findOne({ _id, nutzerId: req.nutzer.id });
    if (!draft) return res.status(404).send("Entwurf nicht gefunden.");

    // Händlerdaten (Snapshot) ziehen
    const haendler = await nutzerCollection.findOne(
      { id: req.nutzer.id },
      { projection: { id: 1, role: 1, firma: 1, name: 1, logoUrl: 1 } }
    );

    const seller = {
      type: haendler?.role || "privat",
      id:   haendler?.id || req.nutzer.id,
      name: haendler?.firma || haendler?.name || "Händler",
      logoUrl: haendler?.logoUrl || ""
    };

    const neuesInserat = {
      ...draft,
      verkaeuferId: req.nutzer.id,
      status: "online",
      veroeffentlichtAm: new Date(),
      verkauf_kurzbeschreibung: getZufaelligeAusstattung(draft.verkauf_ausstattung || []),
      seller // ⬅️ Neu: denormalisierte Verkäuferinfos (Logo + Name)
    };

    // neue _id für öffentliche Sammlung
    delete neuesInserat._id;

    await inserateCollection.insertOne(neuesInserat);
    await entwurfCollection.deleteOne({ _id });

    return res.json({ success: true, message: "Inserat erfolgreich veröffentlicht." });
  } catch (err) {
    console.error("❌ Fehler bei /entwurf/:id/publish:", err);
    return res.status(500).send("Fehler beim Veröffentlichen.");
  }
});


// === 🛡️ Login-Prüfung Middleware (signierte Session + DB-Check) ===
async function checkLogin(req, res, next) {
  try {
    const token = req.cookies.session;               // <-- NEU: signiertes Cookie "session"
    const sess  = decodeSession(token);
    if (!sess?.id) return res.status(401).json({ error: "Nicht eingeloggt." });

    // immer gegen DB prüfen
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

// === 📧 Mail (IONOS / beliebiger SMTP via .env) ===
const MAIL_FROM = process.env.MAIL_FROM || "Autovisa <no-reply@autovisa.de>";
const MAIL_REPLY_TO = process.env.MAIL_REPLY_TO || "support@autovisa.de";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || "false") === "true", // 465 => true
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

transporter.verify((error) => {
  if (error) console.error("❌ SMTP-Fehler:", error);
  else console.log("✅ SMTP bereit");
});


// === 🔧 Email-Template Helper (einmalig definieren) ===
function buildAutovisaEmail({
  subject = "Autovisa Nachricht",
  logoUrl,
  greeting = "",
  title = "",
  htmlText = "",
  buttonText = "",
  buttonUrl = "",
  footerNote = "Wenn du diese E-Mail nicht erwartet hast, kannst du sie ignorieren."
}) {
  const preheader = (greeting || title).slice(0, 120);

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
  <!-- Preheader (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${preheader}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f8fc; padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 6px 30px rgba(0,0,0,0.06);">
          <!-- Header / Logo -->
          <tr>
            <td align="center" style="padding:24px; background:linear-gradient(135deg,#0f2027,#203a43,#2c5364);">
              ${logoUrl
                ? `<img src="${logoUrl}" alt="Autovisa" width="140" style="display:block; border:0; outline:none; text-decoration:none; max-width:140px;">`
                : `<div style="font-weight:700; font-size:22px; color:#fff;">AUTOVISA</div>`}
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:28px 28px 8px;">
              ${greeting ? `<div style="font-size:16px; margin-bottom:8px;">${greeting}</div>` : ""}
              ${title ? `<h1 style="margin:0 0 12px; font-size:22px; line-height:1.3; color:#1a2a33;">${title}</h1>` : ""}
              ${htmlText ? `<div style="font-size:15px; line-height:1.6; color:#37444f;">${htmlText}</div>` : ""}
            </td>
          </tr>

          ${buttonText && buttonUrl ? `
          <!-- Button -->
          <tr>
            <td align="center" style="padding:16px 28px 6px;">
              <a href="${buttonUrl}"
                 style="display:inline-block; text-decoration:none; font-weight:600; padding:12px 20px; border-radius:8px; background:#00b8a9; color:#ffffff;">
                ${buttonText}
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 8px;">
              <div style="font-size:12px; line-height:1.5; color:#6b7a86; word-break:break-all;">
                Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br>
                <a href="${buttonUrl}" style="color:#0f7a70;">${buttonUrl}</a>
              </div>
            </td>
          </tr>` : ""}

          <!-- Footer -->
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
// === 📝 Registrierung mit Verifizierungslink ===
app.post("/register", async (req, res) => {
  let { name, email, password } = req.body;

  // Normalisieren
  name  = (name  || "").trim();
  email = (email || "").trim().toLowerCase();

  // Validierung
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Alle Felder sind erforderlich." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Passwort muss mindestens 8 Zeichen haben." });
  }

  try {
    const nutzerColl = db.collection("nutzer");

    // E-Mail darf nur einmal existieren
    const exists = await nutzerColl.findOne({ email });
    if (exists) {
      return res.status(400).json({ error: "E-Mail bereits registriert." });
    }

    // Token + Passwort-Hash
    const token = crypto.randomBytes(20).toString("hex");
    const hash  = await bcrypt.hash(password, 12);

    // Nutzer-Dokument
    const neuerNutzer = {
      id: Date.now().toString(),   // interne string-ID
      name,
      email,
      password: hash,              // ✅ gehasht
      verified: false,
      token,
      role: "privat",
      createdAt: new Date(),
    };

    await nutzerColl.insertOne(neuerNutzer);

    // URLs aus ENV (robust, auch falls getUrls() nicht definiert ist)
    const hasGetUrls = (typeof getUrls === "function");
    const urls = hasGetUrls
      ? getUrls()
      : {
          api:    process.env.API_URL || process.env.BASE_URL || `http://localhost:${PORT}`,
          appUrl: process.env.PUBLIC_APP_URL || process.env.API_URL || process.env.BASE_URL || `http://localhost:${PORT}`,
        };

    const verifyLink = `${urls.api}/verify?token=${token}`;
    const logoUrl    = `${urls.appUrl}/${encodeURIComponent("AUTOVISA LOGO.PNG")}`;

    // Mailinhalt
    const subject = "Bitte bestätige deine Registrierung";
    const html = buildAutovisaEmail({
      subject,
      logoUrl,
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

    // Versand (Absender/Reply-To kommen aus ENV via MAIL_FROM/MAIL_REPLY_TO)
    const info = await transporter.sendMail({
      from: MAIL_FROM,
      replyTo: MAIL_REPLY_TO,
      to: email,
      subject,
      html,
      text,
    });

    console.log("✅ Bestätigungsmail gesendet:", info.messageId || info.response);
    return res.json({ success: true, message: "E-Mail zur Bestätigung wurde gesendet." });

  } catch (mailOrDbErr) {
    console.error("❌ Fehler bei Registrierung/Versand:", mailOrDbErr);

    // Falls der Nutzer bereits angelegt wurde, aber Versand scheiterte:
    try { if (email) await db.collection("nutzer").deleteOne({ email, verified: false }); } catch {}

    return res.status(500).json({ error: "Interner Fehler oder E-Mail-Versand fehlgeschlagen." });
  }
});

// === Login-Route (bcrypt + sanfte Migration + signierte Session) ===
app.post("/login", async (req, res) => {
  let { email, password } = req.body;

  email = (email || "").trim().toLowerCase();
  if (!email || !password) {
    return res.status(400).json({ error: "❌ E-Mail und Passwort erforderlich." });
  }

  try {
    const nutzerColl = db.collection("nutzer");
    const user = await nutzerColl.findOne({ email });

    // Einheitliche Fehlerausgabe (keine Info, ob E-Mail existiert)
    if (!user) {
      return res.status(401).json({ error: "❌ E-Mail oder Passwort falsch." });
    }

    // Passwort prüfen (sanfte Migration auf bcrypt)
    let passOK = false;
    if (typeof user.password === "string" && user.password.startsWith("$2")) {
      passOK = await bcrypt.compare(password, user.password);
    } else {
      passOK = user.password === password;
      if (passOK) {
        // ✅ Sofortige Migration auf Hash
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

    // 🔒 Signierte Session setzen (einzig relevante Auth-Cookie)
    const payload = makeSessionPayload(user);
    const sessionToken = encodeSession(payload);

    res.cookie("session", sessionToken, {
      httpOnly: true,
      sameSite: "Lax",
      secure: isSecureCookie,
      maxAge: 1000 * 60 * 60 * 24, // 1 Tag
      path: "/"
    });

    // (Optional) UI-Helfer für dein Frontend – kein Security-Flag.
    res.cookie("isLoggedIn", "true", {
      httpOnly: false,
      sameSite: "Lax",
      secure: isSecureCookie,
      maxAge: 1000 * 60 * 60 * 24,
      path: "/"
    });

    /* -----------------------------------------------
       ⚠️ Legacy-Kompatibilität:
       Wenn dein Frontend aktuell noch das unsignierte
       "nutzer"-Cookie liest (z.B. /getNutzerInfo),
       kannst du es vorübergehend weiter setzen.
       ABER: Niemals für Auth nutzen!
       -> Empfohlen: /getNutzerInfo auf "session" umstellen.
    ------------------------------------------------
    res.cookie("nutzer", JSON.stringify({
      id: user.id,
      role: user.role || "privat",
      email: user.email
    }), {
      httpOnly: true,            // bewusst httpOnly lassen (nicht im Browser lesbar)
      sameSite: "Lax",
      secure: isSecureCookie,
      maxAge: 1000 * 60 * 60 * 24,
      path: "/"
    });
    ------------------------------------------------ */

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

// === Helper: Seller-Fallback für Aggregationen ===
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
    {
      $addFields: {
        seller: {
          $ifNull: [
            "$seller",
            {
              type:   { $ifNull: ["$sellerUser.role", "privat"] },
              id:     { $ifNull: ["$sellerUser.id",   "" ] },
              name:   {
                $ifNull: [
                  "$sellerUser.firma",
                  { $ifNull: ["$sellerUser.name", "Händler"] }
                ]
              },
              logoUrl:{ $ifNull: ["$sellerUser.logoUrl", ""] }
            }
          ]
        }
      }
    },
    {
      $project: {
        token: 0, password: 0, iban: 0, bic: 0, kontoinhaber: 0,
        sellerUser: 0
      }
    }
  ];
}

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


// === Nutzer-Info aus Session (sicher) ===
app.get("/getNutzerInfo", async (req, res) => {
  try {
    const sess = decodeSession(req.cookies.session);
    if (!sess?.id) return res.json({ eingeloggt: false });

    const user = await db.collection("nutzer").findOne(
      { id: sess.id },
      { projection: { id: 1, role: 1, name: 1, firma: 1, logoUrl: 1 } }
    );
    if (!user) return res.json({ eingeloggt: false });

    return res.json({
      eingeloggt: true,
      nutzerId: user.id,
      rolle: user.role || "privat",
      name: user.name || user.firma || "Unbekannt",
      logoUrl: user.logoUrl || ""
    });
  } catch (err) {
    console.error("❌ Fehler bei getNutzerInfo:", err);
    return res.status(500).json({ error: "Interner Serverfehler." });
  }
});





const uploadLogo = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.startsWith("image/");
    cb(ok ? null : new Error("Nur Bilddateien (PNG/JPG/WEBP) erlaubt."), ok);
  }
});

// === Händlerregistrierung mit optionalem Logo-Upload ===
app.post("/haendler-registrieren", uploadLogo.single("logo"), async (req, res) => {
  // Felder kommen bei multipart als Strings
  const {
    firma, strasse, hausnummer, plz, ort, land, telefon, telefon2,
    email, whatsapp, tarif, zahlungsmethode, kontoinhaber, iban, bic,
    impressum, agb, datenschutz, password, confirmPassword
  } = req.body;

  // Normalisierung / Sanitizing
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

  const toBool = (v) => (v === true || v === "true" || v === "on" || v === 1 || v === "1");
  const _whatsapp    = toBool(whatsapp);
  const _agb         = toBool(agb);
  const _datenschutz = toBool(datenschutz);

  // Pflichtfelder + Basis-Checks
  if (!_firma || !_email || !password || !_agb || !_datenschutz) {
    return res.status(400).json({ error: "Bitte füllen Sie alle Pflichtfelder aus." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Das Passwort muss mindestens 8 Zeichen lang sein." });
  }
  if (confirmPassword && confirmPassword !== password) {
    return res.status(400).json({ error: "Passwörter stimmen nicht überein." });
  }

  try {
    const nutzerColl = db.collection("nutzer");

    // Keine doppelte E-Mail zulassen
    const existiert = await nutzerColl.findOne({ email: _email });
    if (existiert) {
      return res.status(400).json({ error: "E-Mail bereits registriert." });
    }

    // Nutzer-ID vorab erzeugen (für Cloudinary-Ordner)
    const newId = Date.now().toString();

    // Logo optional zu Cloudinary hochladen
    let logoUrl = "";
    let logoPublicId = "";
    if (req.file) {
      try {
        const result = await uploadFileToCloudinary(req.file.path, {
          folder: `autovisa/${newId}/logo`,
          resource_type: "image",
        });
        logoUrl = result.secure_url || "";
        logoPublicId = result.public_id || "";
      } finally {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
    }

    // Token/Passwort
    const token = crypto.randomBytes(20).toString("hex");
    const hash  = await bcrypt.hash(password, 12);

    // Händler-Dokument
    const neuerHaendler = {
      id: newId,
      role: "haendler",
      verified: false,
      token,
      createdAt: new Date(),
      // Firma / Kontakt
      firma: _firma,
      strasse: _strasse,
      hausnummer: _hausnummer,
      plz: _plz,
      ort: _ort,
      land: _land,
      telefon: _telefon,
      telefon2: _telefon2,
      email: _email,
      whatsapp: _whatsapp,
      // Tarif / Zahlung
      tarif: _tarif,
      zahlungsmethode: _zahlungsmethode,
      kontoinhaber: _kontoinhaber,
      iban: _iban,
      bic: _bic,
      // Rechtliches
      impressum: _impressum,
      agb: _agb,
      datenschutz: _datenschutz,
      // Auth
      password: hash,
      // Logo (optional)
      ...(logoUrl ? { logoUrl, logoPublicId, logoUpdatedAt: new Date() } : {}),
    };

    await nutzerColl.insertOne(neuerHaendler);

    // URLs aus ENV (robust, falls getUrls() nicht definiert ist)
    const hasGetUrls = (typeof getUrls === "function");
    const urls = hasGetUrls
      ? getUrls()
      : {
          api:    process.env.API_URL || process.env.BASE_URL || `http://localhost:${PORT}`,
          appUrl: process.env.PUBLIC_APP_URL || process.env.API_URL || process.env.BASE_URL || `http://localhost:${PORT}`,
        };

    const verifyLink = `${urls.api}/verify?token=${token}`;
    const brandLogo  = `${urls.appUrl}/${encodeURIComponent("AUTOVISA LOGO.PNG")}`;

    // E-Mail
    const subject = "Bitte bestätigen Sie Ihre Händlerregistrierung";
    const html = buildAutovisaEmail({
      subject,
      logoUrl: brandLogo,
      greeting: `Hallo ${_firma},`,
      title: "Händlerkonto bestätigen",
      htmlText: "Bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Händlerkonto zu aktivieren.",
      buttonText: "Händlerkonto bestätigen",
      buttonUrl: verifyLink,
      footerNote: "Wenn Sie sich nicht bei Autovisa registriert haben, können Sie diese E-Mail ignorieren.",
    });
    const text =
`Hallo ${_firma},
bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Händlerkonto bei Autovisa zu aktivieren:
${verifyLink}

Wenn Sie sich nicht registriert haben, ignorieren Sie diese E-Mail.`;

    // Versand (Absender/Reply-To aus ENV)
    const info = await transporter.sendMail({
      from: MAIL_FROM,
      replyTo: MAIL_REPLY_TO,
      to: _email,
      subject,
      html,
      text,
    });

    console.log("✅ Händler-Mail gesendet:", info.messageId || info.response);
    return res.json({ success: true, message: "Händlerregistrierung erfolgreich. E-Mail wurde versendet." });

  } catch (mailErr) {
    console.error("❌ Fehler bei /haendler-registrieren:", mailErr);

    // Aufräumen: Account entfernen, optional Cloudinary-Asset löschen
    try { if (req.body?.email) await db.collection("nutzer").deleteOne({ email: (req.body.email || "").toLowerCase(), verified: false }); } catch {}
    try { if (typeof logoPublicId === "string" && logoPublicId) await cloudinary.uploader.destroy(logoPublicId, { resource_type: "image" }); } catch {}

    return res.status(500).json({ error: "E-Mail-Versand fehlgeschlagen. Bitte später erneut versuchen." });
  }
});


app.post("/haendler/logo", checkLogin, uploadLogo.single("logo"), async (req, res) => {
  try {
    if (req.nutzer.role !== "haendler") {
      return res.status(403).json({ error: "Nur für Händler verfügbar." });
    }
    if (!req.file) return res.status(400).json({ error: "Keine Datei hochgeladen." });

    const folder = `autovisa/${req.nutzer.id}/logo`;
    const result = await uploadFileToCloudinary(req.file.path, { folder, resource_type: "image" });
    try { fs.unlinkSync(req.file.path); } catch {}

    const nutzerColl = db.collection("nutzer");
    const old = await nutzerColl.findOne({ id: req.nutzer.id }, { projection: { logoPublicId: 1 } });

    // optional: altes Logo aus Cloudinary löschen
    if (old?.logoPublicId && old.logoPublicId !== result.public_id) {
      try { await cloudinary.uploader.destroy(old.logoPublicId, { resource_type: "image" }); } catch(e) {}
    }

    await nutzerColl.updateOne(
      { id: req.nutzer.id },
      { $set: { logoUrl: result.secure_url, logoPublicId: result.public_id, logoUpdatedAt: new Date() } }
    );
    
    // ⬇️ NEU: Logo sofort in allen Inseraten/Entwürfen spiegeln
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
// === ✅ Verifikations-Route (Redirect auf Frontend) ===
app.get("/verify", async (req, res) => {
  const { token } = req.query;

  // Ziel-URL aus ENV ermitteln (falls getUrls() nicht existiert)
  const hasGetUrls = (typeof getUrls === "function");
  const { appUrl } = hasGetUrls
    ? getUrls()
    : { appUrl: process.env.PUBLIC_APP_URL || process.env.API_URL || process.env.BASE_URL || `http://localhost:${PORT}` };

  // Keine Caches für diesen Endpunkt
  res.set("Cache-Control", "no-store");

  if (!token || typeof token !== "string") {
    return res.redirect(`${appUrl}/login.html?verified=0&reason=invalid`);
  }

  try {
    const nutzerColl = db.collection("nutzer");

    // Token suchen
    const user = await nutzerColl.findOne({ token });
    if (!user) {
      // Schon bestätigt oder Token falsch/abgelaufen
      return res.redirect(`${appUrl}/login.html?verified=0&reason=token`);
    }

    // Verifizieren & Token entfernen
    await nutzerColl.updateOne(
      { _id: user._id },
      { $set: { verified: true, verifiedAt: new Date() }, $unset: { token: "" } }
    );

    // Erfolg
    return res.redirect(`${appUrl}/login.html?verified=1`);
  } catch (err) {
    console.error("❌ Fehler bei /verify:", err);
    return res.redirect(`${appUrl}/login.html?verified=0&reason=server`);
  }
});
// ====== E-Mail-Benachrichtigung bei neuer Chat-Nachricht ======
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

function escapeHtml(s = "") {
  return s.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

async function sendNewMessageEmail({ to, recipientName, senderName, messagePreview, chatUrl }) {
  if (!to) return;
  const { appUrl } = getAppUrls();
  const logoUrl = `${appUrl}/${encodeURIComponent("AUTOVISA LOGO.PNG")}`;

  const subject = `Neue Nachricht von ${senderName} auf Autovisa`;
  const html = buildAutovisaEmail({
    subject,
    logoUrl,
    greeting: `Hallo ${recipientName || ""},`,
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
    footerNote: "Diese Benachrichtigung wurde automatisch gesendet. Du kannst E-Mail-Benachrichtigungen jederzeit in deinen Einstellungen deaktivieren."
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
    text
  });
}

// Throttling: max. 1 Mail pro 10 Min je (empfaengerId, senderId, fahrzeugId)
async function shouldSendNowAndTouchThrottle({ empfaengerId, senderId, fahrzeugId }) {
  try {
    const coll = db.collection("notifyThrottle");
    const key = `${empfaengerId}:${senderId}:${fahrzeugId}`;
    const now = new Date();
    const minAgo = new Date(Date.now() - NOTIFY_MIN_INTERVAL_MIN * 60 * 1000);

    // Atomar mit Aggregations-Pipeline upsert (erfordert MongoDB 4.2+)
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
    return true; // im Zweifel senden
  }
}

// === Nachricht senden ===
// Sicherheitsänderung: Sender NUR aus Session, nicht aus Body
app.post("/nachricht-senden", checkLogin, async (req, res) => {
  const { empfaengerId, fahrzeugId, absenderName, nachricht } = req.body;
  const senderId = req.nutzer.id;

  if (!senderId || !empfaengerId || !fahrzeugId || !nachricht || !absenderName) {
    return res.status(400).json({ error: "Fehlende Felder." });
  }
  if (senderId === empfaengerId) {
    return res.status(400).json({ error: "Absender und Empfänger dürfen nicht identisch sein." });
  }

  try {
    const nachrichtenColl = db.collection("nachrichten");

    const neueNachricht = {
      id: Date.now().toString(),
      senderId,
      empfaengerId: String(empfaengerId),
      fahrzeugId: String(fahrzeugId),
      absenderName: String(absenderName).trim().slice(0, 128),
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
          const nutzerColl = db.collection("nutzer");
          const [empf, sndr] = await Promise.all([
            nutzerColl.findOne({ id: String(empfaengerId) }, { projection: { email: 1, name: 1, firma: 1 } }),
            nutzerColl.findOne({ id: String(senderId) },    { projection: { name: 1, firma: 1 } })
          ]);

          const recipientEmail = empf?.email || "";
          const recipientName  = empf?.firma || empf?.name || "Nutzer";
          const senderName     = absenderName || sndr?.firma || sndr?.name || "Interessent";

          if (recipientEmail) {
            const { appUrl } = getAppUrls();
            const chatUrl = `${appUrl}/chat.html?user=${encodeURIComponent(empfaengerId)}&with=${encodeURIComponent(senderId)}&fahrzeug=${encodeURIComponent(fahrzeugId)}`;

            await sendNewMessageEmail({
              to: recipientEmail,
              recipientName,
              senderName,
              messagePreview: neueNachricht.nachricht,
              chatUrl
            });
            console.log(`✅ Mail-Benachrichtigung an ${recipientEmail} gesendet.`);
          } else {
            console.log("ℹ️ Empfänger ohne E-Mail – Benachrichtigung übersprungen.");
          }
        } else {
          console.log("⏳ Benachrichtigung gedrosselt (Intervall).");
        }
      }
    } catch (mailErr) {
      console.error("⚠️ Konnte Benachrichtigung nicht senden:", mailErr);
    }

    // API-Antwort erst am Ende zurückgeben
    res.json({ success: true });

  } catch (err) {
    console.error("❌ Fehler beim Speichern der Nachricht:", err);
    res.status(500).json({ error: "Fehler beim Speichern der Nachricht." });
  }
});




app.get("/inserat-details/:id", checkLogin, async (req, res) => {
  try {
    const oid = new ObjectId(String(req.params.id));
    const coll = db.collection("inserate");
    const doc = await coll.findOne({ _id: oid });
    if (!doc) return res.status(404).json({ error: "Nicht gefunden" });

    res.json({
      titel: doc.titel || "",
      preis: doc.verkauf_brutto ?? doc.verkauf_preis ?? doc.preis ?? null,
      images: Array.isArray(doc.images) ? doc.images : [],
      verkauf_kurzbeschreibung: doc.verkauf_kurzbeschreibung || "",
      verkauf_kilometer: doc.verkauf_kilometer ?? null,
      verkauf_erstzulassung: doc.verkauf_erstzulassung || null,
      verkauf_kraftstoff: doc.verkauf_kraftstoff || null,
      verkauf_leistung: doc.verkauf_leistung ?? null,
      verkauf_getriebe: doc.verkauf_getriebe || null,
      verkauf_verbrauch_kombiniert: doc.verkauf_verbrauch_kombiniert || null,
      verkauf_verkaeufer: doc.verkauf_verkaeufer || "",
      verkauf_name: doc.verkauf_name || "",
      standort: doc.standort || "",
      // ⬇️ NEU: Verkäufer-Snapshot inkl. Logo
      seller: {
        type: doc.seller?.type || (doc.verkauf_verkaeufer?.toLowerCase() === "händler" ? "haendler" : "privat"),
        id: doc.seller?.id || doc.verkaeuferId || "",
        name: doc.seller?.name || doc.verkauf_name || "",
        logoUrl: doc.seller?.logoUrl || ""
      }
    });
  } catch (e) {
    res.status(400).json({ error: "Ungültige ID" });
  }
});



// === Nachrichten für Empfänger abrufen ===
// Sicherheitsänderung: Nur der eingeloggte Nutzer darf seine Nachrichten abrufen
app.get("/nachrichten/:empfaengerId", checkLogin, async (req, res) => {
  const { empfaengerId } = req.params;
  if (!empfaengerId) return res.status(400).json({ error: "Keine ID übergeben." });

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
    await coll.updateOne({ id: String(req.params.id) }, { $set: { gelesen: true } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Update fehlgeschlagen" });
  }
});

// === Chatverlauf abrufen ===
app.get("/chat", checkLogin, async (req, res) => {
  const { user1, user2, fahrzeugId } = req.query;

  if (!user1 || !user2 || !fahrzeugId) {
    return res.status(400).json({ error: "Unvollständige Anfrage." });
  }

  // Sicherheitscheck: nur Teilnehmer dürfen ihren Chat sehen
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




// Alle Nachrichten, an denen der eingeloggte Nutzer beteiligt ist
app.get("/meine-nachrichten", checkLogin, async (req, res) => {
  try{
    const uid = req.nutzer.id;
    const coll = db.collection("nachrichten");
    const list = await coll.find({
      $or: [{ senderId: uid }, { empfaengerId: uid }]
    }).toArray();
    res.json(list);
  }catch(e){
    res.status(500).json({ error: "Fehler beim Laden" });
  }
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
  const res = await fetch(url, { headers: { "User-Agent": "autovisa/1.0 (contact: info@autovisa.de)" } }).catch(() => null);
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
app.post("/veroeffentlichen", checkLogin, async (req, res) => {
  try {
    const sellerId = req.nutzer?.id;
    if (!sellerId) return res.status(401).send("Nicht eingeloggt.");

    const entwurfColl  = db.collection("fahrzeugeEntwurf");
    const inserateColl = db.collection("inserate");
    const nutzerColl   = db.collection("nutzer");

    // 1) Entwurf ermitteln
    const { draftId } = req.body || {};
    let draft;

    if (draftId) {
      // Falls Frontend eine Draft-ID mitsendet → genau den Entwurf publizieren
      let _id;
      try { _id = new ObjectId(String(draftId)); }
      catch { return res.status(400).send("Ungültige Draft-ID."); }

      draft = await entwurfColl.findOne({ _id, nutzerId: sellerId });
      if (!draft) return res.status(404).send("Entwurf nicht gefunden oder gehört nicht zu dir.");
    } else {
      // Sonst: den zuletzt geänderten frischen Entwurf (≤ 30 Min) nehmen
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      draft = await entwurfColl.findOne(
        { nutzerId: sellerId, updatedAt: { $gte: thirtyMinAgo } },
        { sort: { updatedAt: -1, _id: -1 } }
      );
      if (!draft) return res.status(400).send("Kein (frischer) Entwurf zum Veröffentlichen gefunden.");
    }

    // 2) Verkäufer-Snapshot laden (inkl. Logo)
    const haendler = await nutzerColl.findOne(
      { id: sellerId },
      { projection: { id: 1, role: 1, firma: 1, name: 1, logoUrl: 1 } }
    );

    const seller = {
      type:   haendler?.role || "privat",
      id:     haendler?.id   || sellerId,
      name:   haendler?.firma || haendler?.name || "Händler",
      logoUrl: haendler?.logoUrl || ""
    };

    // 3) Entwurfs-Payload sanitisieren (interne Felder entfernen)
    const { _id, updatedAt, erstelltAm, __status, ...payload } = draft;

    // 4) Live-Inserat bauen (mit sinnvollen Defaults)
    const neuesInserat = {
      ...payload, // enthält Medien, technische Daten, etc.
      verkaeuferId: sellerId,
      status: "online",
      veroeffentlichtAm: new Date(),
      verkauf_kurzbeschreibung: getZufaelligeAusstattung(payload.verkauf_ausstattung || []),

      // Konsistent setzen (Body-Overrides nur, wenn vorhanden)
      verkauf_verkaeufer: (seller.type === "haendler") ? "Händler" : "Privatverkäufer",
      verkauf_name: req.body?.name || payload.verkauf_name || seller.name,
      standort: (req.body?.plz && req.body?.ort)
        ? `${req.body.plz} ${req.body.ort}`
        : (payload.standort || "Nicht angegeben"),
      telefon: req.body?.telefon || payload.telefon || "",

      // Denormalisierte Verkäuferdaten (für schnelle Anzeige)
      seller
    };

    // 5) (Optional) Geokodierung
    const locString = (req.body?.plz && req.body?.ort)
      ? `${req.body.plz} ${req.body.ort}`
      : (neuesInserat.standort || "");
    if (locString) {
      try {
        const point = await geocodeToPoint(locString);
        if (point) neuesInserat.standortCoords = point;
      } catch (e) {
        console.warn("Geocoding fehlgeschlagen:", e?.message || e);
      }
    }

    // 6) Speichern & Entwurf entfernen
    await inserateColl.insertOne(neuesInserat);
    await entwurfColl.deleteOne({ _id: draft._id, nutzerId: sellerId });

    return res.json({ success: true, message: "Inserat erfolgreich veröffentlicht." });
  } catch (err) {
    console.error("❌ Fehler bei /veroeffentlichen:", err);
    return res.status(500).send("Fehler beim Veröffentlichen.");
  }
});




app.post("/inserat-veroeffentlichen", checkLogin, async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).send("ID fehlt.");

  let _id; try { _id = new ObjectId(id); } catch { return res.status(400).send("Ungültige ID."); }

  try {
    const sellerId     = req.nutzer?.id;
    const entwurfColl  = db.collection("fahrzeugeEntwurf");
    const inserateColl = db.collection("inserate");
    const nutzerColl   = db.collection("nutzer");

    const draft = await entwurfColl.findOne({ _id, nutzerId: sellerId });
    if (!draft) return res.status(404).send("Entwurf nicht gefunden.");

    // Händler-Snapshot (inkl. Logo)
    const haendler = await nutzerColl.findOne(
      { id: sellerId },
      { projection: { id: 1, role: 1, firma: 1, name: 1, logoUrl: 1 } }
    );
    const seller = {
      type:   haendler?.role || "privat",
      id:     haendler?.id   || sellerId,
      name:   haendler?.firma || haendler?.name || "Händler",
      logoUrl: haendler?.logoUrl || ""
    };

    const neuesInserat = {
      ...draft,
      verkaeuferId: sellerId,
      status: "online",
      veroeffentlichtAm: new Date(),
      verkauf_kurzbeschreibung: getZufaelligeAusstattung(draft.verkauf_ausstattung || []),

      // Konsistent setzen
      verkauf_verkaeufer: (seller.type === "haendler") ? "Händler" : "Privatverkäufer",
      verkauf_name: draft.verkauf_name || seller.name,
      standort:     draft.standort || "Nicht angegeben",
      telefon:      draft.telefon || "",

      // ⬇️ WICHTIG
      seller
    };

    // Geocoding (optional)
    const locString = neuesInserat.standort || "";
    if (locString) {
      try {
        const point = await geocodeToPoint(locString);
        if (point) neuesInserat.standortCoords = point;
      } catch (e) { console.warn("Geocoding fehlgeschlagen:", e?.message || e); }
    }

    delete neuesInserat._id;
    await inserateColl.insertOne(neuesInserat);
    await entwurfColl.deleteOne({ _id, nutzerId: sellerId });

    res.send("Inserat erfolgreich veröffentlicht.");
  } catch (err) {
    console.error("❌ Fehler bei /inserat-veroeffentlichen:", err);
    res.status(500).send("Fehler beim Veröffentlichen.");
  }
});



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

// (optional) Legacy-Weiterleitung:
app.get("/fahrzeuge-online", (req, res) => {
  const { page, limit } = req.query;
  const qs = new URLSearchParams();
  if (page) qs.set("page", page);
  if (limit) qs.set("limit", limit);
  res.redirect(302, `/inserate${qs.toString() ? `?${qs}` : ""}`);
});



app.post("/logout", (req, res) => {
  const { appUrl } = getUrls();
  const isSecureCookie = appUrl.startsWith("https") || process.env.NODE_ENV === "production";
  res.clearCookie("session",   { httpOnly: true,  sameSite: "Lax", secure: isSecureCookie, path: "/" });
  res.clearCookie("isLoggedIn",{ httpOnly: false, sameSite: "Lax", secure: isSecureCookie, path: "/" });
  return res.json({ success: true });
});



// === Healthcheck & Server starten ===
app.get("/healthz", (req, res) => res.status(200).send("ok"));

console.log("Render PORT env =", process.env.PORT); // Debug

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
   }
   // ============================================================
// /api/geosuggest  —  schnelle Ortsvorschläge (DE, OSM → Photon Fallback)
// Voraussetzungen (oben im File vorhanden):
//  - const GEO_TTL_MS, const NOMINATIM_TIMEOUT_MS
//  - geoMem Map + getGeoMem/setGeoMem
//  - dedupeByLabel(list)
//  - globale "db" Verbindung
// ============================================================
app.get("/api/geosuggest", async (req, res) => {
  try {
    const qRaw = String(req.query.q || "").trim();
    if (!qRaw) return res.json({ suggestions: [] });

    const key = qRaw.toLowerCase();
    const reqLimit = parseInt(req.query.limit, 10);
    const lim = Math.min(Math.max(Number.isFinite(reqLimit) ? reqLimit : (key.length <= 3 ? 20 : 10), 1), 25);

    // 1) Memory-Cache
    const mem = getGeoMem(key);
    if (mem && mem.length) {
      res.set("Cache-Control", "public, max-age=120");
      return res.json({ suggestions: mem.slice(0, lim) });
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
      return res.json({ suggestions: cached.suggestions.slice(0, lim) });
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
        lon: lonNum
      };
    };

    // 3) Quelle 1: Nominatim
    let suggestions = [];
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), NOMINATIM_TIMEOUT_MS);
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=de&limit=${lim}&q=${encodeURIComponent(qRaw)}`;
      const r = await fetch(url, {
        headers: {
          "User-Agent": "autovisa/1.0 (contact: info@autovisa.de)",
          "Accept-Language": "de-DE,de;q=0.9"
        },
        signal: ctrl.signal
      }).catch(() => null);
      clearTimeout(timer);

      if (r && r.ok) {
        const arr = await r.json().catch(() => []);
        suggestions = (Array.isArray(arr) ? arr : [])
          .map(it => {
            const a = it.address || {};
            const city = a.city || a.town || a.village || a.hamlet || a.suburb || a.neighbourhood || a.locality || "";
            const postcode = a.postcode || "";
            const state = a.state || a.county || "";
            return mapToSuggestion(postcode, city, state, it.lat, it.lon, it.display_name);
          })
          .filter(Boolean)            // filtere nulls raus (NaN lat/lon)
          .filter(s => s.label);      // sinnvolle Einträge
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
          headers: { "User-Agent": "autovisa/1.0 (contact: info@autovisa.de)" }
        }).catch(() => null);
        if (r2 && r2.ok) {
          const data = await r2.json().catch(() => null);
          const feats = Array.isArray(data?.features) ? data.features : [];
          suggestions = feats
            .map(f => {
              const p = f.properties || {};
              const city = p.city || p.name || p.locality || p.town || p.village || "";
              const postcode = p.postcode || "";
              const state = p.state || p.county || p.district || "";
              const [lon, lat] = Array.isArray(f.geometry?.coordinates) ? f.geometry.coordinates : [null, null];
              return mapToSuggestion(postcode, city, state, lat, lon, p.name);
            })
            .filter(Boolean)
            .filter(s => s.label);
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
      .map(s => {
        const lc = s.label.toLowerCase();
        const score =
          (s.postcode.startsWith(q) ? 3 : 0) +
          (s.city.toLowerCase().startsWith(q) ? 3 : 0) +
          (lc.startsWith(q) ? 1 : 0);
        return { ...s, _score: score };
      })
      .sort((a, b) => (b._score - a._score) || (a.label.length - b.label.length))
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

    return res.json({ suggestions });
  } catch (err) {
    console.error("❌ /api/geosuggest fatal:", err);
    return res.json({ suggestions: [] });
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
      marke, modell, ezFrom, ezTo,
      km_min, km_max, price_min, price_max,
      getriebe, kraftstoff, sort,
      land = "", ort, umkreis, ort_lat, ort_lon,
      page = "1", limit = "20",
      modellausfuehrung,
      fahrzeugtyp,
      tueren,
      // neu:
      ps_min, ps_max,          // Leistung (PS)
      ccm_min, ccm_max,        // Hubraum (cm³)
      verbrauch_max,           // L/100 km (komb.)
      antrieb,                 // CSV: Frontantrieb,Heckantrieb,Allrad
      schadstoffklasse,        // z.B. "Euro 6d"
      plakette,                // "Grün (4)" …
      partikelfilter,          // "1" => erforderlich
      halter_max,              // maximale Halter
      farbe,                   // CSV (Karosseriefarbe)
      merkmale,                // CSV (z. B. Scheckheftgepflegt,Fahrtauglich)

      // HU (neu; mehrere Varianten möglich)
      hu_min_monate,           // z.B. "6"
      hu_bis,                  // z.B. "2026-03" oder "03/2026" oder "2026"
      hu                       // z.B. "Mind. 6 Monate"
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

    // ---- Zahlen aus Query
    const priceMaxNum  = parseInt(price_max, 10);
    const priceMinNum  = parseInt(price_min, 10);
    const kmMaxNum     = parseInt(km_max, 10);
    const kmMinNum     = parseInt(km_min, 10);

    const psMinNum     = parseInt(ps_min, 10);
    const psMaxNum     = parseInt(ps_max, 10);
    const ccmMinNum    = parseInt(ccm_min, 10);
    const ccmMaxNum    = parseInt(ccm_max, 10);
    const verbMaxNum   = (verbrauch_max != null)
                          ? parseFloat(String(verbrauch_max).replace(",", "."))
                          : NaN;
    const halterMaxNum = parseInt(halter_max, 10);

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
    const huBisKey  = huBisDate ? (huBisDate.getUTCFullYear() * 12 + (huBisDate.getUTCMonth() + 1)) : null;

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
        : [{ $sort: { veroeffentlichtAm: -1, _id: -1 } }];

    /* ---------------- Parsing / Normalisierung ---------------- */
    const parseNumberStages = [
      { $addFields: {
          _preis_raw: {
            $ifNull: [
              "$brutto-preis",
              { $ifNull: [
                "$brutto_preis",
                { $ifNull: [ "$verkauf_brutto", { $ifNull: [ "$preis", "$verkauf_preis" ] } ] }
              ] }
            ]
          },
          _km_raw:     { $ifNull: ["$verkauf_kilometer", { $ifNull: ["$kilometer", "$km"] }] },
          _ps_raw:     { $ifNull: [ "$verkauf_leistung", { $ifNull: [ "$leistung", "$ps" ] } ] },
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

    // ---- HU: Rohwert -> (y,m) -> hu_key (y*12+m) — inkl. getrennten Feldern tuevJahr / tuevMonat
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
          _hu_rx_y_m: { $regexFind: { input: "$_hu_str", regex: /(\d{4})[-/.](\d{1,2})/ } }, // YYYY-MM
          _hu_rx_m_y: { $regexFind: { input: "$_hu_str", regex: /(\d{1,2})[-/.](\d{4})/ } }, // MM/YYYY
          _hu_rx_y:   { $regexFind: { input: "$_hu_str", regex: /(\d{4})/ } },               // YYYY
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
                    1 // nur Jahr -> Januar
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

    // ---- EZ (YYYY-MM) — optional!
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

    // ---- Freitext „Modellvariante“ (AND aus Tokens)
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

    // ---- Fahrzeugtyp (mehrere erlaubt, Synonyme + Titel/Beschreibung)
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

    // ---- Türen-Filter
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

    // ---- Leistungs-/Hubraum-/Verbrauchs-/usw. Filter
    const powerFilterStages = [
      ...(Number.isFinite(psMinNum) ? [{ $match: { ps_num:  { $ne: null, $gte: psMinNum } } }] : []),
      ...(Number.isFinite(psMaxNum) ? [{ $match: { ps_num:  { $ne: null, $lte: psMaxNum } } }] : [])
    ];
    const ccmFilterStages = [
      ...(Number.isFinite(ccmMinNum) ? [{ $match: { ccm_num: { $ne: null, $gte: ccmMinNum } } }] : []),
      ...(Number.isFinite(ccmMaxNum) ? [{ $match: { ccm_num: { $ne: null, $lte: ccmMaxNum } } }] : [])
    ];
    const consumptionFilterStages =
      Number.isFinite(verbMaxNum) ? [{ $match: { verb_num: { $ne: null, $lte: verbMaxNum } } }] : [];

    // ---- Antrieb (CSV; tolerant mit Synonymen)
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

    // ---- Kraftstoff (inkl. Hybrid-Unterarten)
    let fuelStages = [];
    if (kraftstoff) {
      const fuels = String(kraftstoff).split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
      const FIELDS = ["kraftstoff", "verkauf_kraftstoff", "kraftstoffart", "beschreibung"];
      const OR_FIELDS  = (rx) => ({ $or: FIELDS.map(f => ({ [f]: rx })) });
      const NOR_FIELDS = (rx) => ({ $nor: FIELDS.map(f => ({ [f]: rx })) });
      const RX = {
        benzin: /(benzin|otto)\b/i,
        diesel: /\bdiesel\b/i,
        elektro: /\b(elektro|bev|electric|strom|ev)\b/i,
        hybridAny: /\b(hybrid|mhev|hev|phev|plug[\s-]*in)\b/i,
        phev: /\b(phev|plug[\s-]*in)\b/i,
        autogas: /\b(lpg|autogas)\b/i,
        cng: /\b(cng|erdgas)\b/i,
        ethanol: /\b(ethanol|e85)\b/i,
        wasserstoff: /\b(wasserstoff|h2|fuel\s*cell)\b/i,
        andere: /\b(andere|sonstig|unbek|unknown)\b/i
      };
      const conds = [];
      for (const t of fuels) {
        if (t === "plug-in-hybrid-benzin") { conds.push({ $and: [ OR_FIELDS(RX.phev), OR_FIELDS(RX.benzin) ] }); continue; }
        if (t === "plug-in-hybrid-diesel") { conds.push({ $and: [ OR_FIELDS(RX.phev), OR_FIELDS(RX.diesel) ] }); continue; }
        if (t === "plug-in-hybrid" || t === "phev") { conds.push(OR_FIELDS(RX.phev)); continue; }
        if (t === "hybrid-benzin") { conds.push({ $and: [ OR_FIELDS(RX.hybridAny), OR_FIELDS(RX.benzin) ] }); continue; }
        if (t === "hybrid-diesel") { conds.push({ $and: [ OR_FIELDS(RX.hybridAny), OR_FIELDS(RX.diesel) ] }); continue; }
        if (t === "hybrid") { conds.push(OR_FIELDS(RX.hybridAny)); continue; }
        if (["elektro","elektrisch","bev","ev"].includes(t)) { conds.push({ $and: [ OR_FIELDS(RX.elektro), NOR_FIELDS(RX.hybridAny) ] }); continue; }
        if (["benzin","otto"].includes(t)) { conds.push({ $and: [ OR_FIELDS(RX.benzin), NOR_FIELDS(RX.hybridAny) ] }); continue; }
        if (t === "diesel") { conds.push({ $and: [ OR_FIELDS(RX.diesel), NOR_FIELDS(RX.hybridAny) ] }); continue; }
        if (t === "autogas" || t === "lpg") { conds.push(OR_FIELDS(RX.autogas)); continue; }
        if (t === "cng" || t === "erdgas")  { conds.push(OR_FIELDS(RX.cng)); continue; }
        if (t === "ethanol" || t === "e85"){ conds.push(OR_FIELDS(RX.ethanol)); continue; }
        if (t === "wasserstoff" || t === "h2" || t.includes("fuel")) { conds.push(OR_FIELDS(RX.wasserstoff)); continue; }
        if (t === "andere" || t.startsWith("sonstig")) { conds.push(OR_FIELDS(RX.andere)); continue; }
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
    const plaketteParam = plakette || req.query.umweltplakette;
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

    // ---- Partikelfilter vorhanden
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

    // ---- Sonstige Merkmale (inkl. Fahrtauglich)
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

    // ---- HU-Filter (nach Parsing); nutzt nowKey (JS), kein $$NOW
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
                _ps_raw: 0, _ccm_raw: 0, _verb_raw: 0, _halter_raw: 0,
                _ps_match: 0, _ccm_match: 0, _verb_norm: 0, _verb_all_any: 0,
                _halter_match: 0, _preis_null: 0, _ez: 0,
                _hu_raw: 0, _hu_str: 0, _hu_rx_y_m: 0, _hu_rx_m_y: 0, _hu_rx_y: 0,
                _hu_name: 0, _hu_name_y: 0, _hu_name_m: 0,
                _hu_y: 0, _hu_m: 0, _hu_final_y: 0, _hu_final_m: 0
              }
            },
            { $skip: skip },
            { $limit: lim }
          ],
          total: [{ $count: "count" }]
        }
      },
      { $project: { data: 1, total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] } } }
    ];

    // ---- Optionaler Geo-Teil
    const umkreisKm = Math.max(parseInt(umkreis, 10) || 0, 0);
    let pipeline;

    // bevorzugt lat/lon nutzen
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
      ...huParseStages,        // HU-Parsing
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
      ...colorStages,
      ...featureStages,
      ...driveabilityStages,
      ...variantStages,
      ...vehTypeStages,
      ...tuerenStages,
      ...huFilterStages,       // HU-Filter
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



