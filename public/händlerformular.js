document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("dealerForm");

  // --- Logo-Vorschau Elemente
  const fileInput  = document.getElementById("logo");
  const imgEl      = document.getElementById("logoImg");
  const initialsEl = document.getElementById("logoInitials");
  const removeBtn  = document.getElementById("logoRemove");
  const confirmPasswordInput = document.getElementById("confirm-password");

  // Initialen aus Firmenname
  function initialsFromName(name = "") {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    const ini = parts.map(p => (p[0] || "").toUpperCase()).join("");
    return ini || "AV";
  }
  function updateInitials() {
    if (initialsEl && form?.firma) {
      initialsEl.textContent = initialsFromName(form.firma.value);
    }
  }
  updateInitials();
  form?.firma?.addEventListener("input", updateInitials);

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
    if (fileInput) fileInput.value = "";
    resetPreview();
  });

  // +49-Logik: deutsche Nummern
  function normalizePhone(raw) {
    let v = (raw || "").trim();
    if (!v) return "";

    // Leerzeichen entfernen
    v = v.replace(/\s+/g, "");

    // 00 → +
    if (v.startsWith("00")) {
      v = "+" + v.slice(2);
    }

    // Wenn bereits mit +49 beginnt → so lassen
    if (v.startsWith("+49")) {
      return v;
    }

    // Führende 0 entfernen (0176 → 176)
    if (v.startsWith("0")) {
      v = v.slice(1);
    }

    return "+49" + v;
  }

  // --- Formular absenden (MULTIPART inkl. optionalem LOGO)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Client-Checks
    if (!form.agb.checked || !form.datenschutz.checked) {
      alert("Bitte AGB und Datenschutz akzeptieren.");
      return;
    }

    // Passwort-Check (Bugfix: confirmPasswordInput statt form['confirm-password'])
    if (form.password.value !== confirmPasswordInput.value) {
      alert("Die Passwörter stimmen nicht überein.");
      return;
    }

    // (Sicherheits-)Checks fürs Logo nochmal vorm Absenden
    const f = fileInput?.files?.[0];
    if (f) {
      const okTypes = ["image/png", "image/jpeg", "image/webp"];
      if (!okTypes.includes(f.type)) {
        alert("Bitte PNG, JPEG oder WEBP hochladen.");
        return;
      }
      if (f.size > 1.5 * 1024 * 1024) {
        alert("Das Bild ist größer als 1.5 MB.");
        return;
      }
    }

    const submitBtn = form.querySelector(".submit-btn");
    if (submitBtn) submitBtn.disabled = true;

    try {
      const fd = new FormData();

      // Basisdaten
      fd.append("firma",       form.firma.value.trim());
      fd.append("strasse",     form.strasse.value.trim());
      fd.append("hausnummer",  form.hausnummer.value.trim());
      fd.append("plz",         form.plz.value.trim());
      fd.append("ort",         form.ort.value.trim());
      fd.append("land",        form.land.value);

      // Telefonnummern mit +49-Normalisierung
      fd.append("telefon", normalizePhone(form.telefon.value));
      fd.append("telefon2", normalizePhone(form.telefon2.value));
      fd.append("email", form.email.value.trim());
      fd.append("website", form.website.value.trim());   // <— NEU
      fd.append("whatsapp", form.whatsapp.checked ? "true" : "false");
      
      // Tarif
      const selectedTarif = form.querySelector("input[name='tarif']:checked");
      fd.append("tarif", selectedTarif ? selectedTarif.value : "");

      // Zahlungsdaten / SEPA
      fd.append("zahlungsmethode", form.zahlungsmethode.value);
      fd.append("kontoinhaber",    form.kontoinhaber.value.trim());
      fd.append("iban",            form.iban.value.trim());
      fd.append("bic",             form.bic.value.trim());
// Impressum & Rechtliches
fd.append("impressum",   form.impressum.value.trim());
fd.append("agb",         form.agb.checked ? "true" : "false");
fd.append("datenschutz", form.datenschutz.checked ? "true" : "false");

// Zugangsdaten
fd.append("password",        form.password.value);
fd.append("confirmPassword", confirmPasswordInput.value);

// Öffnungszeiten (robust)
const days = ["mo", "di", "mi", "do", "fr", "sa", "so"];

days.forEach((key) => {
  const vonEl    = document.getElementById(`oeffnungszeiten_${key}_von`);
  const bisEl    = document.getElementById(`oeffnungszeiten_${key}_bis`);
  const closedEl = document.getElementById(`oeffnungszeiten_${key}_closed`);

  const closed = !!closedEl?.checked;

  // Wenn geschlossen → Zeiten bewusst leeren
  const von = closed ? "" : String(vonEl?.value || "").trim();
  const bis = closed ? "" : String(bisEl?.value || "").trim();

  // set() statt append() -> keine doppelten Keys, sauberer Body
  fd.set(`oeffnungszeiten_${key}_von`, von);
  fd.set(`oeffnungszeiten_${key}_bis`, bis);
  fd.set(`oeffnungszeiten_${key}_closed`, closed ? "true" : "false");
});



// Sprachen (mehrere Werte)
const langInputs = form.querySelectorAll("input[name='sprachen']:checked");
langInputs.forEach((inp) => {
  fd.append("sprachen", inp.value);
});


      // Logo
      if (f) {
        fd.append("logo", f);
      }

      const res = await fetch("/haendler-registrieren", {
        method: "POST",
        body: fd
      });

      const result = await res.json().catch(() => ({}));

      if (res.ok) {
        alert("Registrierung erfolgreich! Bitte E-Mail zur Bestätigung prüfen.");
        window.location.href = "index.html";
      } else {
        alert(result.error || "Ein Fehler ist aufgetreten.");
        if (submitBtn) submitBtn.disabled = false;
      }
    } catch (err) {
      console.error(err);
      alert("Serverfehler. Bitte später erneut versuchen.");
      if (submitBtn) submitBtn.disabled = false;
    }
  });
});
