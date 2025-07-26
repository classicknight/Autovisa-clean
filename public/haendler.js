document.addEventListener("DOMContentLoaded", () => {
    // === Verkäufer-Typ speichern ===
    localStorage.setItem("verkaeuferTyp", "Händler");
  
    // === Login prüfen ===
    const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
    const userRole = localStorage.getItem("userRole") || "privat";
    const userId = localStorage.getItem("userId") || null;
  
    // === Navigation / Dropdowns ===
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
  
    // === Links mit Loginprüfung ===
    const savedCarsLink = document.getElementById("saved-cars-link");
    const myCarsLink = document.getElementById("my-cars-link");
  
    savedCarsLink?.addEventListener("click", (e) => {
      e.preventDefault();
      if (!isLoggedIn) {
        localStorage.setItem("redirectAfterLogin", "gespeicherte-autos.html");
        window.location.href = "login.html";
      } else {
        window.location.href = "gespeicherte-autos.html";
      }
    });
  
    myCarsLink?.addEventListener("click", (e) => {
      e.preventDefault();
      if (!isLoggedIn) {
        localStorage.setItem("redirectAfterLogin", "meine-autos.html");
        window.location.href = "login.html";
      } else {
        window.location.href = "meine-autos.html";
      }
    });
  
    // === Schrittboxen-Logik ===
    document.querySelectorAll(".step-box").forEach((box) => {
      box.addEventListener("click", () => {
        const step = box.dataset.step;
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
  
    // === Tariflogik ===
    const boxes = document.querySelectorAll(".tarif-box");
    fetch("/getTarif")
      .then(res => res.json())
      .then(data => {
        let tarif = data.tarif || "";
        if (tarif) {
          boxes.forEach(box => {
            if (box.dataset.tarif + " Fahrzeuge" === tarif) {
              box.classList.add("selected");
            } else {
              box.classList.remove("selected");
            }
          });
          localStorage.setItem("nutzerTarif", tarif);
        } else {
          const firstBox = document.querySelector(".tarif-box");
          if (firstBox) {
            firstBox.classList.add("selected");
            const initialTarif = firstBox.dataset.tarif + " Fahrzeuge";
            localStorage.setItem("nutzerTarif", initialTarif);
  
            fetch("/saveTarif", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tarif: initialTarif, userId }) // WICHTIG: userId mitsenden
            });
          }
        }
      });
  
    boxes.forEach(box => {
      box.addEventListener("click", () => {
        boxes.forEach(b => b.classList.remove("selected"));
        box.classList.add("selected");
  
        const tarifWert = box.dataset.tarif + " Fahrzeuge";
        localStorage.setItem("nutzerTarif", tarifWert);
  
        fetch("/saveTarif", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tarif: tarifWert, userId })
        });
  
        updateNavbarTarif();
      });
    });
  
    // === Schrittanzeige & Inseratsstatus ===
    updateStepStatus(2);
  
    const referrer = document.referrer || "";
    const kamVonNeutralerSeite = ["index.html", "verkaufen.html", "privat.html"].some(p => referrer.includes(p));
    if (kamVonNeutralerSeite) {
      sessionStorage.setItem("inseratGestartet", "true");
      sessionStorage.removeItem("hatGespeichert");
      console.log("Inserat wurde neu gestartet.");
    } else {
      console.log("Kein Neustart des Inserats.");
    }
  
    updateNavbarTarif();
  });
  
  // === Mobiles Ausklappen ===
  function toggleTarife() {
    const hiddenTarife = document.querySelectorAll(".hide-mobile");
    const btn = document.querySelector(".tarif-toggle-btn");
  
    const currentlyHidden = Array.from(hiddenTarife).some(el => el.style.display === "none" || !el.style.display);
  
    hiddenTarife.forEach(el => {
      el.style.display = currentlyHidden ? "block" : "none";
    });
  
    btn.textContent = currentlyHidden ? "Weniger anzeigen" : "Mehr Tarife anzeigen";
  }
  
  // === Schrittvisualisierung ===
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
  
  // === Tarifanzeige in Navbar ===
  function updateNavbarTarif() {
    const tarifBadge = document.getElementById("tarifAnzeige");
    const tarifPreise = {
      "0–3 Fahrzeuge": "Kostenlos",
      "4–10 Fahrzeuge": "4,90 € / Monat",
      "11–25 Fahrzeuge": "9,90 € / Monat",
      "26–50 Fahrzeuge": "17,90 € / Monat",
      "51–100 Fahrzeuge": "29,90 € / Monat",
      "100+ Fahrzeuge": "Auf Anfrage"
    };
  
    const gespeicherterTarif = localStorage.getItem("nutzerTarif");
    if (gespeicherterTarif && tarifBadge) {
      const preis = tarifPreise[gespeicherterTarif] || "";
      tarifBadge.innerHTML = `<i class="fas fa-tag"></i> Aktiver Tarif: ${gespeicherterTarif} – ${preis}`;
    }
  }
  