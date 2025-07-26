document.addEventListener("DOMContentLoaded", () => {
    const loginTab = document.getElementById("loginTab");
    const registerTab = document.getElementById("registerTab");
    const loginContent = document.getElementById("login");
    const registerContent = document.getElementById("register");
  
    // === Tabs umschalten ===
    loginTab.addEventListener("click", () => {
      loginTab.classList.add("active");
      registerTab.classList.remove("active");
      loginContent.classList.remove("hidden");
      registerContent.classList.add("hidden");
    });
  
    registerTab.addEventListener("click", () => {
      registerTab.classList.add("active");
      loginTab.classList.remove("active");
      registerContent.classList.remove("hidden");
      loginContent.classList.add("hidden");
    });
    
  // === LOGIN senden ===
document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
  
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
  
    try {
      const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // wichtig für Cookies!
        body: JSON.stringify({ email, password })
      });
  
      const data = await res.json();
  
      if (res.ok && data.success) {
        alert("✅ Login erfolgreich!");
  
        // Speichere Login-Zustand im localStorage
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("userRole", data.role || "privat");
        localStorage.setItem("userId", data.id || "");
        localStorage.setItem("username", data.name || "");
  
        // Zielseite aus redirectAfterLogin lesen (falls vorhanden)
        const redirectPage = localStorage.getItem("redirectAfterLogin");
        if (redirectPage) {
          localStorage.removeItem("redirectAfterLogin");
          window.location.href = redirectPage;
        } else {
          window.location.href = "index.html";
        }
  
      } else {
        alert("❌ " + (data.error || "Login fehlgeschlagen"));
      }
    } catch (err) {
      console.error("Login Fehler:", err);
      alert("⚠️ Serverfehler. Bitte später versuchen.");
    }
  });
  
  
  
    // === REGISTRIERUNG senden ===
    document.getElementById("registerForm").addEventListener("submit", async (e) => {
      e.preventDefault();
  
      const name = document.getElementById("registerName").value.trim();
      const email = document.getElementById("registerEmail").value.trim();
      const password = document.getElementById("registerPassword").value;
      const passwordRepeat = document.getElementById("registerPasswordRepeat").value;
      const agbChecked = document.querySelector('input[name="agb"]').checked;
  
      if (password !== passwordRepeat) {
        return alert("❌ Passwörter stimmen nicht überein!");
      }
  
      if (!agbChecked) {
        return alert("❌ Bitte AGB und Datenschutz akzeptieren.");
      }
  
      try {
        const res = await fetch("/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password })
        });
  
        const data = await res.json();
  
        if (res.ok && data.success) {
          alert("✅ Registrierung erfolgreich! Bitte bestätige deine E-Mail.");
          loginTab.click(); // Automatisch zum Login wechseln
        } else {
          alert("❌ " + (data.error || "Registrierung fehlgeschlagen"));
        }
      } catch (err) {
        console.error("Registrierung Fehler:", err);
        alert("⚠️ Serverfehler. Bitte später versuchen.");
      }
    });
  });
  