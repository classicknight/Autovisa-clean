const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;


// === Upload-Verzeichnisse vorbereiten ===
const uploadsBaseDir = path.join(__dirname, 'uploads');
const imagesDir = path.join(uploadsBaseDir, 'images');
const videosDir = path.join(uploadsBaseDir, 'videos');
const vehiclesPath = path.join(__dirname, 'vehicles.json');
const meineInseratePath = path.join(__dirname, 'meineInserate.json');
const nutzerPath = path.join(__dirname, 'nutzer.json');



const cookieParser = require("cookie-parser");



const nodemailer = require('nodemailer');



const crypto = require('crypto');







[uploadsBaseDir, imagesDir, videosDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// === Middleware ===
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// === Statische Dateien ausliefern ===
// === Statische Dateien ausliefern ===
app.use(express.static(path.join(__dirname, 'public')));
app.use('/data', express.static(path.join(__dirname, 'data'))); // <--- HIER

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.use('/uploads/images', express.static(imagesDir));
app.use('/uploads/videos', express.static(videosDir));

// === Multer-Konfiguration ===
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
  limits: { fileSize: 50 * 1024 * 1024 }
});

app.post('/saveFahrzeugdaten', (req, res) => {
    const fahrzeugDaten = req.body;
  
    fs.readFile(vehiclesPath, 'utf-8', (err, data) => {
      let vehicles = [];
      if (!err && data) {
        try {
          vehicles = JSON.parse(data);
        } catch {
          return res.status(500).json({ error: 'Fahrzeugdaten konnten nicht verarbeitet werden.' });
        }
      }
  
      // 👇 vorhandene Medien vom letzten Inserat (falls vorhanden)
      const lastVehicle = vehicles[vehicles.length - 1] || {};
      const images = lastVehicle.images || [];
      const video = lastVehicle.video || null;
  
      // 👇 Neues Fahrzeugobjekt erzeugen
      const newVehicle = {
        id: Date.now().toString(),
        ...fahrzeugDaten,
        images,
        video
      };
  
      // 👇 Entweder ersetzen oder neu hinzufügen
      if (vehicles.length > 0 && !lastVehicle.titel) {
        vehicles[vehicles.length - 1] = newVehicle;
      } else {
        vehicles.push(newVehicle);
      }
  
      fs.writeFile(vehiclesPath, JSON.stringify(vehicles, null, 2), err => {
        if (err) return res.status(500).json({ error: 'Fehler beim Speichern.' });
        res.json({ success: true });
      });
    });
  });
  
  

// === 🧾 Schritt 2: Fahrzeugdetails speichern ===
app.post('/saveDetails', (req, res) => {
  const details = req.body;

  fs.readFile(vehiclesPath, 'utf-8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Fehler beim Lesen.' });

    let vehicles = [];
    try {
      vehicles = JSON.parse(data);
    } catch {
      return res.status(500).json({ error: 'Fehler beim Verarbeiten.' });
    }

    if (vehicles.length === 0) return res.status(400).json({ error: 'Kein Fahrzeug gefunden.' });

    vehicles[vehicles.length - 1] = {
      ...vehicles[vehicles.length - 1],
      ...details
    };

    fs.writeFile(vehiclesPath, JSON.stringify(vehicles, null, 2), err => {
      if (err) return res.status(500).json({ error: 'Fehler beim Speichern.' });
      res.json({ success: true });
    });
  });
});

// === 📷🎥 Schritt 3: Medien speichern ===
app.post('/saveMedia', upload.fields([
  { name: 'images', maxCount: 20 },
  { name: 'video', maxCount: 1 }
]), (req, res) => {
  const files = req.files;
  if (!files || (!files.images && !files.video)) {
    return res.status(400).json({ error: 'Keine Mediendateien hochgeladen.' });
  }

  const imageUrls = files.images ? files.images.map(file => `/uploads/images/${file.filename}`) : [];
  const videoUrl = files.video && files.video.length > 0 ? `/uploads/videos/${files.video[0].filename}` : null;

  fs.readFile(vehiclesPath, 'utf-8', (err, data) => {
    let vehicles = [];
    if (!err && data) {
      try {
        vehicles = JSON.parse(data);
      } catch {
        return res.status(500).json({ error: 'Fehler beim Verarbeiten.' });
      }
    }

    if (vehicles.length === 0) return res.status(400).json({ error: 'Kein Fahrzeug gefunden.' });

    vehicles[vehicles.length - 1] = {
      ...vehicles[vehicles.length - 1],
      images: imageUrls,
      video: videoUrl
    };

    fs.writeFile(vehiclesPath, JSON.stringify(vehicles, null, 2), err => {
      if (err) return res.status(500).json({ error: 'Fehler beim Speichern der Medien.' });
      res.json({ success: true });
    });
  });
});

// === Vorschau ===
app.get('/getVehicleData', (req, res) => {
  fs.readFile(vehiclesPath, 'utf-8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Fehler beim Laden der Daten.' });

    try {
      const vehicles = JSON.parse(data);
      res.json(vehicles);
    } catch {
      res.status(500).json({ error: 'Fehler beim Verarbeiten.' });
    }
  });
});

// === ❌ Abbrechen ===
app.post('/abbrechen', (req, res) => {
  fs.readFile(vehiclesPath, 'utf-8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Fehler beim Lesen.' });

    let vehicles = [];
    try {
      if (data) vehicles = JSON.parse(data);
    } catch {
      return res.status(500).json({ error: 'Fehler beim Verarbeiten.' });
    }

    if (vehicles.length > 0) {
      vehicles.pop();
      fs.writeFile(vehiclesPath, JSON.stringify(vehicles, null, 2), err => {
        if (err) return res.status(500).json({ error: 'Fehler beim Löschen.' });
        res.json({ success: true });
      });
    } else {
      res.json({ message: 'Keine Fahrzeuge vorhanden.' });
    }
  });
});






const tarifPath = path.join(__dirname, "nutzerTarif.json");


// Tarif speichern
app.post("/saveTarif", (req, res) => {
  const { tarif } = req.body;

  if (!tarif) {
    return res.status(400).json({ error: "❌ Kein Tarif angegeben." });
  }

  fs.writeFile(tarifPath, JSON.stringify({ tarif }, null, 2), (err) => {
    if (err) {
      console.error("❌ Fehler beim Speichern des Tarifs:", err);
      return res.status(500).json({ error: "Fehler beim Speichern des Tarifs." });
    }

    console.log("✅ Tarif erfolgreich gespeichert:", tarif);
    res.json({ success: true });
  });
});

// Tarif abrufen
app.get("/getTarif", (req, res) => {
  fs.readFile(tarifPath, "utf8", (err, data) => {
    if (err) {
      if (err.code === "ENOENT") {
        // Datei existiert noch nicht → Default-Wert zurückgeben
        return res.json({ tarif: "" });
      }

      console.error("❌ Fehler beim Laden der Tarifdatei:", err);
      return res.status(500).json({ error: "Fehler beim Laden der Tarifdatei." });
    }

    try {
      const parsed = JSON.parse(data);
      res.json({ tarif: parsed.tarif || "" });
    } catch (parseError) {
      console.error("❌ Fehler beim Verarbeiten des Tarifs:", parseError);
      res.status(500).json({ error: "Fehler beim Verarbeiten." });
    }
  });
});

// === Übersicht: veröffentlichte Inserate laden ===
app.get("/meineInserate.json", (req, res) => {
    fs.readFile(meineInseratePath, "utf-8", (err, data) => {
      if (err) {
        console.error("❌ Fehler beim Laden von meineInserate.json:", err);
        return res.status(500).json({ error: "Fehler beim Laden der veröffentlichten Inserate." });
      }
  
      try {
        const inserate = JSON.parse(data);
        res.json(inserate);
      } catch (parseError) {
        console.error("❌ Fehler beim Verarbeiten von meineInserate.json:", parseError);
        res.status(500).json({ error: "Fehler beim Verarbeiten." });
      }
    });
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
    "Luftfederung"
  ];
  
  
  // Funktion: 3 zufällige erlaubte Ausstattungen auswählen
  function getZufaelligeAusstattung(ausstattungArray) {
    if (!Array.isArray(ausstattungArray)) return "Besondere Ausstattung";
    const gefiltert = ausstattungArray.filter(item =>
      erlaubteAusstattungen.includes(item)
    );
    if (gefiltert.length === 0) return "Besondere Ausstattung";
    return gefiltert.sort(() => 0.5 - Math.random()).slice(0, 3).join(" • ");
  }
  app.post('/veroeffentlichen', (req, res) => {
    const { verkaeuferId } = req.body;
  
    if (!verkaeuferId) {
      return res.status(400).send("Verkäufer-ID fehlt.");
    }
  
    fs.readFile(vehiclesPath, 'utf-8', (err, data) => {
      if (err) return res.status(500).send("Fehler beim Lesen von vehicles.json");
  
      let vehicles = [];
      try {
        vehicles = JSON.parse(data);
      } catch {
        return res.status(500).send("Fehler beim Verarbeiten von vehicles.json");
      }
  
      const lastVehicle = vehicles[vehicles.length - 1];
      if (!lastVehicle) return res.status(400).send("Kein Fahrzeug zum Veröffentlichen gefunden.");
  
      // Verkäufer-ID und Status hinzufügen
      lastVehicle.verkaeuferId = verkaeuferId;
      lastVehicle.status = "online";
  
      // Kurzbeschreibung aus Ausstattung
      lastVehicle.verkauf_kurzbeschreibung = getZufaelligeAusstattung(lastVehicle.verkauf_ausstattung || []);
  
      // Felder aus dem Body übernehmen
      lastVehicle.verkauf_verkaeufer = req.body.verkauf_verkaeufer || "Privatverkäufer";
      lastVehicle.verkauf_name = req.body.name || "Unbekannt";
      lastVehicle.standort = req.body.plz && req.body.ort ? `${req.body.plz} ${req.body.ort}` : "Nicht angegeben";
      lastVehicle.telefon = req.body.telefon || ""; // ← NEU: Telefonnummer speichern
  
      // In meineInserate.json schreiben
      fs.readFile(meineInseratePath, 'utf-8', (err2, inserateData) => {
        let inserate = [];
        if (!err2 && inserateData) {
          try {
            inserate = JSON.parse(inserateData);
          } catch {
            return res.status(500).send("Fehler beim Verarbeiten von meineInserate.json");
          }
        }
  
        inserate.push(lastVehicle);
  
        fs.writeFile(meineInseratePath, JSON.stringify(inserate, null, 2), (err3) => {
          if (err3) return res.status(500).send("Fehler beim Speichern in meineInserate.json");
  
          // Aus vehicles.json entfernen (Pop)
          vehicles.pop();
          fs.writeFile(vehiclesPath, JSON.stringify(vehicles, null, 2), (err4) => {
            if (err4) return res.status(500).send("Fehler beim Entfernen aus vehicles.json");
  
            res.send("Inserat erfolgreich veröffentlicht.");
          });
        });
      });
    });
  });
  
  
  


app.use(cookieParser());
  

 

// Login-Prüfung
function checkLogin(req, res, next) {
  try {
    const cookie = req.cookies.nutzer;
    if (!cookie) return res.status(401).json({ error: "Nicht eingeloggt." });

    const nutzer = JSON.parse(cookie);
    if (!nutzer?.id) return res.status(401).json({ error: "Ungültiger Login." });

    req.nutzer = nutzer;
    next();
  } catch {
    return res.status(401).json({ error: "Ungültiger Login." });
  }
}



 
// === E-Mail Transporter konfigurieren ===
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "autovisa0607@gmail.com",
      pass: "inhnziikdkyqtdmy" // App-Passwort
    }
  });
  

  transporter.verify((error, success) => {
    if (error) {
      console.error("❌ SMTP-Fehler:", error);
    } else {
      console.log("✅ SMTP bereit:", success);
    }
  });
  

  
  // === Registrierung mit E-Mail-Bestätigung ===
  app.post("/register", async (req, res) => {
    const { name, email, password } = req.body;
  
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Alle Felder sind erforderlich." });
    }
  
    let nutzer = [];
    if (fs.existsSync(nutzerPath)) {
      nutzer = JSON.parse(fs.readFileSync(nutzerPath));
      if (nutzer.find(n => n.email === email)) {
        return res.status(400).json({ error: "E-Mail bereits registriert." });
      }
    }
  
    const token = crypto.randomBytes(20).toString("hex");
    const neuerNutzer = {
        id: Date.now().toString(),  // ✅ Einzigartige ID hinzufügen
        name,
        email,
        password, // 🔒 später hashen!
        verified: false,
        token,
        role: "privat"
      };
      
  
    nutzer.push(neuerNutzer);
    fs.writeFileSync(nutzerPath, JSON.stringify(nutzer, null, 2));
  
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
  
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Bestätigungsmail gesendet:", info.response);
      res.json({ success: true, message: "E-Mail zur Bestätigung wurde gesendet." });
    } catch (error) {
      console.error("❌ Fehler beim E-Mail-Versand:", error);
      res.status(500).json({ error: "Die E-Mail konnte nicht gesendet werden." });
    }
  });
  
  
  
  
  // === Verifikations-Route ===
  app.get("/verify", (req, res) => {
    const { token } = req.query;
    if (!token) return res.send("Ungültiger Link.");
  
    let nutzer = [];
    if (fs.existsSync(nutzerPath)) {
      nutzer = JSON.parse(fs.readFileSync(nutzerPath));
    }
  
    const user = nutzer.find(n => n.token === token);
    if (!user) return res.send("Token ungültig oder bereits bestätigt.");
  
    user.verified = true;
    user.token = null;
    fs.writeFileSync(nutzerPath, JSON.stringify(nutzer, null, 2));
  
    res.send("✅ Deine E-Mail wurde erfolgreich bestätigt. Du kannst dich jetzt einloggen.");
  });
  
 // === Login-Route ===
app.post("/login", (req, res) => {
    const { email, password } = req.body;
  
    if (!email || !password) {
      return res.status(400).json({ error: "E-Mail und Passwort erforderlich." });
    }
  
    let nutzer = [];
    if (fs.existsSync(nutzerPath)) {
      nutzer = JSON.parse(fs.readFileSync(nutzerPath));
    }
  
    const user = nutzer.find(n => n.email === email && n.password === password);
  
    if (!user) {
      return res.status(401).json({ error: "E-Mail oder Passwort falsch." });
    }
  
    if (!user.verified) {
      return res.status(403).json({ error: "Bitte bestätige zuerst deine E-Mail." });
    }
  
    res
      .cookie("nutzer", JSON.stringify({
        id: user.id,
        role: user.role || "privat",
        email: user.email
      }), {
        httpOnly: false,           // ✅ Zugriff aus JavaScript erlauben
        sameSite: "Lax",           // ✅ CSRF-Schutz bei Bedarf (optional)
        maxAge: 1000 * 60 * 60 * 24 // 1 Tag gültig
      })
      .json({ success: true, role: user.role || "privat" });
  });
  
  
  // === Login-Zustand prüfen (für Frontend) ===
  app.get("/getNutzerInfo", (req, res) => {
    try {
      const nutzer = JSON.parse(req.cookies.nutzer || null);
      if (!nutzer?.id) return res.json({ eingeloggt: false });
      res.json({ eingeloggt: true, nutzer });
    } catch {
      res.json({ eingeloggt: false });
    }
  });
  


  app.post("/haendler-registrieren", async (req, res) => {
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
      role
    } = req.body;
  
    // 🛡 Pflichtfelder prüfen
    if (!firma || !email || !password || !agb || !datenschutz) {
      return res.status(400).json({ error: "Bitte füllen Sie alle Pflichtfelder aus." });
    }
  
    let nutzer = [];
    if (fs.existsSync(nutzerPath)) {
      nutzer = JSON.parse(fs.readFileSync(nutzerPath));
      const existiert = nutzer.find(n => n.email === email);
      if (existiert) {
        return res.status(400).json({ error: "E-Mail bereits registriert." });
      }
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
      whatsapp: whatsapp === "on", // Checkbox aus HTML
      tarif,
      zahlungsmethode,
      kontoinhaber,
      iban,
      bic,
      impressum,
      agb,
      datenschutz,
      password, // 🔐 später mit bcrypt hashen
      verified: false,
      token,
      role
    };
  
    nutzer.push(neuerHaendler);
    fs.writeFileSync(nutzerPath, JSON.stringify(nutzer, null, 2));
  
    const verifyLink = `http://localhost:${PORT}/verify?token=${token}`;
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
  
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Händler-Mail gesendet:", info.response);
      res.json({ success: true, message: "Händlerregistrierung erfolgreich. E-Mail wurde versendet." });
    } catch (error) {
      console.error("❌ Fehler beim Versand der Händler-Mail:", error);
      res.status(500).json({ error: "Fehler beim Senden der Bestätigung." });
    }
  });
  
  app.get("/haendler-registrieren", (req, res) => {
    res.sendFile(path.join(__dirname, "Händlerformular.html"));
  });
  




  const nachrichtenPath = path.join(__dirname, "nachrichten.json");

// Nachricht senden
app.post("/nachricht-senden", (req, res) => {
  const { senderId, empfaengerId, fahrzeugId, absenderName, nachricht } = req.body;

  if (!senderId || !empfaengerId || !fahrzeugId || !nachricht || !absenderName) {
    return res.status(400).json({ error: "Fehlende Felder." });
  }

  let nachrichten = [];
  if (fs.existsSync(nachrichtenPath)) {
    nachrichten = JSON.parse(fs.readFileSync(nachrichtenPath));
  }

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

  nachrichten.push(neueNachricht);
  fs.writeFileSync(nachrichtenPath, JSON.stringify(nachrichten, null, 2));

  res.json({ success: true });
});

// Nachrichten für empfaengerId abrufen
app.get("/nachrichten/:empfaengerId", (req, res) => {
  const { empfaengerId } = req.params;

  if (!empfaengerId) return res.status(400).json({ error: "Keine ID." });

  let nachrichten = [];
  if (fs.existsSync(nachrichtenPath)) {
    nachrichten = JSON.parse(fs.readFileSync(nachrichtenPath));
  }

  const empfangene = nachrichten.filter(n => n.empfaengerId === empfaengerId);
  res.json(empfangene);
});

// Nachrichtenverlauf abrufen für Chat
app.get("/chat", (req, res) => {
  const { user1, user2, fahrzeugId } = req.query;

  if (!user1 || !user2 || !fahrzeugId) {
    return res.status(400).json({ error: "Unvollständige Anfrage." });
  }

  let nachrichten = [];
  if (fs.existsSync(nachrichtenPath)) {
    nachrichten = JSON.parse(fs.readFileSync(nachrichtenPath));
  }

  const verlauf = nachrichten.filter(n =>
    ((n.senderId === user1 && n.empfaengerId === user2) ||
     (n.senderId === user2 && n.empfaengerId === user1)) &&
     n.fahrzeugId === fahrzeugId
  );

  res.json(verlauf);
});





app.post('/inserat-veroeffentlichen', (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).send("ID fehlt.");
  
    fs.readFile(meineInseratePath, 'utf-8', (err, data) => {
      if (err) return res.status(500).send("Fehler beim Lesen von meineInserate.json");
  
      let inserate;
      try {
        inserate = JSON.parse(data);
      } catch {
        return res.status(500).send("Fehler beim Parsen von meineInserate.json");
      }
  
      const inserat = inserate.find(i => i.id === id);
      if (!inserat) return res.status(404).send("Inserat nicht gefunden.");
  
      inserat.status = "online";
  
      // Jetzt in vehicles.json eintragen
      fs.readFile(vehiclesPath, 'utf-8', (err2, fahrzeugData) => {
        let fahrzeuge = [];
        if (!err2 && fahrzeugData) {
          try {
            fahrzeuge = JSON.parse(fahrzeugData);
          } catch {
            return res.status(500).send("Fehler beim Parsen von vehicles.json");
          }
        }
  
        fahrzeuge.push(inserat); // ← in öffentliche Fahrzeuge
        fs.writeFile(vehiclesPath, JSON.stringify(fahrzeuge, null, 2), (err3) => {
          if (err3) return res.status(500).send("Fehler beim Schreiben in vehicles.json");
  
          // Und meineInserate aktualisieren
          fs.writeFile(meineInseratePath, JSON.stringify(inserate, null, 2), (err4) => {
            if (err4) return res.status(500).send("Fehler beim Aktualisieren von meineInserate.json");
  
            res.send("Inserat erfolgreich veröffentlicht.");
          });
        });
      });
    });
  });



  app.get("/fahrzeuge-online", (req, res) => {
    fs.readFile(path.join(__dirname, "meineInserate.json"), "utf-8", (err, data) => {
      if (err) return res.status(500).send("Fehler beim Lesen der Daten.");
      try {
        const fahrzeuge = JSON.parse(data);
        const onlineFahrzeuge = fahrzeuge.filter(fzg => fzg.status === "online");
        res.json(onlineFahrzeuge);
      } catch {
        res.status(500).send("Fehler beim Verarbeiten der Daten.");
      }
    });
  });
  
  
  
 

  app.listen(PORT, () => {
    console.log(`✅ Server läuft auf Port ${PORT}`);
  });
  
  