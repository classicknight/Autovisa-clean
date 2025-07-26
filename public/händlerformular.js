document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("dealerForm");
  
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
        confirmPassword: form["confirm-password"].value,
        role: "haendler"
      };
  
      if (data.password !== data.confirmPassword) {
        alert("Die Passwörter stimmen nicht überein.");
        return;
      }
  
      try {
        const res = await fetch("/haendler-registrieren", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
  
        const result = await res.json();
  
        if (res.ok) {
          alert("Registrierung erfolgreich! Bitte prüfen Sie Ihr E-Mail-Postfach.");
          window.location.href = "index.html";
        } else {
          alert(result.error || "Ein Fehler ist aufgetreten.");
        }
      } catch (err) {
        console.error(err);
        alert("Serverfehler. Bitte später erneut versuchen.");
      }
    });
  });
  