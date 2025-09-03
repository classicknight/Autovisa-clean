// === Module & Abhängigkeiten ===
const express = require("express");
const multer = require("multer");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");                     // für Temp-Files
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const cloudinary = require("cloudinary").v2;
const crypto = require("crypto");

// === Express Initialisierung ===
const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.set("trust proxy", 1);

// === MongoDB Konfiguration ===
const mongoUri = process.env.MONGODB_URI;
const client = new MongoClient(mongoUri);
let db;
client.connect()
  .then(async () => {
    db = client.db("autovisa");
    console.log("✅ MongoDB verbunden");

    // vorhandene Indexe …
    await db.collection("inserate").createIndex({ standortCoords: "2dsphere" });
    await db.collection("geocache").createIndex({ key: 1 }, { unique: true });

    // 👉 geosuggest-Indexe (Cache):
    await db.collection("geosuggest").createIndex({ key: 1 }, { unique: true });
    await db.collection("geosuggest").createIndex(
      { updatedAt: 1 },
      { expireAfterSeconds: 60 * 60 * 24 * 30 } // 30 Tage TTL
    );
    console.log("✅ Indexe für geosuggest bereit");
  })
  .catch(err => console.error("❌ MongoDB-Verbindung fehlgeschlagen:", err));



// === Cloudinary Konfiguration ===
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Body-Limits nur für Text (Dateien sind davon unberührt)
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use(cookieParser());

// === Statische Dateien ausliefern ===
app.use(express.static(path.join(__dirname, "public")));
app.use("/data", express.static(path.join(__dirname, "data"), {
  dotfiles: "ignore",
  etag: true,
  maxAge: "1d"
}));

// === Startseite ===
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


// === Multer: Disk Storage (keine explizite MB-Grenze); Mengenlimit: 20 Bilder + 1 Video ===
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
  limits: { files: 21 }, // 20 Bilder + 1 Video pro Request
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
    if (isVideo) options.chunk_size = 20 * 1024 * 1024; // 20 MB Chunks

    fn(filePath, options, (err, result) => (err ? reject(err) : resolve(result)));
  });
}


// === Schritt 1: Fahrzeugdaten speichern ===
app.post("/saveFahrzeugdaten", checkLogin, async (req, res) => {
  try {
    const daten = req.body;
    const collection = db.collection("fahrzeugeEntwurf");

    const ergebnis = await collection.insertOne({
      ...daten,
      nutzerId: req.nutzer.id,
      erstelltAm: new Date()
    });

    res.json({ success: true, fahrzeugId: ergebnis.insertedId });
  } catch (err) {
    console.error("❌ Fehler bei /saveFahrzeugdaten:", err);
    res.status(500).json({ error: "Serverfehler beim Speichern." });
  }
});

// === Schritt 2: Fahrzeugdetails speichern ===
app.post("/saveDetails", checkLogin, async (req, res) => {
  try {
    const details = req.body;
    const collection = db.collection("fahrzeugeEntwurf");

    const letzter = await collection.findOne(
      { nutzerId: req.nutzer.id },
      { sort: { _id: -1 } }
    );
    if (!letzter) return res.status(400).json({ error: "Kein Fahrzeug gefunden." });

    await collection.updateOne({ _id: letzter._id }, { $set: details });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Fehler in /saveDetails:", err);
    res.status(500).json({ error: "Fehler beim Speichern der Details." });
  }
});


// === Schritt 3: Medien speichern (Cloudinary; Bilder anhängen, Video ersetzen) ===
app.post(
  "/saveMedia",
  checkLogin,
  upload.fields([{ name: "images", maxCount: 20 }, { name: "video", maxCount: 1 }]),
  async (req, res) => {
    // Helper zum sicheren Aufräumen lokaler tmp-Dateien
    const cleanup = (arr = []) => {
      arr.forEach(f => { try { fs.unlinkSync(f.path); } catch {} });
    };

    try {
      const collection = db.collection("fahrzeugeEntwurf");

      // letzten Entwurf des eingeloggten Nutzers holen
      const letzter = await collection.findOne(
        { nutzerId: req.nutzer.id },
        { sort: { _id: -1 } }
      );
      if (!letzter) {
        cleanup([...(req.files?.images || []), ...(req.files?.video || [])]);
        return res.status(400).json({ error: "Kein Fahrzeug gefunden." });
      }

      const files = req.files || {};
      const imageFiles = Array.isArray(files.images) ? files.images : [];
      const videoFile  = Array.isArray(files.video)  ? (files.video[0] || null) : null;

      // Mengenlimit Bilder (max. 20 insgesamt)
      const existingImages = Array.isArray(letzter.images) ? letzter.images.length : 0;
      if (imageFiles.length && existingImages + imageFiles.length > 20) {
        cleanup([...imageFiles, ...(videoFile ? [videoFile] : [])]);
        return res.status(400).json({ error: "Maximal 20 Bilder pro Inserat." });
      }

      const baseFolder = `autovisa/${req.nutzer.id}`;

      // 1) Bilder hochladen
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

      // 2) Video hochladen (ersetzt vorhandenes)
      let uploadedVideoUrl = null;
      if (videoFile) {
        try {
          const r = await uploadFileToCloudinary(videoFile.path, {
            folder: `${baseFolder}/videos`,
            resource_type: "video"
          });
          uploadedVideoUrl = r.secure_url; // kann .mp4/.mov/... sein
        } finally {
          cleanup([videoFile]);
        }
      }

      // Nichts neu?
      if (!uploadedImageUrls.length && !uploadedVideoUrl) {
        return res.json({
          success: true,
          message: "Keine neuen Dateien – bestehende Medien unverändert.",
          images: letzter.images || [],
          video:  letzter.video  || null
        });
      }

      // Update-Dokument
      const updateDoc = {};
      if (uploadedImageUrls.length) {
        updateDoc.images = Array.isArray(letzter.images)
          ? [...letzter.images, ...uploadedImageUrls]
          : [...uploadedImageUrls];
      }
      if (uploadedVideoUrl) updateDoc.video = uploadedVideoUrl;

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



// === Vorschau: Nur Fahrzeuge dieses Nutzers laden ===
app.get('/getVehicleData', checkLogin, async (req, res) => {
  try {
    const collection = db.collection("fahrzeugeEntwurf");
    const data = await collection.find({ nutzerId: req.nutzer.id }).toArray();
    res.json(data);
  } catch (err) {
    console.error("❌ Fehler beim Laden der Fahrzeugdaten:", err);
    res.status(500).json({ error: 'Fehler beim Laden der Daten.' });
  }
});

app.post('/abbrechen', checkLogin, async (req, res) => {
  try {
    const collection = db.collection("fahrzeugeEntwurf");
    const letzter = await collection.findOne(
      { nutzerId: req.nutzer.id },
      { sort: { _id: -1 } }
    );
    if (!letzter) return res.json({ message: 'Keine Fahrzeuge vorhanden.' });

    await collection.deleteOne({ _id: letzter._id, nutzerId: req.nutzer.id });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Fehler beim Abbrechen:", err);
    res.status(500).json({ error: 'Fehler beim Abbrechen.' });
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

    // Entwurf muss dem eingeloggten Nutzer gehören
    const draft = await entwurfCollection.findOne({ _id, nutzerId: req.nutzer.id });
    if (!draft) return res.status(404).send("Entwurf nicht gefunden.");

    const neuesInserat = {
      ...draft,
      verkaeuferId: req.nutzer.id,
      status: "online",
      veroeffentlichtAm: new Date(),
      // Kurzbeschreibung aus erlaubten Ausstattungen generieren
      verkauf_kurzbeschreibung: getZufaelligeAusstattung(draft.verkauf_ausstattung || [])
    };

    // neue _id in der öffentlichen Sammlung verwenden
    delete neuesInserat._id;

    await inserateCollection.insertOne(neuesInserat);
    await entwurfCollection.deleteOne({ _id });

    return res.json({ success: true, message: "Inserat erfolgreich veröffentlicht." });
  } catch (err) {
    console.error("❌ Fehler bei /entwurf/:id/publish:", err);
    return res.status(500).send("Fehler beim Veröffentlichen.");
  }
});


// === 🛡️ Login-Prüfung Middleware ===
// (zweites app.use(cookieParser()) entfernt – cookieParser ist oben bereits aktiv)

function checkLogin(req, res, next) {
  try {
    const cookie = req.cookies.nutzer;
    if (!cookie) return res.status(401).json({ error: "Nicht eingeloggt." });

    const nutzer = JSON.parse(cookie);
    if (!nutzer?.id) return res.status(401).json({ error: "Ungültiger Login." });

    req.nutzer = nutzer;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Ungültiger Login." });
  }
}

// === 📧 Nodemailer-Konfiguration ===
const smtpUser = process.env.SMTP_USER || "autovisa0607@gmail.com";
const smtpPass = process.env.SMTP_PASS || "inhnziikdkyqtdmy"; // ⚠️ nur Dev-Fallback

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: smtpUser, pass: smtpPass }
});

transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP-Fehler:", error);
  } else {
    console.log("✅ SMTP bereit:", success);
  }
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

  name = (name || "").trim();
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
    const hash = await bcrypt.hash(password, 12);

    const neuerNutzer = {
      id: Date.now().toString(),   // intern genutzte ID (string)
      name,
      email,
      password: hash,              // ✅ gehasht
      verified: false,
      token,
      role: "privat",
      createdAt: new Date()
    };

    await nutzerColl.insertOne(neuerNutzer);

    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    const verifyLink = `${baseUrl}/verify?token=${token}`;
    const logoUrl = `${baseUrl}/${encodeURIComponent("AUTOVISA LOGO.PNG")}`;

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

    const mailOptions = {
      from: `"Autovisa" <${smtpUser}>`, // ✅ nutzt ENV/Fallback aus obiger Transporter-Konfig
      to: email,
      subject,
      html,
      text
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Bestätigungsmail gesendet:", info.response);
      return res.json({ success: true, message: "E-Mail zur Bestätigung wurde gesendet." });
    } catch (mailErr) {
      console.error("❌ SMTP-Fehler beim Senden:", mailErr);
      // Aufräumen: unbestätigtes Konto löschen
      await nutzerColl.deleteOne({ email });
      return res.status(500).json({ error: "E-Mail-Versand fehlgeschlagen. Bitte später erneut versuchen." });
    }

  } catch (err) {
    console.error("❌ Fehler bei Registrierung:", err);
    return res.status(500).json({ error: "Interner Serverfehler." });
  }
});


// === Login-Route mit MongoDB (plain + bcrypt unterstützt) ===
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

    // Passwort prüfen (sanfte Migration auf bcrypt)
    let passOK = false;
    if (typeof user.password === "string" && user.password.startsWith("$2")) {
      passOK = await bcrypt.compare(password, user.password);
    } else {
      passOK = user.password === password;
      if (passOK) {
        // ✅ sofortige Migration auf Hash
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

    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    const isSecureCookie = baseUrl.startsWith("https") || process.env.NODE_ENV === "production";

    // Sichere Session-Cookies setzen
    res.cookie("nutzer", JSON.stringify({
      id: user.id,
      role: user.role || "privat",
      email: user.email
    }), {
      httpOnly: true,
      sameSite: "Lax",
      secure: isSecureCookie,
      maxAge: 1000 * 60 * 60 * 24,
      path: "/"
    });

    // Optional (nur falls Frontend es wirklich nutzt)
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

// Meine veröffentlichten Inserate (nur eigene) – für übersicht.html
app.get("/meine-inserate", checkLogin, async (req, res) => {
  try {
    const userId = req.nutzer.id;
    const inserate = await db.collection("inserate")
      .find({ verkaeuferId: userId })     // ggf. zusätzlich { status: "online" }
      .sort({ veroeffentlichtAm: -1, _id: -1 })
      .toArray();
    res.json(inserate);
  } catch (err) {
    console.error("❌ Fehler bei /meine-inserate:", err);
    res.status(500).json({ error: "Fehler beim Laden der veröffentlichten Inserate." });
  }
});

// === Nutzer-Info aus Cookie ===
app.get("/getNutzerInfo", async (req, res) => {
  try {
    const cookie = req.cookies.nutzer;
    if (!cookie) return res.json({ eingeloggt: false });

    let nutzer;
    try {
      nutzer = JSON.parse(cookie);
    } catch {
      return res.json({ eingeloggt: false });
    }
    if (!nutzer?.id) return res.json({ eingeloggt: false });

    const nutzerColl = db.collection("nutzer");
    const user = await nutzerColl.findOne(
      { id: nutzer.id },
      { projection: { id: 1, role: 1, name: 1, firma: 1 } }
    );
    if (!user) return res.json({ eingeloggt: false });

    return res.json({
      eingeloggt: true,
      nutzerId: user.id,
      rolle: user.role || "privat",
      name: user.name || user.firma || "Unbekannt"
    });
  } catch (err) {
    console.error("❌ Fehler bei getNutzerInfo:", err);
    return res.status(500).json({ error: "Interner Serverfehler." });
  }
});




// === Händlerregistrierung mit MongoDB (mit Template-Mail) ===
app.post("/haendler-registrieren", async (req, res) => {
  const {
    firma, strasse, hausnummer, plz, ort, land, telefon, telefon2,
    email, whatsapp, tarif, zahlungsmethode, kontoinhaber, iban, bic,
    impressum, agb, datenschutz, password, confirmPassword
    // role  ⬅️ wird NICHT aus dem Body übernommen (Sicherheitsrisiko)
  } = req.body;

  // Normalisierung / Sanitizing
  const _firma = (firma || "").trim();
  const _email = (email || "").trim().toLowerCase();
  const _strasse = (strasse || "").trim();
  const _hausnummer = (hausnummer || "").trim();
  const _plz = (plz || "").trim();
  const _ort = (ort || "").trim();
  const _land = (land || "").trim();
  const _telefon = (telefon || "").trim();
  const _telefon2 = (telefon2 || "").trim();
  const _tarif = (tarif || "").trim();
  const _zahlungsmethode = (zahlungsmethode || "").trim();
  const _kontoinhaber = (kontoinhaber || "").trim();
  const _iban = (iban || "").replace(/\s+/g, "").toUpperCase();
  const _bic = (bic || "").replace(/\s+/g, "").toUpperCase();
  const _impressum = (impressum || "").trim();
  const _whatsapp =
    whatsapp === true || whatsapp === "true" || whatsapp === "on" || whatsapp === 1 || whatsapp === "1";

  // Pflichtfelder + Basis-Checks
  if (!_firma || !_email || !password || !agb || !datenschutz) {
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

    const existiert = await nutzerColl.findOne({ email: _email });
    if (existiert) {
      return res.status(400).json({ error: "E-Mail bereits registriert." });
    }

    const token = crypto.randomBytes(20).toString("hex");
    const hash = await bcrypt.hash(password, 12);

    const neuerHaendler = {
      id: Date.now().toString(),
      role: "haendler",           // ⬅️ fest vorgegeben
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
      agb: !!agb,
      datenschutz: !!datenschutz,
      // Auth
      password: hash              // ✅ gehasht
    };

    await nutzerColl.insertOne(neuerHaendler);

    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    const verifyLink = `${baseUrl}/verify?token=${token}`;
    const logoUrl = `${baseUrl}/${encodeURIComponent("AUTOVISA LOGO.PNG")}`;

    const subject = "Bitte bestätigen Sie Ihre Händlerregistrierung";
    const html = buildAutovisaEmail({
      subject,
      logoUrl,
      greeting: `Hallo ${_firma},`,
      title: "Händlerkonto bestätigen",
      htmlText: "Bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Händlerkonto zu aktivieren.",
      buttonText: "Händlerkonto bestätigen",
      buttonUrl: verifyLink,
      footerNote: "Wenn Sie sich nicht bei Autovisa registriert haben, können Sie diese E-Mail ignorieren."
    });
    const text =
`Hallo ${_firma},
bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Händlerkonto bei Autovisa zu aktivieren:
${verifyLink}

Wenn Sie sich nicht registriert haben, ignorieren Sie diese E-Mail.`;

    const mailOptions = {
      from: `"Autovisa" <${smtpUser}>`,
      to: _email,
      subject,
      html,
      text
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Händler-Mail gesendet:", info.response);
      return res.json({ success: true, message: "Händlerregistrierung erfolgreich. E-Mail wurde versendet." });
    } catch (mailErr) {
      console.error("❌ SMTP-Fehler beim Senden (Händler):", mailErr);
      // Aufräumen, damit kein unbestätigter Account ohne Mail hängen bleibt
      await nutzerColl.deleteOne({ email: _email });
      return res.status(500).json({ error: "E-Mail-Versand fehlgeschlagen. Bitte später erneut versuchen." });
    }

  } catch (err) {
    console.error("❌ Fehler bei /haendler-registrieren:", err);
    return res.status(500).json({ error: "Interner Fehler bei der Registrierung." });
  }
});

// === ✅ Verifikations-Route ===
app.get("/verify", async (req, res) => {
  const { token } = req.query;
  if (!token || typeof token !== "string") {
    return res.status(400).send("❌ Ungültiger oder fehlender Link.");
  }

  try {
    const nutzerColl = db.collection("nutzer");

    // Token suchen
    const user = await nutzerColl.findOne({ token });
    if (!user) {
      return res.status(400).send("❌ Token ungültig oder bereits bestätigt.");
    }

    // Verifizieren & Token entfernen
    await nutzerColl.updateOne(
      { _id: user._id },
      { $set: { verified: true, verifiedAt: new Date() }, $unset: { token: "" } }
    );

    // Schöne Bestätigungsseite
    return res.send(`
      <!doctype html>
      <meta charset="utf-8">
      <title>Verifizierung erfolgreich</title>
      <meta http-equiv="refresh" content="2;url=/login.html">
      <style>
        body{font-family:Arial,Helvetica,sans-serif;background:#f5f8fc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
        .card{background:#fff;padding:24px 28px;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.08);text-align:center}
        h1{margin:0 0 8px;font-size:20px}
        p{margin:0 0 12px;color:#475a6a}
        a.button{display:inline-block;padding:10px 16px;border-radius:8px;background:#00b8a9;color:#fff;text-decoration:none;font-weight:600}
      </style>
      <div class="card">
        <h1>✅ E-Mail bestätigt</h1>
        <p>Dein Konto ist jetzt freigeschaltet.</p>
        <a class="button" href="/login.html">Zum Login</a>
      </div>
    `);
    // Alternativ:
    // return res.redirect("/login.html?verified=1");

  } catch (err) {
    console.error("❌ Fehler bei /verify:", err);
    return res.status(500).send("❌ Interner Fehler bei der Verifikation.");
  }
});

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
    res.json({ success: true });

  } catch (err) {
    console.error("❌ Fehler beim Speichern der Nachricht:", err);
    res.status(500).json({ error: "Fehler beim Speichern der Nachricht." });
  }
});




app.get("/inserat-details/:id", checkLogin, async (req, res) => {
  try {
    const oid = new ObjectId(String(req.params.id));
    const coll = db.collection("inserate"); // ggf. anpassen
    const doc = await coll.findOne({ _id: oid });
    if (!doc) return res.status(404).json({ error: "Nicht gefunden" });

    // Nur das, was die Karte braucht
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
      standort: doc.standort || ""
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

    const lastVehicle = await entwurfColl.findOne({ nutzerId: sellerId }, { sort: { _id: -1 } });
    if (!lastVehicle) return res.status(400).send("Kein Fahrzeug zum Veröffentlichen gefunden.");

    const neuesInserat = {
      ...lastVehicle,
      verkaeuferId: sellerId,
      status: "online",
      veroeffentlichtAm: new Date(),
      verkauf_kurzbeschreibung: getZufaelligeAusstattung(lastVehicle.verkauf_ausstattung || []),
      verkauf_verkaeufer: req.body?.verkauf_verkaeufer || lastVehicle.verkauf_verkaeufer || "Privatverkäufer",
      verkauf_name:       req.body?.name || lastVehicle.verkauf_name || "Unbekannt",
      standort:           (req.body?.plz && req.body?.ort) ? `${req.body.plz} ${req.body.ort}` : (lastVehicle.standort || "Nicht angegeben"),
      telefon:            req.body?.telefon || lastVehicle.telefon || ""
    };

    const locString = (req.body?.plz && req.body?.ort) ? `${req.body.plz} ${req.body.ort}` : (neuesInserat.standort || "");
    if (locString) {
      try {
        const point = await geocodeToPoint(locString);
        if (point) neuesInserat.standortCoords = point; // GeoJSON Point
      } catch (e) { console.warn("Geocoding fehlgeschlagen:", e?.message || e); }
    }

    delete neuesInserat._id;
    await inserateColl.insertOne(neuesInserat);
    await entwurfColl.deleteOne({ _id: lastVehicle._id, nutzerId: sellerId });

    res.send("Inserat erfolgreich veröffentlicht.");
  } catch (err) {
    console.error("❌ Fehler bei /veroeffentlichen:", err);
    res.status(500).send("Fehler beim Veröffentlichen.");
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

    const draft = await entwurfColl.findOne({ _id, nutzerId: sellerId });
    if (!draft) return res.status(404).send("Entwurf nicht gefunden.");

    const neuesInserat = {
      ...draft,
      verkaeuferId: sellerId,
      status: "online",
      veroeffentlichtAm: new Date(),
      verkauf_kurzbeschreibung: getZufaelligeAusstattung(draft.verkauf_ausstattung || []),
      verkauf_verkaeufer: draft.verkauf_verkaeufer || "Privatverkäufer",
      verkauf_name:       draft.verkauf_name || "Unbekannt",
      standort:           draft.standort || "Nicht angegeben",
      telefon:            draft.telefon || ""
    };

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




// ========== ÖFFENTLICHE INSERATE: Für suche.html (Pagination) ==========
app.get("/inserate", async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const skip  = (page - 1) * limit;

    const coll = db.collection("inserate");
    const [items, total] = await Promise.all([
      coll.find({ status: "online" })
          .project({ token: 0, password: 0, iban: 0, bic: 0, kontoinhaber: 0 })
          .sort({ veroeffentlichtAm: -1, _id: -1 })
          .skip(skip).limit(limit).toArray(),
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



// === Logout ===
app.post("/logout", (req, res) => {
  const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
  const isSecureCookie = baseUrl.startsWith("https") || process.env.NODE_ENV === "production";

  res.clearCookie("nutzer", { httpOnly: true, sameSite: "Lax", secure: isSecureCookie, path: "/" });
  res.clearCookie("isLoggedIn", { httpOnly: false, sameSite: "Lax", secure: isSecureCookie, path: "/" });
  res.json({ success: true });
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




// === Helper zum sicheren Regex-Bau ===
const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
       if (cached && Array.isArray(cached.suggestions) && cached.suggestions.length &&
           (Date.now() - new Date(cached.updatedAt).getTime()) < GEO_TTL_MS) {
         setGeoMem(key, cached.suggestions);
         res.set("Cache-Control", "public, max-age=120");
         return res.json({ suggestions: cached.suggestions.slice(0, lim) });
       }
   
       // Helper: Mapper für einheitliches Suggest-Format
       const mapToSuggestion = (postcode, city, state, lat, lon, display) => {
         const label = [postcode, city].filter(Boolean).join(" ") || display || city || postcode || "";
         return {
           value: label,
           label,
           city: city || "",
           postcode: postcode || "",
           state: state || "",
           lat: Number(lat),
           lon: Number(lon)
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
           // NICHT zu hart filtern – Nominatim gibt sehr unterschiedliche Typen zurück
           suggestions = (Array.isArray(arr) ? arr : []).map(it => {
             const a = it.address || {};
             const city = a.city || a.town || a.village || a.hamlet || a.suburb || a.neighbourhood || a.locality || "";
             const postcode = a.postcode || "";
             const state = a.state || a.county || "";
             return mapToSuggestion(postcode, city, state, it.lat, it.lon, it.display_name);
           }).filter(s => s.label); // nur sinnvolle Einträge
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
             suggestions = feats.map(f => {
               const p = f.properties || {};
               // Photon: city kann je nach Objekt in city / name / locality stecken
               const city = p.city || p.name || p.locality || p.town || p.village || "";
               const postcode = p.postcode || "";
               const state = p.state || p.county || p.district || "";
               const [lon, lat] = Array.isArray(f.geometry?.coordinates) ? f.geometry.coordinates : [null, null];
               return mapToSuggestion(postcode, city, state, lat, lon, p.name);
             }).filter(s => s.label);
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
   
   

// === SUCHE: /api/search (inkl. optionalem Geo-Radius) ===
// GET /api/search?marke=Audi&modell=A4,A6&ezFrom=2018-01&km_max=100000&price_max=30000&getriebe=automatik&kraftstoff=diesel&ort=10115%20Berlin&umkreis=50&sort=preis_asc&page=1&limit=20
app.get("/api/search", async (req, res) => {
  try {
    const {
      marke, modell, ezFrom, km_max, price_max,
      getriebe, kraftstoff, sort,
      ort, umkreis,
      page = "1", limit = "20"
    } = req.query;

    const p   = Math.max(parseInt(page, 10)  || 1, 1);
    const lim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (p - 1) * lim;

    const baseMatch = { status: "online" };
    if (marke) {
      baseMatch.marke = { $regex: `^${escapeRegex(marke)}$`, $options: "i" };
    }
    if (modell) {
      const arr = String(modell)
        .split(",")
        .map(m => m.trim())
        .filter(Boolean)
        .map(m => new RegExp(`^${escapeRegex(m)}$`, "i"));
      if (arr.length) baseMatch.modell = { $in: arr };
    }
    if (ezFrom)     baseMatch.erstzulassung      = { $gte: ezFrom };
    if (getriebe)   baseMatch.verkauf_getriebe   = { $regex: `^${escapeRegex(getriebe)}`, $options: "i" };
    if (kraftstoff) baseMatch.verkauf_kraftstoff = { $regex: escapeRegex(kraftstoff),   $options: "i" };

    // Zahlen-Grenzen vorbereiten
    const priceMaxNum = parseInt(price_max, 10);
    const kmMaxNum    = parseInt(km_max, 10);

    // Sortierung (Preis-null nach hinten)
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

    // Preis/KM-Parsing (in beiden Pipelines)
    const parseNumberStages = [
      { $addFields: {
          _preis_raw: {
            $ifNull: [
              "$brutto-preis",
              { $ifNull: [
                "$brutto_preis",
                { $ifNull: [
                  "$verkauf_brutto",
                  { $ifNull: [ "$preis", "$verkauf_preis" ] }
                ] }
              ] }
            ]
          },
          _km_raw: { $ifNull: ["$verkauf_kilometer", { $ifNull: ["$kilometer", "$km"] }] }
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
                  }},
                  find: " ", replacement: ""
                }},
                find: "€", replacement: ""
              }},
              find: ",", replacement: ""
            }
          },
          _km_clean: {
            $replaceAll: {
              input: { $replaceAll: {
                input: { $trim: { input: { $toString: "$_km_raw" } } },
                find: ".", replacement: ""
              }},
              find: " ", replacement: ""
            }
          }
        }
      },
      { $addFields: {
          preis_num: { $convert: { input: "$_preis_clean", to: "int", onError: null, onNull: null } },
          km_num:    { $convert: { input: "$_km_clean",    to: "int", onError: null, onNull: null } }
        }
      }
    ];

    // Grundfilter + optionale Zahlenfilter
    const numberFilterStages = [
      { $match: baseMatch },
      ...(Number.isFinite(priceMaxNum) ? [{ $match: { preis_num: { $ne: null, $lte: priceMaxNum } } }] : []),
      ...(Number.isFinite(kmMaxNum)    ? [{ $match: { km_num:    { $ne: null, $lte: kmMaxNum } } }] : [])
    ];

    // Projektions- und Facet-Teil
    const endStages = [
      ...sortStages,
      {
        $facet: {
          data: [
            { $project: {
                token: 0, password: 0, iban: 0, bic: 0, kontoinhaber: 0,
                _preis_raw: 0, _km_raw: 0, _preis_clean: 0, _km_clean: 0, _preis_null: 0
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

    // Optionaler Geo-Teil
    const ortStr = String(ort || "").trim();
    const umkreisKm = Math.max(parseInt(umkreis, 10) || 0, 0);
    let pipeline;

    if (ortStr) {
      const point = await geocodeToPoint(ortStr);
      if (point) {
        pipeline = [
          { $geoNear: {
              near: point,
              key: "standortCoords",  // <-- GeoJSON Point-Feld, 2dsphere-Index erforderlich
              distanceField: "dist",
              spherical: true,
              ...(umkreisKm > 0 ? { maxDistance: umkreisKm * 1000 } : {})
            }
          },
          ...parseNumberStages,
          ...numberFilterStages,
          ...endStages
        ];
      }
    }

    // Fallback ohne Geo
    if (!pipeline) {
      pipeline = [
        ...parseNumberStages,
        ...numberFilterStages,
        ...endStages
      ];
    }

    const [{ data = [], total = 0 } = {}] =
      await db.collection("inserate").aggregate(pipeline).toArray();

    res.json({ page: p, limit: lim, total, results: data });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Interner Fehler bei der Suche." });
  }
});







