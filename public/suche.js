// suche.js — TEIL 1
document.documentElement.classList.remove("no-js");

// ---------- Utils (einmalig) ----------
const norm = (s) => String(s || "")
  .toLowerCase()
  .normalize("NFD").replace(/\p{Diacritic}/gu, ""); // Umlaute/Diakritika raus

const toNum = (v) => {
  if (v == null || v === "") return NaN;
  return Number(String(v).replace(/\./g, "").replace(",", "."));
};

// NEU: Akzeptiert YYYY, YYYY-MM, MM/YYYY, YYYY-MM-DD und gibt "YYYY-MM" zurück
function normalizeYMAny(raw, fallbackMonthIfYearOnly = null) {
  const s = String(raw || "").trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (m) return `${m[1]}-${m[2]}`;                         // YYYY-MM-DD -> YYYY-MM
  m = s.match(/^(\d{4})-(\d{1,2})$/);            if (m) return `${m[1]}-${String(m[2]).padStart(2,"0")}`; // YYYY-MM
  m = s.match(/^(\d{1,2})[./-](\d{4})$/);        if (m) return `${m[2]}-${String(m[1]).padStart(2,"0")}`; // MM/YYYY
  m = s.match(/^(\d{4})$/);                      if (m) return fallbackMonthIfYearOnly ? `${m[1]}-${String(fallbackMonthIfYearOnly).padStart(2,"0")}` : "";
  return "";
}

// (Behalten: wird an anderen Stellen verwendet)
function parseYM(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) return s;
  const m = s.match(/^(0?[1-9]|1[0-2])[.\-/](\d{4})$/);
  if (m) return `${m[2]}-${String(m[1]).padStart(2, "0")}`;
  if (/^\d{4}$/.test(s)) return `${s}-01`;
  return "";
}
function orderYM(from, to) {
  if (from && to && from > to) return [to, from];
  return [from || "", to || ""];
}

// Labels für Chips
const FUEL_LABELS = {
  benzin: "Benzin",
  diesel: "Diesel",
  elektrisch: "Elektrisch",
  hybrid: "Hybrid",
  "hybrid-benzin": "Hybrid (Benzin)",
  "hybrid-diesel": "Hybrid (Diesel)"
};
const DRIVE_LABELS = { frontantrieb: "Frontantrieb", heckantrieb: "Heckantrieb", allrad: "Allrad" };
// Canon für Kraftstoff
function fuelCanon(raw) {
  const s = String(raw || "").trim().toLowerCase();

  // vereinheitlichen (Leerzeichen, Sonderzeichen raus für Erkennung)
  const flat = s
    .replace(/[()./\\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!flat) return "";

  // Reihenfolge wichtig: spezifische Synonyme zuerst
  if (/(^|[\s])autogas([\s]|$)/.test(flat)) return "autogas";
  if (/\blpg\b/i.test(s)) return "autogas";

  if (/(^|[\s])erdgas([\s]|$)/.test(flat)) return "cng";
  if (/\bcng\b/i.test(s)) return "cng";

  if (/(^|[\s])benzin|otto|e10|super([\s]|$)/.test(flat)) return "benzin";
  if (/diesel/.test(flat)) return "diesel";

  if (/(elektro|electric|bev|strom)/.test(flat)) return "elektro";

  if (/(hybrid|plug[\s-]?in|phev|mhev|hev)/.test(flat)) return "hybrid";

  if (/(wasserstoff|hydrogen|h2)/.test(flat)) return "wasserstoff";
  if (/(ethanol|e85|flexfuel)/.test(flat)) return "ethanol";

  return flat; // Fallback
}

// Schönes Label für Chips/Select
function fuelNiceLabel(tok) {
  const t = String(tok || "").toLowerCase();
  const map = {
    benzin:       "Benzin",
    diesel:       "Diesel",
    elektro:      "Elektro",
    hybrid:       "Hybrid",
    autogas:      "Autogas (LPG)",
    cng:          "Erdgas (CNG)",
    wasserstoff:  "Wasserstoff (H2)",
    ethanol:      "Ethanol (E85)"
  };
  return map[t] || (t ? t.charAt(0).toUpperCase() + t.slice(1) : "");
}


// ---- Umweltplakette: Canon + Label ----
function badgeCanon(raw) {
  let s = String(raw || "")
    .toLowerCase()
    .trim()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "");
  if (!s) return "";
  if (s === "4" || /grun|gruen|green/.test(s)) return "4";
  if (s === "3" || /gelb|yellow/.test(s))      return "3";
  if (s === "2" || /rot|red/.test(s))          return "2";
  const m = s.match(/\b([234])\b/);
  return m ? m[1] : "";
}
function badgeNiceLabel(tok) {
  switch (String(tok)) {
    case "4": return "Umweltplakette: Grün";
    case "3": return "Umweltplakette: Gelb";
    case "2": return "Umweltplakette: Rot";
    default:  return "";
  }
}

// ---- Schadstoffklasse: Canon + Label ----
function emissionCanon(raw) {
  if (raw == null) return "";
  // robust gegen Groß-/Kleinschreibung, Leerzeichen, Sonderzeichen
  let s = String(raw).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  s = s.replace(/\s+/g, "");
  // Spezialfälle
  if (/6d[- ]?temp|6dtemp/.test(s) || /euro6d[- ]?temp/.test(s)) return "euro6d-temp";
  if (/euro?6d(?!temp)|\b6d\b/.test(s)) return "euro6d";
  if (/euro?6c|\b6c\b/.test(s)) return "euro6c";
  if (/euro?6|\b6\b/.test(s)) return "euro6";
  if (/euro?5|\b5\b/.test(s)) return "euro5";
  if (/euro?4|\b4\b/.test(s)) return "euro4";
  if (/euro?3|\b3\b/.test(s)) return "euro3";
  if (/euro?2|\b2\b/.test(s)) return "euro2";
  if (/euro?1|\b1\b/.test(s)) return "euro1";

  // generisch
  const m = s.match(/euro?\s*(\d)\s*(d(?:-?temp)?)?|euro?\s*(\d)c/);
  if (m) {
    if (m[2]) { // d / d-temp
      return `euro${m[1]}${m[2].includes("temp") ? "d-temp" : "d"}`;
    }
    if (m[3]) { // ...c
      return `euro${m[3]}c`;
    }
  }
  return "";
}
function emissionNiceLabel(tok) {
  const t = String(tok || "").toLowerCase();
  if (!t) return "";
  if (t === "euro6d-temp") return "Schadstoffklasse: Euro 6d-TEMP";
  if (t === "euro6d")      return "Schadstoffklasse: Euro 6d";
  if (t === "euro6c")      return "Schadstoffklasse: Euro 6c";
  const m = t.match(/^euro(\d)$/);
  if (m) return `Schadstoffklasse: Euro ${m[1]}`;
  return `Schadstoffklasse: ${t.replace(/^euro/,"Euro ").toUpperCase()}`;
}

// Antrieb → kanonischer Token
function driveCanon(raw) {
  const s = norm(raw);
  if (!s) return "";
  if (/(quattro|xdrive|4matic|4motion|awd|allrad|4x4|4wd|all[-\s]?wheel)/.test(s)) return "allrad";
  if (/(fwd|front|vorderrad|frontantrieb)/.test(s)) return "frontantrieb";
  if (/(rwd|heck|hinterrad|heckantrieb|rear)/.test(s)) return "heckantrieb";
  return s;
}
function driveNiceLabel(token) {
  const t = String(token || "").toLowerCase();
  return DRIVE_LABELS[t] || (t ? t[0].toUpperCase() + t.slice(1) : "");
}

const GEAR_MAP = {
  automatik: "automatik", automatic: "automatik", auto: "automatik",
  schalt: "schaltgetriebe", schaltung: "schaltgetriebe", manuell: "schaltgetriebe"
};
const canon = (val, map) => map[val] || val;

const isTruthyRaw = (v) => {
  if (typeof v === "boolean") return v;
  const s = String(v || "").trim().toLowerCase();
  return ["1","true","ja","mit","yes","vorhanden"].includes(s);
};

const replaceUrlParams = (params) => {
  const qs = params.toString();
  history.replaceState(null, "", qs ? `${location.pathname}?${qs}` : location.pathname);
};

const splitCsv = (v) => (v ? String(v).split(",").map(s => s.trim()).filter(Boolean) : []);
const uniq     = (arr) => [...new Set(arr)];

// --- HU Param Normalisierung ---
// Freitext "hu" -> (a) "hu_min_monate" wenn "Mind. X Monate", sonst (b) Datum -> "hu_bis"
// Außerdem "inspectionUntil" auf "hu_bis" normalisieren.
function normalizeHuParams(params) {
  const huTxt = params.get("hu");
  if (huTxt) {
    // a) "Mind. 6 Monate" / "6 Monate" / "6 months"
    const m = String(huTxt).match(/(\d{1,2})\s*(?:monate?|months?)/i);
    if (m) {
      params.set("hu_min_monate", String(parseInt(m[1], 10)));
    } else {
      // b) Datum erkennen und auf YYYY-MM normalisieren
      const ym = normalizeYMAny(huTxt, 12);
      if (ym) params.set("hu_bis", ym);
    }
    params.delete("hu"); // Doppelung vermeiden
  }

  // Alias "inspectionUntil" -> "hu_bis" (ebenfalls normalisieren)
  const insp = params.get("inspectionUntil");
  if (insp) {
    const ym2 = normalizeYMAny(insp, 12);
    if (ym2) params.set("hu_bis", ym2);
    params.delete("inspectionUntil");
  }

  return params;
}


// ---------- App ----------
document.addEventListener("DOMContentLoaded", () => {
// ===== DOM Refs =====
const navLinks      = document.getElementById("nav-links");
const hamburger     = document.getElementById("hamburger");
const dropdownLinks = document.querySelectorAll(".dropdown > a");
const dropdownLis   = document.querySelectorAll(".dropdown");

const toggleBtn     = document.getElementById("toggleFiltersBtn");
const sidebar       = document.querySelector(".filter-sidebar");

const searchLink    = document.querySelector('a[href="#search-section"]');
const makeInput     = document.getElementById("marke");
const modelInput    = document.getElementById("modell");
const titleInput    = document.getElementById("title");

const container     = document.getElementById("carResults");
const pager         = document.getElementById("pager");
const sortBy        = document.getElementById("sortBy");
const applyFilters  = document.getElementById("applyFiltersBtn");
// --- Prefill aus URL in die UI ---
(function prefillFromQuery () {
  const sp = new URLSearchParams(location.search);

  const pad2 = (m) => String(m).padStart(2, "0");
  function parseYM(val, fallbackMonthIfYearOnly = null) {
    if (!val) return "";
    const s = String(val).trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})$/); if (m) return `${m[1]}-${pad2(m[2])}`;
    m = s.match(/^(\d{1,2})[-/.](\d{4})$/);     if (m) return `${m[2]}-${pad2(m[1])}`;
    m = s.match(/^(\d{4})$/);                   if (m) return fallbackMonthIfYearOnly ? `${m[1]}-${pad2(fallbackMonthIfYearOnly)}` : "";
    if (/^\d{4}-\d{2}$/.test(s)) return s;
    return "";
  }
  const toDec = (s) => {
    const t = String(s ?? "").trim().replace(/\s+/g, "").replace(",", ".");
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : NaN;
  };

  const QP = {
    marke: sp.get("marke") || "",
    modell: splitCsv(sp.get("modell")),
    modellausfuehrung: sp.get("modellausfuehrung") || "",

    ezFrom: sp.get("ezFrom") || "",
    ezTo:   sp.get("ezTo")   || "",

    km_max:    sp.get("km_max")    || "",
    price_max: sp.get("price_max") || "",

    // Mehrfach (CSV)
    kraftstoff: splitCsv(sp.get("kraftstoff")).map(fuelCanon),
    antrieb:    splitCsv(sp.get("antriebsart") || sp.get("antrieb")).map(driveCanon),

    getriebe: (sp.get("getriebe") || "").toLowerCase(),

    // Mehrfach (CSV)
    fahrzeugtyp: splitCsv(sp.get("fahrzeugtyp")),
    farbe:       splitCsv(sp.get("farbe")),
    tueren:      splitCsv(sp.get("tueren")),

    sort: sp.get("sort") || "",

    partikelfilter: sp.get("partikelfilter"),
    scheckheft:     sp.get("scheckheft"),
    unfallfrei:     sp.get("unfallfrei"),

    // akzeptiert ?umweltplakette=… oder ?plakette=…
    umweltplakette:  badgeCanon(sp.get("umweltplakette") || sp.get("plakette")),
    schadstoffklasse: emissionCanon(sp.get("schadstoffklasse")),

    // HU: Text und strukturierte Varianten
    hu_text: sp.get("hu") || "",
    hu_bis:  sp.get("hu_bis") || sp.get("inspectionUntil") || "",
    hu_min:  sp.get("hu_min_monate") || sp.get("hu_min_months") || ""
  };

  // --- DOM Refs ---
  const markeEl   = document.getElementById("marke");
  const modellEl  = document.getElementById("modell");
  const modVarEl  = document.getElementById("modellausfuehrung");

  const priceToEl = document.getElementById("priceTo");
  const kmToEl    = document.getElementById("mileageTo");

  const fuelEl  = document.getElementById("fuelType") || document.getElementById("fuel");
  const gearEl  = document.getElementById("transmission") || document.getElementById("gear");
  const driveEl = document.getElementById("antriebsart") || document.getElementById("drivetrain") || document.getElementById("antrieb");

  // (Fallbacks, falls irgendwo noch Selects existieren)
  const vehicleTypeSel = document.getElementById("vehicleType");
  const colorSel       = document.getElementById("color");

  // Umweltplakette (Select-ID flexibel)
  const badgeSel = document.getElementById("umweltplakette") || document.getElementById("umwelt-badge");

  // Schadstoffklasse (Select/Radio flexibel)
  const emissionSel = document.getElementById("schadstoffklasse") || document.getElementById("emission");

  // Verbrauch-UI (optional)
  const verbrauchSel = document.getElementById("verbrauch-select");
  const verbrauchInp = document.getElementById("verbrauch");

  // EZ Felder
  const firstRegFromEl  = document.getElementById("firstRegFrom");
  const firstRegMonthEl = document.getElementById("first-registration-month");
  const firstRegYearEl  = document.getElementById("first-registration-year");
  const ezVonEl = document.getElementById("ez-von");
  const ezBisEl = document.getElementById("ez-bis");

  // HU (bis Datum) – aus URL übernehmen (YYYY-MM normalisiert)
  const inspectionUntilEl = document.getElementById("inspectionUntil");
  let huBis =
    normalizeYMAny(QP.hu_bis) ||
    normalizeYMAny(QP.hu_text) ||                 // ?hu=2026-06 ODER "Mind. 6 Monate"
    normalizeYMAny(sp.get("inspectionUntil")) ||  // falls anders gesetzt
    "";
  if (inspectionUntilEl && huBis) inspectionUntilEl.value = huBis;

  // HU (mind. Monate) – aus expliziten Parametern oder Text „Mind. X Monate“
  const huMinSel = document.getElementById("huMinMonths") || document.getElementById("inspectionMinMonths");
  let huMin = parseInt(String(QP.hu_min).trim(), 10);
  if (!Number.isFinite(huMin)) {
    const m = String(QP.hu_text).match(/(\d{1,2})/); // z. B. „Mind. 6 Monate“
    if (m) huMin = parseInt(m[1], 10);
  }
  if (huMinSel && Number.isFinite(huMin) && huMin > 0) huMinSel.value = String(huMin);

  // Flags
  const pfEl = document.getElementById("partikelfilter");
  const shEl = document.getElementById("scheckheft");
  const ufEl = document.getElementById("unfallfrei") || document.getElementById("accidentFree");

  // --- Prefill einfache Felder ---
  if (markeEl && QP.marke) markeEl.value = QP.marke;

  if (modellEl && QP.modell.length) {
    const set = new Set(QP.modell.map(v => v.toLowerCase()));
    [...modellEl.options].forEach(opt => {
      opt.selected = set.has(String(opt.value).toLowerCase());
    });
  }

  if (modVarEl && QP.modellausfuehrung) modVarEl.value = QP.modellausfuehrung;

  if (priceToEl && QP.price_max) priceToEl.value = QP.price_max;
  if (kmToEl   && QP.km_max)     kmToEl.value    = QP.km_max;

  // --- Verbrauch (optional, falls vorhanden) ---
  (function () {
    const v = sp.get("verbrauch_max");
    if (!v) return;
    if (verbrauchSel) {
      const match = [...verbrauchSel.options].find(o =>
        String(o.value).replace(",", ".") === String(v).replace(",", ".")
      );
      verbrauchSel.value = match ? match.value : "custom";
    }
    if (verbrauchInp) verbrauchInp.value = String(v).replace(".", ",");
  })();

  // --- Kraftstoff: Select (erster) + Checkboxen (alle) ---
  (function () {
    const picked = QP.kraftstoff || [];  // kanonisierte Tokens
    if (!picked.length) return;

    // Select: ersten passenden setzen
    if (fuelEl && fuelEl.tagName === "SELECT") {
      const wanted = picked[0];
      const match = [...fuelEl.options].find(o =>
        fuelCanon(o.value) === wanted || fuelCanon(o.text) === wanted
      );
      if (match) fuelEl.value = match.value;
    }

    // Checkboxen: alle passenden anhaken
    const set = new Set(picked);
    const hasHybridAny = set.has("hybrid"); // generisch -> beide Varianten anhaken
    document.querySelectorAll('input[name="kraftstoff"]').forEach(cb => {
      const tok = fuelCanon(cb.value);
      cb.checked = set.has(tok) || (hasHybridAny && tok.startsWith("hybrid-"));
    });
  })();

  // --- Getriebe (einfach) ---
  if (gearEl && QP.getriebe) {
    const m = [...gearEl.options].find(o =>
      String(o.value).toLowerCase() === QP.getriebe ||
      String(o.text).toLowerCase()  === QP.getriebe
    );
    if (m) gearEl.value = m.value;
  }

  // --- Antrieb: Select (erster) + Checkboxen (alle) ---
  if (QP.antrieb.length) {
    if (driveEl && driveEl.tagName === "SELECT") {
      const v = QP.antrieb[0];
      const match = [...driveEl.options].find(o =>
        driveCanon(o.value) === v || driveCanon(o.text) === v
      );
      if (match) driveEl.value = match.value;
    }
    document.querySelectorAll('input[name="antrieb"]').forEach(cb => {
      const tok = driveCanon(cb.value);
      cb.checked = QP.antrieb.includes(tok);
    });
  }

  // --- Fahrzeugtyp (Checkboxen; Fallback Select) ---
  if (QP.fahrzeugtyp.length) {
    const set = new Set(QP.fahrzeugtyp.map(v => String(v).toLowerCase()));
    document.querySelectorAll('input[name="fahrzeugtyp"]').forEach(cb => {
      cb.checked = set.has(String(cb.value || "").toLowerCase());
    });
    if (vehicleTypeSel && vehicleTypeSel.tagName === "SELECT") {
      [...vehicleTypeSel.options].forEach(o => {
        o.selected = set.has(String(o.value || "").toLowerCase());
      });
    }
  }

  // --- Farbe (Checkboxen; Fallback Select) ---
  if (QP.farbe.length) {
    const set = new Set(QP.farbe.map(v => String(v).toLowerCase()));
    document.querySelectorAll('input[name="farbe"]').forEach(cb => {
      cb.checked = set.has(String(cb.value || "").toLowerCase());
    });
    if (colorSel && colorSel.tagName === "SELECT") {
      [...colorSel.options].forEach(o => {
        o.selected = set.has(String(o.value || "").toLowerCase());
      });
    }
  }

  // --- Umweltplakette (Select + Radio/Checkboxen) ---
  (function () {
    const v = QP.umweltplakette; // "4" | "3" | "2" | ""
    if (!v) return;

    if (badgeSel && badgeSel.tagName === "SELECT") {
      const opt = [...badgeSel.options].find(o =>
        badgeCanon(o.value) === v || badgeCanon(o.text) === v
      );
      if (opt) badgeSel.value = opt.value;
    }
    document.querySelectorAll('input[name="umweltplakette"]').forEach(inp => {
      inp.checked = badgeCanon(inp.value) === v;
    });
  })();

  // --- Schadstoffklasse (Select/Radio) ---
  (function () {
    const v = QP.schadstoffklasse;
    if (!v) return;
    if (emissionSel && emissionSel.tagName === "SELECT") {
      const opt = [...emissionSel.options].find(o =>
        emissionCanon(o.value) === v || emissionCanon(o.text) === v
      );
      if (opt) emissionSel.value = opt.value;
    }
    document.querySelectorAll('input[name="schadstoffklasse"], input[name="emission"]').forEach(inp => {
      if (emissionCanon(inp.value) === v) inp.checked = true;
    });
  })();

  // --- EZ Prefill ---
  if (firstRegFromEl && QP.ezFrom) firstRegFromEl.value = QP.ezFrom;
  if (QP.ezFrom && firstRegMonthEl && firstRegYearEl) {
    const [y, m] = QP.ezFrom.split("-");
    if (y) firstRegYearEl.value  = y;
    if (m) firstRegMonthEl.value = m;
  }
  if (ezVonEl && QP.ezFrom) ezVonEl.value = QP.ezFrom;
  if (ezBisEl && QP.ezTo)   ezBisEl.value = QP.ezTo;

  // --- Sortierung ---
  const sortBy = document.getElementById("sortBy");
  if (sortBy) {
    if (QP.sort === "preis_asc")       sortBy.value = "price-asc";
    else if (QP.sort === "preis_desc") sortBy.value = "price-desc";
    else if (QP.sort === "neueste")    sortBy.value = "date-desc";
    else if (QP.sort)                  sortBy.value = "date-desc";
  }

  // --- Flags ---
  if (pfEl) pfEl.checked = isTruthyRaw(QP.partikelfilter);
  if (shEl) shEl.checked = isTruthyRaw(QP.scheckheft);
  if (ufEl) ufEl.checked = isTruthyRaw(QP.unfallfrei);
})();



// Verbrauch: URL -> UI (Select/Custom) + Toggle
(function () {
  const sel = document.getElementById('verbrauch-select');
  const inp = document.getElementById('verbrauch');
  if (!sel && !inp) return;

  function syncVerbrauchUI() {
    if (!sel || !inp) return;
    const isCustom = sel.value === 'custom';
    inp.style.display = isCustom ? '' : 'none';
    if (!isCustom) inp.value = '';
  }
  sel?.addEventListener('change', syncVerbrauchUI);

  const raw = (new URLSearchParams(location.search)).get('verbrauch_max');
  if (raw) {
    const asNum = parseFloat(String(raw).replace(',', '.'));
    if (sel) {
      const match = Array.from(sel.options).find(o =>
        parseFloat(String(o.value).replace(',', '.')) === asNum
      );
      if (match && match.value !== 'custom') {
        sel.value = match.value;
        syncVerbrauchUI();
      } else {
        sel.value = 'custom';
        if (inp) inp.value = String(raw).replace('.', ',');
        syncVerbrauchUI();
      }
    } else if (inp) {
      inp.style.display = '';
      inp.value = String(raw).replace('.', ',');
    }
  } else {
    syncVerbrauchUI();
  }
})();


  // ===== State =====
  let filteredItems = [];   // enthält IMMER nur die aktuelle Server-Seite (nach normalize)
  let page = 1;
  const pageSize = 20;
  let serverTotal = 0;      // Gesamtanzahl vom Server für den Pager
  let lastReqId = 0;        // Fetch-Race Schutz

  // ===== Helpers =====
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const fmtEUR = (v) => {
    const n = toNum(v);
    return isNaN(n) ? "Preis n. a." : n.toLocaleString("de-DE") + " €";
  };
  const sanitizePhone = (p) => String(p || "").replace(/[^\d+]/g, "");


  function closeAllDropdowns(except = null) {
    dropdownLis.forEach(li => {
      if (li !== except) {
        li.classList.remove("open");
        const trigger = li.querySelector('a[aria-haspopup="true"]');
        const menu    = li.querySelector(".dropdown-menu");
        if (trigger) trigger.setAttribute("aria-expanded", "false");
        if (menu) {
          menu.classList.remove("show");
          menu.style.left = "";
          [...menu.children].forEach(item => (item.style.transitionDelay = ""));
        }
      }
    });
  }

  function positionMenu(li) {
    const trigger = li.querySelector('a[aria-haspopup="true"]');
    const menu    = li.querySelector(".dropdown-menu");
    if (!trigger || !menu) return;

    const tRect = trigger.getBoundingClientRect();
    const mRect = menu.getBoundingClientRect();
    const liRect = li.getBoundingClientRect();
    const vw = window.innerWidth;

    const center  = tRect.left + tRect.width / 2;
    let leftAbs   = center - mRect.width / 2;
    leftAbs       = clamp(leftAbs, 16, vw - mRect.width - 16);
    const relLeft = leftAbs - liRect.left;

    menu.style.left = `${relLeft}px`;
  }

  function openDropdown(trigger) {
    const li   = trigger.closest(".dropdown");
    const menu = trigger.nextElementSibling;
    closeAllDropdowns(li);

    li.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    menu.classList.add("show");

    [...menu.children].forEach((item, i) => {
      item.style.transitionDelay = `${i * 25}ms`;
    });

    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    if (!isMobile) requestAnimationFrame(() => positionMenu(li));
  }

  function toggleDropdown(trigger) {
    const li = trigger.closest(".dropdown");
    li.classList.contains("open") ? closeAllDropdowns() : openDropdown(trigger);
  }

  // ===== Navbar: Hamburger & Dropdowns =====
  const navCloseAll = () => {
    navLinks?.classList.remove("active");
    hamburger?.setAttribute("aria-expanded", "false");
    closeAllDropdowns();
  };

  hamburger?.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = !navLinks?.classList.contains("active");
    navLinks?.classList.toggle("active");
    closeAllDropdowns();
    hamburger.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });

  dropdownLinks.forEach(link => {
    link.setAttribute("aria-expanded", "false");
    link.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleDropdown(link);
    });
  });

  document.addEventListener("click", navCloseAll);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") navCloseAll(); });

  // Reposition on resize/scroll
  const repositionOpen = () => document.querySelectorAll(".dropdown.open").forEach(positionMenu);
  window.addEventListener("resize", repositionOpen);
  window.addEventListener("scroll", repositionOpen);

  // ===== Filter-Sidebar Toggle =====
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      const isOpen = sidebar.classList.toggle("open");
      const txtOpen  = toggleBtn.getAttribute("data-open-text")  || "Filter schließen";
      const txtClose = toggleBtn.getAttribute("data-close-text") || "Filter anzeigen";
      toggleBtn.textContent = isOpen ? txtOpen : txtClose;
    });
  }

  // ===== Smooth Scroll (optional) =====
  searchLink?.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
  });

  // ===== Titel-Autofill =====
  function updateTitle() {
    if (!makeInput || !modelInput || !titleInput) return;
    const make  = makeInput.value.trim();
    const model = modelInput.value.trim();
    if (make || model) titleInput.value = `${make} ${model}`.trim();
  }
  makeInput?.addEventListener("input", updateTitle);
  modelInput?.addEventListener("input", updateTitle);

  // ===== Navbar Login/Logout =====
  (async () => {
    const authLi = document.getElementById("auth-link");
    if (!authLi) return;
    try {
      const res = await fetch("/getNutzerInfo", { credentials: "include" });
      const data = await res.json();
      if (data?.eingeloggt) {
        authLi.innerHTML = `
          <a href="#" id="logout-link">
            <i class="fas fa-sign-out-alt"></i> Abmelden
          </a>`;
        document.getElementById("logout-link")?.addEventListener("click", async (e) => {
          e.preventDefault();
          try {
            await fetch("/logout", { method: "POST", credentials: "include" });
            localStorage.clear();
            location.reload();
          } catch {
            alert("Abmelden fehlgeschlagen.");
          }
        });
      }
    } catch { /* ignore */ }
  })();

  // ===== Login-Redirects =====
  function checkLoginAndGo(targetUrl) {
    fetch("/getNutzerInfo", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.eingeloggt) {
          window.location.href = targetUrl;
        } else {
          try { localStorage.setItem("redirectAfterLogin", targetUrl); } catch {}
          window.location.href = "login.html";
        }
      })
      .catch(() => {
        try { localStorage.setItem("redirectAfterLogin", targetUrl); } catch {}
        window.location.href = "login.html";
      });
  }
  document.getElementById("saved-cars-link")?.addEventListener("click", (e) => { e.preventDefault(); checkLoginAndGo("gespeicherte-autos.html"); });
  document.getElementById("my-cars-link")?.addEventListener("click",    (e) => { e.preventDefault(); checkLoginAndGo("meine-autos.html"); });

  // ===== Medien-Slider (Pointer Events, sauberer Drag) =====
  function initMediaSlider(mediaContainer) {
    if (!mediaContainer) return;
    const slidesWrapper = mediaContainer.querySelector(".slides");
    if (!slidesWrapper) return;

    const slides = Array.from(slidesWrapper.children);
    const btnLeft  = mediaContainer.querySelector(".media-arrow.left");
    const btnRight = mediaContainer.querySelector(".media-arrow.right");

    // A11y
    btnLeft?.setAttribute("aria-label", "Vorheriges Bild");
    btnRight?.setAttribute("aria-label", "Nächstes Bild");

    // Keine Slider-Controls nötig bei 0/1 Slide
    const hasMultiple = slides.length > 1;
    if (!hasMultiple) {
      btnLeft?.setAttribute("disabled", "true");
      btnRight?.setAttribute("disabled", "true");
    }

    // Grundlayout
    slidesWrapper.style.display = "flex";
    slidesWrapper.style.willChange = "transform";
    slidesWrapper.style.transition = "transform 0.3s ease";
    slidesWrapper.style.touchAction = "pan-y"; // Scrollen vertikal erlauben
    slides.forEach(slide => {
      slide.style.flex = "0 0 100%";
      slide.style.minWidth = "100%";
      slide.addEventListener("dragstart", e => e.preventDefault());
    });

    const state = {
      idx: 0,
      isDragging: false,
      pointerId: null,
      startX: 0,
      prevX: 0,
      startTranslate: 0,
      currentTranslate: 0,
      hasMoved: false
    };

    const width = () => mediaContainer.clientWidth;
    const snap = () => {
      state.currentTranslate = -state.idx * width();
      slidesWrapper.style.transition = "transform 0.3s ease";
      setTransform(state.currentTranslate);
    };
    const clampIndex = (i) => clamp(i, 0, Math.max(0, slides.length - 1));
    const setTransform = (x) => { slidesWrapper.style.transform = `translateX(${x}px)`; };

    function goTo(i) {
      state.idx = clampIndex(i);
      snap();
      updateArrows();
    }

    function updateArrows() {
      if (!hasMultiple) return;
      if (btnLeft)  btnLeft.disabled  = state.idx <= 0;
      if (btnRight) btnRight.disabled = state.idx >= slides.length - 1;
    }
    updateArrows();

    // === Pointer Events ===
    function onPointerDown(e) {
      if (!hasMultiple) return;
      state.isDragging = true;
      state.pointerId = e.pointerId ?? null;
      slidesWrapper.setPointerCapture?.(state.pointerId);
      state.startX = e.clientX;
      state.prevX = e.clientX;
      state.startTranslate = state.currentTranslate;
      state.hasMoved = false;
      slidesWrapper.style.transition = "none";
      document.body.style.userSelect = "none";
    }

    function onPointerMove(e) {
      if (!state.isDragging) return;
      const dx = e.clientX - state.prevX;
      state.prevX = e.clientX;
      if (Math.abs(e.clientX - state.startX) > 2) state.hasMoved = true;
      // leichte Gummi-Zone am Rand
      const maxTranslate = 0;
      const minTranslate = -(slides.length - 1) * width();
      let next = state.currentTranslate + dx;
      if (next > maxTranslate) next = maxTranslate + (next - maxTranslate) * 0.35;
      if (next < minTranslate) next = minTranslate + (next - minTranslate) * 0.35;
      state.currentTranslate = next;
      setTransform(state.currentTranslate);
    }

    function onPointerUpOrCancel() {
      if (!state.isDragging) return;
      state.isDragging = false;
      document.body.style.userSelect = "";

      // snap nach Threshold
      const moved = state.currentTranslate - state.startTranslate;
      const threshold = Math.max(40, width() * 0.18);
      if (moved <= -threshold) state.idx = clampIndex(state.idx + 1);
      else if (moved >= threshold) state.idx = clampIndex(state.idx - 1);

      snap();
    }

    slidesWrapper.addEventListener("pointerdown", onPointerDown, { passive: true });
    slidesWrapper.addEventListener("pointermove", onPointerMove, { passive: true });
    slidesWrapper.addEventListener("pointerup", onPointerUpOrCancel, { passive: true });
    slidesWrapper.addEventListener("pointercancel", onPointerUpOrCancel, { passive: true });
    slidesWrapper.addEventListener("pointerleave", onPointerUpOrCancel, { passive: true });

    // Tastatur-Navigation
    slidesWrapper.tabIndex = 0;
    slidesWrapper.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") goTo(state.idx + 1);
      if (e.key === "ArrowLeft")  goTo(state.idx - 1);
    });

    // Klicks nach Drag nicht durchlassen (z. B. Card-Click)
    slidesWrapper.addEventListener("click", (e) => {
      if (state.hasMoved) e.stopPropagation();
    }, true);

    // Pfeile
    btnRight?.addEventListener("click", (e) => { e.stopPropagation(); goTo(state.idx + 1); });
    btnLeft?.addEventListener("click",  (e) => { e.stopPropagation(); goTo(state.idx - 1); });

    // Resize
    let ro;
    if ("ResizeObserver" in window) {
      ro = new ResizeObserver(() => snap());
      ro.observe(mediaContainer);
    } else {
      window.addEventListener("resize", snap);
    }

    // Initial
    snap();
  }
  // --- Ende initMediaSlider ---

  async function fetchSearch(p = 1, limit = pageSize) {
    const reqId = ++lastReqId;
    const params = new URLSearchParams(window.location.search);

    normalizeHuParams(params);
    // Client-only: nicht ans Backend senden
    params.delete("verbrauch_max");
    params.set("page", String(p));
    params.set("limit", String(limit));
    const res = await fetch(`/api/search?${params.toString()}`, { credentials: "omit" });
  
    if (!res.ok) throw new Error("Fetch /api/search fehlgeschlagen");
    const data = await res.json();
    if (reqId !== lastReqId) throw new Error("stale"); // alte Antwort verwerfen
    return data;
  }

  // ---- DB -> UI Normalform (einheitliche Feldnamen) ----
  function normalizeItem(raw) {
    // EZ ...
    const ez =
      raw.erstzulassung ||
      (raw.verkauf_ez_jahr && raw.verkauf_ez_monat
        ? `${String(raw.verkauf_ez_jahr)}-${String(raw.verkauf_ez_monat).padStart(2, "0")}`
        : "");

    // Preis robust picken
    const pickPrice = (...vals) => {
      for (const v of vals) {
        if (v === null || v === undefined) continue;
        const s = String(v).trim();
        if (!s) continue;
        const n = Number(s.replace(/\./g, "").replace(",", "."));
        if (Number.isFinite(n)) return n;
      }
      return "";
    };

    const preis = pickPrice(
      raw["brutto-preis"],
      raw.brutto_preis,
      raw.verkauf_brutto,
      raw.preis,
      raw.verkauf_preis,
      raw.verkauf_netto
    );

    return {
      _id: raw._id,
      titel: raw.titel || [raw.marke, raw.modell].filter(Boolean).join(" ").trim(),
      marke: raw.marke || "",
      modell: raw.modell || "",

      preis,

      kilometer: raw.verkauf_kilometer ?? raw.kilometer ?? raw.km ?? "",
      erstzulassung: ez,
      kraftstoff: raw.verkauf_kraftstoff ?? raw.kraftstoff ?? "",
      getriebe: raw.verkauf_getriebe ?? raw.getriebe ?? "",
      leistung: raw.verkauf_leistung ?? raw.leistung ?? raw.ps ?? "",
      verbrauch_kombiniert: raw.verbrauch_kombiniert ?? raw.verkauf_verbrauch_kombiniert ?? "",

      verkaeufer: raw.verkauf_verkaeufer ?? raw.verkaeufer ?? "",
      name: raw.verkauf_name ?? raw.name ?? "",
      standort: raw.standort ?? "",
      telefon: raw.telefon ?? raw.phone ?? "",

      images: Array.isArray(raw.images) ? raw.images
            : Array.isArray(raw.fotos)  ? raw.fotos
            : Array.isArray(raw.media)  ? raw.media.map(m => m.url || m)
            : [],
      video: raw.video || "",

      raw
    };
  }// Gibt eine Zahl in l/100 km zurück.
// - Bevorzugt Zahlen direkt vor "l/100 km"
// - Ignoriert kWh/100 km (EVs -> NaN)
// - Bei Bereichen (z. B. "4,6–5,2 l/100 km") wird der höhere Wert genommen
// - Fallback: max. Zahl < 60 (um CO₂ "120 g/km" zu ignorieren)
function parseVerbrauchNum(val) {
  if (val == null) return NaN;
  if (typeof val === 'number') return Number.isFinite(val) ? val : NaN;

  if (typeof val === 'object') {
    const keys = [
      'kombiniert','combined','wltp_kombiniert','wltpCombined','nefz_kombiniert',
      'combined_l_100km','kombiniert_l_100km','kombiniert_l_pro_100_km'
    ];
    for (const k of keys) {
      if (val[k] != null) {
        const n = parseVerbrauchNum(val[k]);
        if (Number.isFinite(n)) return n;
      }
    }
    // Fallback: irgendein Key mit "komb"
    for (const k in val) {
      if (/komb/i.test(k)) {
        const n = parseVerbrauchNum(val[k]);
        if (Number.isFinite(n)) return n;
      }
    }
    return NaN;
  }

  const s = String(val).toLowerCase().replace(/\s+/g, ' ').trim();

  // EV-/PHEV-Einheit -> ignorieren
  if (/\bkwh\s*\/?\s*100\s*km\b/.test(s)) return NaN;

  // 1) Zahlen direkt vor "l/100 km"
  const litersAll = [];
  const rxLiters = /(\d+(?:[.,]\d+)?)(?=\s*(?:l|liter)\s*\/\s*100\s*km\b)/gi;
  for (const m of s.matchAll(rxLiters)) {
    litersAll.push(parseFloat(m[1].replace(',', '.')));
  }
  if (litersAll.length) {
    return Math.max(...litersAll.filter(n => Number.isFinite(n)));
  }

  // 2) Fallback: nimm max aller Zahlen < 60 (um 120 g/km auszuschließen)
  const nums = (s.match(/\d+(?:[.,]\d+)?/g) || [])
    .map(t => parseFloat(t.replace(',', '.')))
    .filter(n => Number.isFinite(n) && n < 60);
  if (nums.length) return Math.max(...nums);

  return NaN;
}

// Holt "kombiniert" aus möglichst vielen Varianten.
// Gibt NaN zurück, wenn nur kWh/100 km vorhanden oder nichts erkennbar.
function getCombinedConsumption(item) {
  const candidates = [
    item.verkauf_verbrauch_kombiniert,
    item.verbrauch_kombiniert,
    item.raw?.verkauf_verbrauch_kombiniert,
    item.raw?.verbrauch_kombiniert,
    item.raw?.verbrauch?.kombiniert,
    item.raw?.wltp_kombiniert,
    item.raw?.wltp?.kombiniert,
    item.raw?.nefz_kombiniert,
    item.raw?.nefz?.kombiniert,
    item.raw?.verbrauch // String-Fallback
  ];
  for (const c of candidates) {
    const n = parseVerbrauchNum(c);
    if (Number.isFinite(n)) return n;
  }

  // Fallback: Mittelwert inner/außerorts
  const inner = parseVerbrauchNum(
    item.verkauf_verbrauch_innerorts ??
    item.raw?.verkauf_verbrauch_innerorts ??
    item.raw?.verbrauch_innerorts ??
    item.raw?.verbrauch?.innerorts
  );
  const outer = parseVerbrauchNum(
    item.verkauf_verbrauch_ausserorts ??
    item.raw?.verkauf_verbrauch_ausserorts ??
    item.raw?.verbrauch_ausserorts ??
    item.raw?.verbrauch?.ausserorts
  );
  if (Number.isFinite(inner) && Number.isFinite(outer)) return (inner + outer) / 2;

  return NaN;
}function applyClientFilters(items) {
  // UI-Refs
  const priceFromEl       = document.getElementById("priceFrom");
  const priceToEl         = document.getElementById("priceTo");
  const mileageFromEl     = document.getElementById("mileageFrom");
  const mileageToEl       = document.getElementById("mileageTo");
  const powerFromEl       = document.getElementById("powerFrom");
  const powerToEl         = document.getElementById("powerTo");

  const fuelTypeEl        = document.getElementById("fuelType") || document.getElementById("fuel");
  const transmissionEl    = document.getElementById("transmission") || document.getElementById("gear");
  const driveEl           = document.getElementById("antriebsart") || document.getElementById("drivetrain") || document.getElementById("antrieb");

  const accidentFreeEl    = document.getElementById("accidentFree");
  const inspectionUntilEl = document.getElementById("inspectionUntil");     // HU bis (YYYY-MM)
  const huMinMonthsEl     = document.getElementById("huMinMonths")          // optionales Feld "HU mind. (Monate)"
                          || document.getElementById("inspectionMinMonths");

  const firstRegFromEl    = document.getElementById("firstRegFrom");
  const firstRegMonthEl   = document.getElementById("first-registration-month");
  const firstRegYearEl    = document.getElementById("first-registration-year");

  const markeEl           = document.getElementById("marke");
  const modellEl          = document.getElementById("modell");
  const modVarEl          = document.getElementById("modellausfuehrung");

  const selV              = document.getElementById("verbrauch-select");
  const inpV              = document.getElementById("verbrauch");

  // Helpers
  const pad2 = (m) => String(m).padStart(2, "0");
  function parseYM(val, fallbackMonthIfYearOnly = null) {
    if (!val) return "";
    const s = String(val).trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})$/);          // YYYY-MM
    if (m) return `${m[1]}-${pad2(m[2])}`;
    m = s.match(/^(\d{1,2})[-/.](\d{4})$/);              // MM/YYYY
    if (m) return `${m[2]}-${pad2(m[1])}`;
    m = s.match(/^(\d{4})$/);                            // YYYY
    if (m) return fallbackMonthIfYearOnly ? `${m[1]}-${pad2(fallbackMonthIfYearOnly)}` : "";
    if (/^\d{4}-\d{2}$/.test(s)) return s;               // bereits korrekt
    return "";
  }
  const toDec = (s) => {
    const t = String(s ?? "").trim().replace(/\s+/g, "").replace(",", ".");
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : NaN;
  };
  // Monate Restlaufzeit ab "heute" (lokal)
  function monthsLeftFromNow(ym /* "YYYY-MM" */) {
    if (!ym) return NaN;
    const [yStr, mStr] = ym.split("-");
    const y = parseInt(yStr, 10), m = parseInt(mStr, 10);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return NaN;
    const now = new Date();
   return (y - now.getFullYear()) * 12 + (m - (now.getMonth() + 1));
  }

  // URL aktuell lesen (für Fallbacks + CSV)
  const sp = new URLSearchParams(location.search);

  // UI → Zahlen
  const priceFrom     = toNum(priceFromEl?.value ?? "");
  const priceTo       = toNum(priceToEl?.value   ?? "");
  const mileageFrom   = toNum(mileageFromEl?.value ?? "");
  const mileageTo     = toNum(mileageToEl?.value   ?? "");

  const rawPowerFrom  = toNum(powerFromEl?.value ?? "");
  const rawPowerTo    = toNum(powerToEl?.value   ?? "");
  const powerFrom     = (!isNaN(rawPowerFrom) && rawPowerFrom > 0) ? rawPowerFrom : toNum(sp.get("ps_min"));
  const powerTo       = (!isNaN(rawPowerTo)   && rawPowerTo   > 0) ? rawPowerTo   : toNum(sp.get("ps_max"));

  // Kraftstoff (Mehrfach): Checkboxen > Select > URL(CSV)
  let fuelSet = new Set(
    [...document.querySelectorAll('input[name="kraftstoff"]:checked')]
      .map(cb => fuelCanon(cb.value))
      .filter(Boolean)
  );
  if (!fuelSet.size && fuelTypeEl) {
    const v = String(fuelTypeEl.value || "").trim();
    if (v && !/^(beliebig|any|alle|all|-)$/i.test(v)) fuelSet = new Set([fuelCanon(v)]);
  }
  if (!fuelSet.size) {
    splitCsv(sp.get("kraftstoff")).map(fuelCanon).forEach(t => t && fuelSet.add(t));
  }

  // Getriebe (einfach)
  let gearEff = "beliebig";
  if (transmissionEl && transmissionEl.value && !/^(beliebig|any|alle|all|-)$/i.test(transmissionEl.value)) {
    gearEff = canon(norm(transmissionEl.value), GEAR_MAP);
  } else if (sp.get("getriebe")) {
    gearEff = canon(norm(sp.get("getriebe")), GEAR_MAP);
  }

  // Antrieb (Mehrfach): Checkboxen > Select > URL(CSV)
  let driveSet = new Set(
    [...document.querySelectorAll('input[name="antrieb"]:checked')]
      .map(cb => driveCanon(cb.value))
      .filter(Boolean)
  );
  if (!driveSet.size && driveEl) {
    const v = String(driveEl.value || "").trim();
    if (v && !/^(beliebig|any|alle|all|-)$/i.test(v)) driveSet = new Set([driveCanon(v)]);
  }
  if (!driveSet.size) {
    splitCsv(sp.get("antriebsart") || sp.get("antrieb")).map(driveCanon).forEach(t => t && driveSet.add(t));
  }

  const accidentFree = !!accidentFreeEl?.checked;

  // HU: UI & URL-Fallbacks
  const inspectionUntilUI = inspectionUntilEl?.value || ""; // erwartet YYYY-MM
  // - hu_bis oder inspectionUntil aus URL → mind. gültig bis Datum
// - hu_bis / inspectionUntil / hu (Text) -> mind. gültig bis Datum
const huUntilEff = normalizeYMAny(
  inspectionUntilUI ||
  sp.get("hu_bis") ||
  sp.get("inspectionUntil") ||
  sp.get("hu") ||        // falls als Freitext gesetzt
  "",
  12 // Jahresangabe -> Dezember
);

  // - hu_min_monate (UI oder URL)
  const huMinMonths = (() => {
    const ui = toNum(huMinMonthsEl?.value ?? "");
    if (Number.isFinite(ui) && ui > 0) return ui;
    const qp = toNum(sp.get("hu_min_monate") || sp.get("hu_min_months"));
    return (Number.isFinite(qp) && qp > 0) ? qp : NaN;
  })();

  const firstRegFromUI =
    (firstRegFromEl?.value) ||
    (firstRegYearEl?.value && firstRegMonthEl?.value
      ? `${firstRegYearEl.value}-${String(firstRegMonthEl.value).padStart(2, "0")}`
      : "");

  const priceToEff   = (!isNaN(priceTo)   && priceTo   > 0) ? priceTo   : toNum(sp.get("price_max"));
  const mileageToEff = (!isNaN(mileageTo) && mileageTo > 0) ? mileageTo : toNum(sp.get("km_max"));

  const ezFromEff = parseYM(firstRegFromUI || sp.get("ezFrom") || "", 1);
  const ezToEff   = parseYM(sp.get("ezTo") || "", 12);

  // Marke/Modell
  let brandEff  = sp.get("marke") ? norm(sp.get("marke")) : "";
  let modelsEff = splitCsv(sp.get("modell")).map(norm);
  if (markeEl && markeEl.value) brandEff = norm(markeEl.value);
  if (modellEl && modellEl.options) {
    const selected = [...modellEl.options].filter(o => o.selected).map(o => norm(o.value));
    if (selected.length) modelsEff = selected;
  }

  // Modellvariante
  const modVarUI  = (modVarEl?.value || "").trim().toLowerCase();
  const modVarEff = modVarUI || (sp.get("modellausfuehrung") || "").toLowerCase();

  // Verbrauch (max)
  const rawV = selV
    ? (selV.value === "custom" ? (inpV?.value || "") : selV.value)
    : (inpV?.value || "");
  const uiMax = toDec(rawV);
  const qpMax = toDec(sp.get("verbrauch_max"));
  const vMax  = Number.isFinite(uiMax) && uiMax > 0 ? uiMax
              : Number.isFinite(qpMax) && qpMax > 0 ? qpMax
              : NaN;

  // --- Filtern ---
  return items.filter(i => {
    const iBrand = norm(i.marke);
    const iModel = norm(i.modell);
    const iTitle = norm(i.titel || "");

    if (brandEff && iBrand !== brandEff) return false;
    if (modelsEff.length) {
      const hit = modelsEff.some(m => iModel.includes(m) || iTitle.includes(m));
      if (!hit) return false;
    }

    if (modVarEff) {
      const hay = (String(i.raw?.modellausfuehrung || "") + " " + (i.titel || "")).toLowerCase();
      if (!hay.includes(modVarEff)) return false;
    }

    const preis = toNum(i.preis);
    if (!isNaN(priceFrom) && priceFrom > 0 && !(preis >= priceFrom)) return false;
    if (!isNaN(priceToEff) && priceToEff > 0 && !(preis <= priceToEff)) return false;

    const km = toNum(i.kilometer);
    if (!isNaN(mileageFrom) && mileageFrom > 0 && !(km >= mileageFrom)) return false;
    if (!isNaN(mileageToEff) && mileageToEff > 0 && !(km <= mileageToEff)) return false;

    const ps = toNum(i.leistung);
    if (!isNaN(powerFrom) && powerFrom > 0 && !(ps >= powerFrom)) return false;
    if (!isNaN(powerTo)   && powerTo   > 0 && !(ps <= powerTo))   return false;

    // Kraftstoff
    if (fuelSet.size) {
      const ft = fuelCanon(i.kraftstoff || i.raw?.verkauf_kraftstoff || i.raw?.kraftstoff || "");
      if (!ft) return false;
      const isHybridAny = ft.startsWith("hybrid") && fuelSet.has("hybrid");
      const ok = fuelSet.has(ft) || isHybridAny;
      if (!ok) return false;
    }

    // Getriebe (einfach)
    if (gearEff !== "beliebig") {
      const tr = canon(norm(i.getriebe || i.raw?.verkauf_getriebe || i.raw?.getriebe || ""), GEAR_MAP);
      if (!tr || tr !== gearEff) return false;
    }

    // Antrieb (ODER)
    if (driveSet.size) {
      let dt = driveCanon(i.raw?.antriebsart || i.raw?.antrieb || i.raw?.drivetrain || "");
      if (!dt) {
        const textParts = [
          i.titel,
          i.raw?.beschreibung,
          (Array.isArray(i.raw?.verkauf_ausstattung) ? i.raw.verkauf_ausstattung.join(" ") : ""),
          (Array.isArray(i.raw?.ausstattung) ? i.raw.ausstattung.join(" ") : "")
        ].filter(Boolean).join(" ");
        dt = driveCanon(textParts);
      }
      if (!dt || !driveSet.has(dt)) return false;
    }

    // Unfallfrei
    if (accidentFree) {
      const flag = i.raw?.unfallfrei === true ||
        (Array.isArray(i.raw?.verkauf_ausstattung) && i.raw.verkauf_ausstattung.some(a => norm(a).includes("unfall")));
      if (!flag) return false;
    }

    // --- HU-Filter ---
    // HU des Items aus möglichen Feldern lesen
    const huItemYM =
      parseYM(i.raw?.hu || i.raw?.verkauf_hu || i.raw?.verkauf_hu_bis || i.raw?.hauptuntersuchung || "", 1); // Jahr→Januar

    // (1) Mind. Restmonate
    if (Number.isFinite(huMinMonths) && huMinMonths > 0) {
      if (!huItemYM) return false; // keine HU-Angabe -> raus, wenn Filter aktiv
      const left = monthsLeftFromNow(huItemYM);
      if (!(left >= huMinMonths)) return false;
    }
    // (2) Mindestdatum (YYYY-MM)
    else if (huUntilEff) {
      // Stringvergleich funktioniert bei "YYYY-MM"
      if (!huItemYM || huItemYM < huUntilEff) return false;
    }

    // EZ
    if (ezFromEff || ezToEff) {
      const ezItem = parseYM(i.erstzulassung || i.raw?.erstzulassung || "", 1);
      if (ezItem) {
        if (ezFromEff && ezItem < ezFromEff) return false;
        if (ezToEff   && ezItem > ezToEff)   return false;
      }
    }

    // Ort (reiner Textabgleich, clientseitig)
    if (sp.get("ort")) {
      const standort = norm(i.standort || "");
      if (!standort.includes(norm(sp.get("ort")))) return false;
    }

    // Verbrauch (max)
    if (Number.isFinite(vMax) && vMax > 0) {
      const v = getCombinedConsumption(i);
      if (Number.isFinite(v) && v > vMax) return false;
    }

    // Partikelfilter
    if (sp.get("partikelfilter")) {
      const pfRaw = i.raw?.verkauf_partikelfilter ?? i.raw?.partikelfilter ?? "";
      let hasPF = isTruthyRaw(pfRaw);
      if (!hasPF) {
        const lists = [i.raw?.verkauf_ausstattung, i.raw?.ausstattung];
        for (const list of lists) {
          if (Array.isArray(list) && list.some(a => /partikel|ruß|russ|dpf/i.test(String(a)))) { hasPF = true; break; }
        }
      }
      if (!hasPF) return false;
    }

    // Scheckheft
    if (sp.get("scheckheft")) {
      let hasSH = isTruthyRaw(i.raw?.scheckheft);
      if (!hasSH) {
        const lists = [i.raw?.verkauf_ausstattung, i.raw?.ausstattung];
        for (const list of lists) {
          if (Array.isArray(list) && list.some(a => /scheckheft/i.test(String(a)))) { hasSH = true; break; }
        }
      }
      if (!hasSH) return false;
    }

    // Fahrtauglich
    if (sp.get("fahrtauglich")) {
      let ok = isTruthyRaw(i.raw?.fahrtauglich ?? i.raw?.fahrbereit);
      if (!ok) {
        const lists = [i.raw?.verkauf_ausstattung, i.raw?.ausstattung];
        for (const list of lists) {
          if (Array.isArray(list) && list.some(a => /fahrbereit|fahrtauglich/i.test(String(a)))) { ok = true; break; }
        }
      }
      if (!ok) return false;
    }

    return true;
  });
}



  // ===== Sortierung (optional, clientseitig) =====
  function sortItems(items) {
    const v = sortBy?.value || "relevance";
    const copy = items.slice();

    switch (v) {
      case "price-asc":
        copy.sort((a,b) => (toNum(a.preis) || Infinity) - (toNum(b.preis) || Infinity));
        break;
      case "price-desc":
        copy.sort((a,b) => (toNum(b.preis) || -Infinity) - (toNum(a.preis) || -Infinity));
        break;
      case "date-desc": {
        const getDate = (x) => (x?.raw?.veroeffentlichtAm ? new Date(x.raw.veroeffentlichtAm)
                             : x?._id?.$date ? new Date(x._id.$date)
                             : new Date(0));
        copy.sort((a,b) => getDate(b) - getDate(a));
        break;
      }
      case "mileage-asc":
        copy.sort((a,b) => (toNum(a.kilometer) || Infinity) - (toNum(b.kilometer) || Infinity));
        break;
      default: // relevance
        break;
    }
    return copy;
  }

  function renderPager(totalCount) {
    if (!pager) return;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const current    = clamp(page, 1, totalPages);

    if (totalPages <= 1) {
      pager.innerHTML = "";
      return;
    }

    let html = `<button class="pager-btn" data-page="${current - 1}" ${current === 1 ? "disabled" : ""}>« Zurück</button>`;
    const windowSize = 5;
    const start = Math.max(1, current - Math.floor(windowSize / 2));
    const end   = Math.min(totalPages, start + windowSize - 1);
    for (let p = start; p <= end; p++) {
      html += `<button class="pager-btn ${p === current ? "active" : ""}" data-page="${p}">${p}</button>`;
    }
    html += `<button class="pager-btn" data-page="${current + 1}" ${current === totalPages ? "disabled" : ""}>Weiter »</button>`;
    pager.innerHTML = html;

    // Serverseitig blättern + Page in der URL mitführen
    pager.querySelectorAll(".pager-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const target = Number(e.currentTarget.getAttribute("data-page"));
        if (!isNaN(target)) {
          page = clamp(target, 1, totalPages);

          const params = new URLSearchParams(window.location.search);
          params.set("page", String(page));
          replaceUrlParams(params);

          loadAndRender(page);
        }
      });
    });
  }

  // Helper: echte Mongo-ID herausziehen
  function getMongoId(doc) {
    if (!doc) return null;
    if (doc._id && typeof doc._id === "object" && typeof doc._id.$oid === "string") return doc._id.$oid;
    if (typeof doc._id === "string") return doc._id;
    if (typeof doc.id === "string") return doc.id;
    return null;
  }
  function sellerInitials(name = "") {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map(p => (p[0] || "").toUpperCase()).join("") || "AV";
  }
  function renderItems() {
    if (!container) return;
    container.innerHTML = "";
  
    // Server liefert *nur die aktuelle Seite*:
    const view = filteredItems;
  
    if (!view.length) {
      container.innerHTML = "<p>❌ Keine Fahrzeuge gefunden.</p>";
      renderPager(serverTotal);
      return;
    }
  
    // Helper: Datensatz für anzeige.html zusammenbauen
    function toAnzeigePayload(item) {
      const raw = item?.raw && typeof item.raw === "object" ? item.raw : {};
      const merged = { ...raw, ...item }; // normalisierte Felder überschreiben raw
  
      if (merged.verkauf_kilometer == null && item.kilometer != null) merged.verkauf_kilometer = item.kilometer;
      if (!merged.verkauf_erstzulassung && item.erstzulassung) merged.verkauf_erstzulassung = item.erstzulassung;
      if (!merged.verkauf_kraftstoff && item.kraftstoff) merged.verkauf_kraftstoff = item.kraftstoff;
      if (!merged.verkauf_getriebe && item.getriebe) merged.verkauf_getriebe = item.getriebe;
      if (!merged.verkauf_leistung && item.leistung) merged.verkauf_leistung = item.leistung;
      if (!merged.verkauf_verbrauch_kombiniert && item.verbrauch_kombiniert) merged.verkauf_verbrauch_kombiniert = item.verbrauch_kombiniert;
      if (!merged.verkauf_verkaeufer && item.verkaeufer) merged.verkauf_verkaeufer = item.verkaeufer;
      if (!merged.verkauf_name && item.name) merged.verkauf_name = item.name;
  
      // Preise robuster abbilden
      if (merged.verkauf_brutto == null && (merged.brutto_preis != null)) merged.verkauf_brutto = merged.brutto_preis;
      if (merged.verkauf_brutto == null && (merged["brutto-preis"] != null)) merged.verkauf_brutto = merged["brutto-preis"];
      if (merged.verkauf_preis == null && (item.preis != null)) merged.verkauf_preis = item.preis;
  
      if (!merged.telefon && item.telefon) merged.telefon = item.telefon;
  
      return merged;
    }
  
    view.forEach(inserat => {
      // Medien säubern
      const imgs = (Array.isArray(inserat.images) ? inserat.images : [])
        .map(String)
        .filter(u => /^https?:\/\//i.test(u));
      const videoUrl = String(inserat.video || "");
      const tel  = sanitizePhone(inserat.telefon);
      const phoneHref = (tel && tel.length >= 3) ? `tel:${tel}` : "#";
  
      const priceNum = toNum(inserat.preis);
      const kmNum    = toNum(inserat.kilometer);
  
      // Verkäuferdaten robust bestimmen
      const rawType = String(
        inserat.seller?.type ||
        inserat.verkaeufer ||
        inserat.raw?.verkauf_verkaeufer ||
        ""
      ).toLowerCase();
  
      const isHaendler =
        rawType === "haendler" ||
        rawType === "händler" ||
        rawType.includes("händ") ||
        rawType.includes("haend");
  
      const sellerName =
        inserat.seller?.name ||
        inserat.name ||
        inserat.raw?.verkauf_name ||
        (isHaendler ? "Händler" : "Privatanbieter");
  
      const sellerLogo =
        inserat.seller?.logoUrl ||
        inserat.raw?.seller?.logoUrl ||
        inserat.logoUrl ||
        "";
  
      const sellerLocation =
        inserat.standort ||
        inserat.raw?.standort ||
        [inserat.plz, inserat.ort].filter(Boolean).join(" ") ||
        "Standort nicht angegeben";
  
      // 🔹 Verbrauch fürs UI robust ermitteln (gleicher Parser wie Filter)
      const vShow = getCombinedConsumption(inserat);
      const vShowText = Number.isFinite(vShow)
        ? String(vShow.toFixed(1)).replace('.', ',')   // z. B. "5,3"
        : '?';
  
      // Karte rendern (ohne gefährliche Text-Injektionen)
      const card = document.createElement("div");
      card.className = "car-card horizontal";
      card.innerHTML = `
        <div class="car-card-media">
          <div class="card-actions mobile-only">
            <button class="save-btn" title="Auto speichern"><i class="fas fa-heart"></i></button>
            <a href="${phoneHref}" class="contact-btn clean-phone" title="Verkäufer kontaktieren" role="button" ${phoneHref === "#" ? "aria-disabled='true'" : ""}>
              <i class="fas fa-phone"></i>
            </a>
          </div>
          <div class="media-container">
            <div class="slides">
              ${imgs.map(src => `<img src="${src}" class="slide" alt="">`).join("")}
              ${videoUrl ? `<video class="slide" controls muted playsinline preload="metadata"><source src="${videoUrl}" type="video/mp4"></video>` : ""}
            </div>
            <button class="media-arrow left"  type="button"><i class="fas fa-chevron-left"></i></button>
            <button class="media-arrow right" type="button"><i class="fas fa-chevron-right"></i></button>
          </div>
        </div>
  
        <div class="car-details">
          <div class="car-top-row">
            <h2 class="car-title"></h2>
            <p class="car-price">${isNaN(priceNum) ? "Preis n. a." : priceNum.toLocaleString("de-DE") + " €"}</p>
          </div>
  
          <p class="car-subtitle"></p>
  
          <div class="car-info-grid">
            <p><i class="fas fa-road"></i> ${isNaN(kmNum) ? "?" : kmNum.toLocaleString("de-DE")} km</p>
            <p><i class="fas fa-calendar-alt"></i> EZ ${inserat.erstzulassung || "?"}</p>
            <p><i class="fas fa-gas-pump"></i> ${inserat.kraftstoff || "?"}</p>
            <p><i class="fas fa-gauge-high"></i> ${inserat.leistung || "?"} PS</p>
            <p><i class="fas fa-gears"></i> ${inserat.getriebe || "?"}</p>
            <p><i class="fas fa-tint"></i> ${vShowText} l/100 km</p>
          </div>
  
          <div class="dealer-info-row">
            <div class="dealer-row">
              <div class="dealer-avatar">
                <img alt="">
                <span class="dealer-initials">${sellerInitials(sellerName)}</span>
              </div>
              <div class="dealer-meta">
                <div class="dealer-name"></div>
                <div class="dealer-location"></div>
              </div>
            </div>
            <div class="card-actions desktop-only">
              <button class="save-btn" title="Auto speichern"><i class="fas fa-heart"></i></button>
              <a href="${phoneHref}" class="contact-btn clean-phone" title="Verkäufer kontaktieren" role="button" ${phoneHref === "#" ? "aria-disabled='true'" : ""}>
                <i class="fas fa-phone"></i>
              </a>
            </div>
          </div>
        </div>
      `;
  
      // sichere Texte setzen
      card.querySelector(".car-title").textContent = inserat.titel || "Unbekanntes Fahrzeug";
      card.querySelector(".car-subtitle").textContent = inserat.raw?.verkauf_kurzbeschreibung || "";
      card.querySelector(".dealer-name").textContent = sellerName;
      card.querySelector(".dealer-location").textContent = sellerLocation;
  
      container.appendChild(card);
      initMediaSlider(card.querySelector(".media-container"));
  
      // Safari-sicheres Logo-Laden (nie display:none am <img>)
      const avatar = card.querySelector(".dealer-avatar");
      const img    = avatar.querySelector("img");
      avatar.classList.remove("has-logo");
      img.removeAttribute("src");
      img.setAttribute("alt", `${sellerName} Logo`);
  
      if (sellerLogo) {
        img.addEventListener("load",  () => { avatar.classList.add("has-logo"); }, { once: true });
        img.addEventListener("error", () => {
          avatar.classList.remove("has-logo");
          img.removeAttribute("src");
        }, { once: true });
        img.src = sellerLogo;
  
        if (img.complete && img.naturalWidth > 0) {
          avatar.classList.add("has-logo");
        }
      }
  
      // Hochformat-Erkennung + Alt-Texte für Bilder
      const titleForAlt = card.querySelector(".car-title").textContent || "Fahrzeugbild";
      card.querySelectorAll(".slide").forEach((m, idx) => {
        if (m.tagName === "VIDEO") {
          m.addEventListener("loadedmetadata", () => {
            if (m.videoHeight > m.videoWidth) m.classList.add("portrait-zoom");
          });
        } else if (m.tagName === "IMG") {
          m.setAttribute("alt", `${titleForAlt} – Bild ${idx + 1}`);
          m.addEventListener("load", () => {
            if (m.naturalHeight > m.naturalWidth) m.classList.add("portrait-zoom");
          });
        }
      });
  
      // Karte klickbar (nicht auf Buttons/Arrows)
      const realId = getMongoId(inserat);
      card.dataset.id = realId || "";
      card.addEventListener("click", (e) => {
        if (e.target.closest("button, a, .media-arrow")) return;
        try {
          const payload = toAnzeigePayload(inserat);
          localStorage.setItem("ausgewaehltesInserat", JSON.stringify(payload));
        } catch {}
        const qs = realId ? `?id=${encodeURIComponent(realId)}` : "";
        window.location.href = `anzeige.html${qs}`;
      });
    });
  
    renderPager(serverTotal); // Wichtig: Gesamttreffer vom Server
  }
  

  async function loadAndRender(p = 1) {
    try {
      const { page: serverPage, limit: serverLimit, total, results } = await fetchSearch(p, pageSize);

      serverTotal   = total;
      filteredItems = Array.isArray(results) ? results.map(normalizeItem) : [];
      page          = Number(serverPage) || 1;

      // Client-Filter (inkl. Verbrauch & modellausfuehrung)
      filteredItems = applyClientFilters(filteredItems);
      // optional: filteredItems = sortItems(filteredItems);

      renderItems();

      // Chips-Leiste nach jedem (Neu-)Laden aktualisieren, falls vorhanden
      if (typeof renderActiveFilters === "function") {
        renderActiveFilters();
      }

    } catch (err) {
      if (String(err?.message || "").toLowerCase() === "stale") return; // alte Antwort ignorieren
      console.error("Fehler beim Laden der Suche:", err);
      if (container) container.innerHTML = "<p>🚫 Fehler beim Laden der Ergebnisse.</p>";
    }
  }

  // ===== Events: Filter & Sort =====
  function setOrDelete(params, key, val) {
    if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) {
      params.delete(key);
    } else {
      params.set(key, String(val));
    }
  }
  function mapSortSelectToParam(v) {
    if (v === "price-asc")  return "preis_asc";
    if (v === "price-desc") return "preis_desc";
    return "neueste"; // "date-desc" und alles andere
  }function setOrDelete(params, key, val) {
    if (val == null) return params.delete(key);
    const s = String(val).trim();
    if (s === "" || s === "Beliebig" || s === "-" || s === "any" || s === "alle" || s === "all") params.delete(key);
    else params.set(key, s);
  }function updateUrlFromUiAndReload() {
    const params = new URLSearchParams(window.location.search);
  
    const setOrDelete = (p, k, v) => {
      const s = (v == null ? "" : String(v).trim());
      if (!s || /^(beliebig|any|alle|all|-)$/i.test(s)) p.delete(k);
      else p.set(k, s);
    };
  
    // Marke / Modell / Variante
    const markeEl  = document.getElementById("marke");
    const modellEl = document.getElementById("modell");
    const modVarEl = document.getElementById("modellausfuehrung");
    setOrDelete(params, "marke", markeEl?.value || "");
    if (modellEl && modellEl.options) {
      const selected = [...modellEl.options]
        .filter(o => o.selected)
        .map(o => o.value)
        .filter(Boolean);
      setOrDelete(params, "modell", selected.length ? selected.join(",") : "");
    }
    setOrDelete(params, "modellausfuehrung", modVarEl?.value || "");
  
    // Erstzulassung FROM/TO (inkl. Fallback-Felder)
    const firstRegFromEl     = document.getElementById("firstRegFrom");
    const firstRegMonthEl    = document.getElementById("first-registration-month");
    const firstRegYearEl     = document.getElementById("first-registration-year");
    const firstRegToEl       = document.getElementById("firstRegTo");
    const firstRegMonthToEl  = document.getElementById("first-registration-month-to");
    const firstRegYearToEl   = document.getElementById("first-registration-year-to");
    const ezVonEl            = document.getElementById("ez-von");
    const ezBisEl            = document.getElementById("ez-bis");
  
    const fromRaw =
      firstRegFromEl?.value ||
      (firstRegYearEl?.value && firstRegMonthEl?.value
        ? `${firstRegYearEl.value}-${String(firstRegMonthEl.value).padStart(2, "0")}`
        : "") ||
      ezVonEl?.value || "";
  
    const toRaw =
      firstRegToEl?.value ||
      (firstRegYearToEl?.value && firstRegMonthToEl?.value
        ? `${firstRegYearToEl.value}-${String(firstRegMonthToEl.value).padStart(2, "0")}`
        : "") ||
      ezBisEl?.value || "";
  
    let [ezFrom, ezTo] = orderYM(parseYM(fromRaw), parseYM(toRaw));
    setOrDelete(params, "ezFrom", ezFrom);
    setOrDelete(params, "ezTo",   ezTo);
  
    // Preis / KM (max)
    const pMax  = parseInt(document.getElementById("priceTo")?.value || "", 10);
    const kmMax = parseInt(document.getElementById("mileageTo")?.value || "", 10);
    if (!Number.isNaN(pMax)  && pMax  > 0) params.set("price_max", String(pMax));  else params.delete("price_max");
    if (!Number.isNaN(kmMax) && kmMax > 0) params.set("km_max",   String(kmMax)); else params.delete("km_max");
  
    // Leistung (PS)
    const psMin = parseInt(document.getElementById("powerFrom")?.value || "", 10);
    const psMax = parseInt(document.getElementById("powerTo")?.value   || "", 10);
    if (!Number.isNaN(psMin) && psMin > 0) params.set("ps_min", String(psMin)); else params.delete("ps_min");
    if (!Number.isNaN(psMax) && psMax > 0) params.set("ps_max", String(psMax)); else params.delete("ps_max");
  
    // Kraftstoff (Select oder Checkboxen -> CSV)
    const fuelEl  = document.getElementById("fuelType") || document.getElementById("fuel");
    const fuelCbs = document.querySelectorAll('input[name="kraftstoff"]:checked');
    let fuelList = [...fuelCbs].map(cb => fuelCanon(cb.value)).filter(Boolean);
    if (!fuelList.length && fuelEl) {
      const v = String(fuelEl.value || "").trim();
      if (v && !/^(beliebig|any|alle|all|-)$/i.test(v)) fuelList = [fuelCanon(v)];
    }
    setOrDelete(params, "kraftstoff", fuelList.length ? fuelList.join(",") : "");
  
    // Getriebe (ein Wert)
    const gearEl  = document.getElementById("transmission") || document.getElementById("gear");
    const gearRaw = (gearEl?.value || "").toLowerCase();
    const gearVal = (gearRaw === "schaltgetriebe") ? "schalt" : gearRaw;
    if (gearVal && !/^(beliebig|any|alle|all|-)$/i.test(gearVal)) params.set("getriebe", gearVal);
    else params.delete("getriebe");
  
    // Antriebsart (Select oder Checkboxen -> CSV)
    const driveEl  = document.getElementById("antriebsart") || document.getElementById("drivetrain") || document.getElementById("antrieb");
    const driveCbs = document.querySelectorAll('input[name="antrieb"]:checked');
    let driveList = [...driveCbs].map(cb => driveCanon(cb.value)).filter(Boolean);
    if (!driveList.length && driveEl) {
      const v = driveCanon(driveEl.value);
      if (v && !/^(beliebig|any|alle|all|-)$/i.test(v)) driveList = [v];
    }
    setOrDelete(params, "antriebsart", driveList.length ? driveList.join(",") : "");
    params.delete("antrieb"); // legacy key
  
    // Verbrauch (clientseitig)
    (function () {
      const sel = document.getElementById("verbrauch-select");
      const inp = document.getElementById("verbrauch");
      const toDec = s => {
        const t = String(s ?? "").trim().replace(/\s+/g, "").replace(",", ".");
        if (!t) return null;
        const n = parseFloat(t);
        return Number.isFinite(n) ? n : null;
      };
      let raw = "";
      if (sel) raw = sel.value === "custom" ? (inp?.value || "") : sel.value;
      else raw = inp?.value || "";
      const n = toDec(raw);
      setOrDelete(params, "verbrauch_max", (n != null && n > 0) ? String(n) : "");
    })();
  
    // Ort / Umkreis
    const locVal = (document.getElementById("location")?.value || "").trim();
    setOrDelete(params, "ort", locVal);
    const distSel    = document.getElementById("distance-select");
    const distCustom = document.getElementById("distance-custom");
    if (distSel && !distSel.disabled) {
      const dRaw = distSel.value === "custom" ? (distCustom?.value || "") : distSel.value;
      const d    = parseInt(dRaw, 10);
      setOrDelete(params, "umkreis", (!Number.isNaN(d) && d > 0 && d !== 999) ? d : "");
    } else {
      params.delete("umkreis");
    }
  
    // === HU bis (YYYY-MM) — nur anfassen, wenn UI-Feld existiert ===
    {
      const huUntilEl =
        document.getElementById("inspectionUntil") ||
        document.getElementById("huUntil") ||
        null;
  
      if (huUntilEl) {
        const raw = (huUntilEl.value || "").trim();
        let val = "";
        if (/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) {
          val = raw;
        } else if (/^\d{4}$/.test(raw)) {
          // Jahresangabe -> Dezember
          val = `${raw}-12`;
        }
        if (val) params.set("hu_bis", val);
        else params.delete("hu_bis");
      }
      // Falls KEIN Feld existiert: vorhandenen URL-Param NICHT ändern
    }
  
    // === HU mind. Monate — nur anfassen, wenn UI-Feld existiert ===
    {
      const huMinEl =
        document.getElementById("huMinMonths") ||
        document.getElementById("inspectionMinMonths") ||
        null;
  
      if (huMinEl) {
        const n = parseInt((huMinEl.value || "").trim(), 10);
        if (Number.isFinite(n) && n > 0) params.set("hu_min_monate", String(n));
        else params.delete("hu_min_monate");
      }
      // Falls KEIN Feld existiert: vorhandenen URL-Param NICHT ändern
    }
  
    // Zusatz-Flags (Partikelfilter / Scheckheft / Unfallfrei)
    {
      const pfChecked = document.getElementById("partikelfilter")?.checked;
      const shChecked = document.getElementById("scheckheft")?.checked;
      const ufChecked =
        document.getElementById("unfallfrei")?.checked ??
        document.getElementById("accidentFree")?.checked;
  
      // Wir schreiben überall "1", damit Backend + Prefill klar damit arbeiten können
      setOrDelete(params, "partikelfilter", pfChecked ? "1" : "");
      setOrDelete(params, "scheckheft",     shChecked ? "1" : "");
      setOrDelete(params, "unfallfrei",     ufChecked ? "1" : "");
  
      // altes Fahrtauglich-Flag aufräumen, falls noch irgendwo vorhanden
      params.delete("fahrtauglich");
    }
  
    // Fahrzeugtyp (Checkboxen + Fallback-Select) -> CSV
    (function () {
      const s = new Set();
      document.querySelectorAll('input[name="fahrzeugtyp"]:checked')
        .forEach(cb => s.add(String(cb.value || "").trim()));
      const typeSel = document.getElementById("fahrzeugtyp");
      if (typeSel && typeSel.tagName === "SELECT") {
        [...typeSel.options].forEach(o => { if (o.selected && o.value) s.add(o.value.trim()); });
      }
      setOrDelete(params, "fahrzeugtyp", s.size ? [...s].join(",") : "");
    })();
  
    // Farbe (Checkboxen) -> CSV
    (function () {
      const s = new Set();
      document.querySelectorAll('input[name="farbe"]:checked')
        .forEach(cb => s.add(String(cb.value || "").trim()));
      setOrDelete(params, "farbe", s.size ? [...s].join(",") : "");
    })();
  
    // Türen (Checkboxen + Fallback-Select) -> CSV
    (function () {
      const s = new Set();
      const doorSel = document.getElementById("tueren");
      if (doorSel && doorSel.tagName === "SELECT") {
        [...doorSel.options].forEach(o => { if (o.selected && o.value) s.add(o.value.trim()); });
      }
      document.querySelectorAll('input[name="tueren"]:checked')
        .forEach(cb => s.add(String(cb.value || "").trim()));
      setOrDelete(params, "tueren", s.size ? [...s].join(",") : "");
    })();
  
    // Umweltplakette (ein Wert)
    (function () {
      let val = "";
      const checked = document.querySelector('input[name="umweltplakette"]:checked');
      if (checked) val = badgeCanon(checked.value);
      if (!val) {
        const sel = document.getElementById("umweltplakette") || document.getElementById("umwelt-badge");
        if (sel) val = badgeCanon(sel.value);
      }
      // Beide Keys für Kompatibilität schreiben
      if (val) {
        params.set("plakette", val);
        params.set("umweltplakette", val);
      } else {
        params.delete("plakette");
        params.delete("umweltplakette");
      }
    })();
  
    // *** Schadstoffklasse (ein Wert) ***
    (function () {
      let val = "";
      const checked = document.querySelector('input[name="schadstoffklasse"]:checked, input[name="emission"]:checked');
      if (checked) val = emissionCanon(checked.value);
      if (!val) {
        const sel = document.getElementById("schadstoffklasse") || document.getElementById("emission");
        if (sel) val = emissionCanon(sel.value);
      }
      setOrDelete(params, "schadstoffklasse", val);
    })();
  
    // Sortierung -> Serverparam
    const sortSelect = document.getElementById("sortBy");
    const mapSort = v =>
      v === "price-asc"  ? "preis_asc"  :
      v === "price-desc" ? "preis_desc" : "neueste";
    const sortVal = sortSelect?.value || "";
    if (sortVal) params.set("sort", mapSort(sortVal));
    else params.delete("sort");
  
    // Seite 1 + neu laden
    params.delete("page");
    history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
    loadAndRender(1);
  }
  
  // Falls noch nicht gebunden:
  document.getElementById("applyFiltersBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    updateUrlFromUiAndReload();
  });
  
  document.getElementById("sortBy")?.addEventListener("change", () => {
    updateUrlFromUiAndReload();
  });
  
  // ===== Init =====
  const initialPage = Math.max(parseInt(new URLSearchParams(window.location.search).get("page") || "1", 10), 1);
  loadAndRender(initialPage);
  function renderActiveFilters() {
    const bar = document.getElementById('activeFilterBar');
    if (!bar) return;
  
    const barWrap = document.getElementById('activeFilterWrap') || bar.parentElement;
  
    // Utils (nur hier)
    const uniq = (arr) => [...new Set(arr)];
    const pad2 = (m) => String(m).padStart(2, "0");
    const toInt = (v) => {
      const n = parseInt(String(v ?? "").replace(/\./g,"").replace(",", "."), 10);
      return Number.isFinite(n) ? n : NaN;
    };
    const int = v => isNaN(v) ? "" : `${Math.round(v).toLocaleString("de-DE")}`;
    const eur = v => isNaN(v) ? "" : `${Math.round(v).toLocaleString("de-DE")} €`;
    const isTruthyRaw = (v) => {
      if (typeof v === "boolean") return v;
      const s = String(v || "").trim().toLowerCase();
      return ["1","true","ja","mit","yes","vorhanden"].includes(s);
    };
    // YYYY, YYYY-MM, MM/YYYY, YYYY-MM-DD -> "YYYY-MM"
    function normalizeYMAny(raw, fallbackMonthIfYearOnly = null) {
      const s = String(raw || "").trim();
      if (!s) return "";
      let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (m) return `${m[1]}-${m[2]}`;
      m = s.match(/^(\d{4})-(\d{1,2})$/);           if (m) return `${m[1]}-${pad2(m[2])}`;
      m = s.match(/^(\d{1,2})[./-](\d{4})$/);       if (m) return `${m[2]}-${pad2(m[1])}`;
      m = s.match(/^(\d{4})$/);                     if (m) return fallbackMonthIfYearOnly ? `${m[1]}-${pad2(fallbackMonthIfYearOnly)}` : "";
      return "";
    }
    const fmtYM = (s) => /^\d{4}-\d{2}$/.test(s) ? `${s.slice(5,7)}/${s.slice(0,4)}` : s;
  
    // DOM Refs
    const priceFromEl   = document.getElementById("priceFrom");
    const priceToEl     = document.getElementById("priceTo");
    const mileageFromEl = document.getElementById("mileageFrom");
    const mileageToEl   = document.getElementById("mileageTo");
    const powerFromEl   = document.getElementById("powerFrom");
    const powerToEl     = document.getElementById("powerTo");
  
    const fuelEl  = document.getElementById("fuelType") || document.getElementById("fuel");
    const gearEl  = document.getElementById("transmission") || document.getElementById("gear");
    const driveEl = document.getElementById("antriebsart") || document.getElementById("drivetrain") || document.getElementById("antrieb");
  
    const firstRegFromEl  = document.getElementById("firstRegFrom");
    const firstRegMonthEl = document.getElementById("first-registration-month");
    const firstRegYearEl  = document.getElementById("first-registration-year");
  
    const accidentFreeEl = document.getElementById("accidentFree");
    const scheckheftEl   = document.getElementById("scheckheft"); // optionales UI-Checkbox-Element
  
    // HU Felder
    const inspectionEl  = document.getElementById("inspectionUntil"); // HU bis (YYYY-MM)
    const huMinMonthsEl = document.getElementById("huMinMonths") || document.getElementById("inspectionMinMonths");
  
    // Max. Fahrzeughalter (div. IDs abdecken)
    const halterMaxEl =
      document.getElementById("halterMax") ||
      document.getElementById("halter_max") ||
      document.getElementById("ownerMax")   ||
      document.getElementById("ownersMax")  ||
      document.getElementById("anzahlFahrzeughalterMax");
  
    const badgeSel    = document.getElementById("umweltplakette") || document.getElementById("umwelt-badge");
    const emissionSel = document.getElementById("schadstoffklasse") || document.getElementById("emission");
  
    // URL-Params
    const sp = new URLSearchParams(location.search);
  
    // Merkmale (CSV) – hier kann „Scheckheftgepflegt“ drinstehen
    const splitCsv = (v) => v ? String(v).split(",").map(s => s.trim()).filter(Boolean) : [];
    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");
  
    const merkmaleRaw  = sp.get("merkmale") || "";
    const merkmaleList = splitCsv(merkmaleRaw);
    const merkmaleNorm = merkmaleList.map(norm);
    const hasScheckheftFromMerkmale = merkmaleNorm.some(m =>
      /^(scheckheft|scheckheftgepflegt|scheckheft\s*gepflegt|serviceheft|serviceheftgepflegt|serviceheft\s*gepflegt)$/.test(m)
    );
  
    const qp = {
      marke: sp.get("marke") || "",
      modell: (sp.get("modell") || "").split(",").filter(Boolean),
      modellausfuehrung: sp.get("modellausfuehrung") || "",
      fahrzeugtyp: (sp.get("fahrzeugtyp") || "").split(",").filter(Boolean),
      tueren: (sp.get("tueren") || "").split(",").filter(Boolean),
      ezFrom: sp.get("ezFrom") || "",
      ezTo:   sp.get("ezTo")   || "",
      km_max: sp.get("km_max") || "",
      price_max: sp.get("price_max") || "",
      ps_min: sp.get("ps_min") || "",
      ps_max: sp.get("ps_max") || "",
      getriebe: (sp.get("getriebe") || "").toLowerCase(),
      kraftstoff: (sp.get("kraftstoff") || "").split(",").map(fuelCanon).filter(Boolean),
      antrieb: (sp.get("antriebsart") || sp.get("antrieb") || "").split(",").map(driveCanon).filter(Boolean),
      ort: sp.get("ort") || "",
      umkreis: sp.get("umkreis") || "",
      verbrauch_max: sp.get("verbrauch_max") || "",
  
      // Flags
      partikelfilter: isTruthyRaw(sp.get("partikelfilter")),
      // -> Scheckheft kann als eigenes Flag ODER via merkmale kommen
      scheckheft:     isTruthyRaw(sp.get("scheckheft")) || hasScheckheftFromMerkmale,
      fahrtauglich:   isTruthyRaw(sp.get("fahrtauglich")),
  
      // Max. Halter
      halter_max: sp.get("halter_max") || sp.get("max_halter") || sp.get("owners_max") || "",
  
      // Umwelt/Schadstoff
      umweltplakette:   badgeCanon(sp.get("umweltplakette") || sp.get("plakette")),
      schadstoffklasse: emissionCanon(sp.get("schadstoffklasse")),
  
      // HU (strukturiert + Freitext)
      hu_bis:  sp.get("hu_bis") || sp.get("inspectionUntil") || "",
      hu_min:  sp.get("hu_min_monate") || sp.get("hu_min_months") || "",
      hu_text: sp.get("hu") || ""
    };
  
    // Effektive Werte (UI > URL, wenn befüllt)
    const priceMin = toInt(priceFromEl?.value ?? "");
    const priceMax = (() => { const n = toInt(priceToEl?.value ?? ""); return Number.isFinite(n) && n > 0 ? n : toInt(qp.price_max); })();
    const kmMin    = toInt(mileageFromEl?.value ?? "");
    const kmMax    = (() => { const n = toInt(mileageToEl?.value ?? ""); return Number.isFinite(n) && n > 0 ? n : toInt(qp.km_max); })();
    const psMinEff = (() => { const n = toInt(powerFromEl?.value ?? ""); return Number.isFinite(n) && n > 0 ? n : toInt(qp.ps_min); })();
    const psMaxEff = (() => { const n = toInt(powerToEl?.value   ?? ""); return Number.isFinite(n) && n > 0 ? n : toInt(qp.ps_max); })();
  
    // Max. Halter – effektiv
    const halterMaxEff = (() => {
      const ui = toInt(halterMaxEl?.value ?? "");
      if (Number.isFinite(ui) && ui > 0) return ui;
      const url = toInt(qp.halter_max);
      return (Number.isFinite(url) && url > 0) ? url : NaN;
    })();
  
    // Kraftstoff (multi)
    let fuelList = uniq([
      ...(fuelEl && fuelEl.value && !/^(beliebig|any|alle|all|-)$/i.test(fuelEl.value) ? [fuelCanon(fuelEl.value)] : []),
      ...[...document.querySelectorAll('input[name="kraftstoff"]:checked')].map(cb => fuelCanon(cb.value)),
      ...qp.kraftstoff
    ]).filter(Boolean);
  
    // Getriebe (schön formatiert)
    const effGear = (() => {
      const ui = (gearEl?.value || "").trim();
      if (ui && !/^(beliebig|any|alle|all|-)$/i.test(ui)) return ui;
      let v = (qp.getriebe || "").toLowerCase();
      if (!v) return "";
      if (/^schalt/.test(v)) v = "Schaltgetriebe";
      else if (/^auto/.test(v)) v = "Automatik";
      else v = v.charAt(0).toUpperCase() + v.slice(1);
      return v;
    })();
  
    // Antrieb (multi)
    let driveList = uniq([
      ...(driveEl && driveEl.value && !/^(beliebig|any|alle|all|-)$/i.test(driveEl.value) ? [driveCanon(driveEl.value)] : []),
      ...[...document.querySelectorAll('input[name="antrieb"]:checked')].map(cb => driveCanon(cb.value)),
      ...qp.antrieb
    ]).filter(Boolean);
  
    // EZ
    const ezFromUIraw =
      (firstRegFromEl?.value?.trim()) ||
      (firstRegYearEl?.value && firstRegMonthEl?.value ? `${firstRegYearEl.value}-${pad2(firstRegMonthEl.value)}` : "") ||
      "";
    const ezFromEff = normalizeYMAny(ezFromUIraw || qp.ezFrom);
    const ezToEff   = normalizeYMAny(qp.ezTo);
  
    // HU (beide Varianten)
    const huUntilEff = normalizeYMAny(
      (inspectionEl?.value || qp.hu_bis || qp.hu_text || "").trim(),
      12 // Jahresangabe -> Dezember
    );
    const huMinMonthsEff = (() => {
      const ui = toInt(huMinMonthsEl?.value ?? "");
      if (Number.isFinite(ui) && ui > 0) return ui;
      const explicit = toInt(qp.hu_min);
      if (Number.isFinite(explicit) && explicit > 0) return explicit;
      const m = String(qp.hu_text).match(/(\d{1,2})/);
      const n = m ? parseInt(m[1], 10) : NaN;
      return (Number.isFinite(n) && n > 0) ? n : NaN;
    })();
  
    const accFree = !!accidentFreeEl?.checked;
  
    // Umwelt / Schadstoff
    const badgeEff = (() => {
      const r = document.querySelector('input[name="umweltplakette"]:checked');
      if (r && badgeCanon(r.value)) return badgeCanon(r.value);
      if (badgeSel && badgeCanon(badgeSel.value)) return badgeCanon(badgeSel.value);
      return qp.umweltplakette || "";
    })();
    const emissionEff = (() => {
      const r = document.querySelector('input[name="schadstoffklasse"]:checked, input[name="emission"]:checked');
      if (r && emissionCanon(r.value)) return emissionCanon(r.value);
      if (emissionSel && emissionCanon(emissionSel.value)) return emissionCanon(emissionSel.value);
      return qp.schadstoffklasse || "";
    })();
  
    // Chips bauen
    const chips = [];
    if (!isNaN(priceMin) && priceMin > 0) chips.push({key:"price_min", label:`Preis ab ${eur(priceMin)}`});
    if (!isNaN(priceMax) && priceMax > 0) chips.push({key:"price_max", label:`Preis bis ${eur(priceMax)}`});
    if (!isNaN(kmMin)    && kmMin  > 0)   chips.push({key:"km_min",    label:`KM ab ${int(kmMin)}`});
    if (!isNaN(kmMax)    && kmMax  > 0)   chips.push({key:"km_max",    label:`KM bis ${int(kmMax)}`});
    if (!isNaN(psMinEff) && psMinEff > 0) chips.push({key:"ps_min",    label:`PS ab ${int(psMinEff)}`});
    if (!isNaN(psMaxEff) && psMaxEff > 0) chips.push({key:"ps_max",    label:`PS bis ${int(psMaxEff)}`});
  
    fuelList.forEach(tok => chips.push({ key: "fuel", value: tok, label: `Kraftstoff: ${fuelNiceLabel(tok)}` }));
    if (effGear) chips.push({ key: "gear", label: `Getriebe: ${effGear}` });
    driveList.forEach(tok => chips.push({ key: "drive", value: tok, label: `Antrieb: ${driveNiceLabel(tok)}` }));
  
    if (badgeEff)    chips.push({ key: "umweltplakette",   value: badgeEff,    label: badgeNiceLabel(badgeEff) });
    if (emissionEff) chips.push({ key: "schadstoffklasse", value: emissionEff, label: emissionNiceLabel(emissionEff) });
  
    if (ezFromEff) chips.push({key:"ezFrom", label:`EZ ab ${fmtYM(ezFromEff)}`});
    if (ezToEff)   chips.push({key:"ezTo",   label:`EZ bis ${fmtYM(ezToEff)}`});
    if (accFree)   chips.push({key:"accidentFree", label:`Unfallfrei`});
  
    // HU-Chips
    if (Number.isFinite(huMinMonthsEff) && huMinMonthsEff > 0) {
      chips.push({ key: "hu_min_monate", label: `HU ≥ ${int(huMinMonthsEff)} Monate` });
    }
    if (huUntilEff) {
      chips.push({ key: "hu", label: `HU bis ${fmtYM(huUntilEff)}` });
    }
  
    // Scheckheft – aus Flag ODER aus merkmale
    if (qp.scheckheft) {
      chips.push({ key: "scheckheft", label: "Scheckheftgepflegt" });
    }
  
    // Max. Halter
    if (Number.isFinite(halterMaxEff) && halterMaxEff > 0) {
      chips.push({ key: "halter_max", label: `Halter ≤ ${int(halterMaxEff)}` });
    }
  
 // Weitere URL-basierte Chips
if (qp.marke)
  chips.push({ key: "marke", label: `Marke: ${qp.marke}` });

if (qp.modell?.length)
  qp.modell.forEach(m =>
    chips.push({ key: "modell", value: m, label: `Modell: ${m}` })
  );

if (qp.modellausfuehrung)
  chips.push({
    key: "modellausfuehrung",
    label: `Modellvariante: ${qp.modellausfuehrung}`
  });

if (qp.fahrzeugtyp?.length)
  qp.fahrzeugtyp.forEach(t =>
    chips.push({ key: "fahrzeugtyp", value: t, label: `Fahrzeugtyp: ${t}` })
  );

if (qp.tueren?.length)
  qp.tueren.forEach(n =>
    chips.push({ key: "tueren", value: n, label: `Türen: ${n}` })
  );

if (qp.ort)
  chips.push({ key: "ort", label: `Ort: ${qp.ort}` });

if (qp.umkreis)
  chips.push({ key: "umkreis", label: `Umkreis: ${qp.umkreis} km` });

if (qp.verbrauch_max)
  chips.push({
    key: "verbrauch_max",
    label: `Verbrauch ≤ ${String(qp.verbrauch_max).replace(".", ",")} l/100km`
  });

if (isTruthyRaw(qp.partikelfilter))
  chips.push({ key: "partikelfilter", label: "Partikelfilter" });

if (qp.fahrtauglich)
  chips.push({ key: "fahrtauglich", label: "Fahrtauglich" });

if (isTruthyRaw(qp.unfallfrei))
  chips.push({ key: "accidentFree", label: "Unfallfrei" });

    // Render
    if (!chips.length) {
      bar.textContent = "";
      bar.classList.add("is-empty");
      bar.removeAttribute("data-has-chips");
      if (barWrap) barWrap.classList.add("no-chips");
      return;
    }
  
    bar.classList.remove("is-empty");
    bar.setAttribute("data-has-chips", "1");
    if (barWrap) barWrap.classList.remove("no-chips");
  
    bar.innerHTML = chips.map(c => `
      <div class="filter-chip" data-key="${c.key}" ${('value' in c) ? `data-value="${c.value}"` : ""}>
        <span class="chip-label">${c.label}</span>
        <button class="chip-remove" type="button" aria-label="Filter entfernen" title="Filter entfernen">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `).join("") + `<button class="clear-all" type="button">Alle löschen</button>`;
  
    bar.querySelectorAll(".filter-chip .chip-remove").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const chip = e.currentTarget.closest(".filter-chip");
        if (!chip) return;
        const key = chip.getAttribute("data-key");
        const val = chip.getAttribute("data-value") || "";
        removeFilterChip(key, val);
      });
    });
    bar.querySelector(".clear-all")?.addEventListener("click", () => clearAllFilters());
  }
  
// ---- Einzelnen Chip entfernen ----
function removeFilterChip(key, val = "") {
  const params = new URLSearchParams(window.location.search);

  const mapEl = {
    price_min:          document.getElementById("priceFrom"),
    price_max:          document.getElementById("priceTo"),
    km_min:             document.getElementById("mileageFrom"),
    km_max:             document.getElementById("mileageTo"),
    ps_min:             document.getElementById("powerFrom"),
    ps_max:             document.getElementById("powerTo"),
    ezFrom:             document.getElementById("firstRegFrom"),
    hu:                 document.getElementById("inspectionUntil"),
    hu_min_monate:      document.getElementById("huMinMonths") || document.getElementById("inspectionMinMonths"),
    fuel:               document.getElementById("fuelType") || document.getElementById("fuel"),
    gear:               document.getElementById("transmission") || document.getElementById("gear"),
    drive:              document.getElementById("antriebsart") || document.getElementById("drivetrain") || document.getElementById("antrieb"),
    accidentFree:       document.getElementById("accidentFree"),
    modellausfuehrung:  document.getElementById("modellausfuehrung"),
    umweltplakette:     document.getElementById("umweltplakette") || document.getElementById("umwelt-badge"),
    schadstoffklasse:   document.getElementById("schadstoffklasse") || document.getElementById("emission"),
    scheckheft:         document.getElementById("scheckheft"),
    unfallfrei:          document.getElementById("unfallfrei") || document.getElementById("accidentFree")
  };

  const splitCsv = (v) => v ? String(v).split(",").map(s => s.trim()).filter(Boolean) : [];

  switch (key) {
    // UI-only Min-Werte -> URL aus UI neu bauen
    case "price_min": if (mapEl.price_min) mapEl.price_min.value = ""; return updateUrlFromUiAndReload();
    case "km_min":    if (mapEl.km_min)    mapEl.km_min.value    = ""; return updateUrlFromUiAndReload();
    case "ps_min":    if (mapEl.ps_min)    mapEl.ps_min.value    = ""; return updateUrlFromUiAndReload();

    // Max-Werte (direkt via URL)
    case "price_max": if (mapEl.price_max) mapEl.price_max.value = ""; params.delete("price_max"); break;
    case "km_max":    if (mapEl.km_max)    mapEl.km_max.value    = ""; params.delete("km_max");    break;
    case "ps_max":    if (mapEl.ps_max)    mapEl.ps_max.value    = ""; params.delete("ps_max");    break;

    // EZ
    case "ezFrom": {
      if (mapEl.ezFrom) mapEl.ezFrom.value = "";
      const m = document.getElementById("first-registration-month");
      const y = document.getElementById("first-registration-year");
      if (m) m.value = "";
      if (y) y.value = "";
      params.delete("ezFrom");
      break;
    }
    case "ezTo":
      params.delete("ezTo");
      break;

    // HU (alle Varianten gemeinsam entfernen)
    case "hu":
    case "hu_min_monate":
    case "hu_bis":
    case "inspectionUntil": {
      if (mapEl.hu) mapEl.hu.value = "";
      const huMinEl = document.getElementById("huMinMonths") || document.getElementById("inspectionMinMonths");
      if (huMinEl) huMinEl.value = "";
      ["hu","hu_bis","inspectionUntil","hu_min_monate","hu_min_months"].forEach(k => params.delete(k));
      break;
    }

    // Kraftstoff (CSV)
    case "fuel": {
      document.querySelectorAll('input[name="kraftstoff"]').forEach(cb => {
        if (typeof fuelCanon === "function" && fuelCanon(cb.value) === val) cb.checked = false;
      });
      if (mapEl.fuel && typeof fuelCanon === "function" && fuelCanon(mapEl.fuel.value) === val) {
        mapEl.fuel.value = "Beliebig";
      }
      const list = (typeof splitCsv === "function" ? splitCsv(params.get("kraftstoff")) : String(params.get("kraftstoff")||"").split(","))
        .map(v => (typeof fuelCanon === "function" ? fuelCanon(v) : v))
        .filter(Boolean);
      const next = list.filter(x => x !== val);
      if (next.length) params.set("kraftstoff", next.join(","));
      else params.delete("kraftstoff");
      break;
    }

    // Umweltplakette
    case "umweltplakette": {
      if (mapEl.umweltplakette && "value" in mapEl.umweltplakette) mapEl.umweltplakette.value = "";
      document.querySelectorAll('input[name="umweltplakette"]').forEach(inp => inp.checked = false);
      params.delete("umweltplakette");
      params.delete("plakette");
      break;
    }

    // Schadstoffklasse
    case "schadstoffklasse": {
      if (mapEl.schadstoffklasse && "value" in mapEl.schadstoffklasse) mapEl.schadstoffklasse.value = "";
      document.querySelectorAll('input[name="schadstoffklasse"], input[name="emission"]').forEach(inp => inp.checked = false);
      params.delete("schadstoffklasse");
      break;
    }

    // Getriebe
    case "gear": {
      if (mapEl.gear) mapEl.gear.value = "Beliebig";
      document
        .querySelectorAll('.search-group input[type="checkbox"][value="Automatik"], .search-group input[type="checkbox"][value="Schaltgetriebe"]')
        .forEach(cb => (cb.checked = false));
      params.delete("getriebe");
      break;
    }

    // Antrieb (CSV)
    case "drive": {
      document.querySelectorAll('input[name="antrieb"]').forEach(cb => {
        if (typeof driveCanon === "function" && driveCanon(cb.value) === val) cb.checked = false;
      });
      if (mapEl.drive && typeof driveCanon === "function" && driveCanon(mapEl.drive.value) === val) mapEl.drive.value = "Beliebig";

      const raw = params.get("antriebsart") || params.get("antrieb");
      const list = (typeof splitCsv === "function" ? splitCsv(raw) : String(raw||"").split(","))
        .map(v => (typeof driveCanon === "function" ? driveCanon(v) : v))
        .filter(Boolean);
      const next = list.filter(x => x !== val);
      if (next.length) params.set("antriebsart", next.join(","));
      else { params.delete("antriebsart"); params.delete("antrieb"); }
      break;
    }

    case "accidentFree":
      if (mapEl.accidentFree) mapEl.accidentFree.checked = false;
      params.delete("accidentFree");
      break;

    // Scheckheft – Flag und Merkmals-CSV säubern + UI entchecken
    case "scheckheft": {
      if (mapEl.scheckheft) mapEl.scheckheft.checked = false;
      params.delete("scheckheft");

      const list = splitCsv(params.get("merkmale") || "");
      const next = list.filter(x => !/scheckheft/i.test(x) && !/serviceheft/i.test(x));
      if (next.length) params.set("merkmale", next.join(","));
      else params.delete("merkmale");

      document.querySelectorAll('input[name="merkmale"], input[name="merkmale[]"]').forEach(cb => {
        const v = String(cb.value || "");
        if (/scheckheft/i.test(v) || /serviceheft/i.test(v)) cb.checked = false;
      });
      break;
    }

    case "marke":
      params.delete("marke");
      break;

    case "modell": {
      const list = (typeof splitCsv === "function" ? splitCsv(params.get("modell")) : String(params.get("modell")||"").split(","));
      const next = list.filter(m => m.toLowerCase() !== String(val || "").toLowerCase());
      if (next.length) params.set("modell", next.join(","));
      else params.delete("modell");
      break;
    }

    case "modellausfuehrung":
      if (mapEl.modellausfuehrung) mapEl.modellausfuehrung.value = "";
      params.delete("modellausfuehrung");
      break;

    case "fahrzeugtyp": {
      const list = (typeof splitCsv === "function" ? splitCsv(params.get("fahrzeugtyp")) : String(params.get("fahrzeugtyp")||"").split(","));
      const next = list.filter(x => x.toLowerCase() !== String(val || "").toLowerCase());
      if (next.length) params.set("fahrzeugtyp", next.join(","));
      else params.delete("fahrzeugtyp");
      const typeEl     = document.getElementById("fahrzeugtyp");
      const typeChecks = document.querySelectorAll('input[name="fahrzeugtyp"]');
      if (typeEl && typeEl.tagName === "SELECT") {
        [...typeEl.options].forEach(o => { if ((o.value || "").toLowerCase() === String(val).toLowerCase()) o.selected = false; });
      }
      if (typeChecks && typeChecks.length) {
        [...typeChecks].forEach(cb => { if ((cb.value || "").toLowerCase() === String(val).toLowerCase()) cb.checked = false; });
      }
      break;
    }

    case "tueren": {
      const list = (typeof splitCsv === "function" ? splitCsv(params.get("tueren")) : String(params.get("tueren")||"").split(","));
      const next = list.filter(x => x.toLowerCase() !== String(val || "").toLowerCase());
      if (next.length) params.set("tueren", next.join(","));
      else params.delete("tueren");
      const doorsEl     = document.getElementById("tueren");
      const doorsChecks = document.querySelectorAll('input[name="tueren"]');
      if (doorsEl && doorsEl.tagName === "SELECT") {
        [...doorsEl.options].forEach(o => { if ((o.value || "").toLowerCase() === String(val).toLowerCase()) o.selected = false; });
      } else if (doorsEl && typeof doorsEl.value === "string") {
        if (doorsEl.value.toLowerCase() === String(val).toLowerCase()) doorsEl.value = "";
      }
      if (doorsChecks && doorsChecks.length) {
        [...doorsChecks].forEach(cb => { if ((cb.value || "").toLowerCase() === String(val).toLowerCase()) cb.checked = false; });
      }
      break;
    }

    case "farbe": {
      const list = (typeof splitCsv === "function" ? splitCsv(params.get("farbe")) : String(params.get("farbe")||"").split(","));
      const next = list.filter(x => x.toLowerCase() !== String(val || "").toLowerCase());
      if (next.length) params.set("farbe", next.join(","));
      else params.delete("farbe");
      document.querySelectorAll('input[name="farbe"]').forEach(cb => {
        if ((cb.value || "").toLowerCase() === String(val).toLowerCase()) cb.checked = false;
      });
      break;
    }

    // Max. Halter
    case "halter_max": {
      ["halter_max","max_halter","owners_max"].forEach(k => params.delete(k));
      const el = document.getElementById("halterMax")
             || document.getElementById("halter_max")
             || document.getElementById("ownerMax")
             || document.getElementById("ownersMax")
             || document.getElementById("anzahlFahrzeughalterMax");
      if (el) el.value = "";
      break;
    }

    case "ort":
      params.delete("ort"); params.delete("ort_lat"); params.delete("ort_lon");
      break;

    case "umkreis":
      params.delete("umkreis");
      break;

    case "verbrauch_max": {
      params.delete("verbrauch_max");
      const selV = document.getElementById("verbrauch-select");
      const inpV = document.getElementById("verbrauch");
      if (selV) selV.value = "";
      if (inpV) inpV.value = "";
      break;
    }

    case "partikelfilter":
      params.delete("partikelfilter");
      break;

    // ✅ NEU: Unfallfrei-Filter löschen
    case "accidentFree": {
      ["unfallfrei", "accidentFree"].forEach(k => params.delete(k));
      const ufEl =
        document.getElementById("unfallfrei") ||
        document.getElementById("accidentFree");
      if (ufEl && "checked" in ufEl) ufEl.checked = false;
      break;
    }

    case "fahrtauglich":
      params.delete("fahrtauglich");
      break;


    default: break;
  }

  // Paging zurücksetzen & URL aktualisieren
  params.delete("page");
  const qs = params.toString();
  history.replaceState(null, "", `${location.pathname}${qs ? `?${qs}` : ""}`);

  // Neu laden + Chips sofort aktualisieren
  if (typeof loadAndRender === "function")      loadAndRender(1);
  else if (typeof runSearch === "function")     runSearch();
  else if (typeof fetchAndRender === "function") fetchAndRender();
  if (typeof renderActiveFilters === "function") renderActiveFilters();
}

// ---- Alle Filter löschen ----
function clearAllFilters() {
  const params = new URLSearchParams(window.location.search);

  [
    "marke","modell","modellausfuehrung","fahrzeugtyp","tueren",
    "ezFrom","ezTo",
    "km_max","price_max","ps_min","ps_max","getriebe",
    "umweltplakette","plakette","schadstoffklasse",
    "kraftstoff","antriebsart","antrieb",
    "ort","umkreis","sort","verbrauch_max",
    "partikelfilter","scheckheft","fahrtauglich",
    "farbe",
    "merkmale", // ⬅️ wichtig: Merkmale-CSV auch zurücksetzen
    // HU-Parameter (alle Varianten)
    "hu","hu_bis","inspectionUntil","hu_min_monate","hu_min_months",
    // Max. Halter
    "halter_max","max_halter","owners_max"
  ].forEach(k => params.delete(k));

  params.delete("page");

  // Basis-Eingabefelder leeren
  [
    "priceFrom","priceTo",
    "mileageFrom","mileageTo",
    "powerFrom","powerTo",
    "firstRegFrom","firstRegTo",
    "inspectionUntil",
    "modellausfuehrung",
    "location"
  ].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });

  // EZ Fallback-Felder
  [
    "first-registration-month","first-registration-year",
    "first-registration-month-to","first-registration-year-to",
    "ez-von","ez-bis"
  ].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });

  // HU mind. Monate (UI)
  { const el = document.getElementById("huMinMonths") || document.getElementById("inspectionMinMonths"); if (el) el.value = ""; }

  // Max. Halter (UI)
  {
    const ownersMaxEl = document.getElementById("halterMax")
                      || document.getElementById("ownersMax")
                      || document.getElementById("ownerCountMax")
                      || document.getElementById("halter_max")
                      || document.getElementById("maxHalter");
    if (ownersMaxEl) ownersMaxEl.value = "";
  }

  // Fahrzeugtyp / Türen / Farben / Modell
  {
    const typeEl = document.getElementById("fahrzeugtyp");
    if (typeEl) {
      if (typeEl.tagName === "SELECT") [...typeEl.options].forEach(o => (o.selected = false));
      else typeEl.value = "";
    }
    document.querySelectorAll('input[name="fahrzeugtyp"]').forEach(cb => (cb.checked = false));

    const doorsEl = document.getElementById("tueren");
    if (doorsEl) {
      if (doorsEl.tagName === "SELECT") [...doorsEl.options].forEach(o => (o.selected = false));
      else doorsEl.value = "";
    }
    document.querySelectorAll('input[name="tueren"]').forEach(cb => (cb.checked = false));

    document.querySelectorAll('input[name="farbe"]').forEach(cb => (cb.checked = false));

    const modellEl = document.getElementById("modell");
    if (modellEl && modellEl.tagName === "SELECT") [...modellEl.options].forEach(o => (o.selected = false));
  }

  // Kraftstoff
  {
    const fuelEl = document.getElementById("fuelType") || document.getElementById("fuel");
    if (fuelEl) fuelEl.value = "Beliebig";
    document.querySelectorAll('input[name="kraftstoff"]').forEach(cb => (cb.checked = false));
  }

  // Umweltplakette / Schadstoffklasse
  {
    const sel = document.getElementById("umweltplakette") || document.getElementById("umwelt-badge");
    if (sel) sel.value = "";
    document.querySelectorAll('input[name="umweltplakette"]').forEach(inp => (inp.checked = false));

    const sel2 = document.getElementById("schadstoffklasse") || document.getElementById("emission");
    if (sel2) sel2.value = "";
    document.querySelectorAll('input[name="schadstoffklasse"], input[name="emission"]').forEach(inp => (inp.checked = false));
  }

  // Getriebe / Antrieb
  {
    const gearEl = document.getElementById("transmission") || document.getElementById("gear");
    if (gearEl) gearEl.value = "Beliebig";
    document
      .querySelectorAll('.search-group input[type="checkbox"][value="Automatik"], .search-group input[type="checkbox"][value="Schaltgetriebe"]')
      .forEach(cb => (cb.checked = false));

    const driveEl = document.getElementById("antriebsart") || document.getElementById("drivetrain") || document.getElementById("antrieb");
    if (driveEl) driveEl.value = "Beliebig";
    document.querySelectorAll('input[name="antrieb"]').forEach(cb => (cb.checked = false));
  }

  // Unfallfrei / Scheckheft (+ alle Merkmale-Checkboxen zurücksetzen)
  {
    const accEl = document.getElementById("accidentFree");
    if (accEl) accEl.checked = false;

    const sh = document.getElementById("scheckheft");
    if (sh) sh.checked = false;

    document.querySelectorAll('input[name="merkmale"], input[name="merkmale[]"]').forEach(cb => cb.checked = false);
  }

  // Verbrauch
  {
    const selV = document.getElementById("verbrauch-select");
    const inpV = document.getElementById("verbrauch");
    if (selV) selV.value = "";
    if (inpV) inpV.value = "";
  }

  // Umkreis
  {
    const distSel = document.getElementById("distance-select");
    const distCustom = document.getElementById("distance-custom");
    if (distSel) distSel.value = "";
    if (distCustom) distCustom.value = "";
  }

  // Sortierung
  { const sortEl = document.getElementById("sortBy"); if (sortEl) sortEl.value = ""; }

  history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
  loadAndRender(1);
}


});








