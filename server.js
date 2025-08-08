// === Module & Abhängigkeiten ===
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');

// === Express Initialisierung ===
const app = express();
const PORT = process.env.PORT || 3000;

const bcrypt = require("bcryptjs");

// und dann speichern: password: hashed

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

// === Upload-Verzeichnisse ===
const uploadsBaseDir = path.join(__dirname, 'uploads');
const imagesDir = path.join(uploadsBaseDir, 'images');
const videosDir = path.join(uploadsBaseDir, 'videos');

// === Upload-Ordner erstellen falls nicht vorhanden ===
[uploadsBaseDir, imagesDir, videosDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// === Middleware ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// === Statische Dateien ausliefern ===
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use('/uploads/images', express.static(imagesDir));
app.use('/uploads/videos', express.static(videosDir));

// === Startseite ===
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// === Multer für Medien-Upload ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, imagesDir);
    else if (file.mimetype.startsWith('video/')) cb(null, videosDir);
    else cb(new Error('Nur Bilder und Videos erlaubt.'), null);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${timestamp}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const isValid = file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/");
    cb(null, isValid);
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB
});



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
app.post('/saveDetails', checkLogin, async (req, res) => {
  try {
    const details = req.body;
    const collection = db.collection("fahrzeugeEntwurf");

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
    console.error("❌ Fehler in /saveDetails:", err);
    res.status(500).json({ error: 'Fehler beim Speichern der Details.' });
  }
});

// === Schritt 3: Medien speichern (anhängen statt überschreiben) ===
app.post('/saveMedia', checkLogin, upload.fields([
  { name: 'images', maxCount: 20 },
  { name: 'video', maxCount: 1 }
]), async (req, res) => {
  try {
    const collection = db.collection("fahrzeugeEntwurf");

    // letzten Entwurf des eingeloggten Nutzers holen
    const letzter = await collection.findOne(
      { nutzerId: req.nutzer.id },
      { sort: { _id: -1 } }
    );
    if (!letzter) {
      return res.status(400).json({ error: 'Kein Fahrzeug gefunden.' });
    }

    const files = req.files || {};
    const neueImages = files.images ? files.images.map(f => `/uploads/images/${f.filename}`) : [];
    const neuesVideo = (files.video && files.video[0]) ? `/uploads/videos/${files.video[0].filename}` : null;

    // Nichts hochgeladen? => Nichts überschreiben.
    if (neueImages.length === 0 && !neuesVideo) {
      return res.status(200).json({
        success: true,
        message: 'Keine neuen Dateien – bestehende Medien unverändert.',
        images: letzter.images || [],
        video: letzter.video || null
      });
    }

    // Bilder anhängen (bestehende behalten)
    const mergedImages = Array.isArray(letzter.images)
      ? [...letzter.images, ...neueImages]
      : [...neueImages];

    // Video: wenn ein neues kommt, ersetzen wir das alte (du willst genau 1 Video)
    const updateDoc = {};
    if (neueImages.length > 0) updateDoc.images = mergedImages;
    if (neuesVideo) updateDoc.video = neuesVideo;

    await collection.updateOne(
      { _id: letzter._id },
      { $set: updateDoc }
    );

    return res.json({
      success: true,
      message: 'Medien gespeichert.',
      images: updateDoc.images ?? letzter.images ?? [],
      video: updateDoc.video ?? letzter.video ?? null
    });
  } catch (err) {
    console.error("❌ Fehler beim Speichern der Medien:", err);
    res.status(500).json({ error: 'Fehler beim Speichern der Medien.' });
  }
});


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


// === ❌ Abbrechen-Logik ===
app.post('/abbrechen', async (req, res) => {
  try {
    const collection = db.collection("fahrzeugeEntwurf");
    const letzter = await collection.findOne({}, { sort: { _id: -1 } });

    if (!letzter) return res.json({ message: 'Keine Fahrzeuge vorhanden.' });

    await collection.deleteOne({ _id: letzter._id });
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

// === Fahrzeug veröffentlichen ===
app.post('/veroeffentlichen', async (req, res) => {
  const { verkaeuferId } = req.body;

  if (!verkaeuferId) {
    return res.status(400).send("Verkäufer-ID fehlt.");
  }

  try {
    const entwurfCollection = db.collection("fahrzeugeEntwurf");
    const inserateCollection = db.collection("inserate");

    const lastVehicle = await entwurfCollection.findOne({}, { sort: { _id: -1 } });
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
    await entwurfCollection.deleteOne({ _id: lastVehicle._id });

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
      password, // 🔒 später mit bcrypt hashen!
      verified: false,
      token,
      role: "privat"
    };

    await nutzerColl.insertOne(neuerNutzer);

    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    const verifyLink = `${baseUrl}/verify?token=${token}`;

    const mailOptions = {
      from: '"Autovisa" <autovisa0607@gmail.com>',
      to: email,
      subject: "Bitte bestätige deine Registrierung",
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px;">
          <h2>Willkommen bei Autovisa, ${name}!</h2>
          <p>Klicke auf den folgenden Link, um deine Registrierung zu bestätigen:</p>
          <div style="margin:20px 0;">
            <a href="${verifyLink}" style="display:inline-block;padding:10px 20px;background-color:#00b8a9;color:#fff;text-decoration:none;border-radius:5px;">
              E-Mail bestätigen
            </a>
          </div>
          <p>Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:</p>
          <p style="font-size:12px;color:#555;">${verifyLink}</p>
          <br>
          <p>Dein Autovisa-Team</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Bestätigungsmail gesendet:", info.response);
    res.json({ success: true, message: "E-Mail zur Bestätigung wurde gesendet." });

  } catch (err) {
    console.error("❌ Fehler bei Registrierung:", err);
    res.status(500).json({ error: "Interner Serverfehler." });
  }
});

// === ✅ Verifikations-Route ===
app.get("/verify", async (req, res) => {
  const { token } = req.query;
  if (!token) return res.send("❌ Ungültiger Link.");

  try {
    const nutzerColl = db.collection("nutzer");

    const user = await nutzerColl.findOne({ token });
    if (!user) return res.send("❌ Token ungültig oder bereits bestätigt.");

    await nutzerColl.updateOne(
      { token },
      { $set: { verified: true }, $unset: { token: "" } }
    );

    res.send("✅ Deine E-Mail wurde erfolgreich bestätigt. Du kannst dich jetzt einloggen.");
  } catch (err) {
    console.error("❌ Fehler bei /verify:", err);
    res.status(500).send("❌ Interner Fehler bei der Verifikation.");
  }
});


// === Login-Route mit MongoDB ===
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "❌ E-Mail und Passwort erforderlich." });
  }

  try {
    const nutzerColl = db.collection("nutzer");
    const user = await nutzerColl.findOne({ email, password }); // 🔒 später bcrypt

    if (!user) {
      return res.status(401).json({ error: "❌ E-Mail oder Passwort falsch." });
    }

    if (!user.verified) {
      return res.status(403).json({ error: "❌ Bitte bestätige zuerst deine E-Mail." });
    }

    res.cookie("nutzer", JSON.stringify({
      id: user.id,
      role: user.role || "privat",
      email: user.email
    }), {
      httpOnly: false,
      sameSite: "Lax",
      maxAge: 1000 * 60 * 60 * 24
    });
    
    // === ➡️ Das hier NEU hinzufügen
    res.cookie("isLoggedIn", "true", {
      httpOnly: false,
      sameSite: "Lax",
      maxAge: 1000 * 60 * 60 * 24
    });
    

    res.json({
      success: true,
      role: user.role || "privat",
      id: user.id,
      name: user.name || user.firma || "Unbekannt"
    });

  } catch (err) {
    console.error("❌ Fehler beim Login:", err);
    res.status(500).json({ error: "❌ Interner Serverfehler." });
  }
});

app.get("/getNutzerInfo", async (req, res) => {
  try {
    const cookie = req.cookies.nutzer;
    if (!cookie) return res.json({ eingeloggt: false });

    const nutzer = JSON.parse(cookie);
    if (!nutzer?.id) return res.json({ eingeloggt: false });

    const nutzerColl = db.collection("nutzer");
    const user = await nutzerColl.findOne({ id: nutzer.id });

    if (!user) return res.json({ eingeloggt: false });

    res.json({
      eingeloggt: true,
      nutzerId: user.id,
      rolle: user.role,
      name: user.name || user.firma || "Unbekannt"
    });
  } catch (err) {
    console.error("❌ Fehler bei getNutzerInfo:", err);
    res.status(500).json({ error: "Interner Serverfehler." });
  }
});


// === Händlerregistrierung mit MongoDB ===
app.post("/haendler-registrieren", async (req, res) => {
  const {
    firma, strasse, hausnummer, plz, ort, land, telefon, telefon2,
    email, whatsapp, tarif, zahlungsmethode, kontoinhaber, iban, bic,
    impressum, agb, datenschutz, password, confirmPassword, role
  } = req.body;

  // Pflichtfelder prüfen
  if (!firma || !email || !password || !agb || !datenschutz) {
    return res.status(400).json({ error: "Bitte füllen Sie alle Pflichtfelder aus." });
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
      firma,
      strasse,
      hausnummer,
      plz,
      ort,
      land,
      telefon,
      telefon2,
      email,
      whatsapp: whatsapp === "on",
      tarif,
      zahlungsmethode,
      kontoinhaber,
      iban,
      bic,
      impressum,
      agb,
      datenschutz,
      password, // 🔐 später bcrypt
      verified: false,
      token,
      role
    };

    await nutzerColl.insertOne(neuerHaendler);

    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
    const verifyLink = `${baseUrl}/verify?token=${token}`;

    const mailOptions = {
      from: '"Autovisa" <autovisa0607@gmail.com>',
      to: email,
      subject: "Bitte bestätigen Sie Ihre Händlerregistrierung",
      html: `
        <div style="font-family:Arial,sans-serif;padding:20px;">
          <h2>Herzlich willkommen bei Autovisa, ${firma}!</h2>
          <p>Klicken Sie auf den folgenden Link, um Ihre Registrierung zu bestätigen:</p>
          <div style="margin:20px 0;">
            <a href="${verifyLink}" style="display:inline-block;padding:10px 20px;background-color:#00b8a9;color:#fff;text-decoration:none;border-radius:5px;">
              Händlerkonto bestätigen
            </a>
          </div>
          <p>Falls der Button nicht funktioniert, kopieren Sie diesen Link in den Browser:</p>
          <p style="font-size:12px;color:#555;">${verifyLink}</p>
          <br>
          <p>Ihr Autovisa-Team</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Händler-Mail gesendet:", info.response);

    res.json({ success: true, message: "Händlerregistrierung erfolgreich. E-Mail wurde versendet." });

  } catch (err) {
    console.error("❌ Fehler bei /haendler-registrieren:", err);
    res.status(500).json({ error: "Interner Fehler bei der Registrierung." });
  }
});

// === Händler-Formular anzeigen ===
app.get("/haendler-registrieren", (req, res) => {
  res.sendFile(path.join(__dirname, "händlerformular.html"));
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
  res.clearCookie("nutzer");
  res.json({ success: true });
});

// === Server starten ===
app.listen(PORT, () => {
  console.log(`✅ Server läuft auf Port ${PORT}`);
});
