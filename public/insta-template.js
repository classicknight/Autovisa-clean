document.addEventListener("DOMContentLoaded", () => {
    const imageInput = document.getElementById("imageInput");
    const carImage = document.getElementById("carImage");
    
    const priceInput = document.getElementById("priceInput");
    const modelInput = document.getElementById("modelInput");
    const powerInput = document.getElementById("powerInput");
    const yearInput = document.getElementById("yearInput");
    const kmInput = document.getElementById("kmInput");
    
    const infoPrice = document.getElementById("infoPrice");
    const infoMain = document.getElementById("infoMain");
    const infoSub = document.getElementById("infoSub");
    
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
      const year = yearInput.value.trim();
      const km = kmInput.value.trim();
      
      infoPrice.textContent = price ? `${price} €` : "Preis auf Anfrage";
      infoMain.textContent = model || "Modell";
      
      const subParts = [];
      if (power) subParts.push(`${power} PS`);
      if (year) subParts.push(year);
      if (km) subParts.push(`${km} km`);
      
      infoSub.textContent = subParts.length ?
        subParts.join(" · ") :
        "Leistung · Baujahr · Kilometerstand";
    }
    
    [priceInput, modelInput, powerInput, yearInput, kmInput].forEach((el) => {
      if (!el) return;
      el.addEventListener("input", updateOverlay);
    });
    
    // einmal initial
    updateOverlay();
    
    // ==== Bild als PNG im neuen Tab anzeigen (besser für Spck) ====
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
          
          const dataURL = canvas.toDataURL("image/png");
          
          // Neues Fenster / Tab mit dem Bild öffnen
          const win = window.open("", "_blank");
          if (win) {
            win.document.title = "Autovisa Instagram Post";
            win.document.body.style.margin = "0";
            win.document.body.style.background = "#000";
            
            const img = win.document.createElement("img");
            img.src = dataURL;
            img.style.display = "block";
            img.style.width = "100%";
            img.style.height = "auto";
            
            win.document.body.appendChild(img);
          } else {
            alert("Popup wurde blockiert. Bitte Popups im Browser erlauben.");
          }
        } catch (err) {
          console.error("Fehler beim Erstellen des Bildes:", err);
          alert("Das Bild konnte nicht generiert werden. Bitte lade die Seite neu und versuche es erneut.");
        }
      });
    }
  });