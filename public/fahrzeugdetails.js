// fahrzeugdetails.js — korrigiert (Syntax + Edit-Checkboxes)

(() => {
  // ============================
  // kleine Helper
  // ============================
  const $id = (x) => document.getElementById(x);
  const KEY_PREFIX = "details_";

  const parseBool = (v) => {
    if (v === true) return true;
    if (v === false) return false;
    const s = String(v ?? "").trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "on";
  };

  // Kanonischer Key: camelCase -> lowercase, Sonderzeichen weg
  const canonicalize = (name = "") =>
    String(name)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[_-]+/g, "")
      // Achtung: \p{..} braucht moderne JS-Engines (iOS 18 ist ok)
      .replace(/[^\p{L}\p{N}]/gu, "");

  // Aliase, um Preview-Keys sicher zu treffen (bekannte Sonderfälle/Schreibweisen)
  const CANON_ALIASES = {
    elektrheckklappe: "elektheckklappe",
    metallic: "mettalic",
    kamerahinten: "kamerahinten",
    kamera360: "kamera360",
    sitzheizungvorne: "sitzheizungvorne",
    sitzheizunghinten: "sitzheizunghinten",
    sitzeelektrisch: "sitzeelektrisch",
    einparkhilfeselbstlenkend: "einparkhilfeselbstlenkend",
  };

  const canon = (name) => {
    const c = canonicalize(name);
    return CANON_ALIASES[c] || c;
  };

  // Whitelist für Kurzbeschreibung in der Vorschau
  const SHORT_DESC = [
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
    { name: "allwetterreifen", label: "Allwetterreifen" },
  ];

  // Felder für Fortschrittsanzeige (IDs der <input>/<select>)
  const relevanteFelder = [
    "zustand","fahrzeugart","halter","fahrtauglich","beschaedigt","unfall",
    "tuevMonat","tuevJahr","karosseriefarbe","innenmaterial","innenfarbe",
    "airbags","scheinwerfer","tagfahrlicht","kurvenlicht","klimatisierung",
    "pannenhilfe","anhaengerkupplung"
  ];

  function updateProgressBar() {
    const total = relevanteFelder.length || 1;
    let gueltig = 0;

    relevanteFelder.forEach((id) => {
      const el = $id(id);
      if (!el) return;

      const tag = el.tagName;
      if (tag === "SELECT") {
        if (String(el.value || "") !== "") gueltig++;
      } else if (tag === "INPUT" || tag === "TEXTAREA") {
        if (String(el.value || "").trim() !== "") gueltig++;
      }
    });

    const prozent = Math.round((gueltig / total) * 100);
    const bar = $id("progress-bar");
    if (bar) bar.style.width = `${prozent}%`;
  }

  // Toast / StepDone (Fallbacks)
  function ensureToastContainer() {
    if ($id("toast-container")) return;
    const c = document.createElement("div");
    c.id = "toast-container";
    document.body.appendChild(c);
  }

  function safeToast(message, type = "success") {
    ensureToastContainer();
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.textContent = message;
    $id("toast-container").appendChild(t);

    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => {
      t.classList.remove("show");
      t.addEventListener("transitionend", () => t.remove(), { once: true });
    }, 3000);
  }

  function safeMarkStepDone(step) {
    try {
      const KEY = "haendlerSteps";
      const obj = JSON.parse(localStorage.getItem(KEY) || "{}");
      obj[String(step)] = true;
      localStorage.setItem(KEY, JSON.stringify(obj));
    } catch {}
    if (window.markStepDone) {
      try { window.markStepDone(step); } catch {}
    }
  }

  // ============================
  // WICHTIG: DOMContentLoaded
  // ============================
  document.addEventListener("DOMContentLoaded", () => {
    const form = $id("fahrzeugForm");
    if (!form) return;

    // 🚀 Edit-Modus: Wenn vorhanden, lade vorbereitete Fahrzeugdetails aus localStorage
    const isEdit = localStorage.getItem("editMode") === "1";
    const editDetailsRaw = localStorage.getItem("fahrzeugdetails");

    if (isEdit && editDetailsRaw) {
      try {
        const detailsData = JSON.parse(editDetailsRaw);

        Object.entries(detailsData).forEach(([name, val]) => {
          // falls name Sonderzeichen hat
          let field = null;
          try {
            field = form.querySelector(`[name="${CSS.escape(name)}"]`);
          } catch {
            field = form.querySelector(`[name="${name}"]`);
          }
          if (!field) return;

          if (field.type === "checkbox") {
            field.checked = parseBool(val);
          } else {
            field.value = val ?? "";
          }
        });
      } catch (err) {
        console.warn("Fehler beim Einfüllen der bearbeiteten Fahrzeugdetails:", err);
      }
    }

    // 1) Felder aus localStorage vorbelegen
    const allFields = form.querySelectorAll("input, select, textarea");

    allFields.forEach((field) => {
      const nm = field.name;
      if (!nm) return;

      const storedOrig  = localStorage.getItem(KEY_PREFIX + nm);
      const storedCanon = localStorage.getItem(KEY_PREFIX + canon(nm));
      const val = storedOrig ?? storedCanon;

      if (val != null) {
        if (field.type === "checkbox") field.checked = parseBool(val);
        else field.value = val;
      }

      // Fortschritts-Listener setzen
      if (relevanteFelder.includes(field.id)) {
        field.addEventListener("input", updateProgressBar);
        field.addEventListener("change", updateProgressBar);
      }
    });

    updateProgressBar();

    // 2) Live-Speichern aller Eingaben in localStorage (orig + kanonisch)
    const persistField = (field) => {
      const nm = field.name;
      if (!nm) return;
      const v = field.type === "checkbox" ? String(field.checked) : String(field.value || "");
      try {
        localStorage.setItem(KEY_PREFIX + nm, v);
        localStorage.setItem(KEY_PREFIX + canon(nm), v);
      } catch {}
    };

    allFields.forEach((field) => {
      field.addEventListener("input", () => persistField(field));
      field.addEventListener("change", () => persistField(field));
    });

    // 3) Submit → Server speichern + Vorschau-kompatible Keys erzeugen
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const data = {};

      // a) rohe Werte einsammeln + localStorage schreiben (zur Sicherheit)
      allFields.forEach((field) => {
        const nm = field.name;
        if (!nm) return;
        const isCb = field.type === "checkbox";
        const raw  = isCb ? field.checked : field.value;

        data[nm] = isCb ? Boolean(raw) : String(raw || "");

        try {
          localStorage.setItem(KEY_PREFIX + nm, isCb ? String(raw) : String(raw || ""));
          localStorage.setItem(KEY_PREFIX + canon(nm), isCb ? String(raw) : String(raw || ""));
        } catch {}
      });

      // b) Abgeleitete/zusammengefasste Felder

      // HU (Monat Jahr)
      const m = $id("tuevMonat")?.value || "";
      const y = $id("tuevJahr")?.value  || "";
      const huText = (m && y) ? `${m} ${y}` : "";
      data["verkauf_hu"] = huText;
      try {
        localStorage.setItem(KEY_PREFIX + "verkauf_hu", huText);
        localStorage.setItem(KEY_PREFIX + "hu", huText);
      } catch {}

      // Farbe & Innenraum
      const kf = $id("karosseriefarbe")?.value || "";
      const im = $id("innenmaterial")?.value || "";
      const ifa= $id("innenfarbe")?.value || "";
      data["karosseriefarbe"]         = kf;
      data["verkauf_karosseriefarbe"] = kf;
      data["verkauf_innenmaterial"]   = im;
      data["verkauf_innenfarbe"]      = ifa;

      try {
        localStorage.setItem(KEY_PREFIX + "karosseriefarbe", kf);
        localStorage.setItem(KEY_PREFIX + "innenmaterial", im);
        localStorage.setItem(KEY_PREFIX + "innenfarbe", ifa);
      } catch {}

      // Einparkhilfe (Vorne/Hinten)
      const vorne   = form.querySelector("input[name='einparkhilfeVorne']")?.checked;
      const hinten  = form.querySelector("input[name='einparkhilfeHinten']")?.checked;
      let eText = "";
      if (vorne && hinten) eText = "Vorne & Hinten";
      else if (vorne) eText = "Vorne";
      else if (hinten) eText = "Hinten";
      data["verkauf_einparkhilfe"] = eText;
      try { localStorage.setItem(KEY_PREFIX + "einparkhilfe", eText); } catch {}

      // selbstlenkend
      const eps = form.querySelector("input[name='einparkhilfeSelbstlenkend']")?.checked || false;
      data["einparkhilfeSelbstlenkend"] = Boolean(eps);
      data["verkauf_einparkhilfeselbstlenkend"] = Boolean(eps);
      try { localStorage.setItem(KEY_PREFIX + "einparkhilfeselbstlenkend", String(eps)); } catch {}

      // Fahrzeugbeschreibung
      const beschr = $id("fahrzeugbeschreibung")?.value?.trim() || "";
      data["fahrzeugbeschreibung"] = beschr;
      try { localStorage.setItem(KEY_PREFIX + "fahrzeugbeschreibung", beschr); } catch {}

      // c) Checkboxen → Labels + verkauf_* Booleans
      // HINWEIS: Das nimmt ALLE Checkboxen mit name. Wenn du MwSt/sonstige NICHT willst,
      // müssen wir hier filtern (z.B. per data-group="ausstattung").
      const ausgewaehlteAusstattung = [];
      const allCheckboxes = form.querySelectorAll('input[type="checkbox"][name]');

      allCheckboxes.forEach((cb) => {
        const nm = cb.name;
        const lbl = cb.nextElementSibling?.textContent?.trim() || "";
        const ckey = canon(nm);

        data[nm] = Boolean(cb.checked);
        data[`verkauf_${ckey}`] = Boolean(cb.checked);

        try { localStorage.setItem(KEY_PREFIX + ckey, String(cb.checked)); } catch {}
        if (cb.checked && lbl) ausgewaehlteAusstattung.push(lbl);
      });

      data["ausstattung"] = ausgewaehlteAusstattung;

      // Kurzbeschreibung (Whitelist)
      const short = SHORT_DESC
        .filter((e) => form.querySelector(`input[name="${e.name}"]`)?.checked)
        .map((e) => e.label);

      data["verkauf_ausstattung"] = short;

      try {
        localStorage.setItem(KEY_PREFIX + "ausstattung", JSON.stringify(ausgewaehlteAusstattung));
        localStorage.setItem(KEY_PREFIX + "verkauf_ausstattung", JSON.stringify(short));
      } catch {}

      // d) Licht & Sicht
      ["scheinwerfer","tagfahrlicht","kurvenlicht"].forEach((n) => {
        const v = form.querySelector(`select[name="${n}"]`)?.value || "";
        data[n] = v;
        data[`verkauf_${n}`] = v;
        try { localStorage.setItem(KEY_PREFIX + n, v); } catch {}
      });

      // Klimatisierung
      const klima = form.querySelector(`select[name="klimatisierung"]`)?.value || "";
      data["klimatisierung"] = klima;
      data["verkauf_klimatisierung"] = klima;

      // Metallic (inkl. altem Vorschau-Typo)
      const metallic = form.querySelector('input[name="metallic"]')?.checked || false;
      data["metallic"] = metallic;
      data["verkauf_metallic"] = metallic;
      data["verkauf_mettalic"] = metallic;

      try {
        localStorage.setItem(KEY_PREFIX + "metallic", String(metallic));
        localStorage.setItem(KEY_PREFIX + "mettalic", String(metallic));
      } catch {}

      // e) Server speichern
      sessionStorage.setItem("hatGespeichert", "true");

      try {
        const res = await fetch("/saveDetails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data),
        });

        if (!res.ok) throw new Error(await res.text().catch(() => "Fehler beim Speichern der Details."));
        await res.json().catch(() => ({}));

        safeMarkStepDone(2);
        safeToast("Fahrzeugdetails gespeichert ✅");

        const userRole = localStorage.getItem("userRole");
        const ziel = userRole === "haendler" ? "haendler.html" : "privat.html";
        setTimeout(() => { window.location.href = ziel; }, 600);
      } catch (err) {
        console.error("❌ Fehler beim Speichern:", err);
        safeToast("Speichern fehlgeschlagen", "error");
      } finally {
        setTimeout(() => sessionStorage.removeItem("hatGespeichert"), 2000);
      }
    });
  });
})();