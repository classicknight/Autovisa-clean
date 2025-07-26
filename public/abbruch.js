// 🚨 Abbruch.js – Abbrucherkennung beim Verlassen des Verkaufsprozesses

const path = window.location.pathname;

// 🔍 Seiten, die als neutral gelten (Abbruch)
const isNeutralPage =
  path === "/" ||
  path.endsWith("/index.html") ||
  path.endsWith("/verkaufen.html");

// ❗️haendler.html und privat.html NICHT neutral – sie sind Teil des legitimen Ablaufs

const inseratGestartet = sessionStorage.getItem("inseratGestartet") === "true";
const hatGespeichert = sessionStorage.getItem("hatGespeichert") === "true";

const ref = document.referrer || "";
const kamVomVerkauf = ["fahrzeugdaten.html", "fahrzeugdetails.html", "medien.html"]
  .some(p => ref.includes(p));

const keinReferrer = ref === "";

// 🧹 Abbruchbedingung: neutrale Seite + Prozess wurde gestartet +
// (entweder kein Speicher, oder vorheriger Schritt, oder Ref fehlt)
if (isNeutralPage && inseratGestartet && (!hatGespeichert || kamVomVerkauf || keinReferrer)) {
  fetch("/abbrechen", { method: "POST" })
    .then(() => {
      console.log("🧹 Abbruch erkannt – Fahrzeugdaten werden gelöscht.");
      sessionStorage.removeItem("inseratGestartet");
      sessionStorage.removeItem("hatGespeichert");

      // Lokale Fahrzeugdaten löschen
      localStorage.removeItem("fahrzeugdaten");
      localStorage.removeItem("fahrzeugdetails");
      localStorage.removeItem("mediaFiles");

      // 💥 Details-Felder (Prefix "details_") löschen
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith("details_")) {
          localStorage.removeItem(key);
        }
      });
    })
    .catch((err) => console.error("❌ Fehler beim Abbruch-Löschen:", err));
}

// ⏱️ Sicherheitshalber: Marker zurücksetzen
setTimeout(() => {
  sessionStorage.removeItem("hatGespeichert");
}, 2000);
