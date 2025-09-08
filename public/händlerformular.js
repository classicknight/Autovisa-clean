document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("dealerForm");

  // --- Logo-Vorschau Elemente
  const fileInput   = document.getElementById("logo");
  const imgEl       = document.getElementById("logoImg");
  const initialsEl  = document.getElementById("logoInitials");
  const removeBtn   = document.getElementById("logoRemove");

  // Initialen aus Firmenname
  function initialsFromName(name = "") {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    const ini = parts.map(p => (p[0] || "").toUpperCase()).join("");
    return ini || "AV";
  }
  function updateInitials() {
    initialsEl.textContent = initialsFromName(form.firma.value);
  }
  updateInitials();
  form.firma.addEventListener("input", updateInitials);

  // Vorschau zurücksetzen
  function resetPreview() {
    if (imgEl) {
      imgEl.removeAttribute("src");
      imgEl.style.display = "none";
    }
    if (initialsEl) {
      initialsEl.style.display = "flex";
      updateInitials();
    }
  }

  // Logo-Datei auswählen → Vorschau
  fileInput?.addEventListener("change", () => {
    const f = fileInput.files?.[0];
    if (!f) { resetPreview(); return; }

    const okTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!okTypes.includes(f.type)) {
      alert("Bitte PNG, JPEG oder WEBP hochladen.");
      fileInput.value = "";
      resetPreview();
      return;
    }
    const maxBytes = 1.5 * 1024 * 1024; // 1.5 MB
    if (f.size > maxBytes) {
      alert("Das Bild ist größer als 1.5 MB.");
      fileInput.value = "";
      resetPreview();
      return;
    }

    const url = URL.createObjectURL(f);
    imgEl.src = url;
    imgEl.onload = () => URL.revokeObjectURL(url);
    imgEl.style.display = "block";
    initialsEl.style.display = "none";
  });

  // Logo entfernen
  removeBtn?.addEventListener("click", () => {
    fileInput.value = "";
    resetPreview();
  });

  // --- Formular absenden (JSON, kein Datei-Upload)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = {
      firma: form.firma.value.trim(),
      strasse: form.strasse.value.trim(),
      hausnummer: form.hausnummer.value.trim(),
      plz: form.plz.value.trim(),
      ort: form.ort.value.trim(),
      land: form.land.value,
      telefon: form.telefon.value.trim(),
      telefon2: form.telefon2.value.trim(),
      email: form.email.value.trim(),
      whatsapp: form.whatsapp.checked,
      tarif: form.tarif.value,
      zahlungsmethode: form.zahlungsmethode.value,
      kontoinhaber: form.kontoinhaber.value.trim(),
      iban: form.iban.value.trim(),
      bic: form.bic.value.trim(),
      impressum: form.impressum.value.trim(),
      agb: form.agb.checked,
      datenschutz: form.datenschutz.checked,
      password: form.password.value,
      confirmPassword: form["confirm-password"].value
      // role NICHT mitsenden – setzt der Server selbst auf "haendler"
      // logo NICHT mitsenden – Upload später über /haendler/logo nach Login
    };

    // Client-Checks
    if (!data.agb || !data.datenschutz) {
      alert("Bitte AGB und Datenschutz akzeptieren.");
      return;
    }
    if (data.password !== data.confirmPassword) {
      alert("Die Passwörter stimmen nicht überein.");
      return;
    }

    // Button sperren, um Doppelklicks zu vermeiden
    const submitBtn = form.querySelector(".submit-btn");
    submitBtn.disabled = true;

    try {
      const res = await fetch("/haendler-registrieren", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      const result = await res.json().catch(() => ({}));

      if (res.ok) {
        alert("Registrierung erfolgreich! Bitte prüfen Sie Ihr E-Mail-Postfach zur Bestätigung.");
        // Hinweis: Logo-Upload erfolgt nach Login im Profil unter „Logo hochladen“.
        window.location.href = "index.html";
      } else {
        alert(result.error || "Ein Fehler ist aufgetreten.");
        submitBtn.disabled = false;
      }
    } catch (err) {
      console.error(err);
      alert("Serverfehler. Bitte später erneut versuchen.");
      submitBtn.disabled = false;
    }
  });
});
