// haendler.js — EINHEITLICH
document.documentElement.classList.remove("no-js");

document.addEventListener("DOMContentLoaded", () => {
  /* =========================
     Navbar / Dropdown (Klick)
     ========================= */
  const navLinks      = document.getElementById("nav-links");
  const hamburger     = document.getElementById("hamburger");
  const dropdownLinks = document.querySelectorAll(".dropdown > a");
  const dropdownLis   = document.querySelectorAll(".dropdown");
  const authDisplayEl = document.getElementById("auth-display");
  const savedCarsLink = document.getElementById("saved-cars-link");
  const myCarsLink    = document.getElementById("my-cars-link");

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  // Pricing-Mode aus dem <body data-pricing="...">
  const PRICING_MODE = document.body?.dataset?.pricing || "paid-live";
  const INTRO_FREE = PRICING_MODE === "intro-free";

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

    const tRect  = trigger.getBoundingClientRect();
    const mRect  = menu.getBoundingClientRect();
    const liRect = li.getBoundingClientRect();
    const vw     = window.innerWidth;

    const center  = tRect.left + tRect.width / 2;
    let leftAbs   = center - mRect.width / 2;
    leftAbs       = clamp(leftAbs, 16, vw - mRect.width - 16);

    menu.style.left = `${leftAbs - liRect.left}px`;
  }

  function openDropdown(trigger) {
    const li   = trigger.closest(".dropdown");
    const menu = trigger.nextElementSibling;
    if (!li || !menu) return;

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
    if (!li) return;
    li.classList.contains("open") ? closeAllDropdowns() : openDropdown(trigger);
  }

  hamburger?.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = !navLinks.classList.contains("active");
    navLinks.classList.toggle("active");
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

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".navbar")) {
      navLinks?.classList.remove("active");
      hamburger?.setAttribute("aria-expanded", "false");
      closeAllDropdowns();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      navLinks?.classList.remove("active");
      hamburger?.setAttribute("aria-expanded", "false");
      closeAllDropdowns();
    }
  });

  const repositionOpen = () =>
    document.querySelectorAll(".dropdown.open").forEach(positionMenu);

  window.addEventListener("resize", repositionOpen);
  window.addEventListener("scroll", repositionOpen);

  /* =========================
     Edit-Mode Bootstrap (Händler)
     - kompatibel zu übersicht.js
     ========================= */
  (function initEditModeHaendler() {
    const params = new URLSearchParams(location.search);
    const editParam = params.get("edit");
    if (!editParam) return;

    // ID aus URL oder Fallback aus Storage
    const editId =
      editParam !== "1"
        ? editParam
        : (localStorage.getItem("editInseratId") || sessionStorage.getItem("editInseratId") || "");

    if (editId) {
      localStorage.setItem("editInseratId", editId);
      sessionStorage.setItem("editInseratId", editId);
    }

    // Edit-Mode aktiv, aber Wizard noch NICHT "starten"
    localStorage.setItem("editMode", "1");

    // Merker: Wir sind im Edit-Flow, aber bleiben auf haendler.html,
    // bis der User einen Schritt anklickt.
    sessionStorage.setItem("editPending", "1");

    // wichtig: diese beiden NICHT hier setzen (sonst springst du zu früh weiter)
    sessionStorage.removeItem("inseratGestartet");
    sessionStorage.removeItem("hatGespeichert");

    // Wenn Daten schon aus übersicht.js da sind → nichts überschreiben
    const hasAny =
      localStorage.getItem("fahrzeugdaten") ||
      localStorage.getItem("fahrzeugdetails") ||
      localStorage.getItem("medien");

    if (hasAny) return;

    // Optionaler Fallback: wenn jemand direkt haendler.html?edit=<id> aufruft,
    // kannst du später einen Endpoint anbieten.
    // Aktuell: bewusst leer lassen, um keine falschen Mappings reinzuschreiben.
  })();

  /* =========================
     Auth / Händler-Pflicht
     ========================= */
  fetch("/getNutzerInfo", { credentials: "include" })
    .then(res => res.json())
    .then(user => {
      if (!user?.eingeloggt) {
        try {
          const url = location.search ? `haendler.html${location.search}` : "haendler.html";
          localStorage.setItem("redirectAfterLogin", url);
        } catch {}
        window.location.href = "login.html";
        return;
      }

      const roleRaw = String(user?.role || user?.rolle || "").toLowerCase();
      const isHaendler = roleRaw.includes("haend") || roleRaw.includes("händ");

      if (!isHaendler) {
        alert("Dieser Bereich ist nur für Händler zugänglich.");
        window.location.href = "verkaufen.html";
        return;
      }

      initAuthDisplay(user);

      // Navbar-Shortcuts → neue Übersicht-Hashes
      savedCarsLink?.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = "übersicht.html#saved-cars";
      });
      myCarsLink?.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = "übersicht.html#car-list";
      });

      // Nach Auth erst UI/Wizard initialisieren
      initStepsAndTarifUI();
      initWizard();
    })
    .catch(err => console.error("❌ Fehler beim Login-Check:", err));

  function initAuthDisplay(user) {
    if (!authDisplayEl) return;

    const name = user?.name || user?.email || "";
    const roleRaw = String(user?.role || user?.rolle || "");
    const role = roleRaw.toLowerCase().includes("haend") || roleRaw.toLowerCase().includes("händ")
      ? "Händler"
      : roleRaw;

    const label = name
      ? `Eingeloggt${role ? " – " + role : ""}: ${name}`
      : `Eingeloggt${role ? " – " + role : ""}`;

    authDisplayEl.innerHTML = `<i class="fas fa-user-check"></i> ${label}`;
  }

  /* =========================
     Wizard / Steps / Tarif
     ========================= */
  const STEP_STATE_KEY = "haendlerSteps";
  const TARIF_KEY      = "haendlerTarif";
  let stepsState = {};

  // Exponiere Mini-APIs für andere Seiten
  window.markStepDone = (step) => markStepDone(step);
  window.showToast    = (msg, type) => showToast(msg, type);
  window.toggleTarife = () => toggleTarife();

  function initStepsAndTarifUI() {
    stepsState = loadSteps();
    setupToasts();
    renderStepsFromState();
    wireStepNavigation();
    setupTarif();
  }

  async function initWizard() {
    if (!document.getElementById("toast-container")) setupToasts();

    const isEditFlow =
      localStorage.getItem("editMode") === "1" ||
      sessionStorage.getItem("editPending") === "1" ||
      new URLSearchParams(location.search).has("edit");

    // A) Direkt nach dem Veröffentlichen?
    if (sessionStorage.getItem("resetWizard") === "1") {
      clearWizardState();
      sessionStorage.removeItem("resetWizard");
      showToast("Inserat veröffentlicht – Assistent zurückgesetzt ✅");
      return;
    }

    // B) Kein Draft mehr vorhanden? → zurücksetzen
    //    ABER: NICHT im Edit-Flow, sonst werden die edit-Daten aus localStorage gelöscht.
    if (!isEditFlow) {
      try {
        const drafts = await fetch("/getVehicleData", { credentials: "include" }).then(r => r.json());
        const hasDraft = Array.isArray(drafts) && drafts.some(v => !v.status || v.status === "draft");
        if (!hasDraft) clearWizardState();
      } catch (e) {
        console.warn("Entwurfs-Check fehlgeschlagen:", e);
      }
    }
  }

  function ensureWizardFlagsBeforeLeavingHaendler() {
    try {
      const isEdit =
        localStorage.getItem("editMode") === "1" ||
        sessionStorage.getItem("editPending") === "1" ||
        new URLSearchParams(location.search).has("edit");

      // Wizard ist gestartet, sobald man einen Schritt verlässt
      sessionStorage.setItem("inseratGestartet", "true");

      // im Edit-Fall darf "hatGespeichert" gesetzt sein (deine Guards/Abbruchlogik)
      if (isEdit) sessionStorage.setItem("hatGespeichert", "true");
      else sessionStorage.removeItem("hatGespeichert");

      // pending ist ab jetzt erledigt
      sessionStorage.removeItem("editPending");
    } catch {}
  }

  function wireStepNavigation() {
    document.querySelectorAll(".step-box").forEach((box) => {
      box.addEventListener("click", () => {
        const step = String(box.dataset.step || "");
        const targets = {
          "1": "fahrzeugdaten.html",
          "2": "fahrzeugdetails.html",
          "3": "medien.html",
          "4": "vorschau.html",
        };
        if (targets[step]) {
          ensureWizardFlagsBeforeLeavingHaendler();
          window.location.href = targets[step];
        }
      });
    });
  }
  function setupTarif() {
    const grid = document.getElementById("tarifGrid");
    if (!grid) return;

    // STARTPHASE: kostenlos + nicht auswählbar
    if (INTRO_FREE) {
      // Alle Preis-Texte auf "Kostenlos" setzen (optional aber sinnvoll)
      grid.querySelectorAll(".tarif-box .tarif-price").forEach(p => {
        p.textContent = "Kostenlos";
      });

      // Immer den ersten Tarif als aktiv markieren (0–3) und speichern
      const defaultBox =
        grid.querySelector('.tarif-box[data-tarif="0-3"]') ||
        grid.querySelector(".tarif-box");

      grid.querySelectorAll(".tarif-box").forEach(b => b.classList.remove("selected"));
      if (defaultBox) defaultBox.classList.add("selected");

      const code = defaultBox?.dataset?.tarif || "0-3";
      persistTarif(code);

      // Step 4 als erledigt markieren (weil Tarif in Startphase fix ist)
      markStepDone(4);

      // Toggle-Button mobil ausblenden (optional)
      const btn = document.querySelector(".tarif-toggle-btn.mobile-only");
      if (btn) btn.style.display = "none";

      // Optional: Server einmalig informieren (schadet nicht, falls Route existiert)
      // (Fehler werden bewusst ignoriert)
      (async () => {
        try {
          await fetch("/saveTarif", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ tarif: "Startphase – Kostenlos" }),
          });
        } catch {}
      })();

      // WICHTIG: keine Click-Listener setzen -> Auswahl bleibt deaktiviert
      return;
    }

    // =========================
    // PAID-LIVE Modus (dein bisheriges Verhalten)
    // =========================

    // Restore Auswahl im UI
    const saved = safeGet(TARIF_KEY, "");
    if (saved) {
      const el = grid.querySelector(`.tarif-box[data-tarif="${cssEscape(saved)}"]`);
      if (el) {
        grid.querySelectorAll(".tarif-box").forEach(b => b.classList.remove("selected"));
        el.classList.add("selected");
      }
    } else {
      const first = grid.querySelector(".tarif-box");
      if (first) {
        first.classList.add("selected");
        persistTarif(first.dataset.tarif || "");
      }
    }

    updateNavbarTarif();

    grid.addEventListener("click", async (e) => {
      const box = e.target.closest(".tarif-box");
      if (!box) return;

      grid.querySelectorAll(".tarif-box").forEach(b => b.classList.remove("selected"));
      box.classList.add("selected");

      const code = box.dataset.tarif || "";
      try {
        const res = await fetch("/saveTarif", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tarif: humanTarifLabel(code) }),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success) {
          persistTarif(code);
          markStepDone(4);
          showToast("Tarif gespeichert ✅");
        } else {
          showToast(data.error || "Tarif konnte nicht gespeichert werden", "error");
        }
      } catch (err) {
        console.error(err);
        showToast("Serverfehler beim Speichern des Tarifs", "error");
      }
    });
  }

  function persistTarif(code) {
    safeSet(TARIF_KEY, code);
    updateNavbarTarif();
  }

  function updateNavbarTarif() {
    const badge = document.getElementById("tarifAnzeige");
    if (!badge) return;

    const code = safeGet(TARIF_KEY, "");
    if (!code) { badge.textContent = ""; return; }

    const label = humanTarifLabel(code);
    const price = tarifPrice(label);
    badge.innerHTML = `<i class="fas fa-tag"></i> Aktiver Tarif: ${label}${price ? " – " + price : ""}`;
  }

  /* ---------- Steps ---------- */
  function markStepDone(step) {
    const box = document.querySelector(`.step-box[data-step="${step}"]`);
    if (box) {
      box.classList.add("completed");
      const status = box.querySelector(".step-status");
      if (status) status.textContent = "✔️";
    }
    stepsState[step] = true;
    saveSteps();
  }

  function renderStepsFromState() {
    Object.entries(stepsState).forEach(([step, val]) => {
      if (!val) return;
      const box = document.querySelector(`.step-box[data-step="${step}"]`);
      if (!box) return;
      box.classList.add("completed");
      const status = box.querySelector(".step-status");
      if (status) status.textContent = "✔️";
    });
  }

  function loadSteps() {
    try { return JSON.parse(localStorage.getItem(STEP_STATE_KEY)) || {}; }
    catch { return {}; }
  }

  function saveSteps() {
    try { localStorage.setItem(STEP_STATE_KEY, JSON.stringify(stepsState)); } catch {}
  }

  /* ---------- Toasts ---------- */
  function setupToasts() {
    let c = document.getElementById("toast-container");
    if (!c) {
      c = document.createElement("div");
      c.id = "toast-container";
      document.body.appendChild(c);
    }
  }

  function showToast(message, type = "success") {
    const c = document.getElementById("toast-container");
    if (!c) return;

    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.textContent = message;
    c.appendChild(t);

    requestAnimationFrame(() => t.classList.add("show"));

    setTimeout(() => {
      t.classList.remove("show");
      t.addEventListener("transitionend", () => t.remove(), { once: true });
    }, 3000);
  }

  /* ---------- Mobile Tarife Toggle ---------- */
  function toggleTarife() {
    document.querySelectorAll(".tarif-grid .hide-mobile")
      .forEach(el => el.classList.toggle("hide-mobile"));

    const btn = document.querySelector(".tarif-toggle-btn.mobile-only");
    if (btn) {
      btn.textContent = btn.textContent.includes("Mehr")
        ? "Weniger Tarife anzeigen"
        : "Mehr Tarife anzeigen";
    }
  }

  /* ---------- Helpers ---------- */
  function humanTarifLabel(code) {
    const map = {
      "0-3":   "0–3 Fahrzeuge",
      "4-10":  "4–10 Fahrzeuge",
      "11-25": "11–25 Fahrzeuge",
      "26-50": "26–50 Fahrzeuge",
      "51-100":"51–100 Fahrzeuge",
      "100+":  "100+ Fahrzeuge",
    };
    return map[code] || code;
  }

  function tarifPrice(label) {
    if (INTRO_FREE) return "Kostenlos";

    const preisMap = {
      "0–3 Fahrzeuge":   "Kostenlos",
      "4–10 Fahrzeuge":  "4,90 € / Monat",
      "11–25 Fahrzeuge": "9,90 € / Monat",
      "26–50 Fahrzeuge": "17,90 € / Monat",
      "51–100 Fahrzeuge":"29,90 € / Monat",
      "100+ Fahrzeuge":  "Auf Anfrage",
    };
    return preisMap[label] || "";
  }


  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function safeGet(key, fallback) {
    try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
  }

  function safeSet(key, val) {
    try { localStorage.setItem(key, val); } catch {}
  }
});

/* =========================
   Wizard & lokale Draft-Daten zurücksetzen (global)
   ========================= */
function clearWizardState() {
  // Steps & Tarif
  try { localStorage.removeItem("haendlerSteps"); } catch {}
  // optional: Tarif behalten oder löschen – ich lasse ihn bewusst stehen
  // try { localStorage.removeItem("haendlerTarif"); } catch {}

  // Step-Daten (neuer Standard)
  try { localStorage.removeItem("fahrzeugdaten"); } catch {}
  try { localStorage.removeItem("fahrzeugdetails"); } catch {}
  try { localStorage.removeItem("medien"); } catch {}

  // Legacy/Alt-Keys (falls irgendwo noch genutzt)
  try {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith("details_")) localStorage.removeItem(k);
    });
  } catch {}

  // Edit-Flags
  try { localStorage.removeItem("editMode"); } catch {}
  try { localStorage.removeItem("editInseratId"); } catch {}

  // Flow-Flags
  try { sessionStorage.removeItem("inseratGestartet"); } catch {}
  try { sessionStorage.removeItem("hatGespeichert"); } catch {}
  try { sessionStorage.removeItem("editPending"); } catch {}

  // UI sofort neutralisieren (falls haendler.html offen ist)
  document.querySelectorAll(".step-box").forEach(b => {
    b.classList.remove("completed");
    const s = b.querySelector(".step-status");
    if (s) s.textContent = "";
  });
}






