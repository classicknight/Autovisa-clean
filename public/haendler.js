// haendler.js — EINHEITLICH
// haendler.js — EINHEITLICH
document.documentElement.classList.remove("no-js");

document.addEventListener("DOMContentLoaded", () => {
  // ---------- Navbar / Dropdown ----------
  const navLinks      = document.getElementById("nav-links");
  const hamburger     = document.getElementById("hamburger");
  const dropdownLinks = document.querySelectorAll(".dropdown > a");
  const dropdownLis   = document.querySelectorAll(".dropdown");
  const authDisplayEl = document.getElementById("auth-display");
  const savedCarsLink = document.getElementById("saved-cars-link");
  const myCarsLink    = document.getElementById("my-cars-link");

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function closeAllDropdowns(except = null) {
    dropdownLis.forEach(li => {
      if (li !== except) {
        li.classList.remove("open");
        const trigger = li.querySelector('a[aria-haspopup="true"]');
        const menu = li.querySelector(".dropdown-menu");
        if (trigger) trigger.setAttribute("aria-expanded", "false");
        if (menu) {
          menu.classList.remove("show");
          menu.style.left = "";
          [...menu.children].forEach(item => (item.style.transitionDelay = ""));
        }
      }
    });
  }


  // ===== Edit-Mode Bootstrap (Händler) =====
(function initEditModeHaendler() {
  const params = new URLSearchParams(location.search);
  const isEdit = params.get("edit") === "1";
  if (!isEdit) return;

  let payload = null;
  try {
    payload = JSON.parse(localStorage.getItem("autovisa_edit_payload") || "null");
  } catch {}

  if (!payload) {
    // Fallback: wenn aus irgendeinem Grund kein Payload da ist
    // kannst du optional später wieder eine API-Variante ergänzen.
    console.warn("Kein Edit-Payload gefunden.");
    return;
  }

  // ID merken
  const editId = sessionStorage.getItem("autovisa_edit_id") || payload.id || "";
  if (editId) sessionStorage.setItem("editInseratId", editId);

  // ====== Mapping in deine Wizard-Keys ======
  // Annahme: deine Steps lesen diese Keys bereits:
  // - "fahrzeugdaten"
  // - "fahrzeugdetails"
  // - "fahrzeugMedia"
  //
  // Wenn die Keys bei dir anders heißen, hier anpassen.

  const fahrzeugdaten = {
    // Beispiele – passe an deine echten Feldnamen an:
    marke: payload.verkauf_marke || payload.marke || "",
    modell: payload.verkauf_modell || payload.modell || "",
    erstzulassung: payload.verkauf_erstzulassung || payload.erstzulassung || "",
    kilometer: payload.verkauf_kilometer ?? payload.kilometer ?? "",
    leistung: payload.verkauf_leistung ?? payload.leistung ?? "",
    kraftstoff: payload.verkauf_kraftstoff || payload.kraftstoff || "",
    getriebe: payload.verkauf_getriebe || payload.getriebe || "",
    // ...
  };

  const fahrzeugdetails = {
    titel: payload.titel || payload.verkauf_titel || "",
    kurzbeschreibung: payload.verkauf_kurzbeschreibung || "",
    beschreibung: payload.verkauf_beschreibung || payload.beschreibung || "",
    farbe: payload.verkauf_farbe || payload.farbe || "",
    // merkmale/ausstattung evtl. Arrays übernehmen
    merkmale: payload.merkmale || payload.verkauf_ausstattung || [],
    // ...
  };

  const fahrzeugMedia = {
    bilder: payload.bilder || payload.images || payload.mediaImages || [],
    videos: payload.videos || payload.mediaVideos || [],
    // oder falls du ein einheitliches Array nutzt:
    media: payload.media || [],
  };

  try {
    localStorage.setItem("fahrzeugdaten", JSON.stringify(fahrzeugdaten));
    localStorage.setItem("fahrzeugdetails", JSON.stringify(fahrzeugdetails));
    localStorage.setItem("fahrzeugMedia", JSON.stringify(fahrzeugMedia));
  } catch {}

  // Flag für UI/Logik in den Steps
  localStorage.setItem("autovisa_edit_mode", "true");
})();

  function positionMenu(li) {
    const trigger = li.querySelector('a[aria-haspopup="true"]');
    const menu = li.querySelector(".dropdown-menu");
    if (!trigger || !menu) return;
    const tRect = trigger.getBoundingClientRect();
    const mRect = menu.getBoundingClientRect();
    const liRect = li.getBoundingClientRect();
    const vw = window.innerWidth;
    const center = tRect.left + tRect.width / 2;
    let leftAbs = center - mRect.width / 2;
    leftAbs = clamp(leftAbs, 16, vw - mRect.width - 16);
    menu.style.left = `${leftAbs - liRect.left}px`;
  }
  function openDropdown(trigger) {
    const li   = trigger.closest(".dropdown");
    const menu = trigger.nextElementSibling;
    closeAllDropdowns(li);
    li.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    menu.classList.add("show");
    [...menu.children].forEach((item, i) => (item.style.transitionDelay = `${i * 25}ms`));
    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    if (!isMobile) requestAnimationFrame(() => positionMenu(li));
  }
  function toggleDropdown(trigger) {
    const li = trigger.closest(".dropdown");
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
  const repositionOpen = () => document.querySelectorAll(".dropdown.open").forEach(positionMenu);
  window.addEventListener("resize", repositionOpen);
  window.addEventListener("scroll", repositionOpen);

  // ---------- Auth / Händler-Pflicht ----------
  fetch("/getNutzerInfo", { credentials: "include" })
    .then(res => res.json())
    .then(user => {
      if (!user?.eingeloggt) {
        try { localStorage.setItem("redirectAfterLogin", "haendler.html"); } catch {}
        window.location.href = "login.html";
        return;
      }
      if (user.rolle !== "haendler") {
        alert("Dieser Bereich ist nur für Händler zugänglich.");
        window.location.href = "verkaufen.html";
        return;
      }

      initAuthDisplay(user);
      savedCarsLink?.addEventListener("click", (e) => { e.preventDefault(); window.location.href = "gespeicherte-autos.html"; });
      myCarsLink?.addEventListener("click",    (e) => { e.preventDefault(); window.location.href = "meine-autos.html"; });

      initWizard(user);
    })
    .catch(err => console.error("❌ Fehler beim Login-Check:", err));

  function initAuthDisplay(user) {
    if (!authDisplayEl) return;
    const name  = user?.name || user?.email || "";
    const role  = user?.rolle === "haendler" ? "Händler" : user?.rolle || "";
    const label = name ? `Eingeloggt${role ? " – " + role : ""}: ${name}` : `Eingeloggt${role ? " – " + role : ""}`;
    authDisplayEl.innerHTML = `<i class="fas fa-user-check"></i> ${label}`;
  }

  // ---------- Wizard / Steps / Tarif ----------
  const STEP_STATE_KEY = "haendlerSteps";
  const TARIF_KEY      = "haendlerTarif";
  const stepsState     = loadSteps();

  // Exponiere Mini-APIs für andere Seiten
  window.markStepDone  = markStepDone;
  window.showToast     = showToast;
  window.toggleTarife  = toggleTarife;

  renderStepsFromState();
  wireStepNavigation();
  setupToasts();
  setupTarif();

  // Prüft Publish-Flag & Drafts
  async function initWizard(user) {
    if (!document.getElementById("toast-container")) setupToasts();

    // A) Direkt nach dem Veröffentlichen?
    if (sessionStorage.getItem("resetWizard") === "1") {
      clearWizardState();
      sessionStorage.removeItem("resetWizard");
      showToast("Inserat veröffentlicht – Assistent zurückgesetzt ✅");
      return;
    }

    // B) Kein Draft mehr vorhanden? → zurücksetzen
    try {
      const drafts = await fetch("/getVehicleData", { credentials: "include" }).then(r => r.json());
      const hasDraft = Array.isArray(drafts) && drafts.some(v => !v.status || v.status === "draft");
      if (!hasDraft) clearWizardState();
    } catch (e) {
      console.warn("Entwurfs-Check fehlgeschlagen:", e);
    }
  }

  function wireStepNavigation() {
    document.querySelectorAll(".step-box").forEach((box) => {
      box.addEventListener("click", () => {
        const step = box.dataset.step;
        const targets = {
          1: "fahrzeugdaten.html",
          2: "fahrzeugdetails.html",
          3: "medien.html",
          4: "vorschau.html",
        };
        if (targets[step]) window.location.href = targets[step];
      });
    });
  }

  function setupTarif() {
    const grid = document.getElementById("tarifGrid");
    if (!grid) return;

    // Restore
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
        persistTarif(first.dataset.tarif);
      }
    }
    updateNavbarTarif();

    grid.addEventListener("click", async (e) => {
      const box = e.target.closest(".tarif-box");
      if (!box) return;

      grid.querySelectorAll(".tarif-box").forEach(b => b.classList.remove("selected"));
      box.classList.add("selected");

      const code = box.dataset.tarif;
      try {
        const res = await fetch("/saveTarif", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tarif: humanTarifLabel(code) }),
        });
        const data = await res.json();
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
    const code  = safeGet(TARIF_KEY, "");
    if (!code) { badge.textContent = ""; return; }
    const label = humanTarifLabel(code);
    const price = tarifPrice(label);
    badge.innerHTML = `<i class="fas fa-tag"></i> Aktiver Tarif: ${label}${price ? " – " + price : ""}`;
  }

  // Steps
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
    localStorage.setItem(STEP_STATE_KEY, JSON.stringify(stepsState));
  }

  // Toasts
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

  // Mobile Tarife togglen
  function toggleTarife() {
    document.querySelectorAll(".tarif-grid .hide-mobile").forEach(el => el.classList.toggle("hide-mobile"));
    const btn = document.querySelector(".tarif-toggle-btn.mobile-only");
    if (btn) {
      btn.textContent = btn.textContent.includes("Mehr") ? "Weniger Tarife anzeigen" : "Mehr Tarife anzeigen";
    }
  }

  // Helper
  function humanTarifLabel(code) {
    const map = {
      "0-3":  "0–3 Fahrzeuge",
      "4-10": "4–10 Fahrzeuge",
      "11-25":"11–25 Fahrzeuge",
      "26-50":"26–50 Fahrzeuge",
      "51-100":"51–100 Fahrzeuge",
      "100+": "100+ Fahrzeuge",
    };
    return map[code] || code;
  }
  function tarifPrice(label) {
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
}); // ✅ DOMContentLoaded HIER schließen!

// Wizard & lokale Draft-Daten zurücksetzen (global)
function clearWizardState() {
  localStorage.removeItem("haendlerSteps");     // Steps
  localStorage.removeItem("fahrzeugdaten");     // Step 1
  try {
    Object.keys(localStorage).forEach(k => {    // Step 2 (alle details_)
      if (k.startsWith("details_")) localStorage.removeItem(k);
    });
  } catch {}

  sessionStorage.removeItem("inseratGestartet");
  sessionStorage.removeItem("hatGespeichert");

  // UI sofort neutralisieren (falls haendler.html offen ist)
  document.querySelectorAll(".step-box").forEach(b => {
    b.classList.remove("completed");
    const s = b.querySelector(".step-status");
    if (s) s.textContent = "";
  });
}








