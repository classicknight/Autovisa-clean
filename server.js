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
  .then(() => {
    db = client.db("autovisa");
    console.log("✅ MongoDB verbunden");
  })
  .catch(err => {
    console.error("❌ MongoDB-Verbindung fehlgeschlagen:", err);
  });

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

// ========== VERÖFFENTLICHEN: Wizard/Vorschau (nimmt den letzten Entwurf des eingeloggten Nutzers) ==========
app.post("/veroeffentlichen", checkLogin, async (req, res) => {
  try {
    const sellerId = req.nutzer?.id;
    if (!sellerId) return res.status(401).send("Nicht eingeloggt.");

    const entwurfColl  = db.collection("fahrzeugeEntwurf");
    const inserateColl = db.collection("inserate");

    // letzten Entwurf holen
    const lastVehicle = await entwurfColl.findOne(
      { nutzerId: sellerId },
      { sort: { _id: -1 } }
    );
    if (!lastVehicle) return res.status(400).send("Kein Fahrzeug zum Veröffentlichen gefunden.");

    const neuesInserat = {
      ...lastVehicle,
      verkaeuferId: sellerId,
      status: "online",
      veroeffentlichtAm: new Date(),
      verkauf_kurzbeschreibung: getZufaelligeAusstattung(lastVehicle.verkauf_ausstattung || []),
      // Werte aus Request als Fallback erlaubt – ansonsten Draft-Werte oder Defaults
      verkauf_verkaeufer: req.body?.verkauf_verkaeufer || lastVehicle.verkauf_verkaeufer || "Privatverkäufer",
      verkauf_name:       req.body?.name || lastVehicle.verkauf_name || "Unbekannt",
      standort:           (req.body?.plz && req.body?.ort) ? `${req.body.plz} ${req.body.ort}` : (lastVehicle.standort || "Nicht angegeben"),
      telefon:            req.body?.telefon || lastVehicle.telefon || ""
    };

    await inserateColl.insertOne(neuesInserat);
    await entwurfColl.deleteOne({ _id: lastVehicle._id, nutzerId: sellerId });

    res.send("Inserat erfolgreich veröffentlicht.");
  } catch (err) {
    console.error("❌ Fehler bei /veroeffentlichen:", err);
    res.status(500).send("Fehler beim Veröffentlichen.");
  }
});


// ========== VERÖFFENTLICHEN: Aus der Übersicht (konkrete Entwurfs-ID aus fahrzeugeEntwurf) ==========
app.post("/inserat-veroeffentlichen", checkLogin, async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).send("ID fehlt.");

  let _id;
  try {
    _id = new ObjectId(id);
  } catch {
    return res.status(400).send("Ungültige ID.");
  }

  try {
    const sellerId      = req.nutzer?.id;
    const entwurfColl   = db.collection("fahrzeugeEntwurf"); // <-- Quelle: Entwürfe
    const inserateColl  = db.collection("inserate");         // <-- Ziel: öffentlich

    // Entwurf prüfen (Besitz + Existenz)
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

// === SUCHE: /api/search ===
// GET /api/search?marke=Audi&modell=A4,A6&ezFrom=2018-01&km_max=100000&price_max=30000&getriebe=automatik&kraftstoff=diesel&sort=preis_asc&page=1&limit=20
app.get("/api/search", async (req, res) => {
  try {
    const {
      marke,
      modell,           // kommasepariert
      ezFrom,           // 'YYYY-MM'
      km_max,
      price_max,
      getriebe,         // 'manuell' | 'automatik'
      kraftstoff,       // 'benzin' | 'diesel' | 'elektro' | 'hybrid' | ...
      // ort, umkreis    // TODO: Geokodierung (derzeit ignoriert)
      sort,             // 'preis_asc' | 'preis_desc' | 'neueste'
      page = "1",
      limit = "20",
    } = req.query;

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const lim = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (p - 1) * lim;

    // String-Matches
    const baseMatch = {};
    if (marke) {
      baseMatch.marke = { $regex: `^${escapeRegex(marke)}$`, $options: "i" };
    }
    if (modell) {
      const arr = String(modell)
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean)
        .map((m) => new RegExp(`^${escapeRegex(m)}$`, "i"));
      if (arr.length) baseMatch.modell = { $in: arr };
    }
    if (ezFrom) {
      // 'erstzulassung' im Format 'YYYY-MM'
      baseMatch.erstzulassung = { $gte: ezFrom };
    }
    if (getriebe) {
      baseMatch.verkauf_getriebe = { $regex: `^${escapeRegex(getriebe)}`, $options: "i" };
    }
    if (kraftstoff) {
      // enthält 'hybrid', 'benzin', 'diesel', 'elektro' etc.
      baseMatch.verkauf_kraftstoff = { $regex: escapeRegex(kraftstoff), $options: "i" };
    }

    // Aggregation: numerische Felder sicher casten
    const pipeline = [
      {
        $addFields: {
          preis_num: {
            $toInt: {
              $ifNull: ["$brutto-preis", "$preis"], // nimm brutto, sonst preis
            },
          },
          km_num: {
            $toInt: { $ifNull: ["$verkauf_kilometer", "$kilometer", "$km"] },
          },
        },
      },
      { $match: baseMatch },
    ];

    // Zahlen-Grenzen
    if (price_max) {
      pipeline.push({
        $match: { $expr: { $lte: ["$preis_num", parseInt(price_max, 10)] } },
      });
    }
    if (km_max) {
      pipeline.push({
        $match: { $expr: { $lte: ["$km_num", parseInt(km_max, 10)] } },
      });
    }

    // Sortierung
    if (sort === "preis_asc") {
      pipeline.push({ $sort: { preis_num: 1, _id: -1 } });
    } else if (sort === "preis_desc") {
      pipeline.push({ $sort: { preis_num: -1, _id: -1 } });
    } else {
      // "neueste" oder default: neueste zuerst (falls es createdAt gibt, sonst _id)
      pipeline.push({ $sort: { createdAt: -1, _id: -1 } });
    }

    // Pagination + Count
    pipeline.push(
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: lim }],
          total: [{ $count: "count" }],
        },
      },
      {
        $project: {
          data: 1,
          total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
        },
      }
    );

    const cursor = db.collection("fahrzeuge").aggregate(pipeline);
    const [{ data, total } = { data: [], total: 0 }] = await cursor.toArray();

    res.json({
      page: p,
      limit: lim,
      total,
      results: data,
    });
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Interner Fehler bei der Suche." });
  }
});




