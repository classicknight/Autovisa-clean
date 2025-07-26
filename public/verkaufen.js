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
  
    // === Login-Zustand & Navigation ===
    let isLoggedIn = false;
  
    fetch("/getNutzerInfo", {
      method: "GET",
      credentials: "include" // 🧠 wichtig für Cookies!
    })
      .then(res => res.json())
      .then(data => {
        isLoggedIn = data.eingeloggt === true;
  
        // === Verkäuferwahl (Privat/Händler)
        const privatLink = document.getElementById("privat-link");
        const haendlerLink = document.getElementById("haendler-link");
  
        privatLink?.addEventListener("click", (e) => {
          e.preventDefault();
          handleNavigation("privat.html");
        });
  
        haendlerLink?.addEventListener("click", (e) => {
          e.preventDefault();
          handleNavigation("haendler.html");
        });
  
        // === Dropdown-Navigationslinks oben
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
  
    function handleNavigation(targetPage) {
      console.log("➡️ Weiterleitung zu:", targetPage);
      console.log("✅ Eingeloggt?", isLoggedIn);
  
      if (isLoggedIn) {
        window.location.href = targetPage;
      } else {
        localStorage.setItem("redirectAfterLogin", targetPage);
        window.location.href = "login.html";
      }
    }
  
    // === Smooth scroll (falls nötig)
    const searchLink = document.querySelector('a[href="#search-section"]');
    if (searchLink) {
      searchLink.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
      });
    }
  });
  