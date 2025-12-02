/* =========================
   anzeige.js – korrigiert
   ========================= */

// API-Basis (wie in Vorschau)
/* =========================================================
   anzeige.js – Detailseite
   ========================================================= */

/* ------------------------ API-Helper ------------------------ */
// --- Zusatz-Utils für technische Daten ---
const asYN = (v) => {
  if (v === true || v === "true" || v === 1 || v === "1") return "Ja";
  if (v === false || v === "false" || v === 0 || v === "0") return "Nein";
  const s = String(v ?? "").trim();
  return s || "–";
};
const firstNonEmpty = (...vals) => {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
};

const API_BASE =
  (typeof window !== "undefined" && window.API_BASE) ||
  document.querySelector('meta[name="api-base"]')?.content ||
  "";
const api = (path = "") =>
  API_BASE
    ? API_BASE.replace(/\/+$/, "") + "/" + String(path).replace(/^\/+/, "")
    : String(path);

/* ------------------------ Utils ------------------------ */
const toNum = (v) => {
  if (v === null || v === undefined) return NaN;
  const s = String(v)
    .trim()
    .replace(/[\u202F\u00A0\s]/g, "")
    .replace(/[€]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};
const fmtEUR = (n) => (Number.isFinite(n) ? n.toLocaleString("de-DE") + " €" : "");
const PS2KW = (ps) => Math.round(Number(ps) * 0.7355);
const escapeHTML = (str = "") =>
  String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const renderMultilineToHTML = (text = "") => {
  // Text sicher machen + Windows-Umbrüche vereinheitlichen
  const safe = escapeHTML(String(text || "")).replace(/\r\n/g, "\n");

  if (!safe) return "";

  // Jeder Zeilenumbruch im Original-Text wird direkt zu <br>
  return safe.replace(/\n/g, "<br>");
};

const sanitizePhone = (p) => String(p || "").replace(/[^\d+]/g, "");
const ensureHttp = (u) => (!u ? "" : /^https?:\/\//i.test(u) ? u : "https://" + String(u).trim());
const pickPrice = (...vals) => {
  for (const v of vals) {
    const n = toNum(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return NaN;
};
const sellerInitials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => (p[0] || "").toUpperCase()).join("") || "AV";
const getDocId = (doc) => {
  if (!doc) return null;
  if (doc._id && typeof doc._id === "object" && typeof doc._id.$oid === "string") return doc._id.$oid;
  if (typeof doc._id === "string") return doc._id;
  if (typeof doc.id === "string") return doc.id;
  return null;
};
const $id = (x) => document.getElementById(x);
const setText = (id, v) => {
  const el = $id(id);
  if (el) el.textContent = v ?? "—";
};
function parseVerbrauchNum(val) {
  if (val == null) return NaN;
  if (typeof val === "number") return Number.isFinite(val) ? val : NaN;

  if (typeof val === "object") {
    const keys = [
      "kombiniert","combined","wltp_kombiniert","wltpCombined","nefz_kombiniert",
      "combined_l_100km","kombiniert_l_100km","kombiniert_l_pro_100_km"
    ];
    for (const k of keys) {
      if (val[k] != null) {
        const n = parseVerbrauchNum(val[k]);
        if (Number.isFinite(n)) return n;
      }
    }
    for (const k in val) {
      if (/komb/i.test(k)) {
        const n = parseVerbrauchNum(val[k]);
        if (Number.isFinite(n)) return n;
      }
    }
    return NaN;
  }

  const s = String(val).toLowerCase().replace(/\s+/g, " ").trim();

  // 1) Zahlen direkt vor "l/100 km"
  const litersAll = [];
  const rxLiters = /(\d+(?:[.,]\d+)?)(?=\s*(?:l|liter)\s*\/\s*100\s*km\b)/gi;
  for (const m of s.matchAll(rxLiters)) litersAll.push(parseFloat(m[1].replace(",", ".")));
  if (litersAll.length) return Math.max(...litersAll.filter(Number.isFinite));

  // 2) Wenn keine Liter gefunden wurden, aber kWh/100 km vorkommt -> EV/PHEV → NaN
  if (/\bkwh\s*\/?\s*100\s*km\b/.test(s)) return NaN;

  // 3) Fallback: größte Zahl < 60
  const nums = (s.match(/\d+(?:[.,]\d+)?/g) || [])
    .map(t => parseFloat(t.replace(",", ".")))
    .filter(n => Number.isFinite(n) && n < 60);
  if (nums.length) return Math.max(...nums);

  return NaN;
}


// Holt "kombiniert" aus möglichst vielen Varianten.
// Bezieht auch Top-Level `verbrauch` mit ein (manche Datensätze haben nur das).
function getCombinedConsumption(item) {
  const cands = [
    item.verkauf_verbrauch_kombiniert,
    item.verbrauch_kombiniert,
    item.verbrauch,                         // ← Top-Level String
    item.raw?.verkauf_verbrauch_kombiniert,
    item.raw?.verbrauch_kombiniert,
    item.raw?.verbrauch?.kombiniert,
    item.raw?.wltp_kombiniert,
    item.raw?.wltp?.kombiniert,
    item.raw?.nefz_kombiniert,
    item.raw?.nefz?.kombiniert,
    item.raw?.verbrauch                    // ← Roh-String
  ];
  for (const c of cands) {
    const n = parseVerbrauchNum(c);
    if (Number.isFinite(n)) return n;
  }

  // Fallback: Mittelwert inner/außerorts
  const inner = parseVerbrauchNum(
    item.verkauf_verbrauch_innerorts ??
    item.verbrauch_innerorts ??
    item.raw?.verkauf_verbrauch_innerorts ??
    item.raw?.verbrauch_innerorts ??
    item.raw?.verbrauch?.innerorts
  );
  const outer = parseVerbrauchNum(
    item.verkauf_verbrauch_ausserorts ??
    item.verbrauch_ausserorts ??
    item.raw?.verkauf_verbrauch_ausserorts ??
    item.raw?.verbrauch_ausserorts ??
    item.raw?.verbrauch?.ausserorts
  );
  if (Number.isFinite(inner) && Number.isFinite(outer)) return (inner + outer) / 2;

  return NaN;
}

/* ------------------------ Auth + Navbar ------------------------ */
function setupAuthLink() {
  fetch(api("/getNutzerInfo"), { credentials: "include" })
    .then((r) => r.json())
    .then((data) => {
      const authLink = document.getElementById("auth-link");
      if (!authLink) return;
      if (data.eingeloggt) {
        authLink.innerHTML = `<a href="#" id="logout-link"><i class="fas fa-sign-out-alt"></i> Abmelden</a>`;
        document.getElementById("logout-link")?.addEventListener("click", (e) => {
          e.preventDefault();
          fetch(api("/logout"), { method: "POST", credentials: "include" })
            .then(() => {
              try {
                localStorage.clear();
              } catch {}
              window.location.href = "index.html";
            })
            .catch(() => alert("Abmelden fehlgeschlagen."));
        });
      } else {
        authLink.innerHTML = `<a href="login.html"><i class="fas fa-sign-in-alt"></i> Login / Registrierung</a>`;
      }
    })
    .catch(() => {});
}

function setupNavbarShortcuts() {
  const guard = async () => {
    try {
      const s = await fetch(api("/getNutzerInfo"), { credentials: "include" }).then((r) => r.json());
      return !!s.eingeloggt;
    } catch {
      return false;
    }
  };
  document.getElementById("saved-cars-link")?.addEventListener("click", async (e) => {
    e.preventDefault();
    window.location.href = (await guard()) ? "gespeicherte-autos.html" : "login.html";
  });
  document.getElementById("my-cars-link")?.addEventListener("click", async (e) => {
    e.preventDefault();
    window.location.href = (await guard()) ? "meine-autos.html" : "login.html";
  });
}

async function loadInseratData() {
  let fromLS = null;

  // 1) Versuch: vorhandenen Eintrag aus localStorage lesen
  try {
    const raw = localStorage.getItem("ausgewaehltesInserat");
    if (raw) {
      fromLS = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Konnte localStorage-Eintrag nicht parsen:", e);
  }

  // 2) ID aus der URL holen (?id=...)
  let id = null;
  try {
    if (typeof getQuery === "function") {
      id = getQuery("id");
    }
  } catch {
    // wenn getQuery nicht existiert → ignorieren
  }

  // 3) Falls keine Query-ID: evtl. aus Pfad /anzeige/<id>
  if (!id && typeof window !== "undefined") {
    const m = window.location.pathname.match(
      /\/anzeige(?:\.html)?\/([0-9a-fA-F]{24})/
    );
    if (m) id = m[1];
  }

  // 4) Falls immer noch keine ID: aus dem localStorage-Objekt ziehen
  if (!id && fromLS) {
    try {
      if (typeof getDocId === "function") {
        id = getDocId(fromLS);
      } else {
        const cand =
          (fromLS._id && (fromLS._id.$oid || fromLS._id)) ||
          fromLS.id ||
          null;
        if (cand) id = String(cand);
      }
    } catch {
      // egal, wir haben ja noch den LS-Fallback
    }
  }

  // 5) Wenn wir eine vernünftig aussehende ObjectId haben → Server fragen
  if (id && /^[0-9a-fA-F]{24}$/.test(String(id))) {
    try {
      const res = await fetch(
        api(`/inserat-details/${encodeURIComponent(id)}`),
        { credentials: "include" }
      );

      if (res.ok) {
        const details = await res.json();

        // 💡 WICHTIG: Server-Daten mit dem lokalen Inserat MERGEN
        // fromLS = komplettes Inserat (mit allen Feldern)
        // details = Zusatzinfos (seller, isSaved, ein paar Felder)
        const merged = fromLS ? { ...fromLS, ...details } : details;

        try {
          localStorage.setItem(
            "ausgewaehltesInserat",
            JSON.stringify(merged)
          );
        } catch (e) {
          console.warn(
            "Konnte gemergte Daten nicht in localStorage speichern:",
            e
          );
        }

        return merged;
      } else {
        console.warn("Antwort /inserat-details:", res.status);
        if (res.status === 401 || res.status === 403) {
          console.warn(
            "Nicht eingeloggt (401/403) – benutze nur localStorage-Fallback."
          );
        }
      }
    } catch (err) {
      console.error("Fehler beim Laden /inserat-details:", err);
    }
  }

  // 6) Fallback: wenn Server nicht geklappt hat → localStorage verwenden
  if (fromLS) {
    return fromLS;
  }

  console.warn(
    "Kein Inserat im LocalStorage und keine gültige ID in der URL gefunden."
  );
  return null;
}



/* ------------------------ Mapping ------------------------ */
function mapRoleToLabel(roleOrLabel) {
  const r = String(roleOrLabel || "").toLowerCase();
  if (r.includes("haendler") || r.includes("händler") || r === "dealer") return "Händler";
  if (r.includes("privat")) return "Privatverkäufer";
  if (roleOrLabel === "Händler" || roleOrLabel === "Privatverkäufer") return roleOrLabel;
  return "Verkäufer";
}

/* ------------------------ Kopfbereich ------------------------ */
function fillTop(inserat) {
  const titleEl = document.getElementById("car-title");
  if (titleEl) titleEl.textContent = inserat.titel || inserat.verkauf_modell || "–";

  const priceMain = document.getElementById("price-main");
  const priceNet = document.getElementById("price-net");
  const mwstType = document.getElementById("mwst-type");
  const priceType = document.getElementById("price-type");

  const mwstRaw = String(inserat.verkauf_mwst || "").trim().toLowerCase();
  const isKeine = mwstRaw.includes("keine");
  const isZzgl = mwstRaw.includes("zzgl");

  const brutto = toNum(inserat.verkauf_brutto ?? inserat["brutto-preis"]);
  const netto = toNum(inserat.verkauf_netto ?? inserat["netto-preis"]);
  const einzel = toNum(inserat.verkauf_preis ?? inserat.preis);

  let mainPriceNum = NaN;
  if (isKeine) mainPriceNum = Number.isFinite(einzel) ? einzel : NaN;
  else if (isZzgl) mainPriceNum = Number.isFinite(brutto) ? brutto : Number.isFinite(einzel) ? einzel : NaN;
  else mainPriceNum = Number.isFinite(brutto) ? brutto : Number.isFinite(einzel) ? einzel : NaN;

  if (priceMain) priceMain.textContent = Number.isFinite(mainPriceNum) ? fmtEUR(mainPriceNum) : fmtEUR(toNum(inserat.preis)) || "–";
  if (priceNet) priceNet.textContent = isZzgl && Number.isFinite(netto) ? fmtEUR(netto) : "";
  if (mwstType) mwstType.textContent = inserat.verkauf_mwst || (isKeine ? "Keine MwSt." : isZzgl ? "zzgl. MwSt." : "");
  if (priceType) priceType.textContent = isKeine ? "Endpreis" : "Brutto";

  const ezEl = document.getElementById("info-ez");
  const kmEl = document.getElementById("info-km");
  const psEl = document.getElementById("info-ps");
  const kraftstoffEl = document.getElementById("info-kraftstoff");
  const getriebeEl = document.getElementById("info-getriebe");
  const sellerTypeEl = document.getElementById("seller-type");

  if (ezEl && inserat.verkauf_erstzulassung) ezEl.textContent = inserat.verkauf_erstzulassung;
  if (kmEl && inserat.verkauf_kilometer)
    kmEl.textContent = `${Number(inserat.verkauf_kilometer).toLocaleString("de-DE")} km`;

  if (psEl) {
    const ps = toNum(inserat.verkauf_leistung);
    let kw = toNum(inserat.verkauf_leistung_kw);
    if (!Number.isFinite(kw) && Number.isFinite(ps)) kw = PS2KW(ps);
    let txt = "–";
    if (Number.isFinite(ps) && Number.isFinite(kw)) txt = `${ps} PS (${kw} kW)`;
    else if (Number.isFinite(ps)) txt = `${ps} PS`;
    else if (Number.isFinite(kw)) txt = `${kw} kW`;
    psEl.textContent = txt;
  }

  if (kraftstoffEl && inserat.verkauf_kraftstoff) kraftstoffEl.textContent = inserat.verkauf_kraftstoff;
  if (getriebeEl && inserat.verkauf_getriebe) getriebeEl.textContent = inserat.verkauf_getriebe;

  const sellerLabel =
    mapRoleToLabel(inserat?.seller?.type) || mapRoleToLabel(inserat?.verkauf_verkaeufer);
  if (sellerTypeEl) sellerTypeEl.textContent = sellerLabel;
}
function initStickySummary(inserat) {
  const bar = document.getElementById("sticky-summary");
  if (!bar) return;

  // --- Helfer zum Formatieren ---
  function formatPrice(value) {
    if (value == null || !Number.isFinite(value)) return "Preis auf Anfrage";
    try {
      return new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return value + " €";
    }
  }

  function formatEZ(ez) {
    if (!ez) return "EZ –";

    // String "YYYY-MM" oder "YYYY/MM"
    if (typeof ez === "string" && ez.length >= 4) {
      const s = ez.trim();
      // YYYY-MM / YYYY/MM
      const m = s.match(/^(\d{4})[-/.](\d{1,2})$/);
      if (m) {
        const year = m[1];
        const month = String(m[2]).padStart(2, "0");
        return `EZ ${month}/${year}`;
      }
      // Nur Jahr
      if (/^\d{4}$/.test(s)) {
        return `EZ 01/${s}`;
      }
      // Fallback: Roh anzeigen
      return `EZ ${s}`;
    }

    // Objekt { jahr, monat }
    if (typeof ez === "object" && ez.jahr && ez.monat) {
      const m = String(ez.monat).padStart(2, "0");
      return `EZ ${m}/${ez.jahr}`;
    }

    return "EZ –";
  }

  // --- Elemente holen ---
  const titleEl = bar.querySelector("[data-field='title']");
  const priceEl = bar.querySelector("[data-field='price']");
  const kmEl    = bar.querySelector("[data-field='km']");
  const ezEl    = bar.querySelector("[data-field='ez']");
  const imgEl   = bar.querySelector("[data-field='image']");

  // --- Inhalte füllen ---
  const titel =
    inserat.titel ||
    [inserat.marke, inserat.modell].filter(Boolean).join(" ") ||
    "Fahrzeug";

  if (titleEl) {
    titleEl.textContent = titel;
  }

  // 🔥 PREIS: gleiche Logik wie in fillTop()
  if (priceEl) {
    const mwstRaw = String(inserat.verkauf_mwst || "").trim().toLowerCase();
    const isKeine = mwstRaw.includes("keine");
    const isZzgl  = mwstRaw.includes("zzgl");

    const brutto = toNum(inserat.verkauf_brutto ?? inserat["brutto-preis"]);
    const einzel = toNum(inserat.verkauf_preis ?? inserat.preis);

    let mainPriceNum = NaN;
    if (isKeine) {
      // "Keine MwSt." -> Einzelpreis ist der Endpreis
      mainPriceNum = Number.isFinite(einzel) ? einzel : NaN;
    } else if (isZzgl) {
      // "zzgl. MwSt." -> Brutto bevorzugt, sonst Einzelpreis
      mainPriceNum = Number.isFinite(brutto)
        ? brutto
        : Number.isFinite(einzel)
        ? einzel
        : NaN;
    } else {
      // Normale MwSt.-Angabe oder leer -> Brutto bevorzugen, sonst Einzelpreis
      mainPriceNum = Number.isFinite(brutto)
        ? brutto
        : Number.isFinite(einzel)
        ? einzel
        : NaN;
    }

    if (Number.isFinite(mainPriceNum)) {
      priceEl.textContent = formatPrice(mainPriceNum);
    } else {
      // Fallback auf evtl. "preis" (z.B. aus /inserat-details)
      const fallback = toNum(inserat.preis);
      priceEl.textContent = Number.isFinite(fallback)
        ? formatPrice(fallback)
        : "Preis auf Anfrage";
    }
  }

  // ✅ Kilometer: String oder Number, beides erlaubt
  if (kmEl) {
    const kmRaw =
      inserat.verkauf_kilometer ??
      inserat.kilometer ??
      inserat.km;

    const kmNum = Number(kmRaw);

    if (Number.isFinite(kmNum) && kmNum > 0) {
      kmEl.textContent =
        kmNum.toLocaleString("de-DE") + " km";
    } else {
      kmEl.textContent = "– km";
    }
  }

  if (ezEl) {
    const ezValue =
      inserat.verkauf_erstzulassung ||
      inserat.erstzulassung ||
      null;
    ezEl.textContent = formatEZ(ezValue);
  }

  if (imgEl) {
    let firstImage = null;

    if (Array.isArray(inserat.images) && inserat.images.length > 0) {
      firstImage = inserat.images[0]; // String-URL
    } else if (
      inserat.medien &&
      inserat.medien[0] &&
      inserat.medien[0].url
    ) {
      // Fallback auf altes Format
      firstImage = inserat.medien[0].url;
    }

    if (firstImage) {
      imgEl.src = firstImage;
      imgEl.alt = titel;
    } else {
      imgEl.src = "";
      imgEl.alt = "Fahrzeugbild";
    }
  }

  // --- Sichtbarkeit abhängig von Scrollposition ---
  const anchor = document.querySelector(".car-price-title-wrapper");
  if (!anchor) return;

  let visible = false;

  function updateVisibility() {
    const rect = anchor.getBoundingClientRect();
    const shouldShow = rect.bottom < 0; // Preisbox komplett aus dem Viewport oben raus

    if (shouldShow && !visible) {
      visible = true;
      bar.classList.add("sticky-summary-visible");
    } else if (!shouldShow && visible) {
      visible = false;
      bar.classList.remove("sticky-summary-visible");
    }
  }

  window.addEventListener("scroll", updateVisibility, { passive: true });
  window.addEventListener("resize", updateVisibility);
  updateVisibility();

  // --- Buttons in der Leiste ---
  const galleryBtn = document.getElementById("sticky-summary-gallery");
  if (galleryBtn) {
    galleryBtn.addEventListener("click", (e) => {
      e.preventDefault();
      document
        .querySelector(".media-detail-container")
        ?.scrollIntoView({ behavior: "smooth" });
    });
  }

  const msgBtn = document.getElementById("sticky-summary-msg");
  if (msgBtn) {
    const scrollMsgBtn = document.getElementById("scrollToMessageBtn");
    if (scrollMsgBtn) {
      msgBtn.addEventListener("click", (e) => {
        e.preventDefault();
        scrollMsgBtn.click(); // benutzt deine bestehende Scroll-Logik
      });
    }
  }
}

function fillTechnical(inserat) {
  // einfache Textfelder (direkte Strings)
  const simpleMap = [
    ["zustand", "v-zustand"],
    ["fahrzeugart", "v-fahrzeugart"],
    ["verkauf_fahrzeugtyp", "v-fahrzeugtyp"],
    ["verkauf_hubraum", "v-hubraum"],
    // ⚠️ kombinierten Verbrauch NICHT mehr hier setzen – das machen wir unten berechnet
    ["verkauf_verbrauch_innerorts", "v-verbrauch-innerorts"],
    ["verkauf_verbrauch_ausserorts", "v-verbrauch-ausserorts"],
    ["verkauf_antrieb", "v-antrieb"],
    ["verkauf_co2_emission", "v-co2"],
    ["verkauf_schadstoffklasse", "v-schadstoffklasse"],
    ["verkauf_umweltplakette", "v-umweltplakette"],
    ["klimatisierung", "v-klimatisierung"],
    ["airbags", "v-airbags"],
    // Emissions-/Energieeffizienzklasse (A–G)
    ["verkauf_emissionsklasse", "v-emissionsklasse"],
    ["emissionsklasse", "v-emissionsklasse"],
  ];

  // render simple text values
  simpleMap.forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const val = String(inserat[key] ?? "").trim();
    el.textContent = val || "–";
  });

  // 🚗 Kombinierter Verbrauch *berechnet* setzen (überschreibt evtl. vorigen Wert)
  (function () {
    const vCombEl = document.getElementById("v-verbrauch-kombiniert");
    if (!vCombEl) return;

    let txt = "–";

    if (typeof getCombinedConsumption === "function") {
      const n = getCombinedConsumption(inserat);
      if (Number.isFinite(n)) {
        txt = String(n.toFixed(1)).replace(".", ",") + " l/100 km";
      }
    } else {
      // Fallback, falls die Helfer noch nicht eingebunden sind:
      const raw =
        (inserat.verkauf_verbrauch_kombiniert ??
         inserat.verbrauch_kombiniert ??
         inserat.verbrauch ?? "");
      txt = String(raw || "–");
    }

    vCombEl.textContent = txt;
  })();

  // Halter (Anzahl)
  const halterEl = document.getElementById("v-halter");
  if (halterEl) {
    const raw =
      inserat.halter ??
      inserat.anzahlhalter ??
      inserat.verkauf_halter ??
      inserat["anzahl-der-halter"];
    halterEl.textContent = String(raw ?? "").trim() || "–";
  }

  // Türen
  const tuerenEl = document.getElementById("v-tueren");
  if (tuerenEl) {
    const raw = inserat.verkauf_tueren ?? inserat.tueren ?? inserat.türen ?? inserat.anzahltueren;
    tuerenEl.textContent = String(raw ?? "").trim() || "–";
  }

  // HU
  const huEl = document.getElementById("v-hu");
  if (huEl) {
    const huRaw = firstNonEmpty(inserat.hu, inserat.tuev, inserat.tüv);
    const m = firstNonEmpty(inserat.tuevMonat, inserat.tüvMonat, inserat.huMonat);
    const j = firstNonEmpty(inserat.tuevJahr, inserat.tüvJahr, inserat.huJahr);
    const hu = huRaw || `${m} ${j}`.trim();
    huEl.textContent = hu || "–";
  }

  // Innenausstattung (Material / Farbe)
  const innenOut = document.getElementById("v-innenausstattung");
  if (innenOut) {
    const mat = firstNonEmpty(inserat.verkauf_innenmaterial, inserat.innenmaterial, inserat.sitzmaterial);
    const col = firstNonEmpty(inserat.verkauf_innenfarbe, inserat.innenfarbe, inserat.sitzfarbe);
    const txt = [mat, col].filter(Boolean).join(" / ");
    innenOut.textContent = txt || "–";
  }

  // Karosseriefarbe (falls Element existiert – z. B. in Vorschau)
  const colorEl = document.getElementById("v-karosseriefarbe");
  if (colorEl) {
    const col = firstNonEmpty(
      inserat.verkauf_karosseriefarbe,
      inserat.karosseriefarbe,
      inserat.verkauf_aussenfarbe,
      inserat.aussenfarbe,
      inserat["außenfarbe"],
      inserat.farbe
    );
    colorEl.textContent = col || "–";
  }

  // Scheinwerfer (z. B. LED, Xenon) – robust
  const headEl = document.getElementById("v-scheinwerfer");
  if (headEl) {
    const head = firstNonEmpty(inserat.verkauf_scheinwerfer, inserat.scheinwerfer, inserat.licht);
    headEl.textContent = head || "–";
  }

  // Tagfahrlicht (Ja/Nein oder Text)
  const tflEl = document.getElementById("v-tagfahrlicht");
  if (tflEl) {
    const tfl = inserat.verkauf_tagfahrlicht ?? inserat.tagfahrlicht ?? inserat.tagesfahrlicht;
    tflEl.textContent = asYN(tfl);
  }

  // Einparkhilfe (String bevorzugen, sonst zusammensetzen)
  const eph = document.getElementById("v-einparkhilfe");
  if (eph) {
    const ausDB = firstNonEmpty(inserat.verkauf_einparkhilfe, inserat.einparkhilfe);
    if (ausDB) {
      eph.textContent = ausDB;
    } else {
      const bits = [];
      if (inserat.einparkhilfeVorne) bits.push("vorn");
      if (inserat.einparkhilfeHinten) bits.push("hinten");
      if (inserat.einparkhilfeSelbstlenkend) bits.push("selbstlenkend");
      if (inserat.kameraHinten || inserat.kamerahinten) bits.push("Kamera hinten");
      if (inserat.kamera360) bits.push("360° Kamera");
      eph.textContent = bits.length ? bits.join(", ") : "–";
    }
  }

  // Boolesche Felder mit Ja/Nein (wenn vorhanden)
  const ynMap = [
    ["fahrtauglich", "v-fahrtauglich"],
    ["beschaedigt", "v-beschaedigt"],
    ["unfall", "v-unfall"],
    ["partikelfilter", "v-partikelfilter"],
  ];
  ynMap.forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = asYN(inserat[key]);
  });
}


/* ------------------------ Ausstattung ------------------------ */
const AUSSTATTUNG_KEYS = [
  "abstandsregeltempomat","applecarplay","androidauto","frontscheibenheizung","heckklappe","led","multifunktion",
  "navigation","sitzheizung","rueckfahrkamera","nichtraucher","scheckheft","garantie","mettalic","abs","esp","asr",
  "berganfahrassistent","muedigkeitswarner","spurhalteassistent","totwinkelassistent","notbremsassistent","notrufsystem",
  "verkehrszeichenerkennung","isofixhinten","isofixbeifahrer","scheinwerferreinigung","blendfreiesfernlicht",
  "fernlichtassistent","innenspiegelabblendend","nachtsichtassistent","nebelscheinwerfer","lichtsensor","regensensor",
  "alarmanlage","wegfahrsperre","keylesszv","zentralverriegelung","standheizung","frontscheibebeheizbar","lenkradbeheizbar",
  "einparkhilfeselbstlenkend","kamerahinten","kamera360","sitzheizungvorne","sitzheizunghinten","sitzeelektrisch",
  "sportsitze","armlehne","lordosenstuetze","massagesitze","sitzbelueftung","beifahrersitzumklappbar","elektrfensterheber",
  "elektrspiegel","elektheckklappe","servolenkung","ambientebeleuchtung","lederlenkrad","radio","dab","cd","tv","navi",
  "soundsystem","touchscreen","sprachsteuerung","multifunktionslenkrad","freisprecheinrichtung","usb","bluetooth","wlan",
  "streaming","induktionsladen","bordcomputer","headup","volldigital","alufelgen","sommerreifen","winterreifen","allwetterreifen",
  "reifendruckkontrolle","winterpaket","raucherpaket","sportpaket","sportfahrwerk","luftfederung","gepaeckabtrennung",
  "skisack","schiebedach","panoramadach","dachreling","behindertengerecht","taxi"
];
const AUSSTATTUNG_LABELS = {
  abstandsregeltempomat:"Abstandsregeltempomat", applecarplay:"Apple CarPlay", androidauto:"Android Auto",
  frontscheibenheizung:"Frontscheibenheizung", heckklappe:"Elektrische Heckklappe", led:"LED-Scheinwerfer",
  multifunktion:"Multifunktionslenkrad", navigation:"Navigationssystem", sitzheizung:"Sitzheizung",
  rueckfahrkamera:"Rückfahrkamera", nichtraucher:"Nichtraucherfahrzeug", scheckheft:"Scheckheftgepflegt",
  garantie:"Garantie / Werksgarantie", mettalic:"Metallic-Lackierung", abs:"ABS", esp:"ESP",
  asr:"ASR (Traktionskontrolle)", berganfahrassistent:"Berganfahrassistent", muedigkeitswarner:"Müdigkeitswarner",
  spurhalteassistent:"Spurhalteassistent", totwinkelassistent:"Totwinkelassistent", notbremsassistent:"Notbremsassistent",
  notrufsystem:"Notrufsystem", verkehrszeichenerkennung:"Verkehrszeichenerkennung", isofixhinten:"Isofix (hinten)",
  isofixbeifahrer:"Isofix Beifahrersitz", scheinwerferreinigung:"Scheinwerferreinigung",
  blendfreiesfernlicht:"Blendfreies Fernlicht", fernlichtassistent:"Fernlichtassistent",
  innenspiegelabblendend:"Innenspiegel automatisch abblendend", nachtsichtassistent:"Nachtsichtassistent",
  nebelscheinwerfer:"Nebelscheinwerfer", lichtsensor:"Lichtsensor", regensensor:"Regensensor",
  alarmanlage:"Alarmanlage", wegfahrsperre:"Elektrische Wegfahrsperre", keylesszv:"Schlüssellose Zentralverriegelung",
  zentralverriegelung:"Zentralverriegelung", standheizung:"Standheizung", frontscheibebeheizbar:"Beheizbare Frontscheibe",
  lenkradbeheizbar:"Beheizbares Lenkrad", einparkhilfeselbstlenkend:"Selbstlenkende Einparkhilfe",
  kamerahinten:"Rückfahrkamera", kamera360:"360°-Kamera", sitzheizungvorne:"Sitzheizung vorne",
  sitzheizunghinten:"Sitzheizung hinten", sitzeelektrisch:"Elektrische Sitzeinstellung", sportsitze:"Sportsitze",
  armlehne:"Armlehne", lordosenstuetze:"Lordosenstütze", massagesitze:"Massagesitze", sitzbelueftung:"Sitzbelüftung",
  beifahrersitzumklappbar:"Umklappbarer Beifahrersitz", elektrfensterheber:"Elektrische Fensterheber",
  elektrspiegel:"Elektrische Seitenspiegel", elektheckklappe:"Elektrische Heckklappe", servolenkung:"Servolenkung",
  ambientebeleuchtung:"Ambientebeleuchtung", lederlenkrad:"Lederlenkrad", radio:"Radio", dab:"DAB-Radio", cd:"CD-Spieler",
  tv:"TV-Empfang", navi:"Navigationssystem", soundsystem:"Soundsystem", touchscreen:"Touchscreen",
  sprachsteuerung:"Sprachsteuerung", multifunktionslenkrad:"Multifunktionslenkrad", freisprecheinrichtung:"Freisprecheinrichtung",
  usb:"USB-Anschluss", bluetooth:"Bluetooth", wlan:"WLAN / Wifi Hotspot", streaming:"Musikstreaming integriert",
  induktionsladen:"Induktionsladen für Smartphones", bordcomputer:"Bordcomputer", headup:"Head-up Display",
  volldigital:"Volldigitales Kombiinstrument", alufelgen:"Leichtmetallfelgen", sommerreifen:"Sommerreifen",
  winterreifen:"Winterreifen", allwetterreifen:"Allwetterreifen", reifendruckkontrolle:"Reifendruckkontrollsystem",
  winterpaket:"Winterpaket", raucherpaket:"Raucherpaket", sportpaket:"Sportpaket", sportfahrwerk:"Sportfahrwerk",
  luftfederung:"Luftfederung", gepaeckabtrennung:"Gepäckraumabtrennung", skisack:"Skisack", schiebedach:"Schiebedach",
  panoramadach:"Panorama-Dach", dachreling:"Dachreling", behindertengerecht:"Behindertengerecht", taxi:"Taxi",
};

function fillAusstattung(inserat) {
  const container = document.getElementById("v-ausstattung");
  const block = document.getElementById("ausstattung-block");
  if (!container) return;

  let any = false;
  AUSSTATTUNG_KEYS.forEach((key) => {
    const v = inserat["verkauf_" + key] ?? inserat[key];
    const checked = v === true || v === "true";
    if (checked && AUSSTATTUNG_LABELS[key]) {
      const div = document.createElement("div");
      div.classList.add("equipment-item");
      div.innerHTML = `<i class="fas fa-check"></i> ${AUSSTATTUNG_LABELS[key]}`;
      container.appendChild(div);
      any = true;
    }
  });

  if (any && block) block.style.display = "block";
}

function fillSellerCard(inserat) {
  const seller = inserat.seller || {};

  const rawType = String(
    seller.type || inserat.verkauf_verkaeufer || ""
  ).toLowerCase();

  const sellerTypeLabel = mapRoleToLabel(
    seller.type || inserat.verkauf_verkaeufer
  );
  const isDealer = sellerTypeLabel === "Händler";

  // --- Basis-Elemente ---
  const nameEl   = document.getElementById("sellerName");
  const typeEl   = document.getElementById("sellerType");
  const addrEl   = document.getElementById("sellerAddress");
  const logoImg  = document.getElementById("sellerLogo");
  const avatarEl = document.getElementById("sellerAvatar");
  const initEl   = document.getElementById("sellerInitials");

  const phoneRow    = document.getElementById("sellerPhoneRow");
  const phoneDisplay = document.getElementById("sellerPhoneDisplay");
  const mailRow     = document.getElementById("sellerMailRow");
  const mailDisplay = document.getElementById("sellerMailDisplay");
  const websiteRow  = document.getElementById("sellerWebsiteRow");
  const websiteLink = document.getElementById("sellerWebsiteLink");
  const languageRow = document.getElementById("sellerLanguageRow");
  const languageEl  = document.getElementById("sellerLanguages");
  const memberRow   = document.getElementById("sellerMemberSinceRow");
  const memberEl    = document.getElementById("sellerMemberSince");
  const impressumRow = document.getElementById("sellerImpressumRow");
  const impressumEl  = document.getElementById("sellerImpressum");

  const ratingWrap  = document.querySelector(".seller-rating-wrap");
  const ratingFill  = document.getElementById("sellerRatingFill");
  const ratingValue = document.getElementById("sellerRatingValue");
  const ratingCount = document.getElementById("sellerRatingCount");

  const callBtn  = document.getElementById("callBtn");
  const carsBtn  = document.getElementById("sellerCarsBtn");
  const msgBtn   = document.getElementById("msgBtn");

  const hoursBox = document.getElementById("sellerHoursBox");
  const hoursList = document.getElementById("sellerHours");
  const mapBox   = document.getElementById("sellerMapBox");
  const mapNote  = document.getElementById("sellerMapNote");
  const mapFrame = document.getElementById("sellerMapFrame");

  // --- Name & Typ ---
  const name =
    seller.firma ||
    seller.name ||
    inserat.verkauf_name ||
    (isDealer ? "Händler" : "Privatanbieter");

  if (nameEl) nameEl.textContent = name;
  if (typeEl) typeEl.textContent = sellerTypeLabel;

  // --- Adresse: Händler = volle Adresse, Privat = nur Ort ---
  const s = (v) => (v == null ? "" : String(v).trim());

  let fullAddress = "";
  if (isDealer) {
    const line1 = [s(seller.strasse), s(seller.hausnummer)]
      .filter(Boolean)
      .join(" ");
    const line2 = [s(seller.plz), s(seller.ort)]
      .filter(Boolean)
      .join(" ");
    const line3 = s(seller.land);
    fullAddress = [line1, line2, line3].filter(Boolean).join(", ");
  } else {
    const city =
      inserat.ort ||
      seller.ort ||
      guessCityFromStandort(inserat.standort || "");
    fullAddress =
      city ||
      inserat.standort ||
      [s(inserat.plz), s(inserat.ort)].filter(Boolean).join(" ") ||
      "Standort nicht angegeben";
  }
  if (addrEl) addrEl.textContent = fullAddress || "–";

  // --- Avatar / Logo ---
  if (logoImg && avatarEl) {
    const logoUrl =
      seller.logoUrl || inserat.sellerLogo || inserat.logoUrl || "";
    if (logoUrl) {
      logoImg.src = logoUrl;
      logoImg.alt = name;
      avatarEl.classList.add("has-logo");
    } else {
      logoImg.removeAttribute("src");
      logoImg.alt = "Logo";
      avatarEl.classList.remove("has-logo");
    }
  }

  if (initEl) {
    const initials =
      (name.match(/\b\p{L}/gu) || [])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "AV";
    initEl.textContent = initials;
  }

  // --- Bewertung: nur bei Händlern anzeigen ---
  if (!isDealer && ratingWrap) {
    ratingWrap.style.display = "none";
  } else if (ratingWrap) {
    ratingWrap.style.display = "";
    // Falls du später Rating im Profil speicherst:
    const ratingNum = Number(seller.rating || inserat.rating || 0);
    const ratingCnt = Number(seller.reviews || inserat.reviews || 0);
    const pct = (Math.max(0, Math.min(5, ratingNum)) / 5) * 100;
    if (ratingFill) ratingFill.style.width = pct + "%";
    if (ratingValue)
      ratingValue.textContent = ratingNum ? ratingNum.toFixed(1) + " / 5" : "– / 5";
    if (ratingCount)
      ratingCount.textContent = ratingCnt ? `(${ratingCnt})` : "";
  }

  // --- Telefon (immer erlaubt) ---
  const rawPhone =
    inserat.telefon ||
    seller.telefon ||
    seller.telefon2 ||
    "";
  if (phoneDisplay) phoneDisplay.textContent = rawPhone || "–";
  if (callBtn) {
    const telFmt = rawPhone ? sanitizePhone(rawPhone) : "";
    if (telFmt) {
      callBtn.href = `tel:${telFmt}`;
      callBtn.setAttribute("aria-disabled", "false");
    } else {
      callBtn.removeAttribute("href");
      callBtn.setAttribute("aria-disabled", "true");
    }
  }

  // --- E-Mail: nur bei Händlern zeigen, bei Privat komplett weg ---
  const rawMail = isDealer
    ? (seller.email || inserat.email || "")
    : "";

  if (mailRow && mailDisplay) {
    if (isDealer && rawMail) {
      mailDisplay.textContent = rawMail;
      mailRow.style.display = "";
    } else {
      mailRow.style.display = "none";
    }
  }

  // --- Website: nur wenn vorhanden ---
  const rawWebsite =
    seller.website ||
    seller.webseite ||
    inserat.website ||
    inserat.webseite ||
    "";

  if (websiteRow && websiteLink) {
    if (rawWebsite) {
      const url = ensureHttp(rawWebsite);
      websiteLink.href = url;
      websiteLink.textContent = rawWebsite.replace(/^https?:\/\//i, "");
      websiteRow.style.display = "";
    } else {
      websiteRow.style.display = "none";
    }
  }

  // --- Sprachen (kommt später in Mongo, bis dahin nur anzeigen wenn vorhanden) ---
  const langs =
    seller.sprachen ||
    seller.languages ||
    inserat.seller_sprachen ||
    null;

  if (languageRow && languageEl) {
    let text = "";
    if (Array.isArray(langs)) text = langs.join(", ");
    else if (typeof langs === "string") text = langs;

    if (text && text.trim()) {
      languageEl.textContent = text.trim();
      languageRow.style.display = "";
    } else {
      languageRow.style.display = "none";
    }
  }

  // --- Mitglied seit (Jahr) ---
  const createdRaw =
    seller.createdAt ||
    seller.erstelltAm ||
    inserat.sellerCreatedAt ||
    null;

  if (memberRow && memberEl) {
    let year = "";
    if (createdRaw) {
      const d = new Date(createdRaw);
      if (!Number.isNaN(d.getTime())) {
        year = String(d.getFullYear());
      }
    }
    if (year) {
      memberEl.textContent = `seit ${year}`;
      memberRow.style.display = "";
    } else {
      memberRow.style.display = "none";
    }
  }

  // --- Impressum: nur Händler, aus Händler-Dokument ---
  if (impressumRow && impressumEl) {
    const impr = isDealer ? (seller.impressum || inserat.impressum || "") : "";
    if (impr && impr.trim()) {
      impressumEl.textContent = impr.trim();
      impressumRow.style.display = "";
    } else {
      impressumRow.style.display = "none";
    }
  }

  // --- Öffnungszeiten: nur Händler ---
  if (hoursBox && hoursList) {
    const hoursText =
      isDealer
        ? (seller.oeffnungszeiten || inserat.oeffnungszeiten || "")
        : "";
    if (hoursText && hoursText.trim()) {
      hoursList.innerHTML = "";
      hoursText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((line) => {
          const li = document.createElement("li");
          li.textContent = line;
          hoursList.appendChild(li);
        });
      hoursBox.style.display = "";
    } else {
      hoursBox.style.display = "none";
    }
  }

  // --- Google Maps: jetzt auch bei Privatanbieter ---
  if (mapBox && mapFrame && mapNote) {
    const city =
      inserat.ort ||
      seller.ort ||
      guessCityFromStandort(inserat.standort || fullAddress);

    // Hinweistext
    if (isDealer) {
      mapNote.textContent = city ? `${name} · ${city}` : name;
    } else {
      mapNote.textContent = city
        ? `Privater Anbieter in ${city}`
        : "Privater Anbieter";
    }

    // Koordinaten bevorzugen
    let src = "";
    if (
      inserat.standortCoords &&
      Array.isArray(inserat.standortCoords.coordinates) &&
      inserat.standortCoords.coordinates.length === 2
    ) {
      const [lon, lat] = inserat.standortCoords.coordinates;
      src = `https://www.google.com/maps?q=${encodeURIComponent(
        lat + "," + lon
      )}&hl=de&z=12&output=embed`;
    } else {
      const query =
        city ||
        inserat.standort ||
        fullAddress;

      if (query && query.trim()) {
        src = `https://www.google.com/maps?q=${encodeURIComponent(
          query
        )}&hl=de&z=12&output=embed`;
      }
    }

    if (src) {
      mapFrame.src = src;
      mapBox.style.display = "";
    } else {
      mapBox.style.display = "none";
    }
  }

  // --- Buttons unten: Anrufen haben wir oben, jetzt: "Fahrzeuge dieses Anbieters" ---
  if (carsBtn) {
    // sellerId aus Inserat ziehen
    const sellerId =
      inserat.verkaeuferId ||
      inserat.sellerId ||
      seller.id ||
      seller._id ||
      "";

    carsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      // Funktionalität später: vorerst einfach auf suche.html
      const param = sellerId
        ? `?sellerId=${encodeURIComponent(sellerId)}`
        : "";
      window.location.href = "suche.html" + param;
    });
  }

  // Nachricht-Button scrollt zum Formular / öffnet Panel
  if (msgBtn) {
    msgBtn.addEventListener("click", (e) => {
      e.preventDefault();
      // Variante 1: Scroll in die Nachrichten-Box
      const messageBox = document.querySelector(".message-box");
      if (messageBox) {
        messageBox.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      } else {
        // oder: vorhandenes Kontakt-Popup öffnen, falls du das so nutzt:
        const contactPanel = document.getElementById("contactPanel");
        if (contactPanel) {
          contactPanel.classList.add("open");
          contactPanel
            .querySelector("textarea")
            ?.focus();
        }
      }
    });
  }
}




// Stadt aus Freitext-Standort grob herausziehen (für Privatanbieter)
function guessCityFromStandort(text) {
  if (!text) return "";
  const parts = text.split(/[,]/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return "";
  const last = parts[parts.length - 1];
  const tokens = last.split(/\s+/);
  const maybeCity = tokens.filter((t) => !/^\d{4,5}$/.test(t)).join(" ");
  return maybeCity || last;
}

// Website-URL ggf. mit https:// ergänzen
function ensureHttpUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return "https://" + url.replace(/^\/+/, "");
}

// Öffnungszeiten füllen – robust für verschiedene Formate
function fillOpeningHours(seller, inserat, isDealer) {
  const box  = document.getElementById("sellerHoursBox");
  const list = document.getElementById("sellerHours");
  if (!box || !list) return;

  // Privatanbieter: gar keine Öffnungszeiten anzeigen
  if (!isDealer) {
    box.style.display = "none";
    return;
  }

  list.innerHTML = "";

  const src =
    seller.oeffnungszeiten ||
    inserat.oeffnungszeiten ||
    seller.openingHours ||
    inserat.openingHours ||
    null;

  const rows = [];

  if (Array.isArray(src)) {
    src.forEach((row) => {
      if (!row) return;
      if (typeof row === "string") {
        const m = row.split(/[:\-–]/);
        if (m.length >= 2) {
          rows.push({
            day: m[0].trim(),
            time: m.slice(1).join("–").trim(),
          });
        } else {
          rows.push({ day: "", time: row.trim() });
        }
      } else if (typeof row === "object") {
        const day  = row.day || row.label || "";
        const from = row.from || row.von || row.open || "";
        const to   = row.to   || row.bis || row.close || "";
        const time = [from, to].filter(Boolean).join(" – ");
        if (day && time) rows.push({ day, time });
      }
    });
  } else if (src && typeof src === "object") {
    // z. B. { mo: "09–18", di: "09–18", ... }
    const order = [
      ["mo", "Mo."],
      ["di", "Di."],
      ["mi", "Mi."],
      ["do", "Do."],
      ["fr", "Fr."],
      ["sa", "Sa."],
      ["so", "So."],
    ];
    order.forEach(([key, label]) => {
      const val = src[key] || src[key.toUpperCase()];
      if (!val) return;
      rows.push({ day: label, time: String(val).trim() });
    });
  } else if (typeof src === "string") {
    src
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line) => {
        const m = line.split(/[:\-–]/);
        if (m.length >= 2) {
          rows.push({
            day: m[0].trim(),
            time: m.slice(1).join("–").trim(),
          });
        } else {
          rows.push({ day: "", time: line });
        }
      });
  }

  if (!rows.length) {
    box.style.display = "none";
    return;
  }

  rows.forEach((row) => {
    const li  = document.createElement("li");
    const dEl = document.createElement("span");
    const tEl = document.createElement("strong");
    dEl.textContent = row.day || "";
    tEl.textContent = row.time || "";
    li.appendChild(dEl);
    li.appendChild(tEl);
    list.appendChild(li);
  });

  box.style.display = "";
}

// Google-Maps Karte für Händler, nur Stadt-Text bei Privat
function renderSellerMap(inserat, sellerName, sellerTypeLabel, sellerAddr, isDealer) {
  const box   = document.getElementById("sellerMapBox");
  const frame = document.getElementById("sellerMapFrame");
  const note  = document.getElementById("sellerMapNote");
  if (!box || !frame || !note) return;

  const city = inserat.ort || guessCityFromStandort(sellerAddr);

  if (!isDealer) {
    // Privatanbieter → nur Info-Text, keine Karte
    box.classList.add("seller-map-box--no-map");
    note.textContent = city
      ? `Privater Anbieter in ${city}`
      : "Privater Anbieter";
    frame.src = "";
    return;
  }

  box.classList.remove("seller-map-box--no-map");
  const label = city ? `${sellerName} · ${city}` : sellerName;
  note.textContent = label;

  // Versuche Koordinaten aus dem Inserat
  let lat = null;
  let lon = null;
  const coords = inserat.standortCoords && inserat.standortCoords.coordinates;
  if (Array.isArray(coords) && coords.length === 2) {
    lon = coords[0];
    lat = coords[1];
  }

  let url = "";
  if (lat != null && lon != null) {
    url = `https://www.google.com/maps?q=${lat},${lon}&hl=de&z=14&output=embed`;
  } else if (sellerAddr && sellerAddr !== "—") {
    const q = encodeURIComponent(sellerAddr);
    url = `https://www.google.com/maps?q=${q}&hl=de&z=14&output=embed`;
  }

  if (!url) {
    box.style.display = "none";
    return;
  }

  box.style.display = "";
  frame.src = url;
}

/* ------------------------ Beschreibung ------------------------ */
function fillDescription(inserat) {
  const descEl = document.getElementById("car-description");
  const btn = document.getElementById("toggle-description-btn");

  // Text mit Zeilenumbrüchen einsetzen
  if (descEl) {
    descEl.innerHTML = renderMultilineToHTML(inserat.fahrzeugbeschreibung || "");
  }

  if (!descEl || !btn) return;

  // Die umgebende Box (für die CSS-Klasse .car-description-box.expanded)
  const box = descEl.closest(".car-description-box");
  if (!box) return;

  // Prüfen, ob überhaupt genug Text für "Mehr anzeigen" da ist
  requestAnimationFrame(() => {
    const needsMore = descEl.scrollHeight > descEl.clientHeight + 1;
    btn.style.display = needsMore ? "inline-block" : "none";

    btn.onclick = () => {
      box.classList.toggle("expanded");
      const expanded = box.classList.contains("expanded");
      btn.textContent = expanded ? "Weniger anzeigen" : "Mehr anzeigen";
    };
  });
}

/* ------------------------ Medien + Slider ------------------------ */
let mediaItems = [];
let currentIndex = 0;
let startX = 0;
let currentTranslate = 0;
let prevTranslate = 0;
let isDragging = false;
let animationID;
let slider;
let container;


function fillMedia(inserat) {
  mediaItems = [];

  if (Array.isArray(inserat.images)) {
    inserat.images.forEach((src) => mediaItems.push({ type: "img", src }));
  }
  if (inserat.video && String(inserat.video).trim() !== "") {
    mediaItems.push({ type: "video", src: inserat.video });
  }

  slider    = document.getElementById("media-slider");
  container = document.getElementById("media-display");
  const thumbs = document.getElementById("thumbnail-track");
  if (!slider || !container) return;

  document.documentElement.style.setProperty("--media-count", mediaItems.length);
  slider.innerHTML = "";
  if (thumbs) thumbs.innerHTML = "";

  mediaItems.forEach((item, idx) => {
    const el = document.createElement(item.type === "img" ? "img" : "video");
    el.src = item.src;
    el.classList.add("media-slide");
    el.draggable = false;

    if (item.type === "video") {
      // Video: ganz normal im Slider abspielen, NICHT automatisch in die Lightbox springen
      el.controls   = true;
      el.playsInline = true;
      el.preload    = "metadata";
      el.tabIndex   = -1;
      // kein openFullscreen-Click-Handler hier
    } else {
      // Bild: Portrait-Erkennung + Klick öffnet Lightbox
      el.addEventListener("load", () => {
        if (el.naturalHeight > el.naturalWidth) {
          el.classList.add("portrait");
        }
      });
      el.addEventListener("click", () => openFullscreen(el));
    }

    slider.appendChild(el);

    // Thumbnails – Verhalten bleibt wie gehabt (Video-Thumbnail wechselt nur auf den Slide)
    if (thumbs) {
      if (item.type === "video") {
        const th = document.createElement("video");
        th.className = "media-thumb";
        th.src = item.src;
        th.muted = true;
        th.playsInline = true;
        th.onclick = () => setMedia(idx);
        thumbs.appendChild(th);
      } else {
        const th = document.createElement("img");
        th.className = "media-thumb";
        th.src = item.src;
        th.onclick = () => setMedia(idx);
        thumbs.appendChild(th);
      }
    }
  });

  // Start auf Slide 0
  setTimeout(() => {
    setMedia(0);
    updateSlider();
  }, 0);

  // Gesten – bleiben wie vorher
  container.addEventListener("pointerdown", dragStart, { passive: false });
  container.addEventListener("pointermove", dragMove, { passive: false });
  container.addEventListener("pointerup",   dragEnd);
  container.addEventListener("pointerleave",dragEnd);
  container.addEventListener("pointercancel", dragEnd);
  container.addEventListener("dblclick", () => nextMedia());
}


function dragStart(e) {
  isDragging = true;
  slider?.classList.add("dragging");
  startX = e.clientX;
  animationID = requestAnimationFrame(animation);
  
}
function dragMove(e) {
  if (!isDragging) return;
  e.preventDefault();
  const currentX = e.clientX;
  currentTranslate = prevTranslate + currentX - startX;
}
function dragEnd() {
  cancelAnimationFrame(animationID);
  isDragging = false;
  slider?.classList.remove("dragging");
  const movedBy = currentTranslate - prevTranslate;
  if (movedBy < -50 && currentIndex < mediaItems.length - 1) currentIndex++;
  else if (movedBy > 50 && currentIndex > 0) currentIndex--;
  updateSlider();
}
function animation() {
  setSliderPosition();
  if (isDragging) requestAnimationFrame(animation);
}
function setSliderPosition() {
  if (slider) slider.style.transform = `translateX(${currentTranslate}px)`;
}
function updateSlider() {
  if (!container || !slider) return;
  const slideWidth = container.offsetWidth;
  const targetTranslate = -currentIndex * slideWidth;
  
  slider.style.transform = `translateX(${targetTranslate}px)`;
  currentTranslate = targetTranslate;
  prevTranslate = targetTranslate;
  highlightThumb(currentIndex);
}
function highlightThumb(idx) {
  const thumbs = document.querySelectorAll(".media-thumb");
  thumbs.forEach((t, i) => {
    const isActive = i === idx;
    // ❌ alt: t.classList.toggle("active", isActive);
    // ✅ neu:
    t.classList.toggle("active-thumb", isActive);
    t.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  const active   = thumbs[idx];
  const scroller = document.querySelector(".media-detail-thumbnails-scroll") 
                || active?.parentElement;

  if (!scroller || !active) return;

  const cRect = scroller.getBoundingClientRect();
  const aRect = active.getBoundingClientRect();
  const delta = (aRect.left + aRect.width/2) - (cRect.left + cRect.width/2);

  scroller.scrollTo({ left: scroller.scrollLeft + delta, behavior: "smooth" });
}



function setMedia(index) {
  currentIndex = Math.max(0, Math.min(index, mediaItems.length - 1));
  updateSlider();
}
function prevMedia() {
  if (currentIndex > 0) {
    currentIndex--;
    updateSlider();
  }
}
function nextMedia() {
  if (currentIndex < mediaItems.length - 1) {
    currentIndex++;
    updateSlider();
  }
}

/* ------------------------ Lightbox (mit Swipe & Keys) ------------------------ */
let lightboxIndex = 0;
let lbStartX = 0;
let lbDragging = false;
function openFullscreen(media) {
  if (!media || !/^(IMG|VIDEO)$/.test(media.tagName)) return;

  const allSlides = Array.from(document.querySelectorAll(".media-slide"));
  let idx = allSlides.findIndex((el) => el.src === media.src);
  if (idx < 0) idx = Math.max(0, allSlides.indexOf(media));
  lightboxIndex = idx;

  const overlay = document.getElementById("lightbox-overlay");
  const content = document.getElementById("lightbox-content");
  const counter = document.getElementById("lightbox-counter");
  if (!overlay || !content) return;

  const isMobile = window.matchMedia("(max-width: 768px)").matches;

  // nur per Klasse öffnen – Look kommt aus CSS
  overlay.classList.add("show");

  function renderLightboxMedia(sourceEl) {
    if (!sourceEl) return;
    content.innerHTML = "";

    const el = document.createElement(sourceEl.tagName.toLowerCase());
    el.src = sourceEl.src;
    el.className = "lightbox-inner-media";

    if (sourceEl.tagName === "VIDEO") {
      el.controls = true;
      el.autoplay = true;
      el.playsInline = true;
    }

    // keine Inline-Styles – CSS regelt Größen/Hintergrund/Schatten
    content.appendChild(el);
  }

  function updateLightboxCounter() {
    if (counter) counter.textContent = `Bild ${lightboxIndex + 1} von ${allSlides.length}`;
  }

  renderLightboxMedia(allSlides[lightboxIndex]);
  updateLightboxCounter();

  // Keyboard: mobil nur ESC; Desktop zusätzlich ← →
  const onKey = (e) => {
    if (e.key === "Escape") closeLightbox();
    if (!isMobile && e.key === "ArrowLeft")  navigateLightbox(-1);
    if (!isMobile && e.key === "ArrowRight") navigateLightbox(1);
  };
  if (overlay._onKey) window.removeEventListener("keydown", overlay._onKey);
  overlay._onKey = onKey;
  window.addEventListener("keydown", onKey);

  // Pointer-Swipe nur Desktop (kein zusätzlicher Inline-Style am Media)
  if (!overlay._lbBound) {
    const down = (e) => {
      const isMob = window.matchMedia("(max-width: 768px)").matches;
      if (isMob) return;
      lbDragging = true;
      lbStartX = e.clientX;
      overlay.classList.add("dragging");
    };
    const move = (e) => {
      const isMob = window.matchMedia("(max-width: 768px)").matches;
      if (isMob || !lbDragging) return;
      e.preventDefault();
      const deltaX = e.clientX - lbStartX;
      const mediaEl = document.querySelector("#lightbox-content .lightbox-inner-media");
      if (mediaEl) mediaEl.style.transform = `translateX(${deltaX}px)`;
    };
    const end = (e) => {
      const isMob = window.matchMedia("(max-width: 768px)").matches;
      if (isMob || !lbDragging) return;
      lbDragging = false;
      overlay.classList.remove("dragging");
      const deltaX = e.clientX - lbStartX;
      if (Math.abs(deltaX) > 80) {
        navigateLightbox(deltaX > 0 ? -1 : 1);
      } else {
        const mediaEl = document.querySelector("#lightbox-content .lightbox-inner-media");
        if (mediaEl) {
          mediaEl.style.transition = "transform 0.3s ease";
          mediaEl.style.transform = "translateX(0)";
          setTimeout(() => (mediaEl.style.transition = ""), 300);
        }
      }
    };

    [overlay, content].forEach((el) => {
      el?.addEventListener("pointerdown", down, { passive: false });
      el?.addEventListener("pointermove", move, { passive: false });
      el?.addEventListener("pointerup", end);
      el?.addEventListener("pointercancel", end);
      el?.addEventListener("pointerleave", end);
    });

    overlay._lbBound = true;
  }

  // für navigateLightbox()
  window._lb_render = (el) => renderLightboxMedia(el);
  window._lb_update = () => updateLightboxCounter();
}

function navigateLightbox(direction) {
  const allSlides = Array.from(document.querySelectorAll(".media-slide"));
  lightboxIndex = Math.max(0, Math.min(lightboxIndex + direction, allSlides.length - 1));
  window._lb_render?.(allSlides[lightboxIndex]);
  window._lb_update?.();
}

function closeLightbox() {
  const overlay = document.getElementById("lightbox-overlay");
  const content = document.getElementById("lightbox-content");
  if (!overlay) return;
  overlay.classList.remove("show");
  // keine Inline-Resets nötig
  if (overlay._onKey) window.removeEventListener("keydown", overlay._onKey);
  if (content) content.innerHTML = "";
  lbDragging = false;
}




/* ------------------------ Kontakt-Panel & Telefon ------------------------ */
function toggleContactPanel() {
  const panel = document.getElementById("contactPanel");
  const overlay = document.getElementById("contactOverlay");
  panel?.classList.toggle("open");
  overlay?.classList.toggle("show");
}
function showPhoneNumber() {
  const phoneContainer = document.getElementById("phoneNumber");
  const btn = document.getElementById("showPhoneBtn");
  if (!phoneContainer || !btn) return;

  let inserat = {};
  try {
    inserat = JSON.parse(localStorage.getItem("ausgewaehltesInserat") || "{}");
  } catch {}

  if (inserat.telefon) {
    phoneContainer.textContent = inserat.telefon;
  } else {
    phoneContainer.textContent = "Keine Nummer vorhanden";
  }
  phoneContainer.style.display = "block";
  btn.style.display = "none";
}

/* ------------------------ Nachricht an Verkäufer ------------------------ */
function setupMessageForm() {
  const form = document.getElementById("messageForm");
  if (!form) return;

  let fahrzeug = {};
  try {
    fahrzeug = JSON.parse(localStorage.getItem("ausgewaehltesInserat") || "{}");
  } catch {}
  const fahrzeugId = fahrzeug.id || fahrzeug._id;
  if (!fahrzeugId) {
    alert("❌ Kein Fahrzeug ausgewählt.");
    window.location.href = "übersicht.html";
    return;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const nachricht = this.querySelector("textarea[name='nachricht']")?.value.trim();
    if (!nachricht) return;

    const senderId = localStorage.getItem("userId");
    const absenderName = localStorage.getItem("username");
    if (!senderId || !absenderName) {
      alert("Bitte logge dich ein, um eine Nachricht zu senden.");
      return;
    }

    const payload = {
      senderId,
      empfaengerId: fahrzeug.verkaeuferId || fahrzeug.nutzerId || "",
      fahrzeugId,
      absenderName,
      nachricht,
    };

    try {
      const res = await fetch(api("/nachricht-senden"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok && result.success) {
        alert("Nachricht wurde erfolgreich gesendet.");
        this.reset();
      } else {
        alert("Fehler beim Senden: " + (result.error || `Fehler ${res.status}`));
      }
    } catch {
      alert("Serverfehler. Bitte später versuchen.");
    }
  });
}

/* ------------------------ Händlerprofil & Weitere Fahrzeuge ------------------------ */
function loadLogo(imgEl, avatarEl, url) {
  avatarEl?.classList?.remove("has-logo");
  imgEl?.removeAttribute?.("src");
  if (!url || !imgEl || !avatarEl) return;
  try {
    imgEl.loading = "eager";
  } catch {}
  imgEl.addEventListener(
    "load",
    () => {
      if (imgEl.naturalWidth > 0) avatarEl.classList.add("has-logo");
    },
    { once: true }
  );
  imgEl.addEventListener(
    "error",
    () => {
      avatarEl.classList.remove("has-logo");
      imgEl.removeAttribute("src");
    },
    { once: true }
  );
  imgEl.src = url;
  if (imgEl.complete && imgEl.naturalWidth > 0) avatarEl.classList.add("has-logo");
}
async function fetchSellerProfile(sellerId) {
  try {
    if (!sellerId) return null;
    const res = await fetch(api(`/api/seller?id=${encodeURIComponent(sellerId)}`), { credentials: "include" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
async function fetchSellerCars(sellerId, limit = 6) {
  try {
    if (!sellerId) return { total: 0, results: [] };
    const params = new URLSearchParams({ verkaeufer: sellerId, limit: String(limit), page: "1", sort: "neueste" });
    const res = await fetch(api(`/api/search?${params.toString()}`), { credentials: "omit" });
    if (!res.ok) return { total: 0, results: [] };
    const data = await res.json();
    const list = data?.results ?? data?.items ?? [];
    return { total: data?.total || list.length || 0, results: Array.isArray(list) ? list : [] };
  } catch {
    return { total: 0, results: [] };
  }
}
function initMediaSlider(mediaContainer) {
  if (!mediaContainer) return;
  const slidesWrapper = mediaContainer.querySelector(".slides");
  if (!slidesWrapper) return;

  const slides = Array.from(slidesWrapper.children);
  const state = { currentIndex: 0, isDragging: false, startPos: 0, currentTranslate: 0, prevTranslate: 0, animationID: null };

  slidesWrapper.style.display = "flex";
  slidesWrapper.style.transition = "transform 0.3s ease";
  slidesWrapper.style.willChange = "transform";
  slides.forEach((slide) => {
    slide.style.flex = "0 0 100%";
    slide.style.minWidth = "100%";
  });

  const getX = (ev) => (typeof ev.clientX === "number" ? ev.clientX : (ev.touches && ev.touches[0]?.clientX) || 0);
  const setSliderPosition = () => {
    slidesWrapper.style.transform = `translateX(${state.currentTranslate}px)`;
  };
  const animation = () => {
    setSliderPosition();
    if (state.isDragging) requestAnimationFrame(animation);
  };

  const pointerDown = (ev) => {
    state.isDragging = true;
    state.startPos = getX(ev);
    state.animationID = requestAnimationFrame(animation);
  };
  const pointerMove = (ev) => {
    if (!state.isDragging) return;
    const x = getX(ev);
    state.currentTranslate = state.prevTranslate + x - state.startPos;
  };
  const pointerUp = () => {
    if (!state.isDragging) return;
    state.isDragging = false;
    cancelAnimationFrame(state.animationID);
    const movedBy = state.currentTranslate - state.prevTranslate;
    if (movedBy < -50 && state.currentIndex < slides.length - 1) state.currentIndex++;
    else if (movedBy > 50 && state.currentIndex > 0) state.currentIndex--;
    updateSlidePosition();
  };
  const updateSlidePosition = () => {
    const width = mediaContainer.clientWidth || 1;
    state.currentTranslate = -state.currentIndex * width;
    state.prevTranslate = state.currentTranslate;
    setSliderPosition();
  };

  ["pointerdown", "touchstart", "mousedown"].forEach((ev) => slidesWrapper.addEventListener(ev, pointerDown));
  ["pointermove", "touchmove", "mousemove"].forEach((ev) => slidesWrapper.addEventListener(ev, pointerMove));
  ["pointerup", "pointerleave", "pointercancel", "touchend", "mouseup", "mouseleave"].forEach((ev) =>
    slidesWrapper.addEventListener(ev, pointerUp)
  );

  mediaContainer.querySelector(".media-arrow.right")?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (state.currentIndex < slides.length - 1) {
      state.currentIndex++;
      updateSlidePosition();
    }
  });
  mediaContainer.querySelector(".media-arrow.left")?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (state.currentIndex > 0) {
      state.currentIndex--;
      updateSlidePosition();
    }
  });

  window.addEventListener("resize", updateSlidePosition);
  updateSlidePosition();
}
function renderSellerMore(items) {
  const sec = document.getElementById("sellerMore");
  const grid = document.getElementById("sellerMoreGrid");
  if (!sec || !grid) return;

  grid.innerHTML = "";
  if (!items.length) {
    sec.style.display = "none";
    return;
  }

  items.forEach((inserat) => {
    const imgs = Array.isArray(inserat.images) ? inserat.images : [];
    const tel = sanitizePhone(inserat.telefon);
    const titel = inserat.titel || "Unbekanntes Fahrzeug";

    const preisNum = pickPrice(
      inserat["brutto-preis"],
      inserat.brutto_preis,
      inserat.verkauf_brutto,
      inserat.preis,
      inserat.verkauf_preis,
      inserat.verkauf_netto
    );
    const preis = fmtEUR(preisNum);

    const kurz = inserat.verkauf_kurzbeschreibung || "";
    const _id = getDocId(inserat) || "";

    const kmV = inserat.verkauf_kilometer ?? inserat.kilometer ?? inserat.km;
    const ezV = inserat.verkauf_erstzulassung || inserat.erstzulassung;
    const fuelV = inserat.verkauf_kraftstoff || inserat.kraftstoff;
    const psV = inserat.verkauf_leistung ?? inserat.leistung;
    const gearV = inserat.verkauf_getriebe || inserat.getriebe;
    const conV = inserat.verkauf_verbrauch_kombiniert || inserat.verbrauch_kombiniert || inserat.verbrauch;

    const kmTxt = kmV != null && kmV !== "" ? `${Number(toNum(kmV)).toLocaleString("de-DE")} km` : "—";
    const ezTxt = ezV || "—";
    const fuTxt = fuelV || "—";
    const psTxt = psV != null && psV !== "" ? `${Number(toNum(psV)).toLocaleString("de-DE")} PS` : "—";
    const geTxt = gearV || "—";
    const coTxt = conV != null && conV !== "" ? `${String(conV).replace(",", ".")} l/100 km` : "—";

    const rawType = String(inserat.seller?.type || inserat.verkauf_verkaeufer || "").toLowerCase();
    const isHaendler =
      rawType === "haendler" || rawType === "händler" || rawType.includes("händ") || rawType.includes("haend");
    const sellerName = inserat.seller?.name || inserat.verkauf_name || (isHaendler ? "Händler" : "Privatanbieter");
    const sellerLogo = inserat.seller?.logoUrl || inserat.raw?.seller?.logoUrl || inserat.logoUrl || "";
    const sellerLocation = inserat.standort || [inserat.plz, inserat.ort].filter(Boolean).join(" ") || "Standort nicht angegeben";

    const card = document.createElement("div");
    card.className = "car-card";
    card.innerHTML = `
      <div class="car-card-media">
        <div class="card-actions mobile-only">
          <button class="save-btn" title="Auto speichern"><i class="fas fa-heart"></i></button>
          <a href="${tel ? `tel:${tel}` : "#"}" class="contact-btn clean-phone" title="Verkäufer kontaktieren" role="button" ${
      tel ? "" : "aria-disabled='true'"
    } >
            <i class="fas fa-phone"></i>
          </a>
        </div>
        <div class="media-container">
          <div class="slides">
            ${imgs.map((src) => `<img src="${src}" class="slide" alt="">`).join("")}
          </div>
          <button class="media-arrow left"  type="button"><i class="fas fa-chevron-left"></i></button>
          <button class="media-arrow right" type="button"><i class="fas fa-chevron-right"></i></button>
        </div>
      </div>

      <div class="car-details">
        <div class="car-top-row">
          <h2 class="car-title">${titel}</h2>
          <p class="car-price">${preis}</p>
        </div>

        <p class="car-subtitle">${kurz}</p>

        <div class="car-info-grid">
          <p><i class="fas fa-road"></i> ${kmTxt}</p>
          <p><i class="fas fa-calendar-alt"></i> EZ ${ezTxt}</p>
          <p><i class="fas fa-gas-pump"></i> ${fuTxt}</p>
          <p><i class="fas fa-gauge-high"></i> ${psTxt}</p>
          <p><i class="fas fa-gears"></i> ${geTxt}</p>
          <p><i class="fas fa-tint"></i> ${coTxt}</p>
        </div>

        <div class="dealer-info">
          <div class="dealer-row">
            <div class="dealer-avatar">
              <img alt="${sellerName} Logo">
              <span class="dealer-initials">${sellerInitials(sellerName)}</span>
            </div>
            <div class="dealer-meta">
              <div class="dealer-name">${sellerName}</div>
              <div class="dealer-location">${sellerLocation}</div>
            </div>
          </div>
        </div>
      </div>
    `;

    card.addEventListener("click", (e) => {
      if (e.target.closest(".card-actions button, .card-actions a, .media-arrow")) return;
      try {
        localStorage.setItem("ausgewaehltesInserat", JSON.stringify(toAnzeigePayload(inserat)));
      } catch {}
      if (_id) window.location.href = `anzeige.html?id=${encodeURIComponent(_id)}`;
      else window.location.href = `anzeige.html`;
    });

    grid.appendChild(card);
    initMediaSlider(card.querySelector(".media-container"));

    const avatar = card.querySelector(".dealer-avatar");
    const img = avatar.querySelector("img");
    avatar.classList.remove("has-logo");
    img.removeAttribute("src");
    if (sellerLogo) {
      try {
        img.loading = "eager";
      } catch {}
      img.addEventListener(
        "load",
        () => {
          if (img.naturalWidth > 0) avatar.classList.add("has-logo");
        },
        { once: true }
      );
      img.addEventListener(
        "error",
        () => {
          avatar.classList.remove("has-logo");
          img.removeAttribute("src");
        },
        { once: true }
      );
      img.src = sellerLogo;
      if (img.complete && img.naturalWidth > 0) avatar.classList.add("has-logo");
    }
  });

  sec.style.display = "";
}
function toAnzeigePayload(item) {
  const raw = item?.raw && typeof item.raw === "object" ? item.raw : {};
  const merged = { ...raw, ...item };

  if (merged.verkauf_kilometer == null && item.kilometer != null) merged.verkauf_kilometer = item.kilometer;
  if (!merged.verkauf_erstzulassung && item.erstzulassung) merged.verkauf_erstzulassung = item.erstzulassung;
  if (!merged.verkauf_kraftstoff && item.kraftstoff) merged.verkauf_kraftstoff = item.kraftstoff;
  if (!merged.verkauf_getriebe && item.getriebe) merged.verkauf_getriebe = item.getriebe;
  if (!merged.verkauf_leistung && item.leistung) merged.verkauf_leistung = item.leistung;
  if (merged.verkauf_verbrauch_kombiniert == null && item.verbrauch_kombiniert != null)
    merged.verkauf_verbrauch_kombiniert = item.verbrauch_kombiniert;
  if (!merged.verkauf_kurzbeschreibung && item.verkauf_kurzbeschreibung) merged.verkauf_kurzbeschreibung = item.verkauf_kurzbeschreibung;

  if (merged.verkauf_brutto == null && merged.brutto_preis != null) merged.verkauf_brutto = merged.brutto_preis;
  if (merged.verkauf_brutto == null && merged["brutto-preis"] != null) merged.verkauf_brutto = merged["brutto-preis"];
  if (merged.verkauf_preis == null && item.preis != null) merged.verkauf_preis = item.preis;

  if (!merged.telefon && item.telefon) merged.telefon = item.telefon;
  if (!merged.verkauf_verkaeufer && item.verkauf_verkaeufer) merged.verkauf_verkaeufer = item.verkauf_verkaeufer;
  if (!merged.verkauf_name && item.verkauf_name) merged.verkauf_name = item.verkauf_name;

  return merged;
}
function ensureExtraInfoBlock() {
  let wrap = document.getElementById("sellerInfoExtra");
  if (wrap) return wrap;

  wrap = document.createElement("div");
  wrap.id = "sellerInfoExtra";
  wrap.style.marginTop = "12px";
  wrap.innerHTML = `
    <ul class="kv" id="sellerKV" style="list-style:none;display:flex;flex-direction:column;gap:8px;">
      <li id="rowPhone" style="display:none;justify-content:space-between;gap:10px;">
        <span><i class="fas fa-phone"></i> Telefon</span><strong id="sellerPhoneText"></strong>
      </li>
      <li id="rowMail" style="display:none;justify-content:space-between;gap:10px;">
        <span><i class="fas fa-envelope"></i> E-Mail</span><strong id="sellerMailText"></strong>
      </li>
      <li id="rowWeb" style="display:none;justify-content:space-between;gap:10px;">
        <span><i class="fas fa-globe"></i> Website</span><strong><a id="sellerWebsiteText" target="_blank" rel="noopener"></a></strong>
      </li>
      <li id="rowLang" style="display:none;justify-content:space-between;gap:10px;">
        <span><i class="fas fa-language"></i> Wir sprechen</span><strong id="sellerLanguages"></strong>
      </li>
    </ul>
    <div id="hoursWrap" style="display:none;margin-top:10px;">
      <div class="box-title" style="font-weight:700;display:flex;align-items:center;gap:8px;">
        <i class="fas fa-clock" style="color:#00bfa6;"></i> Öffnungszeiten
      </div>
      <ul class="hours" id="hoursList" style="list-style:none;display:flex;flex-direction:column;gap:8px;"></ul>
    </div>
  `;
  const contact = $id("sellerCard")?.querySelector(".seller-contact");
  (contact?.parentElement || $id("sellerCard"))?.appendChild(wrap);
  return wrap;
}
function renderHours(hours) {
  const wrap = $id("hoursWrap");
  const list = $id("hoursList");
  if (!wrap || !list) return;
  if (!hours || typeof hours !== "object") {
    wrap.style.display = "none";
    return;
  }

  const order = ["montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag", "sonntag"];
  const mapDe = { montag: "Mo", dienstag: "Di", mittwoch: "Mi", donnerstag: "Do", freitag: "Fr", samstag: "Sa", sonntag: "So" };
  const todayIdx = (new Date().getDay() + 6) % 7;

  list.innerHTML = "";
  order.forEach((key, i) => {
    const val = hours[key];
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.gap = "10px";
    if (i === todayIdx) {
      li.style.fontWeight = "700";
      li.style.color = "#0b5e56";
    }
    li.innerHTML = `<span>${mapDe[key] || key}</span><span>${val || "—"}</span>`;
    list.appendChild(li);
  });
  wrap.style.display = "";
}async function renderSeller() {
  // 👉 passt jetzt sowohl zu altem #sellerCard als auch zu deinem neuen #anbieter
  const box = $id("sellerCard") || $id("anbieter");
  if (!box) return;

  // --- Inserat aus localStorage holen ---
  let inserat = {};
  try {
    inserat = JSON.parse(localStorage.getItem("ausgewaehltesInserat") || "{}");
  } catch {}

  // --- Händler vs. Privat erkennen ---
  const rawType = String(
    inserat?.seller?.type || inserat?.verkauf_verkaeufer || ""
  ).toLowerCase();

  const isDealer =
    rawType === "haendler" ||
    rawType === "händler" ||
    rawType.includes("händ") ||
    rawType.includes("haend") ||
    inserat?.seller?.role === "haendler";

  // --- Seller-ID bestimmen (aus Inserat) ---
  let sellerId =
    inserat?.verkaeuferId || inserat?.seller?.id || inserat?.sellerId || "";

  // --- Händler-Profil aus /api/seller laden ---
  const profile = await fetchSellerProfile(sellerId);
  if (!sellerId && profile && (profile._id || profile.id)) {
    sellerId = getDocId(profile) || profile.id;
  }

  // --- Name + Initialen + Typ ---
  const name = (
    profile?.firma ||
    profile?.name ||
    inserat?.seller?.name ||
    inserat?.verkauf_name ||
    (isDealer ? "Händler" : "Privatanbieter")
  ).trim();

  const initials =
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || "")
      .join("") || "AV";

  setText("sellerName", name);
  setText("sellerInitials", initials);
  setText("sellerType", isDealer ? "Händler" : "Privatanbieter");

  // --- Adresse: Händler = volle Adresse, Privat = nur Ort ---
  const fullAddress = (() => {
    const s = (t) => (t == null ? "" : String(t).trim());

    if (isDealer) {
      // Händler: komplette Adresse aus dem Profil
      const street = [s(profile?.strasse), s(profile?.hausnummer)]
        .filter(Boolean)
        .join(" ");
      const zipCity = [s(profile?.plz), s(profile?.ort)]
        .filter(Boolean)
        .join(" ");
      const country = s(profile?.land);

      const parts = [street, zipCity, country].filter(Boolean);
      if (parts.length) return parts.join(", ");
    }

    // Privat: nur Stadt/Ort anzeigen
    const cityDirect = s(inserat?.ort || profile?.ort);
    if (cityDirect) return cityDirect;

    const rawStandort = s(inserat?.standort);
    if (rawStandort) {
      // z.B. "45731 Dortmund" -> "Dortmund"
      const m = rawStandort.match(/^\s*\d{4,5}\s+(.+)$/);
      if (m) return m[1];
      return rawStandort;
    }

    const zipCity = [s(inserat?.plz), s(inserat?.ort)]
      .filter(Boolean)
      .join(" ");
    if (zipCity) return zipCity;

    return "Standort nicht angegeben";
  })();

  setText("sellerAddress", fullAddress);

  // --- Avatar / Logo ---
  const avatar = box.querySelector(".dealer-avatar");
  const logoUrl =
    profile?.logoUrl ||
    inserat?.seller?.logoUrl ||
    inserat?.logoUrl ||
    "";

  loadLogo($id("sellerLogo"), avatar, logoUrl);

  // --- Bewertung ---
  const rating = Number(
    profile?.rating ?? inserat?.seller?.rating ?? inserat?.rating ?? 0
  );
  const rCnt = Number(
    profile?.reviews ?? inserat?.seller?.reviews ?? inserat?.reviews ?? 0
  );
  const w = (Math.max(0, Math.min(5, rating)) / 5) * 100;

  const starsFill = $id("starsFill");
  if (starsFill) {
    starsFill.style.width = w + "%";
  }
  setText("ratingValue", rating ? rating.toFixed(1) : "–");
  const ratingCountEl = $id("ratingCount");
  if (ratingCountEl) {
    ratingCountEl.textContent = rCnt ? `(${rCnt})` : "";
  }

  // --- Kontakt-Daten ---
  const phone =
    profile?.telefon || inserat?.telefon || inserat?.seller?.phone || "";
  const mail = profile?.email || inserat?.seller?.email || inserat?.email || "";
  const web = ensureHttp(
    profile?.website ||
      profile?.web ||
      inserat?.seller?.website ||
      inserat?.website ||
      ""
  );
  const telFmt = sanitizePhone(phone);

  const callBtn = $id("callBtn");
  if (callBtn) {
    if (telFmt) {
      callBtn.href = `tel:${telFmt}`;
      callBtn.classList.remove("ghost");
    } else {
      callBtn.removeAttribute("href");
      callBtn.classList.add("ghost");
    }
  }

  const mailBtn = $id("mailBtn");
  if (mailBtn) {
    if (mail) {
      mailBtn.href = `mailto:${mail}`;
      mailBtn.classList.remove("ghost");
    } else {
      mailBtn.removeAttribute("href");
      mailBtn.classList.add("ghost");
    }
  }

  const msgBtn = $id("msgBtn");
  if (msgBtn) {
    msgBtn.onclick = () => {
      document.getElementById("contactPanel")?.classList.add("open");
      document.querySelector("#messageForm textarea")?.focus();
    };
  }

  // --- Extra-Infos unten (alte Struktur: rowPhone/rowMail/rowWeb/rowLang) ---
  ensureExtraInfoBlock();

  if (phone) {
    setText("sellerPhoneText", phone);
    $id("rowPhone") && ($id("rowPhone").style.display = "flex");
  }
  if (mail) {
    setText("sellerMailText", mail);
    $id("rowMail") && ($id("rowMail").style.display = "flex");
  }
  if (web) {
    const a = $id("sellerWebsiteText");
    if (a) {
      a.href = web;
      a.textContent = web.replace(/^https?:\/\//i, "");
    }
    $id("rowWeb") && ($id("rowWeb").style.display = "flex");
  }

  // --- Sprachen ---
  const langs = (() => {
    const l =
      profile?.sprachen ||
      profile?.languages ||
      inserat?.seller?.languages ||
      inserat?.sprachen ||
      [];
    if (Array.isArray(l)) return l;
    if (typeof l === "string") {
      return l
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  })();

  if (langs.length) {
    setText("sellerLanguages", langs.join(", "));
    $id("rowLang") && ($id("rowLang").style.display = "flex");
  }

  // --- Öffnungszeiten ---
  const hours =
    profile?.oeffnungszeiten ||
    profile?.hours ||
    inserat?.seller?.hours ||
    inserat?.oeffnungszeiten ||
    null;
  renderHours(hours);

  // --- Weitere Fahrzeuge des Händlers ---
  const moreSec = $id("sellerMore");
  if (isDealer && (sellerId || profile?._id || profile?.id) && moreSec) {
    const finalId = sellerId || getDocId(profile) || profile?.id || "";
    const { results } = await fetchSellerCars(finalId, 6);
    const currentId = getDocId(inserat);
    const filtered = results.filter((r) => getDocId(r) !== currentId);
    renderSellerMore(filtered.slice(0, 6));
  } else if (moreSec) {
    moreSec.style.display = "none";
  }
}


/* ------------------------ Rating Panel ------------------------ */
function setupRatingPanel() {
  let panel = document.getElementById("ratingPanel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "ratingPanel";
    panel.style.display = "none";
    panel.innerHTML = `
      <div class="rating-panel" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);z-index:10000;">
        <div style="background:#fff;border-radius:12px;min-width:300px;max-width:90vw;padding:16px 16px 12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <strong>Händler bewerten</strong>
            <button id="closeRatingBtn" style="background:none;border:none;font-size:22px;line-height:1;cursor:pointer;">×</button>
          </div>
          <div id="starRating" style="display:flex;gap:6px;margin:6px 0 10px;"></div>
          <textarea id="ratingText" rows="4" style="width:100%;padding:8px;border-radius:8px;border:1px solid #e3e9ef;" placeholder="Deine Bewertung…"></textarea>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
            <button id="submitRatingBtn" class="btn-primary" style="padding:8px 12px;border-radius:10px;border:none;background:linear-gradient(90deg,#00ffcc,#00bfa6);color:#002a2b;font-weight:800;cursor:pointer;">Absenden</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(panel);

    const wrap = panel.querySelector("#starRating");
    for (let i = 1; i <= 5; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.value = String(i);
      b.style.cssText =
        "width:34px;height:34px;border:none;border-radius:8px;background:#f3f7f8;cursor:pointer;display:flex;align-items:center;justify-content:center;";
      b.innerHTML = `<i class="fas fa-star"></i>`;
      wrap.appendChild(b);
    }
  }

  let chosen = 0;
  panel.querySelector("#starRating")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-value]");
    if (!btn) return;
    chosen = Number(btn.dataset.value || 0);
    [...panel.querySelectorAll("#starRating button")].forEach((b, i) => {
      b.style.background = i < chosen ? "#e9fdfb" : "#f3f7f8";
      b.querySelector("i").style.color = i < chosen ? "#00bfa6" : "#888";
    });
  });

  document.getElementById("btnRate")?.addEventListener("click", () => {
    panel.style.display = "block";
    chosen = 0;
    [...panel.querySelectorAll("#starRating button i")].forEach((i) => (i.style.color = "#888"));
  });
  panel.querySelector("#closeRatingBtn")?.addEventListener("click", () => {
    panel.style.display = "none";
  });

  panel.querySelector("#submitRatingBtn")?.addEventListener("click", async () => {
    const text = (panel.querySelector("#ratingText").value || "").trim();
    let inserat = {};
    try {
      inserat = JSON.parse(localStorage.getItem("ausgewaehltesInserat") || "{}");
    } catch {}
    const sellerId = inserat?.verkaeuferId || inserat?.seller?.id || inserat?.sellerId || "";
    if (!sellerId) {
      alert("Kein Händler zugeordnet.");
      return;
    }
    if (!chosen) {
      alert("Bitte Sterne auswählen.");
      return;
    }

    try {
      const res = await fetch(api("/api/seller/rate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sellerId, rating: chosen, text }),
      });
      if (res.status === 401) {
        alert("Bitte einloggen, um zu bewerten.");
        return;
      }
      if (!res.ok) throw new Error();
      panel.style.display = "none";
      alert("Danke für deine Bewertung!");
      renderSeller();
    } catch {
      alert("Bewertung konnte nicht gespeichert werden.");
    }
  });
}
function toggleRatingPanel() {
  const panel = document.getElementById("ratingPanel");
  panel?.classList.toggle("show");
}
/* ------------------------ Boot ------------------------ */
document.addEventListener("DOMContentLoaded", async () => {
  // Navbar / Auth / Panels
  setupAuthLink();
  setupNavbarShortcuts();
  setupMessageForm();
  setupRatingPanel();

  // 🔽 "Nachricht schreiben" scrollt zum Formular
  const scrollMsgBtn = document.getElementById("scrollToMessageBtn");
  if (scrollMsgBtn) {
    scrollMsgBtn.addEventListener("click", (e) => {
      e.preventDefault();

      const form = document.getElementById("messageForm");
      if (!form) return;

      const offset = 100; // kleiner Abstand zur Navbar
      const rect = form.getBoundingClientRect();
      const targetY = rect.top + window.pageYOffset - offset;

      window.scrollTo({
        top: targetY,
        behavior: "smooth",
      });

      const firstField = form.querySelector("textarea, input, select");
      if (firstField) {
        setTimeout(() => firstField.focus(), 400);
      }
    });
  }
  // 🔼 Ende Scroll-Logik

  // Navbar-Setup (falls globale Funktion existiert)
  try {
    if (typeof window.setupNavbar === "function") window.setupNavbar();
  } catch {}

  // Inserat laden
  const inserat = await loadInseratData();
  if (!inserat) {
    console.error("Kein Inserat gefunden.");
    return;
  }

  // Obere Bereiche füllen
  fillTop(inserat);          // Titel + Preis + 6 Hauptinfos
  fillMedia(inserat);        // Galerie / Slider
  fillTechnical(inserat);    // Technische Daten
  fillAusstattung(inserat);  // Ausstattung
  fillSellerCard(inserat);   // Verkäufer-Box
  fillDescription(inserat);  // Fahrzeugbeschreibung mit Mehr-anzeigen
  renderSeller();            // ggf. zusätzliche Seller-Infos

  // Save-Button (Herz) initialisieren
  initSaveButton(inserat);

  // 👉 NEU: Sticky Summary-Balken oben nach den 6 Hauptinfos
  initStickySummary(inserat);

  // Tastatursteuerung (Slider / Lightbox)
  document.addEventListener("keydown", (e) => {
    const overlay = document.getElementById("lightbox-overlay");
    const lightboxOpen = overlay?.classList.contains("show");
    if (lightboxOpen) {
      if (e.key === "ArrowRight") navigateLightbox(1);
      if (e.key === "ArrowLeft")  navigateLightbox(-1);
      if (e.key === "Escape")     closeLightbox();
    } else {
      if (e.key === "ArrowRight") nextMedia();
      if (e.key === "ArrowLeft")  prevMedia();
    }
  });

  // Smooth Scroll (optional) für Link auf die Suchsektion
  document
    .querySelector('a[href="#search-section"]')
    ?.addEventListener("click", (e) => {
      e.preventDefault();
      document
        .querySelector("#search-section")
        ?.scrollIntoView({ behavior: "smooth" });
    });
});


/* ------------------------ Save-Button (Server-basiert) ------------------------ */

function getInseratId(inserat) {
  if (!inserat) return null;

  // Mongo-Objekt (_id.$oid)
  if (inserat._id && typeof inserat._id === "object" && typeof inserat._id.$oid === "string") {
    return inserat._id.$oid;
  }
  // normaler String
  if (typeof inserat._id === "string") return inserat._id;
  if (typeof inserat.id === "string") return inserat.id;

  return null;
}

function updateSaveButtonUI(btn, saved) {
  const icon  = btn.querySelector("i");
  const label = btn.querySelector(".label");

  btn.classList.toggle("is-saved", saved);
  btn.setAttribute("aria-pressed", saved ? "true" : "false");
  btn.dataset.saved = saved ? "1" : "0";

  if (icon) {
    icon.classList.toggle("far", !saved);
    icon.classList.toggle("fas", saved);
  }
  if (label) {
    label.textContent = saved ? "Gespeichert" : "Speichern";
  }
}

// wird im Boot-Block nach loadInseratData(inserat) aufgerufen
async function initSaveButton(inserat) {
  const btn = document.querySelector(".save-cta");
  if (!btn || !inserat) return;

  const inseratId = getInseratId(inserat);
  if (!inseratId) return;

  // ID am Button merken, damit toggleSave darauf zugreifen kann
  btn.dataset.inseratId = inseratId;

  // --- Initialen Status holen ---
  let saved = false;

  if (typeof inserat.isSaved === "boolean") {
    // falls der Server isSaved schon mitliefert
    saved = inserat.isSaved;
  } else {
    // sonst extra Status-Request
    try {
      const res = await fetch(api(`/saved/status/${encodeURIComponent(inseratId)}`), {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        saved = !!data.saved;
      }
    } catch (e) {
      // ignorieren, default bleibt false
    }
  }

  updateSaveButtonUI(btn, saved);

  // Klick-Handler
  btn.addEventListener("click", () => toggleSave(btn));
}

async function toggleSave(btn) {
  const inseratId = btn.dataset.inseratId;
  if (!inseratId) return;

  const wasSaved    = btn.dataset.saved === "1";
  const willBeSaved = !wasSaved;

  // Optimistic UI
  updateSaveButtonUI(btn, willBeSaved);
  btn.disabled = true;

  try {
    const res = await fetch(api("/saved/toggle"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fahrzeugId: inseratId }),
    });

    if (res.status === 401) {
      // nicht eingeloggt → zurückdrehen + Login
      updateSaveButtonUI(btn, wasSaved);
      window.location.href = "login.html";
      return;
    }

    if (!res.ok) {
      updateSaveButtonUI(btn, wasSaved);
      const data = await res.json().catch(() => null);
      alert(data?.error || "Speichern konnte nicht aktualisiert werden.");
      return;
    }

    const data = await res.json().catch(() => null);
    const finalSaved = typeof data?.saved === "boolean" ? data.saved : willBeSaved;
    updateSaveButtonUI(btn, finalSaved);
  } catch (err) {
    updateSaveButtonUI(btn, wasSaved);
    alert("Netzwerkfehler – bitte später nochmal versuchen.");
  } finally {
    btn.disabled = false;
  }
}

// falls du es irgendwo inline brauchst:
window.toggleSave = toggleSave;




/* ------------------------ Global Exports (HTML inline handlers) ------------------------ */
window.toggleSave = toggleSave;
window.showPhoneNumber = showPhoneNumber;
window.setMedia = setMedia;
window.prevMedia = prevMedia;
window.nextMedia = nextMedia;
window.openFullscreen = openFullscreen;
window.closeLightbox = closeLightbox;
window.navigateLightbox = navigateLightbox;
window.toggleContactPanel = toggleContactPanel;
window.toggleRatingPanel = toggleRatingPanel;



function setupNavbar() {
  const navLinks  = document.getElementById("nav-links");
  const hamburger = document.getElementById("hamburger");

  const closeAll = (exceptLi = null) => {
    document.querySelectorAll(".navbar .dropdown").forEach((li) => {
      if (li !== exceptLi) {
        li.classList.remove("open");
        const trigger = li.querySelector(":scope > a[aria-haspopup='true']");
        const menu    = li.querySelector(":scope > .dropdown-menu");
        trigger?.setAttribute("aria-expanded", "false");
        menu?.classList.remove("show");
      }
    });
  };

  const toggleDropdown = (trigger) => {
    const li   = trigger.closest(".dropdown");
    const menu = li?.querySelector(":scope > .dropdown-menu");
    if (!li || !menu) return;
    const willOpen = !li.classList.contains("open");
    closeAll(willOpen ? li : null);
    li.classList.toggle("open", willOpen);
    trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
    menu.classList.toggle("show", willOpen);
  };

  // Hamburger
  hamburger?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const willOpen = !navLinks?.classList.contains("active");
    navLinks?.classList.toggle("active", willOpen);
    hamburger.setAttribute("aria-expanded", willOpen ? "true" : "false");
    if (!willOpen) closeAll();
  });

  // Dropdowns per Klick (kein Hover)
  document.querySelectorAll(".navbar .dropdown > a[aria-haspopup='true']").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleDropdown(a);
    });
  });

  // Outside-Click schließt alles
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".navbar")) {
      navLinks?.classList.remove("active");
      hamburger?.setAttribute("aria-expanded", "false");
      closeAll();
    }
  });

  // ESC schließt alles
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      navLinks?.classList.remove("active");
      hamburger?.setAttribute("aria-expanded", "false");
      closeAll();
    }
  });
}












