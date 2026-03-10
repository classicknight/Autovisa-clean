// suche.js — TEIL 1
document.documentElement.classList.remove("no-js");

// ---------- Utils (einmalig) ----------
const norm = (s) => String(s || "")
  .toLowerCase()
  .normalize("NFD").replace(/\p{Diacritic}/gu, ""); // Umlaute/Diakritika raus

const toNum = (v) => {
  if (v === null || v === undefined || v === "") return NaN;
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;

  let s = String(v).trim();
  if (!s) return NaN;

  s = s.replace(/[\u202F\u00A0\s]/g, "").replace(/[€]/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    const decPos = Math.max(lastComma, lastDot);
    const intPart = s.slice(0, decPos).replace(/[.,]/g, "");
    const fracPart = s.slice(decPos + 1).replace(/[.,]/g, "");
    s = `${intPart}.${fracPart}`;
  } else if (hasComma || hasDot) {
    const sep = hasComma ? "," : ".";
    const parts = s.split(sep);
    if (parts.length === 2) {
      const frac = parts[1];
      if (/^\d{1,2}$/.test(frac)) {
        s = parts[0].replace(/[.,]/g, "") + "." + frac;
      } else {
        s = s.replace(/[.,]/g, "");
      }
    } else {
      s = s.replace(/[.,]/g, "");
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

function hasMwstHint(obj) {
  const raw =
    obj?.verkauf_mwst ??
    obj?.mwst ??
    obj?.mwst_type ??
    obj?.mwstType ??
    obj?.raw?.verkauf_mwst ??
    obj?.raw?.mwst ??
    obj?.raw?.mwst_type ??
    obj?.raw?.mwstType ??
    "";

  if (raw === true) return true;
  if (raw === false) return false;

  const str = String(raw || "").trim();
  if (!str) return false;
  const low = str.toLowerCase();
  if (low.includes("keine") || low.includes("nicht")) return false;
  if (low.includes("zzgl")) return true;
  if (low.includes("inkl")) return true;
  if (low.includes("mwst") || low.includes("ust")) return true;
  return false;
}

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
function parseYM(raw, fallbackMonthIfYearOnly = null) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) return s;
  const m = s.match(/^(0?[1-9]|1[0-2])[.\-/](\d{4})$/);
  if (m) return `${m[2]}-${String(m[1]).padStart(2, "0")}`;
  if (/^\d{4}$/.test(s)) {
    const mm = fallbackMonthIfYearOnly ? String(fallbackMonthIfYearOnly).padStart(2, "0") : "01";
    return `${s}-${mm}`;
  }
  return "";
}
function orderYM(from, to) {
  if (from && to && from > to) return [to, from];
  return [from || "", to || ""];
}

function readEzValue(inputEl, yearEl, monthEl, fallbackMonthIfYearOnly) {
  const rawInput = (inputEl?.value || "").trim();
  if (rawInput) {
    const parsed = parseYM(rawInput, fallbackMonthIfYearOnly);
    return parsed || rawInput;
  }
  const year = (yearEl?.value || "").trim();
  if (!year) return "";
  const month = (monthEl?.value || "").trim();
  const mm = month
    ? String(month).padStart(2, "0")
    : String(fallbackMonthIfYearOnly || "01").padStart(2, "0");
  return `${year}-${mm}`;
}

/* =========================
   Saved (Herz) – Suche
   Nutzt: /saved/status/:id  und  /saved/toggle
========================= */

function setSaveBtnUI(btn, saved) {
  if (!btn) return;

  const isSaved = !!saved;

  btn.classList.toggle("is-saved", isSaved);
  btn.setAttribute("aria-pressed", isSaved ? "true" : "false");
  btn.title = isSaved ? "Gespeichert" : "Auto speichern";

  const icon = btn.querySelector("i");
  if (icon) {
    icon.classList.add("fa-heart");
    icon.classList.remove("fa-solid", "fa-regular", "fas", "far");
    if (isSaved) {
      icon.classList.add("fa-solid", "fas");
    } else {
      icon.classList.add("fa-regular", "far");
    }
  }

  if (isSaved) {
    btn.classList.remove("pulse");
    void btn.offsetWidth;
    btn.classList.add("pulse");
    window.setTimeout(() => btn.classList.remove("pulse"), 500);
  } else {
    btn.classList.remove("pulse");
  }
}

function getRedirectTarget() {
  const path = window.location.pathname || "";
  const isRoot = path === "/" || path === "";
  const file = isRoot ? "index.html" : (path.split("/").pop() || "index.html");
  return file + (window.location.search || "") + (window.location.hash || "");
}

async function fetchSaveStatus(fahrzeugId) {
  const res = await fetch(`/saved/status/${encodeURIComponent(fahrzeugId)}`, {
    credentials: "include",
  });
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) throw new Error("Fehler beim Laden des Save-Status");
  const data = await res.json().catch(() => ({}));
  return !!data.saved;
}

function syncSaveButtonsById(fahrzeugId, saved) {
  if (!fahrzeugId) return;
  const safeId = String(fahrzeugId).replace(/"/g, '\\"');
  document.querySelectorAll(`button.save-btn[data-inserat-id="${safeId}"]`)
    .forEach((btn) => setSaveBtnUI(btn, saved));
}

async function toggleSaveBtn(btn) {
  const fahrzeugId = (btn?.dataset?.inseratId || "").trim();
  if (!fahrzeugId) return;

  if (btn.dataset.busy === "1") return;
  btn.dataset.busy = "1";

  try {
    const res = await fetch("/saved/toggle", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fahrzeugId }),
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.setItem("redirectAfterLogin", getRedirectTarget());
      window.location.href = "login.html";
      return;
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Speichern fehlgeschlagen");

    syncSaveButtonsById(fahrzeugId, !!data.saved);
  } catch (err) {
    console.error("❌ Save toggle error:", err);
  } finally {
    btn.dataset.busy = "0";
  }
}

function hydrateSaveButtons(scope = document) {
  const buttons = Array.from(scope.querySelectorAll("button.save-btn[data-inserat-id]"));
  if (!buttons.length) return;

  const ids = [...new Set(buttons.map((b) => (b.dataset.inseratId || "").trim()).filter(Boolean))];
  if (!ids.length) return;

  Promise.allSettled(
    ids.map(async (id) => {
      const saved = await fetchSaveStatus(id);
      if (saved === null) return;
      syncSaveButtonsById(id, saved);
    })
  ).catch(() => {});
}

if (!window.__autovisaSaveDelegationBound) {
  window.__autovisaSaveDelegationBound = true;
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("button.save-btn[data-inserat-id]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    toggleSaveBtn(btn);
  });
}

// ---- Erstzulassung: Month-Input Fallback ----
let useEzFallback = false;
function supportsMonthInput() {
  const input = document.createElement("input");
  input.type = "month";
  return input.type === "month";
}

function fillYearSelect(selectEl) {
  if (!selectEl) return;
  if (selectEl.options.length > 1) return;
  const currentYear = new Date().getFullYear();
  for (let year = currentYear; year >= 1900; year--) {
    const opt = document.createElement("option");
    opt.value = String(year);
    opt.textContent = String(year);
    selectEl.appendChild(opt);
  }
}

function setupEzMonthFallback() {
  const rangeEl = document.getElementById("firstRegRange");
  if (!rangeEl) return false;

  const ua = navigator.userAgent || "";
  const isMac = /Macintosh/.test(ua) && !/iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua);
  const shouldFallback = !supportsMonthInput() || (isMac && isSafari);

  if (shouldFallback) {
    rangeEl.classList.add("is-fallback");
    const fromEl = document.getElementById("firstRegFrom");
    const toEl = document.getElementById("firstRegTo");
    if (fromEl) fromEl.value = "";
    if (toEl) toEl.value = "";
  } else {
    rangeEl.classList.remove("is-fallback");
  }

  return shouldFallback;
}

useEzFallback = setupEzMonthFallback();
fillYearSelect(document.getElementById("first-registration-year"));
fillYearSelect(document.getElementById("first-registration-year-to"));

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
// Canon für Kraftstoff (mit Hybrid-Unterarten)
function fuelCanon(raw) {
  const s = String(raw || "").trim().toLowerCase();

  // vereinheitlichen (Leerzeichen, Sonderzeichen raus für Erkennung)
  const flat = s
    .normalize("NFD").replace(/\p{Diacritic}/gu, "") // Umlaute entfernen
    .replace(/[()./\\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!flat) return "";

  // 1) Spezifische Synonyme zuerst
  if (/(^|\s)autogas(\s|$)/.test(flat) || /\blpg\b/.test(s)) return "autogas";
  if (/(^|\s)erdgas(\s|$)/.test(flat) || /\bcng\b/.test(s)) return "cng";

  const isHybrid = /(hybrid|plug[\s-]?in|plugin|phev|mhev|hev)/.test(flat);
  const isDiesel = /diesel/.test(flat);
  const isBenzin = /(benzin|super|e10|e5|e95|e98|otto|petrol|gasoline)/.test(flat);

  // 2) Hybrid zuerst auswerten – mit Unterarten
  if (isHybrid) {
    if (isDiesel && !isBenzin) return "hybrid-diesel";
    if (isBenzin && !isDiesel) return "hybrid-benzin";
    return "hybrid"; // generischer Hybrid (falls nicht eindeutig)
  }

  // 3) Standards
  if (isDiesel) return "diesel";
  if (isBenzin) return "benzin";
  if (/(elektro|electric|bev|strom|ev)/.test(flat)) return "elektro";

  // 4) Sonstiges
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

// --- HU-Parameter beibehalten (Filter kommt aus Suchkriterien) ---
function normalizeHuParams(params) {
  return params;
}


// ---------- App ----------
document.addEventListener("DOMContentLoaded", () => {
  // HU-Parameter beibehalten (kommen aus Suchkriterien)
  (function keepHuInUrl() {
    const params = new URLSearchParams(window.location.search);
    const before = params.toString();
    normalizeHuParams(params);
    const after = params.toString();
    if (before !== after) replaceUrlParams(params);
  })();
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
const resultCountEl = document.getElementById("resultCount");
const sortBy        = document.getElementById("sortBy");
const applyFilters  = document.getElementById("applyFiltersBtn");

  function updateResultCount() {
    if (!resultCountEl) return;
    const total = Number(serverTotal) || 0;
    resultCountEl.textContent = `${total.toLocaleString("de-DE")} Treffer`;
  }

  // Mobile/Tablet: Filter-Sidebar ein-/ausblenden
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      const next = !sidebar.classList.contains("visible");
      sidebar.classList.toggle("visible", next);
      toggleBtn.setAttribute("aria-expanded", String(next));
    });
  }

  // Mobile: Sticky Filter-Dock (zeigt aktive Filter beim Hochscrollen)
  function setupMobileFilterDock() {
    const dock = document.getElementById("mobileFilterDock");
    if (!dock) return;

    const dockBtn = document.getElementById("toggleFiltersBtnDock");
    if (dockBtn && toggleBtn) {
      dockBtn.addEventListener("click", () => toggleBtn.click());
    }

    let lastY = window.scrollY || 0;
    let ticking = false;
    const threshold = 120;

    const setDockVisible = (show) => {
      dock.classList.toggle("show", show);
      dock.setAttribute("aria-hidden", show ? "false" : "true");
    };

    const updateDock = () => {
      const hasChips =
        document.getElementById("activeFilterBar")?.dataset.hasChips === "1";
      const y = window.scrollY || 0;

      if (!hasChips || y <= threshold) {
        setDockVisible(false);
        lastY = y;
        return;
      }

      if (y < lastY - 6) {
        setDockVisible(true);
      } else if (y > lastY + 6) {
        setDockVisible(false);
      }
      lastY = y;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        updateDock();
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => {
      lastY = window.scrollY || 0;
      updateDock();
    });

    // von renderActiveFilters() aufrufbar
    window.updateMobileFilterDock = () => updateDock();
  }

  setupMobileFilterDock();
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
  
    km_min:    sp.get("km_min")    || "",
    km_max:    sp.get("km_max")    || "",
  
    price_min: sp.get("price_min") || "",
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

  const priceFromEl = document.getElementById("priceFrom");
  const priceToEl   = document.getElementById("priceTo");
  const kmFromEl    = document.getElementById("mileageFrom");
  const kmToEl      = document.getElementById("mileageTo");
  

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
  const firstRegToEl    = document.getElementById("firstRegTo");
  const firstRegMonthEl = document.getElementById("first-registration-month");
  const firstRegYearEl  = document.getElementById("first-registration-year");
  const firstRegMonthToEl = document.getElementById("first-registration-month-to");
  const firstRegYearToEl  = document.getElementById("first-registration-year-to");
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

  if (priceFromEl && QP.price_min) priceFromEl.value = QP.price_min;
  if (priceToEl   && QP.price_max) priceToEl.value   = QP.price_max;
  
  if (kmFromEl && QP.km_min) kmFromEl.value = QP.km_min;
  if (kmToEl   && QP.km_max) kmToEl.value   = QP.km_max;
  
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
    const picked = QP.kraftstoff || [];  // kanonisierte Tokens, z.B. ["hybrid-benzin"]
    if (!picked.length) return;

    // Select: ersten passenden setzen (falls es oben noch ein Select gibt)
    if (fuelEl && fuelEl.tagName === "SELECT") {
      const wanted = picked[0];
      const match = [...fuelEl.options].find(o =>
        fuelCanon(o.value) === wanted || fuelCanon(o.text) === wanted
      );
      if (match) fuelEl.value = match.value;
    }

    // Checkboxen: alle passenden anhaken
    const set = new Set(picked);

    document.querySelectorAll('input[name="kraftstoff"]').forEach(cb => {
      const tok = fuelCanon(cb.value); // z.B. "hybrid-benzin", "hybrid-diesel", "benzin", "diesel"

      if (set.has(tok)) {
        // exakt dieser Token wurde angefragt (z. B. "hybrid-benzin")
        cb.checked = true;
      } else if (tok.startsWith("hybrid-") && set.has("hybrid")) {
        // generischer Hybrid-Filter -> beide Hybrid-Checkboxen anhaken
        cb.checked = true;
      } else {
        cb.checked = false;
      }
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
  if (!useEzFallback && firstRegFromEl && QP.ezFrom) firstRegFromEl.value = QP.ezFrom;
  if (!useEzFallback && firstRegToEl && QP.ezTo)     firstRegToEl.value   = QP.ezTo;
  if (QP.ezFrom && firstRegMonthEl && firstRegYearEl) {
    const [y, m] = QP.ezFrom.split("-");
    if (y) firstRegYearEl.value  = y;
    if (m) firstRegMonthEl.value = m;
  }
  if (QP.ezTo && firstRegMonthToEl && firstRegYearToEl) {
    const [y, m] = QP.ezTo.split("-");
    if (y) firstRegYearToEl.value  = y;
    if (m) firstRegMonthToEl.value = m;
  }
  if (ezVonEl && QP.ezFrom) ezVonEl.value = QP.ezFrom;
  if (ezBisEl && QP.ezTo)   ezBisEl.value = QP.ezTo;

  // --- Sortierung ---
  const sortBy = document.getElementById("sortBy");
  if (sortBy) {
    if (QP.sort === "preis_asc")       sortBy.value = "price-asc";
    else if (QP.sort === "preis_desc") sortBy.value = "price-desc";
    else if (QP.sort === "km_asc")     sortBy.value = "mileage-asc";
    else if (QP.sort === "km_desc")    sortBy.value = "mileage-desc";
    else if (QP.sort === "ez_desc")    sortBy.value = "ez-desc";
    else if (QP.sort === "ez_asc")     sortBy.value = "ez-asc";
    else                               sortBy.value = "default";
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
  // TEST-Subtitle (einfach entfernen, wenn nicht mehr gebraucht)
  const TEST_SUBTITLE = "Tributo Carbon-LED/Lift/360Kam/Garantie04/26";
  const pickText = (...vals) => {
    for (const v of vals) {
      if (v === null || v === undefined) continue;
      const s = String(v).trim();
      if (s) return s;
    }
    return "";
  };
  const getDisplayTexts = (inserat) => {
    const brand = pickText(
      inserat?.verkauf_marke,
      inserat?.marke,
      inserat?.raw?.verkauf_marke,
      inserat?.raw?.marke,
      inserat?.brand,
      inserat?.make,
      inserat?.manufacturer
    );
    const model = pickText(
      inserat?.verkauf_modell,
      inserat?.modell,
      inserat?.raw?.verkauf_modell,
      inserat?.raw?.modell,
      inserat?.model,
      inserat?.vehicle_model
    );
    const variant = pickText(
      inserat?.verkauf_variante,
      inserat?.variante,
      inserat?.verkauf_ausstattung_variante,
      inserat?.raw?.verkauf_variante,
      inserat?.raw?.variante,
      inserat?.variant,
      inserat?.trim
    );
    const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

    let title = "";
    if (brand || model) {
      const b = norm(brand);
      const m = norm(model);

      if (brand && model) {
        const startsWithBrand =
          b && (m.startsWith(`${b} `) || m.startsWith(`${b}-`) || m.startsWith(`${b}/`));
        const endsWithBrand =
          b && (m.endsWith(` ${b}`) || m.endsWith(`-${b}`) || m.endsWith(`/${b}`));

        if (m === b) title = brand;
        else if (startsWithBrand || endsWithBrand) title = model;
        else title = [brand, model].filter(Boolean).join(" ").trim();
      } else {
        title = brand || model || "";
      }
    }

    if (!title) {
      title =
        pickText(inserat?.verkauf_titel, inserat?.titel) ||
        "Unbekanntes Fahrzeug";
    }

    const subtitle = pickText(
      variant,
      inserat?.verkauf_kurzbeschreibung,
      inserat?.kurzbeschreibung,
      inserat?.raw?.verkauf_kurzbeschreibung
    );
    return { title, subtitle: subtitle || TEST_SUBTITLE };
  };


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

  // ===== Medien-Slider (wie auf der Startseite) =====
  function initMediaSlider(container) {
    if (!container) return;

    if (container.dataset.sliderInit === "1") return;
    container.dataset.sliderInit = "1";

    const slidesWrapper = container.querySelector(".slides");
    if (!slidesWrapper) return;

    const slides = Array.from(slidesWrapper.children || []);
    if (!slides.length) return;

    const state = {
      index: 0,
      dragging: false,
      axis: null,
      pointerId: null,
      startX: 0,
      startY: 0,
      prevTranslate: 0,
      currentTranslate: 0,
      blockClickUntil: 0,
      hadRealSwipe: false,
      captured: false,
    };

    slidesWrapper.style.display = "flex";
    slidesWrapper.style.willChange = "transform";
    slides.forEach((slide) => {
      slide.style.flex = "0 0 100%";
      slide.style.minWidth = "100%";
    });

    const btnLeft = container.querySelector(".media-arrow.left");
    const btnRight = container.querySelector(".media-arrow.right");

    const width = () => (container.getBoundingClientRect().width || container.clientWidth || 1);

    const setTranslate = (x, animate) => {
      slidesWrapper.style.transition = animate
        ? "transform 0.28s cubic-bezier(.2,.8,.2,1)"
        : "none";
      slidesWrapper.style.transform = `translateX(${x}px)`;
    };

    const updateArrows = () => {
      if (btnLeft) btnLeft.disabled = state.index <= 0;
      if (btnRight) btnRight.disabled = state.index >= slides.length - 1;
    };

    const pauseInactiveVideos = () => {
      slides.forEach((s, idx) => {
        const v = s?.tagName === "VIDEO" ? s : s?.querySelector?.("video");
        if (!v) return;
        if (idx !== state.index && !v.paused) {
          try { v.pause(); } catch {}
        }
      });
    };

    const snapTo = (i, animate = true) => {
      state.index = Math.max(0, Math.min(i, slides.length - 1));
      state.prevTranslate = -state.index * width();
      state.currentTranslate = state.prevTranslate;
      setTranslate(state.currentTranslate, animate);
      updateArrows();
      pauseInactiveVideos();
    };

    container.addEventListener("click", (e) => {
      if (Date.now() < state.blockClickUntil) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    const startDrag = (e) => {
      if (e.button != null && e.button !== 0) return;
      if (e.target?.closest?.(".media-arrow")) return;

      state.dragging = true;
      state.axis = null;
      state.pointerId = e.pointerId ?? null;
      state.startX = e.clientX;
      state.startY = e.clientY;
      state.hadRealSwipe = false;

      state.captured = false;
      slidesWrapper.style.transition = "none";
    };

    const moveDrag = (e) => {
      if (!state.dragging) return;
      if (state.pointerId != null && e.pointerId != null && e.pointerId !== state.pointerId) return;

      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;

      if (state.axis == null) {
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        if (adx < 6 && ady < 6) return;

        state.axis = adx > ady ? "x" : "y";
        if (state.axis === "y") {
          state.dragging = false;
          state.pointerId = null;
          return;
        }

        if (!state.captured && e.pointerId != null && container.setPointerCapture) {
          try {
            container.setPointerCapture(e.pointerId);
            state.captured = true;
          } catch {}
        }
      }

      if (state.axis !== "x") return;

      if (Math.abs(dx) > 10) state.hadRealSwipe = true;
      if (e.cancelable) e.preventDefault();

      state.currentTranslate = state.prevTranslate + dx;
      setTranslate(state.currentTranslate, false);
    };

    const endDrag = (e) => {
      if (!state.dragging) return;
      if (state.pointerId != null && e?.pointerId != null && e.pointerId !== state.pointerId) return;

      state.dragging = false;

      const movedBy = state.currentTranslate - state.prevTranslate;
      const w = width();
      const threshold = Math.max(40, w * 0.12);

      if (movedBy < -threshold && state.index < slides.length - 1) state.index++;
      else if (movedBy > threshold && state.index > 0) state.index--;

      state.blockClickUntil = state.hadRealSwipe ? Date.now() + 220 : 0;

      snapTo(state.index, true);

      if (state.captured && e?.pointerId != null && container.releasePointerCapture) {
        try { container.releasePointerCapture(e.pointerId); } catch {}
      }

      state.pointerId = null;
      state.axis = null;
      state.captured = false;
      state.hadRealSwipe = false;
    };

    container.addEventListener("pointerdown", startDrag, { passive: false });
    container.addEventListener("pointermove", moveDrag, { passive: false });
    container.addEventListener("pointerup", endDrag, { passive: true });
    container.addEventListener("pointercancel", endDrag, { passive: true });
    container.addEventListener("pointerleave", endDrag, { passive: true });

    btnRight?.addEventListener("click", (e) => {
      e.stopPropagation();
      snapTo(state.index + 1, true);
    });

    btnLeft?.addEventListener("click", (e) => {
      e.stopPropagation();
      snapTo(state.index - 1, true);
    });

    window.addEventListener("resize", () => snapTo(state.index, false), { passive: true });

    snapTo(0, false);
  }
  // --- Ende initMediaSlider ---

  async function fetchSearch(p = 1, limit = pageSize) {
    const reqId = ++lastReqId;
    const params = new URLSearchParams(window.location.search);
    const before = params.toString();
    ensureSortParam(params);
    if (before !== params.toString()) replaceUrlParams(params);

    normalizeHuParams(params);
    // Client-only: nicht ans Backend senden
    params.delete("sellerName");
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
    const unwrapPrice = (v) => {
      if (v === null || v === undefined) return null;
      if (typeof v === "object") {
        if (typeof v.value === "number" || typeof v.value === "string") return v.value;
        if (typeof v.amount === "number" || typeof v.amount === "string") return v.amount;
        if (typeof v.$numberDecimal === "string") return v.$numberDecimal;
      }
      return v;
    };
    const pickPrice = (...vals) => {
      for (const v0 of vals) {
        const v = unwrapPrice(v0);
        const n = toNum(v);
        if (Number.isFinite(n)) return n;
      }
      return "";
    };

    const preis = pickPrice(
      raw["brutto-preis"],
      raw.brutto_preis,
      raw["netto-preis"],
      raw.netto_preis,
      raw.verkauf_brutto,
      raw.preis,
      raw.price,
      raw.price_eur,
      raw.priceEUR,
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

      seller: raw.seller || null,

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
}

function detectConsumptionUnitFromFuel(fuelRaw) {
  const f = String(fuelRaw || "").toLowerCase();
  if (/(elektro|electric|bev|ev|strom)/.test(f)) return "kWh/100 km";
  if (/(wasserstoff|hydrogen|h2|cng|erdgas)/.test(f)) return "kg/100 km";
  return "l/100 km";
}

function detectConsumptionUnitFromText(textRaw) {
  const s = String(textRaw || "").toLowerCase();
  if (/\bkwh\b/.test(s) || /kw\s*\/\s*h/.test(s)) return "kWh/100 km";
  if (/\bkg\b/.test(s)) return "kg/100 km";
  if (/\b(l|liter)\b/.test(s)) return "l/100 km";
  return "";
}

function formatConsumptionDisplay(value, unitRaw, fuelRaw) {
  if (value == null) return "–";
  const s = String(value).trim();
  if (!s) return "–";

  const unitInText = detectConsumptionUnitFromText(s);
  if (unitInText) return s;

  if (/[a-zA-Z]/.test(s)) return "–";

  const unit = unitRaw || detectConsumptionUnitFromFuel(fuelRaw);
  return `${s} ${unit}`;
}

function applyClientFilters(items) {
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

  const accidentFreeEl =
    document.getElementById("unfallfrei") ||
    document.getElementById("accidentFree");

  const inspectionUntilEl = document.getElementById("inspectionUntil");     // HU bis (YYYY-MM)
  const huMinMonthsEl     = document.getElementById("huMinMonths")          // optionales Feld "HU mind. (Monate)"
                          || document.getElementById("inspectionMinMonths");

  const firstRegFromEl    = document.getElementById("firstRegFrom");
  const firstRegToEl      = document.getElementById("firstRegTo");
  const firstRegMonthEl   = document.getElementById("first-registration-month");
  const firstRegYearEl    = document.getElementById("first-registration-year");
  const firstRegMonthToEl = document.getElementById("first-registration-month-to");
  const firstRegYearToEl  = document.getElementById("first-registration-year-to");

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

  // Unfallfrei: UI-Checkbox ODER URL-Param (unfallfrei=1 / accidentFree=1)
  const accidentFree =
    !!accidentFreeEl?.checked ||
    isTruthyRaw(sp.get("unfallfrei") || sp.get("accidentFree"));

  // HU: UI & URL-Fallbacks
  const inspectionUntilUI = inspectionUntilEl?.value || ""; // erwartet YYYY-MM
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

  const firstRegFromUI = readEzValue(firstRegFromEl, firstRegYearEl, firstRegMonthEl, 1);
  const firstRegToUI   = readEzValue(firstRegToEl, firstRegYearToEl, firstRegMonthToEl, 12);

  const priceToEff   = (!isNaN(priceTo)   && priceTo   > 0) ? priceTo   : toNum(sp.get("price_max"));
  const mileageToEff = (!isNaN(mileageTo) && mileageTo > 0) ? mileageTo : toNum(sp.get("km_max"));

  const ezFromEff = parseYM(firstRegFromUI || sp.get("ezFrom") || "", 1);
  const ezToEff   = parseYM(firstRegToUI   || sp.get("ezTo")   || "", 12);

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
  const customV = (inpV?.value || "").trim();
  const rawV = customV
    ? customV
    : selV
      ? (selV.value === "custom" ? "" : selV.value)
      : "";
  const uiMax = toDec(rawV);
  const qpMax = toDec(sp.get("verbrauch_max"));
  const vMax  = Number.isFinite(uiMax) && uiMax > 0 ? uiMax
              : Number.isFinite(qpMax) && qpMax > 0 ? qpMax
              : NaN;

  // ------------------------------------------------------------
  // KORREKTUR: Unfallfrei-Erkennung muss mit item (i) arbeiten
  // und i.raw.unfall === "keine" als unfallfrei akzeptieren.
  // ------------------------------------------------------------
  function isItemAccidentFree(item) {
    const raw = item?.raw ?? item ?? {};

    // 1) Explizite Bool-Felder
    const boolTrue =
      isTruthyRaw(raw.unfallfrei) ||
      isTruthyRaw(raw.verkauf_unfallfrei) ||
      isTruthyRaw(raw.accidentFree) ||
      isTruthyRaw(raw.verkauf_accidentFree);

    if (boolTrue) return true;

    // 2) Unfall-Textfeld (bei dir typischerweise: unfall = "keine")
    const hist =
      raw.unfall ??
      raw.verkauf_unfall ??
      raw.unfallhistorie ??
      raw.unfallHistorie ??
      raw.verkauf_unfallhistorie ??
      raw.verkauf_unfallHistorie ??
      "";

    const s0 = String(hist || "").trim();
    if (!s0) return false;

    const s = norm(s0).replace(/\s+/g, " ").trim();
    if (!s) return false;

    // "keine Angabe" / unbekannt NICHT als unfallfrei werten
    if (/(keine angabe|unbekannt|nicht bekannt|\bk\.?\s*a\.?\b|n\/a)/i.test(s)) return false;

    // WICHTIG: "keine" alleine => unfallfrei (dein Hauptfall)
    if (/^(keine|nein|unfallfrei)$/i.test(s0)) return true;

    // Fälle wie "Unfallhistorie: keine"
    if (/\bkeine\b/i.test(s) && /(unfall|historie|schaden)/i.test(s)) return true;

    // Allgemeine unfallfrei-Formulierungen
    if (/\bunfallfrei\b/i.test(s)) return true;
    if (/\bohne\b.*\b(unfall|schaden)\b/i.test(s)) return true;
    if (/\bkein(e)?\b.*\b(unfall|schaden)\b/i.test(s)) return true;

    // negative Hinweise => nicht unfallfrei
    if (/(unfall(?!frei)|unfallschaden|schaden|besch(a|ä)digt|repariert|accident)/i.test(s)) return false;

    return false;
  }

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
      if (!isItemAccidentFree(i)) return false;
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

    // Ort: nur clientseitiger Textabgleich, WENN KEIN Umkreis gesetzt ist.
    // Mit Umkreis übernimmt das Backend das komplette Geo-Filtering.
    const ortParam = sp.get("ort") || "";
    const hasRadius = !!sp.get("umkreis");

    if (ortParam && !hasRadius) {
      const standort = norm(i.standort || "");
      if (!standort.includes(norm(ortParam))) return false;
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



  function renderPager(totalCount) {
    if (!pager) return;
  
    const totalPages = Math.max(1, Math.ceil((Number(totalCount) || 0) / pageSize));
    const current    = clamp(page, 1, totalPages);
  
    if (totalPages <= 1) {
      pager.innerHTML = "";
      return;
    }
  
    const windowSize = 5;
  
    // Fenster um aktuelle Seite
    let start = Math.max(1, current - Math.floor(windowSize / 2));
    let end   = Math.min(totalPages, start + windowSize - 1);
    start     = Math.max(1, end - windowSize + 1);
  
    const pageBtn = (p) =>
      `<button type="button"
               class="pager-btn ${p === current ? "active" : ""}"
               data-page="${p}"
               aria-label="Seite ${p}">
          ${p}
       </button>`;
  
    let pagesHtml = "";
  
    // 1. Seite + Ellipse
    if (start > 1) {
      pagesHtml += pageBtn(1);
      if (start > 2) pagesHtml += `<span class="pager-ellipsis" aria-hidden="true">…</span>`;
    }
  
    // Seitenfenster
    for (let p = start; p <= end; p++) pagesHtml += pageBtn(p);
  
    // letzte Seite + Ellipse
    if (end < totalPages) {
      if (end < totalPages - 1) pagesHtml += `<span class="pager-ellipsis" aria-hidden="true">…</span>`;
      pagesHtml += pageBtn(totalPages);
    }
  
    pager.innerHTML = `
      <nav class="pager-nav" aria-label="Seitennavigation">
        <button type="button"
                class="pager-btn pager-prev"
                data-page="${current - 1}"
                ${current === 1 ? "disabled" : ""}
                aria-label="Vorherige Seite">
          <i class="fa-solid fa-chevron-left" aria-hidden="true"></i>
          <span>Zurück</span>
        </button>
  
        <div class="pager-pages" role="group" aria-label="Seiten">
          ${pagesHtml}
        </div>
  
        <button type="button"
                class="pager-btn pager-next"
                data-page="${current + 1}"
                ${current === totalPages ? "disabled" : ""}
                aria-label="Nächste Seite">
          <span>Weiter</span>
          <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
        </button>
  
        <div class="pager-meta" aria-live="polite">
          Seite ${current} von ${totalPages} · ${(Number(totalCount) || 0).toLocaleString("de-DE")} Treffer
        </div>
      </nav>
    `;
  
    // Klick-Handling: Seite setzen, URL updaten, neu laden
    pager.querySelectorAll(".pager-btn[data-page]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const target = Number(e.currentTarget.getAttribute("data-page"));
        if (!Number.isFinite(target)) return;

        const nextPage = clamp(target, 1, totalPages);
        if (nextPage === page) return;

        page = nextPage;

        const params = new URLSearchParams(window.location.search);
        ensureSortParam(params);
        params.set("page", String(page));
        replaceUrlParams(params);

        loadAndRender(page);
  
        // Optional (UX): nach dem Blättern zurück zum Beginn der Ergebnisse
        // document.querySelector(".results-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const fmtRating = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(1).replace(".", ",") : "";
  };

  const starsHTML = (avg) => {
    const a = Number(avg);
    if (!Number.isFinite(a) || a <= 0) return "";
    let out = `<span class="stars" aria-hidden="true">`;
    for (let i = 1; i <= 5; i++) {
      if (a >= i - 0.25) out += `<i class="fa-solid fa-star"></i>`;
      else if (a >= i - 0.75) out += `<i class="fa-solid fa-star-half-stroke"></i>`;
      else out += `<i class="fa-regular fa-star"></i>`;
    }
    out += `</span>`;
    return out;
  };

  const ratingBlock = ({ isHaendler, avg, count }) => {
    const c = Number(count);
    const a = Number(avg);

    if (!isHaendler) return "";
    if (!Number.isFinite(c) || c <= 0) return "";
    if (!Number.isFinite(a) || a <= 0) return "";

    const label = `Bewertung ${fmtRating(a)} von 5 Sternen (${c} Bewertungen)`;
    return `
      <div class="dealer-rating" aria-label="${label}">
        ${starsHTML(a)}
        <span class="dealer-rating__value">${fmtRating(a)}</span>
        <span class="dealer-rating__count" title="${c} Bewertungen">(${c})</span>
      </div>
    `;
  };
  function renderItems() {
    if (!container) return;
    container.innerHTML = "";
  
    // Server liefert *nur die aktuelle Seite*:
    const view = filteredItems;

    updateResultCount();
  
    if (!view.length) {
      container.innerHTML = "<p>❌ Keine Fahrzeuge gefunden.</p>";
      renderPager(serverTotal);
      const footnote = document.getElementById("vatFootnoteSearch");
      if (footnote) footnote.hidden = true;
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
  
    let hasMwstAny = false;
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
      const hasMwst = hasMwstHint(inserat);
      const mwstSup = hasMwst ? `<sup class="price-sup">1</sup>` : "";
      if (hasMwst) hasMwstAny = true;
  
      // Verkäuferdaten robust bestimmen
      const rawType = String(
        inserat.seller?.type ||
        inserat.raw?.seller?.type ||
        inserat.verkaeufer ||
        inserat.raw?.verkauf_verkaeufer ||
        ""
      ).toLowerCase();
  
      const isHaendler =
        rawType === "haendler" ||
        rawType === "händler" ||
        rawType.includes("händ") ||
        rawType.includes("haend");
  
      const sellerName = isHaendler
        ? (
            inserat.seller?.name ||
            inserat.raw?.seller?.name ||
            inserat.name ||
            inserat.raw?.verkauf_name ||
            "Händler"
          )
        : "Privatanbieter";
  
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

      const ratingAvg =
        inserat.seller?.ratingAvg ??
        inserat.raw?.seller?.ratingAvg ??
        inserat.raw?.seller?.rating_avg ??
        inserat.raw?.ratingAvg ??
        inserat.raw?.rating_avg;

      const ratingCount =
        inserat.seller?.ratingCount ??
        inserat.raw?.seller?.ratingCount ??
        inserat.raw?.seller?.rating_count ??
        inserat.raw?.ratingCount ??
        inserat.raw?.rating_count;

      const dealerRatingHTML = ratingBlock({
        isHaendler,
        avg: ratingAvg,
        count: ratingCount
      });

      // 🔹 Verbrauch fürs UI robust ermitteln (inkl. Einheit)
      const vShowText = formatConsumptionDisplay(
        inserat.verkauf_verbrauch_kombiniert ??
          inserat.verbrauch_kombiniert ??
          inserat.raw?.verkauf_verbrauch_kombiniert ??
          inserat.raw?.verbrauch_kombiniert ??
          inserat.raw?.verbrauch,
        inserat.verkauf_verbrauch_kombiniert_unit ??
          inserat.verbrauch_kombiniert_unit ??
          inserat.raw?.verkauf_verbrauch_kombiniert_unit ??
          inserat.raw?.verbrauch_kombiniert_unit ??
          "",
        inserat.verkauf_kraftstoff ?? inserat.kraftstoff
      );

      const realId = getMongoId(inserat) || "";
  
      // Karte rendern (ohne gefährliche Text-Injektionen)
      const card = document.createElement("div");
      card.className = "car-card horizontal";
      card.innerHTML = `
        <div class="car-card-media">
          <div class="card-actions mobile-only">
            <button
              class="save-btn"
              type="button"
              title="Auto speichern"
              aria-pressed="false"
              data-inserat-id="${realId}"
              ${realId ? "" : "disabled aria-disabled='true'"}
            >
              <i class="far fa-heart" aria-hidden="true"></i>
            </button>
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
            <div class="car-title-block">
              <h2 class="car-title"></h2>
              <p class="car-subtitle"></p>
            </div>
            <div class="car-price-wrap">
              <p class="car-price">${isNaN(priceNum) ? "Preis n. a." : priceNum.toLocaleString("de-DE") + " €"}${mwstSup}</p>
            </div>
          </div>
  
          <div class="car-meta-block">
            <div class="car-info-grid">
              <p><i class="fas fa-road"></i> ${isNaN(kmNum) ? "?" : kmNum.toLocaleString("de-DE")} km</p>
              <p><i class="fas fa-calendar-alt"></i> EZ ${inserat.erstzulassung || "?"}</p>
              <p><i class="fas fa-gas-pump"></i> ${inserat.kraftstoff || "?"}</p>
              <p><i class="fas fa-gauge-high"></i> ${inserat.leistung || "?"} PS</p>
              <p><i class="fas fa-gears"></i> ${inserat.getriebe || "?"}</p>
              <p><i class="fas fa-tint"></i> ${vShowText}</p>
            </div>
  
            <div class="dealer-info-row">
              <div class="dealer-row">
                <div class="dealer-avatar">
                  <img alt="">
                  <span class="dealer-initials">${sellerInitials(sellerName)}</span>
                </div>
                <div class="dealer-meta">
                  <div class="dealer-name"></div>
                  ${dealerRatingHTML}
                  <div class="dealer-location"></div>
                </div>
              </div>
              <div class="card-actions desktop-only">
                <button
                  class="save-btn"
                  type="button"
                  title="Auto speichern"
                  aria-pressed="false"
                  data-inserat-id="${realId}"
                  ${realId ? "" : "disabled aria-disabled='true'"}
                >
                  <i class="far fa-heart" aria-hidden="true"></i>
                </button>
                <a href="${phoneHref}" class="contact-btn clean-phone" title="Verkäufer kontaktieren" role="button" ${phoneHref === "#" ? "aria-disabled='true'" : ""}>
                  <i class="fas fa-phone"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
      `;
  
      // sichere Texte setzen (Marke + Modell oben, Variante darunter)
      const display = getDisplayTexts(inserat);
      card.querySelector(".car-title").textContent = display.title;
      card.querySelector(".car-subtitle").textContent = display.subtitle || "";
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

    const footnote = document.getElementById("vatFootnoteSearch");
    if (footnote) footnote.hidden = !hasMwstAny;

    // Nach dem Rendern gespeicherte Herzen hydraten
    hydrateSaveButtons(container);

    renderPager(serverTotal); // Wichtig: Gesamttreffer vom Server
  }
  

  async function loadAndRender(p = 1) {
    try {
      const { page: serverPage, limit: serverLimit, total, results } = await fetchSearch(p, pageSize);

      serverTotal   = total;
      filteredItems = Array.isArray(results) ? results.map(normalizeItem) : [];
      page          = Number(serverPage) || 1;

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
    if (v === "price-asc")    return "preis_asc";
    if (v === "price-desc")   return "preis_desc";
    if (v === "mileage-asc")  return "km_asc";
    if (v === "mileage-desc") return "km_desc";
    if (v === "ez-desc")      return "ez_desc";
    if (v === "ez-asc")       return "ez_asc";
    return "neueste"; // default
  }
  function ensureSortParam(params) {
    if (!params) return params;
    if (params.get("sort")) return params;
    const sortSel = document.getElementById("sortBy");
    const mapped = mapSortSelectToParam(sortSel?.value || "default");
    if (mapped) params.set("sort", mapped);
    return params;
  }
  function setOrDelete(params, key, val) {
    if (val == null) return params.delete(key);
    const s = String(val).trim();
    if (s === "" || s === "Beliebig" || s === "-" || s === "any" || s === "alle" || s === "all") params.delete(key);
    else params.set(key, s);
  }function updateUrlFromUiAndReload(opts = {}) {
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
      readEzValue(firstRegFromEl, firstRegYearEl, firstRegMonthEl, 1) ||
      ezVonEl?.value || "";
  
    const toRaw =
      readEzValue(firstRegToEl, firstRegYearToEl, firstRegMonthToEl, 12) ||
      ezBisEl?.value || "";
  
    let [ezFrom, ezTo] = orderYM(parseYM(fromRaw, 1), parseYM(toRaw, 12));
    setOrDelete(params, "ezFrom", ezFrom);
    setOrDelete(params, "ezTo",   ezTo);
  
// Preis / KM (min + max) – robust gegen "10.000"
const toIntParam = (v) => {
  const n = toNum(v ?? "");
  return Number.isFinite(n) ? Math.round(n) : NaN;
};
const pMin  = toIntParam(document.getElementById("priceFrom")?.value || "");
const pMax  = toIntParam(document.getElementById("priceTo")?.value   || "");
const kmMin = toIntParam(document.getElementById("mileageFrom")?.value || "");
const kmMax = toIntParam(document.getElementById("mileageTo")?.value   || "");

if (!Number.isNaN(pMin)  && pMin  > 0) params.set("price_min", String(pMin)); else params.delete("price_min");
if (!Number.isNaN(pMax)  && pMax  > 0) params.set("price_max", String(pMax)); else params.delete("price_max");

if (!Number.isNaN(kmMin) && kmMin > 0) params.set("km_min", String(kmMin));   else params.delete("km_min");
if (!Number.isNaN(kmMax) && kmMax > 0) params.set("km_max", String(kmMax));   else params.delete("km_max");

    // Leistung (PS)
    const psMin = parseInt(document.getElementById("powerFrom")?.value || "", 10);
    const psMax = parseInt(document.getElementById("powerTo")?.value   || "", 10);
    if (!Number.isNaN(psMin) && psMin > 0) params.set("ps_min", String(psMin)); else params.delete("ps_min");
    if (!Number.isNaN(psMax) && psMax > 0) params.set("ps_max", String(psMax)); else params.delete("ps_max");
    if ((!Number.isNaN(psMin) && psMin > 0) || (!Number.isNaN(psMax) && psMax > 0)) {
      params.set("power_unit", "ps");
    } else {
      params.delete("power_unit");
    }
  
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
    const gearVal =
      (/schalt|getriebe|manuell|manual/.test(gearRaw)) ? "schalt" : gearRaw;
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
  
    // Verbrauch (Filter)
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
      const customVal = (inp?.value || "").trim();
      if (customVal) raw = customVal;
      else if (sel) raw = sel.value === "custom" ? "" : sel.value;
      const n = toDec(raw);
      setOrDelete(params, "verbrauch_max", (n != null && n > 0) ? String(n) : "");
    })();
  
    // Ort / Umkreis
    const locVal = (document.getElementById("location")?.value || document.getElementById("ort")?.value || "").trim();
    const hasLoc = !!locVal;
    setOrDelete(params, "ort", locVal);
    const distSel    = document.getElementById("distance-select");
    const distCustom = document.getElementById("distance-custom");
    let umkreisSet = false;
    if (hasLoc && distSel && !distSel.disabled) {
      const dRaw = distSel.value === "custom" ? (distCustom?.value || "") : distSel.value;
      const d    = parseInt(dRaw, 10);
      if (!Number.isNaN(d) && d > 0 && d !== 999) {
        setOrDelete(params, "umkreis", d);
        umkreisSet = true;
      } else {
        params.delete("umkreis");
      }
    } else {
      params.delete("umkreis");
    }
    if (!hasLoc) {
      params.delete("umkreis");
      params.delete("ort_lat"); params.delete("ort_lon");
      params.delete("ort-lat"); params.delete("ort-lon");
      if (distSel) {
        distSel.value = "999";
        distSel.disabled = true;
      }
      if (distCustom) {
        distCustom.value = "";
        distCustom.style.display = "none";
      }
    }
    // Default: wenn Ort gesetzt ist, aber kein Umkreis gewählt → 100 km
    if (hasLoc && !umkreisSet) {
      params.set("umkreis", "100");
      if (distSel) {
        distSel.disabled = false;
        distSel.value = "100";
        if (distCustom) distCustom.value = "";
      }
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
      v === "price-asc"    ? "preis_asc"  :
      v === "price-desc"   ? "preis_desc" :
      v === "mileage-asc"  ? "km_asc"     :
      v === "mileage-desc" ? "km_desc"    :
      v === "ez-desc"      ? "ez_desc"    :
      v === "ez-asc"       ? "ez_asc"     :
      "neueste";
    const sortVal = sortSelect?.value || "";
    const sortParam = mapSort(sortVal);
    if (sortParam) params.set("sort", sortParam);
    else params.delete("sort");
  
    // Seite 1 + neu laden
    params.delete("page");
    const qs = params.toString();
    if (opts.replace !== false) {
      history.replaceState(null, "", `${location.pathname}${qs ? `?${qs}` : ""}`);
    }
    if (opts.reload !== false) {
      loadAndRender(1);
    }
    return params;
  }
  
  // Falls noch nicht gebunden:
  document.getElementById("applyFiltersBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    updateUrlFromUiAndReload();
  });

  document.getElementById("moreFiltersBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    const params = updateUrlFromUiAndReload({ reload: false, replace: false }) || new URLSearchParams();
    const qs = params.toString();
    window.location.href = `suchkriterien.html${qs ? `?${qs}` : ""}`;
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
    const KW_TO_PS = 1.35962;
    const PS_TO_KW = 1 / KW_TO_PS;
  
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
    const firstRegToEl    = document.getElementById("firstRegTo");
    const firstRegMonthEl = document.getElementById("first-registration-month");
    const firstRegYearEl  = document.getElementById("first-registration-year");
    const firstRegMonthToEl = document.getElementById("first-registration-month-to");
    const firstRegYearToEl  = document.getElementById("first-registration-year-to");
  
    const accidentFreeEl = document.getElementById("accidentFree") || document.getElementById("unfallfrei");
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
    const sellerIdParam =
      sp.get("sellerId") ||
      sp.get("haendlerId") ||
      sp.get("anbieterId") ||
      "";
    const sellerNameParam = sp.get("sellerName") || "";
  
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
      
      km_min: sp.get("km_min") || "",
      km_max: sp.get("km_max") || "",
      
      price_min: sp.get("price_min") || "",
      price_max: sp.get("price_max") || "",
      
      ps_min: sp.get("ps_min") || "",
      ps_max: sp.get("ps_max") || "",
      kw_min: sp.get("kw_min") || "",
      kw_max: sp.get("kw_max") || "",
      power_unit: sp.get("power_unit") || "",
      
  
      getriebe: (sp.get("getriebe") || "").toLowerCase(),
      kraftstoff: (sp.get("kraftstoff") || "").split(",").map(fuelCanon).filter(Boolean),
      antrieb: (sp.get("antriebsart") || sp.get("antrieb") || "").split(",").map(driveCanon).filter(Boolean),
  
      // Farben (CSV)
      farbe: (sp.get("farbe") || "").split(",").map(s => s.trim()).filter(Boolean),
  
      ort: sp.get("ort") || "",
      umkreis: sp.get("umkreis") || "",
      verbrauch_max: sp.get("verbrauch_max") || "",
  
      // Flags
      partikelfilter: isTruthyRaw(sp.get("partikelfilter")),
      // -> Scheckheft kann als eigenes Flag ODER via merkmale kommen
      scheckheft:     isTruthyRaw(sp.get("scheckheft")) || hasScheckheftFromMerkmale,
      fahrtauglich:   isTruthyRaw(sp.get("fahrtauglich")),
      unfallfrei:     isTruthyRaw(sp.get("unfallfrei")),
  
      // Max. Halter
      halter_max: sp.get("halter_max") || sp.get("max_halter") || sp.get("owners_max") || "",

      // Sitze / Anbieter / MwSt / Ausstattung
      sitze_min: sp.get("sitze_min") || sp.get("sitze") || "",
      anbieter: sp.get("anbieter") || "",
      mwst: sp.get("mwst") || "",
      ausstattung: (sp.get("ausstattung") || "").split(",").map(s => s.trim()).filter(Boolean),
  
      // Umwelt/Schadstoff
      umweltplakette:   badgeCanon(sp.get("umweltplakette") || sp.get("plakette")),
      schadstoffklasse: emissionCanon(sp.get("schadstoffklasse")),
  
      // HU (strukturiert + Freitext)
      hu_bis:  sp.get("hu_bis") || sp.get("inspectionUntil") || "",
      hu_min:  sp.get("hu_min_monate") || sp.get("hu_min_months") || "",
      hu_text: sp.get("hu") || ""
    };
  
  // Effektive Werte (UI > URL, wenn befüllt)
const priceMin = (() => {
  const n = toInt(priceFromEl?.value ?? "");
  return Number.isFinite(n) && n > 0 ? n : toInt(qp.price_min);
})();

const priceMax = (() => {
  const n = toInt(priceToEl?.value ?? "");
  return Number.isFinite(n) && n > 0 ? n : toInt(qp.price_max);
})();

const kmMin = (() => {
  const n = toInt(mileageFromEl?.value ?? "");
  return Number.isFinite(n) && n > 0 ? n : toInt(qp.km_min);
})();

const kmMax = (() => {
  const n = toInt(mileageToEl?.value ?? "");
  return Number.isFinite(n) && n > 0 ? n : toInt(qp.km_max);
})();

const psMinEff = (() => {
  const n = toInt(powerFromEl?.value ?? "");
  return Number.isFinite(n) && n > 0 ? n : toInt(qp.ps_min);
})();

const psMaxEff = (() => {
  const n = toInt(powerToEl?.value ?? "");
  return Number.isFinite(n) && n > 0 ? n : toInt(qp.ps_max);
})();

const powerUnitEff = (() => {
  const u = (qp.power_unit || "").toLowerCase();
  return u === "kw" ? "kw" : "ps";
})();

const displayPower = (psVal) => {
  if (!Number.isFinite(psVal)) return NaN;
  return powerUnitEff === "kw" ? Math.round(psVal * PS_TO_KW) : Math.round(psVal);
};

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
  
    // Farben (multi) – aus URL + UI-Checkboxen
    const colorFromUrl = (qp.farbe || []).map(s => String(s).trim()).filter(Boolean);
    const colorFromUI  = [...document.querySelectorAll('input[name="farbe"]:checked')]
      .map(cb => String(cb.value || "").trim())
      .filter(Boolean);
    const colorList    = uniq([...colorFromUrl, ...colorFromUI]).filter(Boolean);
  
    // EZ
    const ezFromUIraw = readEzValue(firstRegFromEl, firstRegYearEl, firstRegMonthEl, 1) || "";
    const ezToUIraw   = readEzValue(firstRegToEl, firstRegYearToEl, firstRegMonthToEl, 12) || "";
    const ezFromEff = normalizeYMAny(ezFromUIraw || qp.ezFrom);
    const ezToEff   = normalizeYMAny(ezToUIraw   || qp.ezTo);
  
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
  
    const accFree = !!accidentFreeEl?.checked || qp.unfallfrei;
  
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
    if (!isNaN(psMinEff) && psMinEff > 0) chips.push({key:"ps_min",    label:`${powerUnitEff === "kw" ? "kW" : "PS"} ab ${int(displayPower(psMinEff))}`});
    if (!isNaN(psMaxEff) && psMaxEff > 0) chips.push({key:"ps_max",    label:`${powerUnitEff === "kw" ? "kW" : "PS"} bis ${int(displayPower(psMaxEff))}`});
  
    fuelList.forEach(tok => chips.push({ key: "fuel", value: tok, label: `Kraftstoff: ${fuelNiceLabel(tok)}` }));
    if (effGear) chips.push({ key: "gear", label: `Getriebe: ${effGear}` });
    driveList.forEach(tok => chips.push({ key: "drive", value: tok, label: `Antrieb: ${driveNiceLabel(tok)}` }));
  
    // Farb-Chips
    colorList.forEach(col => {
      const label = col ? col.charAt(0).toUpperCase() + col.slice(1) : col;
      chips.push({ key: "farbe", value: col, label: `Farbe: ${label}` });
    });
  
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
    if (qp.scheckheft || scheckheftEl?.checked) {
      chips.push({ key: "scheckheft", label: "Scheckheftgepflegt" });
    }
  
    // Max. Halter
    if (Number.isFinite(halterMaxEff) && halterMaxEff > 0) {
      chips.push({ key: "halter_max", label: `Halter ≤ ${int(halterMaxEff)}` });
    }
  
    // Weitere URL-basierte Chips
    if (sellerIdParam) {
      const labelName = sellerNameParam || sellerIdParam;
      chips.push({ key: "sellerId", label: `Anbieter: ${labelName}` });
    }

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

    // Sitze (mind.)
    if (qp.sitze_min)
      chips.push({ key: "sitze_min", label: `Sitze ab ${qp.sitze_min}` });

    // Anbieter (Händler/Privat)
    if (qp.anbieter) {
      const label = qp.anbieter.toLowerCase().includes("haend") || qp.anbieter.toLowerCase().includes("händ")
        ? "Händler"
        : "Privat";
      chips.push({ key: "anbieter", label: `Anbieter: ${label}` });
    }

    // MwSt. ausweisbar
    if (isTruthyRaw(qp.mwst))
      chips.push({ key: "mwst", label: "MwSt. ausweisbar" });

    // Ausstattung
    const equipLabel = (t) => {
      const k = String(t || "").trim().toLowerCase();
      const map = {
        navigation: "Navigation",
        sitzheizung: "Sitzheizung",
        rueckfahrkamera: "Rückfahrkamera",
        scheinwerfer: "Scheinwerfer",
        bluetooth: "Bluetooth",
        panorama: "Panorama",
        applecarplay: "Apple CarPlay",
        androidauto: "Android Auto",
        isofix: "ISOFIX",
        led: "Scheinwerfer",
        xenon: "Scheinwerfer",
        matrix: "Scheinwerfer"
      };
      if (map[k]) return map[k];
      if (/(rueckfahr|rückfahr|rear|backup).*(kamera|camera)/.test(k)) return "Rückfahrkamera";
      if (/(scheinwerfer|xenon|bi-?xenon|matrix|led|laser)/.test(k)) return "Scheinwerfer";
      return t;
    };
    if (qp.ausstattung?.length) {
      qp.ausstattung.forEach(e =>
        chips.push({ key: "ausstattung", value: e, label: `Ausstattung: ${equipLabel(e)}` })
      );
    }
  
 
  
    // Render
    if (!chips.length) {
      bar.textContent = "";
      bar.classList.add("is-empty");
      bar.removeAttribute("data-has-chips");
      if (barWrap) barWrap.classList.add("no-chips");
      const dockBarEmpty = document.getElementById("activeFilterBarDock");
      if (dockBarEmpty) {
        dockBarEmpty.textContent = "";
        dockBarEmpty.classList.add("is-empty");
        dockBarEmpty.removeAttribute("data-has-chips");
      }
      if (typeof window.updateMobileFilterDock === "function") {
        window.updateMobileFilterDock();
      }
      return;
    }
  
    bar.classList.remove("is-empty");
    bar.setAttribute("data-has-chips", "1");
    if (barWrap) barWrap.classList.remove("no-chips");

    const renderChipsTo = (target) => {
      if (!target) return;
      target.innerHTML = chips.map(c => `
        <div class="filter-chip" data-key="${c.key}" ${('value' in c) ? `data-value="${c.value}"` : ""}>
          <span class="chip-label">${c.label}</span>
          <button class="chip-remove" type="button" aria-label="Filter entfernen" title="Filter entfernen">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `).join("") + `<button class="clear-all" type="button">Alle löschen</button>`;

      target.querySelectorAll(".filter-chip .chip-remove").forEach(btn => {
        btn.addEventListener("click", (e) => {
          const chip = e.currentTarget.closest(".filter-chip");
          if (!chip) return;
          const key = chip.getAttribute("data-key");
          const val = chip.getAttribute("data-value") || "";
          removeFilterChip(key, val);
        });
      });
      target.querySelector(".clear-all")?.addEventListener("click", () => clearAllFilters());
    };

    renderChipsTo(bar);

    const dockBar = document.getElementById("activeFilterBarDock");
    if (dockBar) {
      dockBar.classList.remove("is-empty");
      dockBar.setAttribute("data-has-chips", "1");
      renderChipsTo(dockBar);
    }
    if (typeof window.updateMobileFilterDock === "function") {
      window.updateMobileFilterDock();
    }
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
    case "ezTo": {
      const toEl = document.getElementById("firstRegTo");
      if (toEl) toEl.value = "";
      const m = document.getElementById("first-registration-month-to");
      const y = document.getElementById("first-registration-year-to");
      if (m) m.value = "";
      if (y) y.value = "";
      const ezBis = document.getElementById("ez-bis");
      if (ezBis) ezBis.value = "";
      params.delete("ezTo");
      break;
    }

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

    case "sellerId":
      params.delete("sellerId");
      params.delete("sellerName");
      params.delete("haendlerId");
      params.delete("anbieterId");
      break;

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
      params.delete("ort-lat"); params.delete("ort-lon");
      params.delete("umkreis");
      {
        const distSel = document.getElementById("distance-select");
        const distCustom = document.getElementById("distance-custom");
        if (distSel) {
          distSel.value = "999";
          distSel.disabled = true;
        }
        if (distCustom) {
          distCustom.value = "";
          distCustom.style.display = "none";
        }
      }
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
      case "accidentFree": {
        // URL-Parameter entfernen (beide Varianten, falls irgendwo noch accidentFree genutzt wurde)
        ["unfallfrei", "accidentFree"].forEach(k => params.delete(k));
      
        // Checkbox im UI zurücksetzen (id kann bei dir "unfallfrei" ODER "accidentFree" sein)
        const ufEl =
          document.getElementById("unfallfrei") ||
          document.getElementById("accidentFree");
      
        if (ufEl && "checked" in ufEl) ufEl.checked = false;
      
        break;
      }
      

    case "fahrtauglich":
      params.delete("fahrtauglich");
      break;

    case "sitze_min":
    case "sitze": {
      params.delete("sitze_min");
      params.delete("sitze");
      const seatsEl = document.getElementById("sitze");
      if (seatsEl) seatsEl.value = "";
      break;
    }

    case "anbieter": {
      params.delete("anbieter");
      const anbieterEl = document.getElementById("anbieter");
      if (anbieterEl) anbieterEl.value = "";
      break;
    }

    case "mwst":
      params.delete("mwst");
      break;

    case "ausstattung": {
      const list = splitCsv(params.get("ausstattung") || "");
      const next = list.filter(x => x.toLowerCase() !== String(val || "").toLowerCase());
      if (next.length) params.set("ausstattung", next.join(","));
      else params.delete("ausstattung");
      document.querySelectorAll('.equipment-grid input[type="checkbox"]').forEach(cb => {
        if ((cb.value || "").toLowerCase() === String(val || "").toLowerCase()) cb.checked = false;
      });
      break;
    }


    default: break;
  }

  // Paging zurücksetzen & URL aktualisieren
  params.delete("page");
  if (!params.get("ps_min") && !params.get("ps_max")) params.delete("power_unit");
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
    "sellerId","sellerName","haendlerId","anbieterId",
    // HU-Parameter (alle Varianten)
    "hu","hu_bis","inspectionUntil","hu_min_monate","hu_min_months",
    // Max. Halter
    "halter_max","max_halter","owners_max",
    // Neu: Sitze / Anbieter / MwSt / Ausstattung / Leistungseinheit
    "sitze_min","sitze","anbieter","mwst","ausstattung","power_unit","kw_min","kw_max"
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

  // Sitze / Anbieter / MwSt / Ausstattung
  {
    const seatsEl = document.getElementById("sitze");
    if (seatsEl) seatsEl.value = "";

    const anbieterEl = document.getElementById("anbieter");
    if (anbieterEl) anbieterEl.value = "";

    const mwstEl = document.getElementById("mwst-ausweisbar");
    if (mwstEl) mwstEl.checked = false;

    document.querySelectorAll('.equipment-grid input[type="checkbox"]').forEach(cb => (cb.checked = false));
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
