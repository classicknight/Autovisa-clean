// 🚨 Abbruch.js – Abbrucherkennung beim Verlassen des Verkaufsprozesses

const path = window.location.pathname;

// 🔍 Seiten, die als neutral gelten (Abbruch)
const isNeutralPage =
  path === "/" ||
  path.endsWith("/index.html") ||
  path.endsWith("/verkaufen.html");

// ❗️haendler.html und privat.html NICHT neutral – sie sind Teil des legitimen Ablaufs

const inseratGestartet = sessionStorage.getItem("inseratGestartet") === "true";

const ref = document.referrer || "";
const kamVomVerkauf = ["fahrzeugdaten.html", "fahrzeugdetails.html", "medien.html"]
  .some(p => ref.includes(p));

const keinReferrer = ref === "";

let hasLocalDraft = false;
try {
  hasLocalDraft = ["fahrzeugdaten", "fahrzeugdetails", "medien", "mediaFiles"]
    .some((key) => Boolean(localStorage.getItem(key)));
} catch {}

const shouldAbort = isNeutralPage && (inseratGestartet || hasLocalDraft || kamVomVerkauf || keinReferrer);

function clearLocalDraft() {
  sessionStorage.removeItem("inseratGestartet");
  sessionStorage.removeItem("hatGespeichert");

  // Lokale Fahrzeugdaten löschen
  try { localStorage.removeItem("fahrzeugdaten"); } catch {}
  try { localStorage.removeItem("fahrzeugdetails"); } catch {}
  try { localStorage.removeItem("medien"); } catch {}
  try { localStorage.removeItem("mediaFiles"); } catch {}
  try { localStorage.removeItem("haendlerSteps"); } catch {}

  // Edit-Flags entfernen
  try { localStorage.removeItem("editMode"); } catch {}
  try { localStorage.removeItem("editInseratId"); } catch {}
  try { sessionStorage.removeItem("editPending"); } catch {}

  // 💥 Details-Felder (Prefix "details_") löschen
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("details_")) {
        localStorage.removeItem(key);
      }
    });
  } catch {}
}

// 🧹 Abbruchbedingung: neutrale Seite + Prozess gestartet oder lokale Daten vorhanden
if (shouldAbort) {
  clearLocalDraft();
  fetch("/abbrechen", { method: "POST" })
    .then(() => {
      console.log("🧹 Abbruch erkannt – Fahrzeugdaten werden gelöscht.");
    })
    .catch((err) => console.error("❌ Fehler beim Abbruch-Löschen:", err));
}

// ⏱️ Sicherheitshalber: Marker zurücksetzen
setTimeout(() => {
  sessionStorage.removeItem("hatGespeichert");
}, 2000);
