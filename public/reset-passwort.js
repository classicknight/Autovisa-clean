document.addEventListener("DOMContentLoaded", () => {
    const imageInput  = document.getElementById("imageInput");
    const carImage    = document.getElementById("carImage");
  
    const priceInput  = document.getElementById("priceInput");
    const modelInput  = document.getElementById("modelInput");
    const powerInput  = document.getElementById("powerInput");
    const yearInput   = document.getElementById("yearInput");
    const kmInput     = document.getElementById("kmInput");
  
    const infoPrice   = document.getElementById("infoPrice");
    const infoMain    = document.getElementById("infoMain");
    const infoSub     = document.getElementById("infoSub");
  
    const downloadBtn = document.getElementById("downloadBtn");
  
    // ==== Bild hochladen ====
    if (imageInput) {
      imageInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
  
        const reader = new FileReader();
        reader.onload = () => {
          carImage.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }
  
    // ==== Text in der Leiste aktualisieren ====
    function updateOverlay() {
      const price = priceInput.value.trim();
      const model = modelInput.value.trim();
      const power = powerInput.value.trim();
      const year  = yearInput.value.trim();
      const km    = kmInput.value.trim();
  
      infoPrice.textContent = price ? `${price} €` : "Preis auf Anfrage";
      infoMain.textContent  = model || "Modell";
  
      const subParts = [];
      if (power) subParts.push(`${power} PS`);
      if (year)  subParts.push(year);
      if (km)    subParts.push(`${km} km`);
  
      infoSub.textContent = subParts.length
        ? subParts.join(" · ")
        : "Leistung · Baujahr · Kilometerstand";
    }
  
    [priceInput, modelInput, powerInput, yearInput, kmInput].forEach((el) => {
      if (!el) return;
      el.addEventListener("input", updateOverlay);
    });
  
    // einmal initial
    updateOverlay();
  
    // ==== Bild als PNG direkt herunterladen (kein Popup) ====
    if (downloadBtn) {
      downloadBtn.addEventListener("click", async () => {
        const post = document.querySelector(".post-frame");
        if (!post || !window.html2canvas) return;
  
        try {
          const canvas = await html2canvas(post, {
            useCORS: true,
            backgroundColor: null,
            scale: 2 // höhere Qualität
          });
  
          // Canvas in Blob umwandeln und als Datei laden
          canvas.toBlob((blob) => {
            if (!blob) return;
  
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
  
            const model = (modelInput.value || "autovisa-post").replace(/\s+/g, "_");
            link.href = url;
            link.download = `${model}.png`;
  
            // Link kurz in den DOM hängen, klicken, wieder entfernen
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
  
            URL.revokeObjectURL(url);
          }, "image/png");
        } catch (err) {
          console.error("Fehler beim Erstellen des Bildes:", err);
          alert("Das Bild konnte nicht generiert werden. Bitte lade die Seite neu und versuche es erneut.");
        }
      });
    }
  });
  