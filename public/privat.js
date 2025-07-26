document.addEventListener("DOMContentLoaded", () => {
    // Verkäufertyp setzen
    localStorage.setItem("verkaeuferTyp", "Privat");
  
    // ================== NAVIGATION ==================
    const navLinks = document.getElementById("nav-links");
    const hamburger = document.getElementById("hamburger");
    const dropdownLinks = document.querySelectorAll(".dropdown > a");
  
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
  
    // ================== Login-Links ==================
    const isLoggedIn = localStorage.getItem("userLoggedIn") === "true";
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
  
    // ================== Smooth Scroll ==================
    const searchLink = document.querySelector('a[href="#search-section"]');
    searchLink?.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
    });
  
    // ================== Abbruch-Logik ==================
    const referrer = document.referrer || "";
    const kamVonNeutralerSeite = ["index.html", "verkaufen.html", "haendler.html"].some(p => referrer.includes(p));
  
    if (kamVonNeutralerSeite) {
      sessionStorage.setItem("inseratGestartet", "true");
      sessionStorage.removeItem("hatGespeichert");
      console.log("Inserat wurde neu gestartet.");
    }
  
    // ================== Tarif-Auswahl ==================
    const boxes = document.querySelectorAll("#privatTarifGrid .tarif-box");
  
    fetch("/getTarif")
      .then(res => res.json())
      .then(data => {
        let tarif = data.tarif || "";
        if (tarif) {
          boxes.forEach(box => {
            if (box.dataset.tarif + " Inserat(e)" === tarif) {
              box.classList.add("selected");
            } else {
              box.classList.remove("selected");
            }
          });
          localStorage.setItem("nutzerTarif", tarif);
        } else {
          const firstBox = boxes[0];
          if (firstBox) {
            firstBox.classList.add("selected");
            const initialTarif = firstBox.dataset.tarif + " Inserat(e)";
            localStorage.setItem("nutzerTarif", initialTarif);
  
            fetch("/saveTarif", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tarif: initialTarif })
            });
          }
        }
      });
  
    boxes.forEach(box => {
      box.addEventListener("click", () => {
        boxes.forEach(b => b.classList.remove("selected"));
        box.classList.add("selected");
  
        const tarifWert = box.dataset.tarif + " Inserat(e)";
        localStorage.setItem("nutzerTarif", tarifWert);
  
        fetch("/saveTarif", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tarif: tarifWert })
        });
  
        updateNavbarTarif();
      });
    });
  
    // ================== Schritt-Boxen Navigation ==================
    document.querySelectorAll(".step-box").forEach((box) => {
      box.addEventListener("click", () => {
        const step = box.dataset.step;
        const isLoggedIn = localStorage.getItem("userLoggedIn") === "true";
  
        if (!isLoggedIn) {
          localStorage.setItem("redirectAfterLogin", "fahrzeugdaten.html");
          window.location.href = "login.html";
          return;
        }
  
        if (step === "1") window.location.href = "fahrzeugdaten.html";
        else if (step === "2") window.location.href = "fahrzeugdetails.html";
        else if (step === "3") window.location.href = "medien.html";
        else if (step === "4") window.location.href = "vorschau.html";
      });
    });
  
    // ================== Schrittstatus ==================
    updateStepStatus(1);
  
    // ================== Tarif in Navbar anzeigen ==================
    updateNavbarTarif();
  });
  
  // ================== Schritt-Visualisierung ==================
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
  
  // ================== Mobiles Tarif-Ausklappen ==================
  function togglePrivatTarife() {
    const hiddenTarife = document.querySelectorAll("#privatTarifGrid .hide-mobile");
    const btn = document.querySelector(".tarif-toggle-btn");
  
    const isHidden = Array.from(hiddenTarife).some(el => el.style.display === "none" || !el.style.display);
  
    hiddenTarife.forEach(el => {
      el.style.display = isHidden ? "block" : "none";
    });
  
    btn.textContent = isHidden ? "Weniger anzeigen" : "Mehr Tarife anzeigen";
  }
  
  // ================== Tarif-Badge in Navbar ==================
  function updateNavbarTarif() {
    const tarifBadge = document.getElementById("tarifAnzeige");
    const tarifPreise = {
      "1 Inserat(e)": "Kostenlos",
      "2 Inserat(e)": "2,90 € einmalig",
      "3 Inserat(e)": "5,90 € einmalig",
      "4-5 Inserat(e)": "9,90 € einmalig"
    };
  
    const gespeicherterTarif = localStorage.getItem("nutzerTarif");
    if (gespeicherterTarif && tarifBadge) {
      const preis = tarifPreise[gespeicherterTarif] || "";
      tarifBadge.innerHTML = `<i class="fas fa-tag"></i> Aktiver Tarif: ${gespeicherterTarif} – ${preis}`;
    }
  }
  