// === Module & Abhängigkeiten ===
const express = require('express');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');                     // ⬅️ hinzugefügt
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');     // ⬅️ hinzugefügt
const cloudinary = require('cloudinary').v2;
const crypto = require('crypto');

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
    db = client.db('autovisa');
    console.log('✅ MongoDB verbunden');
  })
  .catch(err => {
    console.error('❌ MongoDB-Verbindung fehlgeschlagen:', err);
  });

// === Cloudinary Konfiguration ===
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// === Middleware ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// === Statische Dateien ausliefern ===
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data')));

// === Startseite ===
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// === Multer: In-Memory Storage (wir streamen zu Cloudinary) ===
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/');
    cb(null, ok);
  }
});

// Helper: Datei zu Cloudinary hochladen (stream-basiert)
function uploadToCloudinary(file, { folder, resource_type }) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(file.buffer);
  });
}

// === Schritt 1: Fahrzeugdaten speichern ===
app.post('/saveFahrzeugdaten', checkLogin, async (req, res) => {
  try {
    const daten = req.body;
    const collection = db.collection('fahrzeugeEntwurf');

    const ergebnis = await collection.insertOne({
      ...daten,
      nutzerId: req.nutzer.id,
      erstelltAm: new Date()
    });

    res.json({ success: true, fahrzeugId: ergebnis.insertedId });
  } catch (err) {
    console.error('❌ Fehler bei /saveFahrzeugdaten:', err);
    res.status(500).json({ error: 'Serverfehler beim Speichern.' });
  }
});

// === Schritt 2: Fahrzeugdetails speichern ===
app.post('/saveDetails', checkLogin, async (req, res) => {
  try {
    const details = req.body;
    const collection = db.collection('fahrzeugeEntwurf');

    const letzter = await collection.findOne(
      { nutzerId: req.nutzer.id },
      { sort: { _id: -1 } }
    );
    if (!letzter) return res.status(400).json({ error: 'Kein Fahrzeug gefunden.' });

    await collection.updateOne(
      { _id: letzter._id },
      { $set: details }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Fehler in /saveDetails:', err);
    res.status(500).json({ error: 'Fehler beim Speichern der Details.' });
  }
});

// === Schritt 3: Medien speichern (Cloudinary; Bilder anhängen, Video ersetzen) ===
app.post(
  '/saveMedia',
  checkLogin,
  upload.fields([{ name: 'images', maxCount: 20 }, { name: 'video', maxCount: 1 }]),
  async (req, res) => {
    try {
      const collection = db.collection('fahrzeugeEntwurf');

      // letzten Entwurf des eingeloggten Nutzers holen
      const letzter = await collection.findOne(
        { nutzerId: req.nutzer.id },
        { sort: { _id: -1 } }
      );
      if (!letzter) {
        return res.status(400).json({ error: 'Kein Fahrzeug gefunden.' });
      }

      const files = req.files || {};
      const imageFiles = Array.isArray(files.images) ? files.images : [];
      const videoFile  = Array.isArray(files.video) && files.video[0] ? files.video[0] : null;

      // Ordner nach Nutzer strukturieren (übersichtlich in Cloudinary)
      const baseFolder = `autovisa/${req.nutzer.id}`;

      // 1) Bilder zu Cloudinary (parallel)
      let uploadedImageUrls = [];
      if (imageFiles.length > 0) {
        const uploads = imageFiles.map(f =>
          uploadToCloudinary(f, { folder: `${baseFolder}/images`, resource_type: 'image' })
            .then(r => r.secure_url)
        );
        uploadedImageUrls = await Promise.all(uploads);
      }

      // 2) Video zu Cloudinary (ersetzt vorhandenes)
      let uploadedVideoUrl = null;
      if (videoFile) {
        const r = await uploadToCloudinary(videoFile, {
          folder: `${baseFolder}/videos`,
          resource_type: 'video'
        });
        uploadedVideoUrl = r.secure_url;
      }

      // Nichts neu? -> nichts ändern
      if (uploadedImageUrls.length === 0 && !uploadedVideoUrl) {
        return res.json({
          success: true,
          message: 'Keine neuen Dateien – bestehende Medien unverändert.',
          images: letzter.images || [],
          video:  letzter.video  || null
        });
      }

      // Bilder anhängen, Video ggf. ersetzen
      const updateDoc = {};
      if (uploadedImageUrls.length > 0) {
        const mergedImages = Array.isArray(letzter.images)
          ? [...letzter.images, ...uploadedImageUrls]
          : [...uploadedImageUrls];
        updateDoc.images = mergedImages;
      }
      if (uploadedVideoUrl) updateDoc.video = uploadedVideoUrl;

      await collection.updateOne(
        { _id: letzter._id },
        { $set: updateDoc }
      );

      res.json({
        success: true,
        message: 'Medien gespeichert.',
        images: updateDoc.images ?? letzter.images ?? [],
        video:  updateDoc.video  ?? letzter.video  ?? null
      });
    } catch (err) {
      console.error('❌ Fehler beim Speichern der Medien (Cloudinary):', err);
      res.status(500).json({ error: 'Fehler beim Speichern der Medien.' });
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
    const inserate = await inserateCollection.find({}).toArray();
    res.json(inserate);
  } catch (err) {
    console.error("❌ Fehler beim Laden der veröffentlichten Inserate:", err);
    res.status(500).json({ error: "Fehler beim Laden der veröffentlichten Inserate." });
  }
});

// Erlaubte Ausstattungseinträge für Kurzbeschreibung
const erlaubteAusstattungen = [
  "Gepäckraumabtrennung", "Skisack", "Schiebedach", "Panorama-Dach", "Dachreling",
  "Behindertengerecht", "Taxi", "Winterpaket", "Raucherpaket",
  "Sportpaket", "Sportfahrwerk", "Luftfederung"
];

// Funktion: 3 zufällige erlaubte Ausstattungen auswählen
function getZufaelligeAusstattung(ausstattungArray) {
  if (!Array.isArray(ausstattungArray)) return "Besondere Ausstattung";
  const gefiltert = ausstattungArray.filter(item => erlaubteAusstattungen.includes(item));
  if (gefiltert.length === 0) return "Besondere Ausstattung";
  return gefiltert.sort(() => 0.5 - Math.random()).slice(0, 3).join(" • ");
}

app.post('/veroeffentlichen', checkLogin, async (req, res) => {
  const { verkaeuferId } = req.body;
  if (!verkaeuferId) return res.status(400).send("Verkäufer-ID fehlt.");

  try {
    const entwurfCollection = db.collection("fahrzeugeEntwurf");
    const inserateCollection = db.collection("inserate");

    const lastVehicle = await entwurfCollection.findOne(
      { nutzerId: req.nutzer.id },
      { sort: { _id: -1 } }
    );
    if (!lastVehicle) return res.status(400).send("Kein Fahrzeug zum Veröffentlichen gefunden.");

    const neuesInserat = {
      ...lastVehicle,
      verkaeuferId,
      status: "online",
      verkauf_kurzbeschreibung: getZufaelligeAusstattung(lastVehicle.verkauf_ausstattung || []),
      verkauf_verkaeufer: req.body.verkauf_verkaeufer || "Privatverkäufer",
      verkauf_name: req.body.name || "Unbekannt",
      standort: req.body.plz && req.body.ort ? `${req.body.plz} ${req.body.ort}` : "Nicht angegeben",
      telefon: req.body.telefon || ""
    };

    await inserateCollection.insertOne(neuesInserat);
    await entwurfCollection.deleteOne({ _id: lastVehicle._id, nutzerId: req.nutzer.id });

    res.send("Inserat erfolgreich veröffentlicht.");
  } catch (err) {
    console.error("❌ Fehler bei Veröffentlichung:", err);
    res.status(500).send("Fehler beim Veröffentlichen.");
  }
});


// === 🛡️ Login-Prüfung Middleware ===
app.use(cookieParser());

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
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "autovisa0607@gmail.com",
    pass: "inhnziikdkyqtdmy" // App-spezifisches Passwort
  }
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
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Alle Felder sind erforderlich." });
  }

  try {
    const nutzerColl = db.collection("nutzer");

    const exists = await nutzerColl.findOne({ email });
    if (exists) {
      return res.status(400).json({ error: "E-Mail bereits registriert." });
    }

    const token = crypto.randomBytes(20).toString("hex");
    const neuerNutzer = {
      id: Date.now().toString(),
      name,
      email,
      password, // TODO: später bcrypt
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
      from: '"Autovisa" <autovisa0607@gmail.com>',
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
      // Optionales Aufräumen:
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
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "❌ E-Mail und Passwort erforderlich." });
  }

  try {
    const nutzerColl = db.collection("nutzer");
    const user = await nutzerColl.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "❌ E-Mail oder Passwort falsch." });
    }

    // Passwort prüfen (bietet sanften Übergang auf bcrypt)
    let passOK = false;
    if (typeof user.password === "string" && user.password.startsWith("$2")) {
      // bcrypt-Hash erkannt
      passOK = await bcrypt.compare(password, user.password);
    } else {
      // aktuell noch Klartext
      passOK = user.password === password;
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

    // Optional (Frontend nutzt ohnehin localStorage) – nur lassen, wenn du es wirklich brauchst:
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
    impressum, agb, datenschutz, password, confirmPassword, role
  } = req.body;

  // Pflichtfelder + Basis-Checks
  if (!firma || !email || !password || !agb || !datenschutz) {
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

    const existiert = await nutzerColl.findOne({ email });
    if (existiert) {
      return res.status(400).json({ error: "E-Mail bereits registriert." });
    }

    const token = crypto.randomBytes(20).toString("hex");

    const neuerHaendler = {
      id: Date.now().toString(),
      // Stammdaten
      role: role || "haendler",
      verified: false,
      token,
      createdAt: new Date(),
      // Firma / Kontakt
      firma,
      strasse: strasse || "",
      hausnummer: hausnummer || "",
      plz: plz || "",
      ort: ort || "",
      land: land || "",
      telefon: telefon || "",
      telefon2: telefon2 || "",
      email,
      whatsapp: (whatsapp === true || whatsapp === "true" || whatsapp === "on" || whatsapp === 1),
      // Tarif / Zahlung
      tarif: tarif || "",
      zahlungsmethode: zahlungsmethode || "",
      kontoinhaber: kontoinhaber || "",
      iban: iban || "",
      bic: bic || "",
      // Rechtliches
      impressum: impressum || "",
      agb: !!agb,
      datenschutz: !!datenschutz,
      // Auth (später bcrypt)
      password // TODO: bcrypt.hash(...)
    };

    await nutzerColl.insertOne(neuerHaendler);

    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    const verifyLink = `${baseUrl}/verify?token=${token}`;
    const logoUrl = `${baseUrl}/${encodeURIComponent("AUTOVISA LOGO.PNG")}`;

    const subject = "Bitte bestätigen Sie Ihre Händlerregistrierung";
    const html = buildAutovisaEmail({
      subject,
      logoUrl,
      greeting: `Hallo ${firma},`,
      title: "Händlerkonto bestätigen",
      htmlText: "Bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Händlerkonto zu aktivieren.",
      buttonText: "Händlerkonto bestätigen",
      buttonUrl: verifyLink,
      footerNote: "Wenn Sie sich nicht bei Autovisa registriert haben, können Sie diese E-Mail ignorieren."
    });
    const text =
`Hallo ${firma},
bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Händlerkonto bei Autovisa zu aktivieren:
${verifyLink}

Wenn Sie sich nicht registriert haben, ignorieren Sie diese E-Mail.`;

    const mailOptions = {
      from: '"Autovisa" <autovisa0607@gmail.com>',
      to: email,
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
      await nutzerColl.deleteOne({ email });
      return res.status(500).json({ error: "E-Mail-Versand fehlgeschlagen. Bitte später erneut versuchen." });
    }

  } catch (err) {
    console.error("❌ Fehler bei /haendler-registrieren:", err);
    return res.status(500).json({ error: "Interner Fehler bei der Registrierung." });
  }
});

// === Nachricht senden ===
app.post("/nachricht-senden", async (req, res) => {
  const { senderId, empfaengerId, fahrzeugId, absenderName, nachricht } = req.body;

  if (!senderId || !empfaengerId || !fahrzeugId || !nachricht || !absenderName) {
    return res.status(400).json({ error: "Fehlende Felder." });
  }

  try {
    const nachrichtenColl = db.collection("nachrichten");

    const neueNachricht = {
      id: Date.now().toString(),
      senderId,
      empfaengerId,
      fahrzeugId,
      absenderName,
      nachricht,
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
app.get("/nachrichten/:empfaengerId", async (req, res) => {
  const { empfaengerId } = req.params;

  if (!empfaengerId) return res.status(400).json({ error: "Keine ID übergeben." });

  try {
    const nachrichtenColl = db.collection("nachrichten");
    const empfangene = await nachrichtenColl.find({ empfaengerId }).toArray();
    res.json(empfangene);

  } catch (err) {
    console.error("❌ Fehler beim Abrufen der Nachrichten:", err);
    res.status(500).json({ error: "Fehler beim Abrufen der Nachrichten." });
  }
});

// === Chatverlauf abrufen ===
app.get("/chat", async (req, res) => {
  const { user1, user2, fahrzeugId } = req.query;

  if (!user1 || !user2 || !fahrzeugId) {
    return res.status(400).json({ error: "Unvollständige Anfrage." });
  }

  try {
    const nachrichtenColl = db.collection("nachrichten");

    const verlauf = await nachrichtenColl.find({
      $or: [
        { senderId: user1, empfaengerId: user2 },
        { senderId: user2, empfaengerId: user1 }
      ],
      fahrzeugId
    }).sort({ zeit: 1 }).toArray();

    res.json(verlauf);

  } catch (err) {
    console.error("❌ Fehler beim Abrufen des Chatverlaufs:", err);
    res.status(500).json({ error: "Fehler beim Abrufen des Chatverlaufs." });
  }
});

// === Inserat veröffentlichen ===
app.post("/inserat-veroeffentlichen", async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).send("ID fehlt.");

  try {
    const meineInserate = db.collection("meineInserate");
    const vehicles = db.collection("fahrzeuge");

    const inserat = await meineInserate.findOne({ id });
    if (!inserat) return res.status(404).send("Inserat nicht gefunden.");

    await meineInserate.updateOne({ id }, { $set: { status: "online" } });
    await vehicles.insertOne(inserat);

    res.send("Inserat erfolgreich veröffentlicht.");

  } catch (err) {
    console.error("❌ Fehler beim Veröffentlichen des Inserats:", err);
    res.status(500).send("Fehler beim Veröffentlichen.");
  }
});

// === Online-Fahrzeuge abrufen ===
app.get("/fahrzeuge-online", async (req, res) => {
  try {
    const meineInserate = db.collection("meineInserate");
    const onlineFahrzeuge = await meineInserate.find({ status: "online" }).toArray();
    res.json(onlineFahrzeuge);

  } catch (err) {
    console.error("❌ Fehler beim Abrufen der Online-Fahrzeuge:", err);
    res.status(500).send("Fehler beim Abrufen der Daten.");
  }
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
