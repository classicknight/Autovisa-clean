document.documentElement.classList.remove('no-js');

document.addEventListener("DOMContentLoaded", () => {
  // ====== DOM refs ======
  const navLinks = document.getElementById("nav-links");
  const hamburger = document.getElementById("hamburger");
  const dropdownLinks = document.querySelectorAll(".dropdown > a");
  const dropdownLis = document.querySelectorAll(".dropdown");
  const authLink = document.getElementById("auth-link");

  // ====== Helpers ======
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
    const menu = li.querySelector('.dropdown-menu');
    if (!trigger || !menu) return;

    const tRect = trigger.getBoundingClientRect();
    const mRect = menu.getBoundingClientRect();
    const liRect = li.getBoundingClientRect();
    const vw = window.innerWidth;

    const center = tRect.left + tRect.width / 2;
    let leftAbs = center - mRect.width / 2;
    leftAbs = clamp(leftAbs, 16, vw - mRect.width - 16);

    const relativeLeft = leftAbs - liRect.left;
    menu.style.left = `${relativeLeft}px`;
  }

  function openDropdown(trigger) {
    const li = trigger.closest(".dropdown");
    const menu = trigger.nextElementSibling;
    closeAllDropdowns(li);

    li.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    menu.classList.add("show");

    // Stagger die Items leicht
    [...menu.children].forEach((item, i) => {
      item.style.transitionDelay = `${i * 25}ms`;
    });

    // Nur Desktop zentrieren (Mobile = position:static)
    const isMobile = window.matchMedia("(max-width: 900px)").matches;
    if (!isMobile) requestAnimationFrame(() => positionMenu(li));
  }

  function toggleDropdown(trigger) {
    const li = trigger.closest(".dropdown");
    const isOpen = li.classList.contains("open");
    if (isOpen) {
      closeAllDropdowns();
    } else {
      openDropdown(trigger);
    }
  }

  // ====== Hamburger ======
  hamburger?.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = !navLinks.classList.contains("active");
    navLinks.classList.toggle("active");
    closeAllDropdowns();
    hamburger.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });

  // ====== Dropdown NUR per Klick ======
  dropdownLinks.forEach(link => {
    link.setAttribute("aria-expanded", "false");
    link.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleDropdown(link);
    });
  });

  // >>> KEIN Hover-Open (bewusst weggelassen)

  // ====== Outside Click (nur außerhalb der Navbar) ======
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".navbar")) {
      navLinks?.classList.remove("active");
      hamburger?.setAttribute("aria-expanded", "false");
      closeAllDropdowns();
    }
  });

  // ESC schließt
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      navLinks?.classList.remove("active");
      hamburger?.setAttribute("aria-expanded", "false");
      closeAllDropdowns();
    }
  });

  // Reposition bei Resize/Scroll (Desktop)
  const repositionOpen = () => document.querySelectorAll(".dropdown.open").forEach(positionMenu);
  window.addEventListener("resize", repositionOpen);
  window.addEventListener("scroll", repositionOpen);

  // ====== HARTE Login-Pflicht für verkaufen.html ======
  // Wenn nicht eingeloggt -> auf Login umleiten, danach zurück auf verkaufen.html
  fetch("/getNutzerInfo", { credentials: "include" })
    .then(res => res.json())
    .then(data => {
      if (!data.eingeloggt) {
        localStorage.setItem("redirectAfterLogin", "verkaufen.html");
        window.location.href = "login.html";
        return;
      }
      // Eingeloggt: Navbar & Rollen-Logik initialisieren
      initNavbarAuth(data);
      initRoleRouting(data);
      initInternalLinks(data);
    })
    .catch(err => {
      console.error("❌ Fehler beim Login-Check:", err);
    });

  // ====== Navbar Login/Logout (zeigt Abmelden, wenn eingeloggt) ======
  function initNavbarAuth(userData) {
    if (!authLink) return;
    const alreadyTrue = localStorage.getItem("isLoggedIn") === "true" || userData.eingeloggt === true;

    if (alreadyTrue) {
      authLink.innerHTML = `<a href="#" id="logout-link"><i class="fas fa-sign-out-alt"></i> Abmelden</a>`;
      document.getElementById("logout-link")?.addEventListener("click", handleLogout);
    } else {
      // Fallback: versuch Servercheck (sollte hier eigentlich nie nötig sein)
      fetch("/getNutzerInfo", { credentials: "include" })
        .then(res => res.json())
        .then(data => {
          if (data.eingeloggt) {
            authLink.innerHTML = `<a href="#" id="logout-link"><i class="fas fa-sign-out-alt"></i> Abmelden</a>`;
            document.getElementById("logout-link")?.addEventListener("click", handleLogout);
          }
        })
        .catch(err => console.error("Fehler beim Abrufen des Login-Zustands:", err));
    }
  }

  function handleLogout(e) {
    e.preventDefault();
    fetch("/logout", { method: "POST", credentials: "include" })
      .then(() => {
        localStorage.clear();
        location.reload();
      })
      .catch(() => alert("Abmelden fehlgeschlagen."));
  }

  // ====== Rollenabhängige Navigation (privat/haendler) ======
  function initRoleRouting(userData) {
    const rolle = userData.rolle;
    const privatLink = document.getElementById("privat-link");
    const haendlerLink = document.getElementById("haendler-link");

    if (rolle === "privat") {
      if (haendlerLink) {
        haendlerLink.classList.add("disabled");
        haendlerLink.title = "Als Privatverkäufer nicht verfügbar";
      }
    } else if (rolle === "haendler") {
      if (privatLink) {
        privatLink.classList.add("disabled");
        privatLink.title = "Als Händler nicht verfügbar";
      }
    }

    privatLink?.addEventListener("click", (e) => {
      e.preventDefault();
      if (rolle !== "privat") return alert("❌ Dieser Bereich ist nur für Privatverkäufer zugänglich.");
      window.location.href = "privat.html";
    });

    haendlerLink?.addEventListener("click", (e) => {
      e.preventDefault();
      if (rolle !== "haendler") return alert("❌ Dieser Bereich ist nur für Händler zugänglich.");
      window.location.href = "haendler.html";
    });
  }

  // ====== Interne Links (gespeicherte / eigene Autos) ======
  function initInternalLinks(userData) {
    const isLoggedIn = userData.eingeloggt === true;
    const savedCarsLink = document.getElementById("saved-cars-link");
    const myCarsLink = document.getElementById("my-cars-link");

    savedCarsLink?.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = isLoggedIn ? "gespeicherte-autos.html" : "login.html";
    });

    myCarsLink?.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = isLoggedIn ? "meine-autos.html" : "login.html";
    });
  }

  // ====== Smooth scroll (falls vorhanden) ======
  const searchLink = document.querySelector('a[href="#search-section"]');
  if (searchLink) {
    searchLink.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
    });
  }
});
