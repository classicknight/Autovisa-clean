document.addEventListener("DOMContentLoaded", () => {
    const imageInput = document.getElementById("imageInput");
    const carImage   = document.getElementById("carImage");
  
    const priceInput = document.getElementById("priceInput");
    const modelInput = document.getElementById("modelInput");
    const powerInput = document.getElementById("powerInput");
    const yearInput  = document.getElementById("yearInput");
    const kmInput    = document.getElementById("kmInput");
  
    const infoPrice  = document.getElementById("infoPrice");
    const infoMain   = document.getElementById("infoMain");
  
    // NEU: statt infoSub jetzt die drei Spec-Felder
    const infoPower  = document.getElementById("infoPower");
    const infoYear   = document.getElementById("infoYear");
    const infoKm     = document.getElementById("infoKm");
  
    const downloadBtn = document.getElementById("downloadBtn");
  
const postFrame = document.querySelector(".post-frame");

// === Bild-Ausrichtung (Hoch/Quer) setzen ===
function updateImageFit() {
  if (!carImage || !carImage.naturalWidth || !carImage.naturalHeight) return;
  
  const portrait = carImage.naturalHeight >= carImage.naturalWidth;
  
  // Klassen am Bild (falls du sie noch brauchst)
  carImage.classList.toggle("portrait", portrait);
  carImage.classList.toggle("landscape", !portrait);
  
  // NEU: robuste Klassen am Frame (für CSS)
  if (postFrame) {
    postFrame.classList.toggle("is-portrait", portrait);
    postFrame.classList.toggle("is-landscape", !portrait);
  }
}

// WICHTIG: immer load-Listener setzen (auch wenn das Startbild schon complete ist)
if (carImage) {
  carImage.addEventListener("load", updateImageFit);
  if (carImage.complete && carImage.naturalWidth) updateImageFit();
}
  
    // ==== Bild hochladen ====
    if (imageInput && carImage) {
      imageInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
  
        const reader = new FileReader();
        reader.onload = () => {
          carImage.src = reader.result; // load-event triggert updateImageFit()
        };
        reader.readAsDataURL(file);
      });
    }
  
    // Kleine Helfer (optional, aber sauber)
    function formatEUR(input) {
      const v = (input || "").trim();
      if (!v) return "";
      // lässt "28.990" oder "28990" zu
      const cleaned = v.replace(/[^\d]/g, "");
      if (!cleaned) return v;
      return Number(cleaned).toLocaleString("de-DE");
    }
  
    function formatKM(input) {
      const v = (input || "").trim();
      if (!v) return "";
      const cleaned = v.replace(/[^\d]/g, "");
      if (!cleaned) return v;
      return Number(cleaned).toLocaleString("de-DE");
    }
  
    // ==== Overlay aktualisieren ====
    function updateOverlay() {
      const priceRaw = priceInput?.value || "";
      const model = (modelInput?.value || "").trim();
      const power = (powerInput?.value || "").trim();
      const year  = (yearInput?.value || "").trim();
      const kmRaw = kmInput?.value || "";
  
      const price = formatEUR(priceRaw);
      const km    = formatKM(kmRaw);
  
      if (infoPrice) infoPrice.textContent = price ? `${price} €` : "Preis auf Anfrage";
      if (infoMain)  infoMain.textContent  = model || "Modell";
  
      if (infoPower) infoPower.textContent = power || "—";
      if (infoYear)  infoYear.textContent  = year  || "—";
      if (infoKm)    infoKm.textContent    = km    || "—";
    }
  
    [priceInput, modelInput, powerInput, yearInput, kmInput].forEach((el) => {
      if (!el) return;
      el.addEventListener("input", updateOverlay);
    });
  
    updateOverlay();
  
 // ==== Download ====
if (downloadBtn) {
    downloadBtn.addEventListener("click", async () => {
      const post = document.querySelector(".post-frame");
      if (!post || !window.html2canvas) {
        alert("Export nicht möglich: html2canvas oder Post-Element fehlt.");
        return;
      }
  
      const oldText = downloadBtn.textContent;
      downloadBtn.disabled = true;
      downloadBtn.textContent = "Export…";
  
      try {
        // warten bis Auto-Bild wirklich geladen ist
        if (carImage && (!carImage.complete || !carImage.naturalWidth)) {
          await new Promise((res) => carImage.addEventListener("load", res, { once: true }));
        }
  
        // warten bis Logo geladen ist
        const logoImg = document.querySelector(".brand-logo");
        if (logoImg && (!logoImg.complete || !logoImg.naturalWidth)) {
          await new Promise((res) => logoImg.addEventListener("load", res, { once: true }));
        }
  
        // warten bis Fonts geladen sind
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
  
        const canvas = await html2canvas(post, {
          useCORS: true,
          backgroundColor: null,
          scale: 2
        });
  
        canvas.toBlob((blob) => {
          if (!blob) {
            alert("Das Bild konnte nicht erstellt werden.");
            return;
          }
  
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
  
          const modelName = (modelInput?.value || "autovisa-post")
            .trim()
            .replace(/\s+/g, "_")
            .replace(/[^\w\-]/g, "");
  
          link.href = url;
          link.download = `${modelName || "autovisa-post"}.png`;
  
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
  
          URL.revokeObjectURL(url);
        }, "image/png");
      } catch (err) {
        console.error("Fehler beim Erstellen des Bildes:", err);
        alert("Das Bild konnte nicht generiert werden. Bitte Seite neu laden und erneut versuchen.");
      } finally {
        downloadBtn.disabled = false;
        downloadBtn.textContent = oldText;
      }
    });
  }
  
  });
  
  

