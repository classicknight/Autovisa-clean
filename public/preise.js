// Highlight-Logik für ausgewählte Tarife
document.addEventListener("DOMContentLoaded", () => {
    function setupTarifGrid(gridId) {
      const grid = document.getElementById(gridId);
      if (!grid) return;
      
      grid.querySelectorAll(".tarif-box").forEach(box => {
        box.addEventListener("click", () => {
          grid.querySelectorAll(".tarif-box").forEach(b => b.classList.remove("selected"));
          box.classList.add("selected");
        });
      });
    }
    
    setupTarifGrid("tarifGrid"); // Händler
    setupTarifGrid("privatTarifGrid"); // Privat
  });