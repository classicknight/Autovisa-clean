
// 📌 IDs der relevanten Felder für den Fortschritt
const relevanteFelder = [
  "zustand","fahrzeugart","halter","fahrtauglich","beschaedigt","unfall",
  "tuevMonat","tuevJahr","karosseriefarbe","innenmaterial","innenfarbe",
  "airbags","scheinwerfer","tagfahrlicht","kurvenlicht","klimatisierung",
  "pannenhilfe","anhaengerkupplung"
];

// 📊 Fortschrittsbalken aktualisieren
function updateProgressBar() {
  const total = relevanteFelder.length;
  let gueltig = 0;

  relevanteFelder.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const value = el.value;
    if (el.tagName === "SELECT" && value !== "") gueltig++;
    else if (el.tagName === "INPUT" && value.trim() !== "") gueltig++;
  });

  const prozent = Math.round((gueltig / total) * 100);
  const bar = document.getElementById("progress-bar");
  if (bar) bar.style.width = `${prozent}%`;
}

window.addEventListener("DOMContentLoaded", async () => {
  // 🔐 Login via Backend prüfen (httpOnly-Cookie!)
  try {
    const info = await fetch("/getNutzerInfo", { credentials: "include" }).then(r => r.json());
    if (!info?.eingeloggt) {
      localStorage.setItem("redirectAfterLogin", "fahrzeugdetails.html");
      window.location.href = "login.html";
      return;
    }
  } catch {
    localStorage.setItem("redirectAfterLogin", "fahrzeugdetails.html");
    window.location.href = "login.html";
    return;
  }

  // Formular holen
  const form = document.getElementById("fahrzeugForm");
  if (!form) return; // Safety
  const KEY_PREFIX = "details_";

  // Felder initial befüllen aus localStorage + Progress-Events setzen
  const fields = form.querySelectorAll("input, select, textarea");
  fields.forEach(field => {
    if (field.name) {
      const savedValue = localStorage.getItem(KEY_PREFIX + field.name);
      if (savedValue !== null) {
        if (field.type === "checkbox") field.checked = savedValue === "true";
        else field.value = savedValue;
      }
    }
    if (relevanteFelder.includes(field.id)) {
      field.addEventListener("change", updateProgressBar);
      field.addEventListener("input", updateProgressBar);
    }
  });
  updateProgressBar();

  // Ausstattung-Keys (für Labels sammeln)
  const ausstattungsKeys = [
    "ausstattung_abstandsregeltempomat","ausstattung_applecarplay","ausstattung_androidauto",
    "ausstattung_frontscheibenheizung","ausstattung_heckklappe","ausstattung_led",
    "ausstattung_multifunktion","ausstattung_navigation","ausstattung_sitzheizung",
    "ausstattung_rueckfahrkamera","ausstattung_nichtraucher","ausstattung_scheckheft",
    "ausstattung_garantie","ausstattung_mettalic","ausstattung_abs","ausstattung_esp",
    "ausstattung_asr","ausstattung_berganfahrassistent","ausstattung_muedigkeitswarner",
    "ausstattung_spurhalteassistent","ausstattung_totwinkelassistent","ausstattung_notbremsassistent",
    "ausstattung_notrufsystem","ausstattung_verkehrszeichenerkennung","ausstattung_isofixhinten",
    "ausstattung_isofixbeifahrer","ausstattung_scheinwerferreinigung","ausstattung_blendfreiesfernlicht",
    "ausstattung_fernlichtassistent","ausstattung_innenspiegelabblendend","ausstattung_nachtsichtassistent",
    "ausstattung_nebelscheinwerfer","ausstattung_lichtsensor","ausstattung_regensensor",
    "ausstattung_alarmanlage","ausstattung_wegfahrsperre","ausstattung_keylesszv",
    "ausstattung_zentralverriegelung","ausstattung_standheizung","ausstattung_frontscheibebeheizbar",
    "ausstattung_lenkradbeheizbar","ausstattung_einparkhilfeselbstlenkend","ausstattung_kamerahinten",
    "ausstattung_kamera360","ausstattung_sitzheizungvorne","ausstattung_sitzheizunghinten",
    "ausstattung_sitzeelektrisch","ausstattung_sportsitze","ausstattung_armlehne",
    "ausstattung_lordosenstuetze","ausstattung_massagesitze","ausstattung_sitzbelueftung",
    "ausstattung_beifahrersitzumklappbar","ausstattung_elektrfensterheber","ausstattung_elektrspiegel",
    "ausstattung_elektheckklappe","ausstattung_servolenkung","ausstattung_ambientebeleuchtung",
    "ausstattung_lederlenkrad","ausstattung_radio","ausstattung_dab","ausstattung_cd","ausstattung_tv",
    "ausstattung_navi","ausstattung_soundsystem","ausstattung_touchscreen","ausstattung_sprachsteuerung",
    "ausstattung_multifunktionslenkrad","ausstattung_freisprecheinrichtung","ausstattung_usb",
    "ausstattung_bluetooth","ausstattung_applecarplay","ausstattung_androidauto","ausstattung_wlan",
    "ausstattung_streaming","ausstattung_induktionsladen","ausstattung_bordcomputer","ausstattung_headup",
    "ausstattung_volldigital","ausstattung_alufelgen","ausstattung_sommerreifen","ausstattung_winterreifen",
    "ausstattung_allwetterreifen","ausstattung_reifendruckkontrolle","ausstattung_winterpaket",
    "ausstattung_raucherpaket","ausstattung_sportpaket","ausstattung_sportfahrwerk","ausstattung_luftfederung",
    "ausstattung_gepaeckabtrennung","ausstattung_skisack","ausstattung_schiebedach","ausstattung_panoramadach",
    "ausstattung_dachreling","ausstattung_behindertengerecht","ausstattung_taxi"
  ];

  // Submit: speichern + Feedback + Step abhaken
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const data = {};
    const allFields = form.querySelectorAll("input, select, textarea");

    allFields.forEach(field => {
      if (!field.name) return;
      if (field.type === "checkbox") {
        data[field.name] = field.checked;
        localStorage.setItem(KEY_PREFIX + field.name, String(field.checked));
      } else {
        data[field.name] = field.value;
        localStorage.setItem(KEY_PREFIX + field.name, field.value);
      }
    });

    // ✅ Ausstattung prüfen & sammeln (Labels)
    const ausgewaehlteAusstattung = [];
    ausstattungsKeys.forEach(key => {
      const cb = form.querySelector(`input[name="${key}"]`);
      if (cb?.checked) {
        const label = cb.nextElementSibling?.textContent?.trim();
        if (label) ausgewaehlteAusstattung.push(label);
      }
    });
    data["ausstattung"] = ausgewaehlteAusstattung;
    localStorage.setItem(KEY_PREFIX + "ausstattung", JSON.stringify(ausgewaehlteAusstattung));

    // Kurzbeschreibung-Auswahl (Whitelist)
    data["verkauf_ausstattung"] = sammleAusstattung();
    localStorage.setItem(KEY_PREFIX + "verkauf_ausstattung", JSON.stringify(data["verkauf_ausstattung"]));

    // ✅ EINPARKHILFE-ZUSAMMENFASSUNG
    const vorne = form.querySelector("input[name='einparkhilfeVorne']")?.checked;
    const hinten = form.querySelector("input[name='einparkhilfeHinten']")?.checked;
    let einparkhilfeText = "";
    if (vorne && hinten) einparkhilfeText = "Vorne & Hinten";
    else if (vorne) einparkhilfeText = "Vorne";
    else if (hinten) einparkhilfeText = "Hinten";
    data["einparkhilfe"] = einparkhilfeText;
    localStorage.setItem(KEY_PREFIX + "einparkhilfe", einparkhilfeText);

    // ✅ HU kombinieren
    const tuevMonat = document.getElementById("tuevMonat")?.value || "";
    const tuevJahr  = document.getElementById("tuevJahr")?.value  || "";
    if (tuevMonat && tuevJahr) {
      const huDatum = `${tuevMonat} ${tuevJahr}`;
      data["verkauf_hu"] = huDatum;
      localStorage.setItem(KEY_PREFIX + "verkauf_hu", huDatum);
    } else {
      data["verkauf_hu"] = "";
      localStorage.setItem(KEY_PREFIX + "verkauf_hu", "");
    }

    // ✅ Fahrzeugbeschreibung übernehmen
    const beschreibung = document.getElementById("fahrzeugbeschreibung")?.value.trim() || "";
    data["fahrzeugbeschreibung"] = beschreibung;
    localStorage.setItem(KEY_PREFIX + "fahrzeugbeschreibung", beschreibung);

    // Speichern am Server
    sessionStorage.setItem("hatGespeichert", "true");

    fetch("/saveDetails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // Cookie mitsenden!
      body: JSON.stringify(data)
    })
      .then(async (res) => {
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(txt || "Fehler beim Speichern der Details.");
        }
        return res.json().catch(() => ({}));
      })
      .then(() => {
        safeMarkStepDone(2);                    // ✅ Schritt 2 als erledigt markieren
        safeToast("Fahrzeugdetails gespeichert ✅");
        const userRole = localStorage.getItem("userRole");
        const ziel = userRole === "haendler" ? "haendler.html" : "privat.html";
        setTimeout(() => { window.location.href = ziel; }, 600);
        // Alternative: direkt zur nächsten Seite → window.location.href = "medien.html";
      })
      .catch(err => {
        console.error("❌ Fehler beim Speichern:", err);
        safeToast("Speichern fehlgeschlagen", "error");
      });
  });

  // 🔁 Nach kurzer Zeit das Flag wieder löschen
  setTimeout(() => {
    sessionStorage.removeItem("hatGespeichert");
  }, 2000);
});

// Whitelist für Kurzbeschreibung
function sammleAusstattung() {
  const erlaubt = [
    { name: "gepaeckabtrennung", label: "Gepäckraumabtrennung" },
    { name: "skisack", label: "Skisack" },
    { name: "schiebedach", label: "Schiebedach" },
    { name: "panoramadach", label: "Panorama-Dach" },
    { name: "dachreling", label: "Dachreling" },
    { name: "behindertengerecht", label: "Behindertengerecht" },
    { name: "taxi", label: "Taxi" },
    { name: "winterpaket", label: "Winterpaket" },
    { name: "raucherpaket", label: "Raucherpaket" },
    { name: "sportpaket", label: "Sportpaket" },
    { name: "sportfahrwerk", label: "Sportfahrwerk" },
    { name: "luftfederung", label: "Luftfederung" },
    { name: "tv", label: "TV" },
    { name: "navi", label: "Navigationssystem" },
    { name: "soundsystem", label: "Soundsystem" },
    { name: "touchscreen", label: "Touchscreen" },
    { name: "sprachsteuerung", label: "Sprachsteuerung" },
    { name: "multifunktionslenkrad", label: "Multifunktionslenkrad" },
    { name: "bluetooth", label: "Bluetooth" },
    { name: "applecarplay", label: "Apple CarPlay" },
    { name: "androidauto", label: "Android Auto" },
    { name: "wlan", label: "WLAN / Wifi Hotspot" },
    { name: "streaming", label: "Musikstreaming integriert" },
    { name: "induktionsladen", label: "Induktionsladen für Smartphones" },
    { name: "bordcomputer", label: "Bordcomputer" },
    { name: "headup", label: "Head-up Display" },
    { name: "volldigital", label: "Volldigitales Kombiinstrument" },
    { name: "alufelgen", label: "Leichtmetallfelgen" },
    { name: "sommerreifen", label: "Sommerreifen" },
    { name: "winterreifen", label: "Winterreifen" },
    { name: "allwetterreifen", label: "Allwetterreifen" }
  ];
  return erlaubt
    .filter(e => document.querySelector(`input[name="${e.name}"]`)?.checked)
    .map(e => e.label);
}

// ===== Fallbacks, falls haendler.js nicht geladen ist =====
function safeToast(message, type = "success") {
  // immer einen Toast-Container haben (passt zu deinem CSS)
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = message;
  container.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    t.addEventListener("transitionend", () => t.remove(), { once: true });
  }, 3000);
}

function safeMarkStepDone(step) {
  // 1) Persistieren, damit haendler.html den Status lesen kann
  try {
    const KEY = "haendlerSteps";
    const obj = JSON.parse(localStorage.getItem(KEY) || "{}");
    obj[String(step)] = true;            // Schritt als erledigt markieren
    localStorage.setItem(KEY, JSON.stringify(obj));
  } catch {}

  // 2) Wenn haendler.js geladen ist, zusätzlich dessen UI-Update nutzen
  if (window.markStepDone) {
    try { window.markStepDone(step); } catch {}
  }
}

