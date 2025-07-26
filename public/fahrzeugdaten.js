document.addEventListener("DOMContentLoaded", () => {
    const isLoggedIn = localStorage.getItem("userLoggedIn") === "true";
    if (!isLoggedIn) {
      localStorage.setItem("redirectAfterLogin", "fahrzeugdaten.html");
      window.location.href = "login.html";
      return;
    }
  
    // Dein bisheriger Code beginnt hier:
    const referrer = document.referrer || "";
    const aktuelleSeite = window.location.pathname;

  
  
    const kamVonNeutralerSeite = ["index.html", "verkaufen.html"].some(p =>
      referrer.includes(p)
    );
  
    const istZurückVonHaendlerOderPrivat =
      referrer.includes("haendler.html") || referrer.includes("privat.html");
  
    const inseratGestartet = sessionStorage.getItem("inseratGestartet") === "true";
    const hatGespeichert = sessionStorage.getItem("hatGespeichert") === "true";
  
    if (kamVonNeutralerSeite && inseratGestartet && !hatGespeichert) {
        localStorage.removeItem("fahrzeugdaten");
        sessionStorage.removeItem("inseratGestartet");
        console.log("❌ Abbruch erkannt: Fahrzeugdaten gelöscht.");
      }
  
    sessionStorage.setItem("inseratGestartet", "true");
  
    let fahrzeugdaten = {};
    try {
      fahrzeugdaten = JSON.parse(localStorage.getItem("fahrzeugdaten")) || {};
    } catch {
      fahrzeugdaten = {};
    }
  
    const form = document.getElementById("fahrzeugForm");
    const saveButton = document.querySelector(".save-button");
    const backButton = document.querySelector(".back-button");
    const markeSelect = document.getElementById("marke");
    const modellSelect = document.getElementById("modell");
    const titelInput = document.getElementById("titel");
  
    const mwstCheckbox = document.getElementById("mwst-ausweisbar");
    const bruttoNettoFields = document.getElementById("brutto-netto-fields");
    const standardPreis = document.getElementById("preis-wrapper");
    const bruttoInput = document.getElementById("brutto-preis");
    const nettoInput = document.getElementById("netto-preis");
    const preisInput = document.getElementById("preis");
  
    const ezMonat = document.getElementById("ez-monat");
    const ezJahr = document.getElementById("ez-jahr");
  
    if (ezJahr) {
      const aktuellesJahr = new Date().getFullYear();
      for (let j = aktuellesJahr; j >= 1990; j--) {
        const opt = document.createElement("option");
        opt.value = j;
        opt.textContent = j;
        ezJahr.appendChild(opt);
      }
    }
  
    const fields = form.querySelectorAll("input, select");
    fields.forEach(field => {
      if (field.name && fahrzeugdaten[field.name]) {
        field.type === "checkbox"
          ? (field.checked = fahrzeugdaten[field.name] === "true")
          : (field.value = fahrzeugdaten[field.name]);
      }
  
      const speichern = () => {
        fahrzeugdaten[field.name] =
          field.type === "checkbox" ? field.checked.toString() : field.value;
  
        if (ezJahr && ezMonat) {
          const monat = ezMonat.value;
          const jahr = ezJahr.value;
          if (monat && jahr) {
            fahrzeugdaten.erstzulassung = `${jahr}-${monat}`;
          }
        }
  
        localStorage.setItem("fahrzeugdaten", JSON.stringify(fahrzeugdaten));
        updateProgressBar();
        aktualisiereTitel();
      };
  
      ["input", "change"].forEach(e => field.addEventListener(e, speichern));
    });
  
    if (fahrzeugdaten.erstzulassung && ezMonat && ezJahr) {
      const [jahr, monat] = fahrzeugdaten.erstzulassung.split("-");
      ezJahr.value = jahr;
      ezMonat.value = monat;
    }
  
    fetch("data/marken-modelle.json")
      .then(res => res.json())
      .then(data => {
        if (markeSelect && modellSelect) {
          markeSelect.addEventListener("change", () => {
            const modelle = data[markeSelect.value] || [];
            modellSelect.innerHTML = `<option disabled selected>Bitte Modell wählen</option>`;
            modelle.forEach(modell => {
              const opt = document.createElement("option");
              opt.value = modell;
              opt.textContent = modell;
              modellSelect.appendChild(opt);
            });
            aktualisiereTitel();
          });
        }
      });
  
      function aktualisiereTitel() {
        const marke = markeSelect?.value;
        const modell = modellSelect?.value;
        if (titelInput && marke && modell && modell !== "Beliebig") {
          const aktuellerTitel = titelInput.value.trim();
          const vorgeschlagenerTitel = `${marke} ${modell}`;
          
          // ❗ Nur automatisch setzen, wenn das Feld komplett leer ist
          if (aktuellerTitel === "") {
            titelInput.value = vorgeschlagenerTitel;
            fahrzeugdaten.titel = vorgeschlagenerTitel;
            localStorage.setItem("fahrzeugdaten", JSON.stringify(fahrzeugdaten));
          }
        }
      }
      
  
    function updateProgressBar() {
      const relevanteFelder = [
        "marke", "modell", "kilometer", "leistung", "hubraum",
        "kraftstoff", "getriebe", "antriebsart", "fahrzeugtyp",
        "türen", "partikelfilter", "verbrauch_kombiniert", "co2_emission",
        "verbrauch_innerorts", "verbrauch_ausserorts", "schadstoffklasse", "umweltplakette"
      ];
      let gültig = 0;
  
      relevanteFelder.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value.trim() !== "") gültig++;
      });
  
      if (ezMonat?.value && ezJahr?.value) gültig++;
  
      const total = relevanteFelder.length + 1;
      const prozent = Math.round((gültig / total) * 100);
      document.getElementById("progress-bar").style.width = `${prozent}%`;
    }
  
    if (mwstCheckbox && bruttoNettoFields && standardPreis) {
      if (mwstCheckbox.checked) {
        preisInput.disabled = true;
        bruttoNettoFields.style.display = "flex";
        standardPreis.style.display = "none";
      }
  
      mwstCheckbox.addEventListener("change", function () {
        const checked = this.checked;
        preisInput.disabled = checked;
        bruttoNettoFields.style.display = checked ? "flex" : "none";
        standardPreis.style.display = checked ? "none" : "flex";
      });
  
      bruttoInput?.addEventListener("input", function () {
        const brutto = parseFloat(this.value);
        nettoInput.value = !isNaN(brutto) ? (brutto / 1.19).toFixed(2) : "";
      });
    }
  
    backButton?.addEventListener("click", (e) => {
      e.preventDefault();
      const userRole = localStorage.getItem("userRole");
      window.location.href = userRole === "haendler" ? "haendler.html" : "privat.html";
    });
  
    saveButton?.addEventListener("click", (e) => {
        e.preventDefault();
      
        // 🟢 Vorschau-relevante Felder absichern – auch bei verstecktem Input
        const brutto = bruttoInput?.value?.trim() || fahrzeugdaten["brutto-preis"] || "";
        const netto = nettoInput?.value?.trim() || fahrzeugdaten["netto-preis"] || "";
        const einzelpreis = preisInput?.value?.trim() || fahrzeugdaten["preis"] || "";
      
        // 🔐 Vorschau-Daten sicher schreiben
        fahrzeugdaten.verkauf_preis = einzelpreis;
        fahrzeugdaten.verkauf_brutto = brutto;
        fahrzeugdaten.verkauf_netto = netto;
        fahrzeugdaten.verkauf_mwst = mwstCheckbox?.checked ? "zzgl. MwSt." : "Keine MwSt.";
        fahrzeugdaten.verkauf_modell = titelInput?.value || "";
      
        // ✅ Verkäufer-Typ mit abspeichern
const verkaeuferTyp = localStorage.getItem("verkaeuferTyp") || "Privat";
fahrzeugdaten.verkauf_verkaeufer = verkaeuferTyp;

const monat = ezMonat?.value || "";
const jahr = ezJahr?.value || "";

if (monat && jahr) {
  fahrzeugdaten.verkauf_erstzulassung = `${monat}/${jahr}`;  // ✅ NEU
}


// 📌 Zurückspeichern in fahrzeugdaten
fahrzeugdaten["brutto-preis"] = brutto;
fahrzeugdaten["netto-preis"] = netto;
fahrzeugdaten["preis"] = einzelpreis;


fahrzeugdaten.verkauf_antrieb = document.getElementById("antriebsart")?.value || "";
// ✅ Zusätzliche technische Daten speichern
fahrzeugdaten.verkauf_hubraum = document.getElementById("hubraum")?.value || "";
fahrzeugdaten.verkauf_fahrzeugtyp = document.getElementById("fahrzeugtyp")?.value || "";
fahrzeugdaten.verkauf_tueren = document.getElementById("türen")?.value || "";
fahrzeugdaten.verkauf_partikelfilter = document.getElementById("partikelfilter")?.value || "";
fahrzeugdaten.verkauf_verbrauch_kombiniert = document.getElementById("verbrauch_kombiniert")?.value || "";
fahrzeugdaten.verkauf_co2_emission = document.getElementById("co2_emission")?.value || "";
fahrzeugdaten.verkauf_verbrauch_innerorts = document.getElementById("verbrauch_innerorts")?.value || "";
fahrzeugdaten.verkauf_verbrauch_ausserorts = document.getElementById("verbrauch_ausserorts")?.value || "";
fahrzeugdaten.verkauf_schadstoffklasse = document.getElementById("schadstoffklasse")?.value || "";
fahrzeugdaten.verkauf_umweltplakette = document.getElementById("umweltplakette")?.value || "";


      
fetch("/saveFahrzeugdaten", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fahrzeugdaten)
  })
  .then(res => {
    if (!res.ok) throw new Error("Fehler beim Speichern der Fahrzeugdaten.");
    return res.json(); // optional, falls du eine Bestätigung erwartest
  })
  .then(() => {
    sessionStorage.setItem("hatGespeichert", "true");
    localStorage.setItem("fahrzeugSchritt1", "abgeschlossen");
  
    const userRole = localStorage.getItem("userRole");
    if (userRole === "haendler") {
      window.location.href = "haendler.html";
    } else {
      window.location.href = "privat.html";
    }
  })
  .catch(err => {
    console.error("🚫 Fehler:", err);
    alert("❌ Fahrzeugdaten konnten nicht gespeichert werden. Bitte versuche es erneut.");
  });
  
      });
      
  
    updateProgressBar();
    aktualisiereTitel();
  });
  


