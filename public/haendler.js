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
      e.preventDefault(); e.stopPropagation(); toggleDropdown(link);
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
  const TARIF_KEY = "haendlerTarif";
  const stepsState = loadSteps();

  // Globale APIs
  window.markStepDone = markStepDone;
  window.showToast = showToast;
  window.toggleTarife = toggleTarife;

  renderStepsFromState();
  wireStepNavigation();
  setupToasts();
  setupTarif();

  function initWizard(user) {
    // ggf. weitere Initialisierung abhängig von user
  }

  function wireStepNavigation() {
    document.querySelectorAll(".step-box").forEach((box) => {
      box.addEventListener("click", () => {
        const step = box.dataset.step;
        const targets = {
          1: "fahrzeugdaten.html",
          2: "fahrzeugdetails.html",
          3: "medien.html",
          4: "vorschau.html"
        };
        if (targets[step]) window.location.href = targets[step];
      });
    });
  }

  function setupTarif() {
    const grid = document.getElementById("tarifGrid");
    if (!grid) return;

    // Restore Auswahl
    const saved = safeGet(TARIF_KEY, "");
    if (saved) {
      const el = grid.querySelector(`.tarif-box[data-tarif="${cssEscape(saved)}"]`);
      if (el) {
        grid.querySelectorAll(".tarif-box").forEach(b => b.classList.remove("selected"));
        el.classList.add("selected");
      }
    } else {
      // Falls nichts gespeichert: erste Box wählen + speichern
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

      const tarifCode = box.dataset.tarif; // z.B. "0-3", "4-10", "100+"
      // Server speichern
      try {
        const res = await fetch("/saveTarif", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ tarif: humanTarifLabel(tarifCode) }) // Server speichert nur Text; Label ist hübscher
        });
        const data = await res.json();
        if (res.ok && data.success) {
          persistTarif(tarifCode);
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
    const tarifBadge = document.getElementById("tarifAnzeige");
    if (!tarifBadge) return;
    const code = safeGet(TARIF_KEY, "");
    if (!code) { tarifBadge.textContent = ""; return; }
    const label = humanTarifLabel(code);
    const price = tarifPrice(label);
    tarifBadge.innerHTML = `<i class="fas fa-tag"></i> Aktiver Tarif: ${label}${price ? " – " + price : ""}`;
  }

  // ---------- Steps speichern / wiederherstellen ----------
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

  // ---------- Toasts ----------
  function setupToasts() {
    let toastContainer = document.getElementById("toast-container");
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.id = "toast-container";
      document.body.appendChild(toastContainer);
    }
  }
  function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;
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

  // ---------- Mobile Tarife togglen ----------
  function toggleTarife() {
    document.querySelectorAll(".tarif-grid .hide-mobile").forEach(el => {
      el.classList.toggle("hide-mobile");
    });
    const btn = document.querySelector(".tarif-toggle-btn.mobile-only");
    if (btn) {
      btn.textContent = btn.textContent.includes("Mehr")
        ? "Weniger Tarife anzeigen"
        : "Mehr Tarife anzeigen";
    }
  }

  // ---------- Helper ----------
  function humanTarifLabel(code) {
    // Mappe data-tarif ("0-3") auf sichtbares Label mit En-Dash und "Fahrzeuge"
    const map = {
      "0-3":  "0–3 Fahrzeuge",
      "4-10": "4–10 Fahrzeuge",
      "11-25":"11–25 Fahrzeuge",
      "26-50":"26–50 Fahrzeuge",
      "51-100":"51–100 Fahrzeuge",
      "100+": "100+ Fahrzeuge"
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
      "100+ Fahrzeuge":  "Auf Anfrage"
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
