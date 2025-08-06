document.addEventListener("DOMContentLoaded", () => {
  const navLinks = document.getElementById("nav-links");
  const hamburger = document.getElementById("hamburger");
  const dropdownLinks = document.querySelectorAll(".dropdown > a");

  // === Dropdown-Menüs & Hamburger ===
  hamburger?.addEventListener("click", (e) => {
    e.stopPropagation();
    navLinks?.classList.toggle("active");
    closeAllDropdowns();
  });

  dropdownLinks.forEach(link => {
    const menu = link.nextElementSibling;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll(".dropdown-menu").forEach(other => {
        if (other !== menu) other.classList.remove("show");
      });
      menu.classList.toggle("show");
    });
  });

  document.addEventListener("click", () => {
    navLinks?.classList.remove("active");
    closeAllDropdowns();
  });

  function closeAllDropdowns() {
    document.querySelectorAll(".dropdown-menu").forEach(menu => {
      menu.classList.remove("show");
    });
  }

  // === Navbar Login/Logout (LocalStorage & Fetch Fallback) ===
  const authLink = document.getElementById("auth-link");

  function handleLogout(e) {
    e.preventDefault();
    fetch("/logout", { method: "POST", credentials: "include" })
      .then(() => {
        localStorage.clear();
        location.reload();
      })
      .catch(() => alert("Abmelden fehlgeschlagen."));
  }

  function setLoggedInNavbar() {
    authLink.innerHTML = `<a href="#" id="logout-link"><i class="fas fa-sign-out-alt"></i> Abmelden</a>`;
    document.getElementById("logout-link").addEventListener("click", handleLogout);
  }
  const isLoggedInCookie = document.cookie.includes("nutzer=");
  if (isLoggedInCookie) {
    setLoggedInNavbar();
  } else {
  
    fetch("/getNutzerInfo", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.eingeloggt) setLoggedInNavbar();
      })
      .catch(err => {
        console.error("Fehler beim Abrufen des Login-Zustands:", err);
      });
  }

  // === Login-Zustand & Navigation für verkaufen.html ===
  fetch("/getNutzerInfo", {
    method: "GET",
    credentials: "include"
  })
    .then(res => res.json())
    .then(data => {
      const isLoggedIn = data.eingeloggt === true;
      const rolle = data.rolle;

      const privatLink = document.getElementById("privat-link");
      const haendlerLink = document.getElementById("haendler-link");

      if (isLoggedIn) {
        if (rolle === "privat") {
          haendlerLink?.classList.add("disabled");
          haendlerLink.title = "Als Privatverkäufer nicht verfügbar";
        } else if (rolle === "haendler") {
          privatLink?.classList.add("disabled");
          privatLink.title = "Als Händler nicht verfügbar";
        }
      }

      privatLink?.addEventListener("click", (e) => {
        e.preventDefault();
        if (!isLoggedIn || rolle !== "privat") return;
        window.location.href = "privat.html";
      });

      haendlerLink?.addEventListener("click", (e) => {
        e.preventDefault();
        if (!isLoggedIn || rolle !== "haendler") return;
        window.location.href = "haendler.html";
      });

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
    })
    .catch(err => {
      console.error("❌ Fehler beim Login-Check:", err);
    });

  // === Smooth scroll
  const searchLink = document.querySelector('a[href="#search-section"]');
  if (searchLink) {
    searchLink.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
    });
  }
});





