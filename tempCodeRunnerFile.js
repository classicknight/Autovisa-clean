document.addEventListener("DOMContentLoaded", () => {
    const navLinks = document.getElementById("nav-links");
    const hamburger = document.getElementById("hamburger");
    const dropdownLinks = document.querySelectorAll(".dropdown > a");
    
    // Hamburger-Menü ein-/ausblenden
    hamburger.addEventListener("click", (e) => {
      e.stopPropagation();
      navLinks.classList.toggle("active");
      closeAllDropdowns(); // Immer Dropdowns schließen beim Öffnen
    });
    
    // Dropdown-Handling
    dropdownLinks.forEach(link => {
      const menu = link.nextElementSibling;
      
      link.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Schließt alle Dropdowns außer das angeklickte
        document.querySelectorAll(".dropdown-menu").forEach(otherMenu => {
          if (otherMenu !== menu) {
            otherMenu.classList.remove("show");
          }
        });
        
        menu.classList.toggle("show");
      });
    });
    
    // Klick außerhalb: alles schließen
    document.addEventListener("click", () => {
      navLinks.classList.remove("active");
      closeAllDropdowns();
    });
    
    function closeAllDropdowns() {
      document.querySelectorAll(".dropdown-menu").forEach(menu => {
        menu.classList.remove("show");
      });
    }
    
    // Login-Handling
    const isLoggedIn = false; // später dynamisch setzen
    
    const savedCarsLink = document.getElementById("saved-cars-link");
    const myCarsLink = document.getElementById("my-cars-link");
    
    if (savedCarsLink) {
      savedCarsLink.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = isLoggedIn ? "gespeicherte-autos.html" : "login.html";
      });
    }
    
    if (myCarsLink) {
      myCarsLink.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = isLoggedIn ? "meine-autos.html" : "login.html";
      });
    }
    
    // Smooth Scroll
    const searchLink = document.querySelector('a[href="#search-section"]');
    if (searchLink) {
      searchLink.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
      });
    }
  });
  
  
  
  
  
  
  
  
  document.addEventListener("DOMContentLoaded", () => {
    const boxes = document.querySelectorAll(".tarif-box");
  
    const firstBox = document.querySelector(".tarif-box");
    if (firstBox) {
      firstBox.classList.add("selected");
      localStorage.setItem("nutzerTarif", firstBox.dataset.tarif + " Fahrzeuge"); // Auch initial setzen
    }
  
    boxes.forEach(box => {
      box.addEventListener("click", () => {
        boxes.forEach(b => b.classList.remove("selected"));
        box.classList.add("selected");
  
        // 👇 TARIF IM LOCALSTORAGE SPEICHERN
        localStorage.setItem("nutzerTarif", box.dataset.tarif + " Fahrzeuge");
      });
    });
  });
  
  function toggleTarife() {
    const hiddenTarife = document.querySelectorAll(".hide-mobile");
    const btn = document.querySelector(".tarif-toggle-btn");
    
    const isHidden = Array.from(hiddenTarife).some(el => el.style.display === "none" || !el.style.display);
    
    hiddenTarife.forEach(el => {
      el.style.display = isHidden ? "block" : "none";
    });
    
    btn.textContent = isHidden ? "Weniger anzeigen" : "Mehr Tarife anzeigen";
  }
  
  
  
  
  
  
  function updateStepStatus(currentStep) {
    const steps = document.querySelectorAll(".step-box");
    steps.forEach((step, index) => {
      step.classList.remove("completed");
      
      const status = step.querySelector(".step-status");
      if (index + 1 < currentStep) {
        step.classList.add("completed");
        status.textContent = "✔️";
      } else {
        status.textContent = "";
      }
    });
  }
  
  // Beispiel: Schritt 2 ist aktiv, Schritt 1 ist abgeschlossen
  updateStepStatus(2);




  document.querySelectorAll(".step-box").forEach((box) => {
    box.addEventListener("click", () => {
      const step = box.dataset.step;
  
      // Login-Prüfung
      const isLoggedIn = localStorage.getItem("userLoggedIn") === "true";
      if (!isLoggedIn) {
        localStorage.setItem("redirectAfterLogin", "fahrzeugdaten.html");
        window.location.href = "login.html";
        return;
      }
  
      // Weiterleitung je nach Schritt
      if (step === "1") {
        window.location.href = "fahrzeugdaten.html";
      } else if (step === "2") {
        window.location.href = "fahrzeugdetails.html";
      } else if (step === "3") {
        window.location.href = "medien.html";
      } else if (step === "4") {
        window.location.href = "vorschau.html";
      }
    });
  });







  window.addEventListener("DOMContentLoaded", () => {
    sessionStorage.setItem("inseratGestartet", "true");
  });