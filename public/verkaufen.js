document.documentElement.classList.remove('no-js');

document.addEventListener("DOMContentLoaded", () => {
  // ===== Navbar Grund-Setup (wie in navbar.js) =====
  const navLinks = document.getElementById("nav-links");
  const hamburger = document.getElementById("hamburger");
  const dropdownLinks = document.querySelectorAll(".dropdown > a");
  const dropdownLis = document.querySelectorAll(".dropdown");

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
    leftAbs = Math.max(16, Math.min(leftAbs, vw - mRect.width - 16));

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

    // Stagger
    [...menu.children].forEach((item, i) => {
      item.style.transitionDelay = `${i * 25}ms`;
    });

    // Nur Desktop zentrieren
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

  // Hamburger-Menü (wie navbar.js)
  if (hamburger) {
    hamburger.addEventListener("click", (e) => {
      e.stopPropagation();
      navLinks.classList.toggle("active");
      closeAllDropdowns(); // immer schließen
      hamburger.setAttribute(
        "aria-expanded",
        navLinks.classList.contains("active") ? "true" : "false"
      );
    });
  }

  // Dropdowns per Klick (wie navbar.js)
  dropdownLinks.forEach(link => {
    link.setAttribute("aria-expanded", "false");
    link.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleDropdown(link);
    });
  });

  // Optional Desktop Hover (genau wie navbar.js)
  const isCoarse = matchMedia("(pointer: coarse)").matches;
  if (!isCoarse) {
    dropdownLis.forEach(li => {
      const trigger = li.querySelector('a[aria-haspopup="true"]');
      const menu = li.querySelector(".dropdown-menu");
      if (!trigger || !menu) return;

      li.addEventListener("mouseenter", () => openDropdown(trigger));
      li.addEventListener("mouseleave", () => closeAllDropdowns());
    });
  }

  // Outside Click schließt (wie navbar.js)
  document.addEventListener("click", () => {
    navLinks.classList.remove("active");
    closeAllDropdowns();
  });

  // Reposition on resize/scroll
  const repositionOpen = () =>
    document.querySelectorAll(".dropdown.open").forEach(positionMenu);
  window.addEventListener("resize", repositionOpen);
  window.addEventListener("scroll", repositionOpen);

  // ===== Login-Pflicht für verkaufen.html =====
  fetch("/getNutzerInfo", { credentials: "include" })
    .then(res => res.json())
    .then(data => {
      if (!data.eingeloggt) {
        localStorage.setItem("redirectAfterLogin", "verkaufen.html");
        window.location.href = "login.html";
        return;
      }
      // eingeloggt → Navbar/Links/Rolle initialisieren
      initNavbarAuth(data);
      initRoleRouting(data);
      initInternalLinks(data);
    })
    .catch(err => console.error("❌ Fehler beim Login-Check:", err));

  // ===== Navbar Login/Logout =====
  function initNavbarAuth(userData) {
    const authLink = document.getElementById("auth-link");
    if (!authLink) return;

    const alreadyTrue =
      localStorage.getItem("isLoggedIn") === "true" || userData.eingeloggt === true;

    if (alreadyTrue) {
      authLink.innerHTML =
        `<a href="#" id="logout-link"><i class="fas fa-sign-out-alt"></i> Abmelden</a>`;
      document.getElementById("logout-link")?.addEventListener("click", handleLogout);
    } else {
      fetch("/getNutzerInfo", { credentials: "include" })
        .then(res => res.json())
        .then(data => {
          if (data.eingeloggt) {
            authLink.innerHTML =
              `<a href="#" id="logout-link"><i class="fas fa-sign-out-alt"></i> Abmelden</a>`;
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

  // ===== Rollenabhängige Navigation =====
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

  // ===== Interne Links =====
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

  // ===== Smooth Scroll (falls vorhanden) =====
  const searchLink = document.querySelector('a[href="#search-section"]');
  if (searchLink) {
    searchLink.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
    });
  }
});
