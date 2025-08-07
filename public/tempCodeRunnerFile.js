let globalImageFiles = [];
let globalVideoFiles = [];

function setupUpload(boxId, inputId, previewId, isVideo = false, maxFiles = 20) {
  const box = document.getElementById(boxId);
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  let files = [];
  let hauptbildIndex = 0;

  box.addEventListener('click', () => input.click());

  box.addEventListener('dragover', (e) => {
    e.preventDefault();
    box.classList.add('drag-over');
  });

  box.addEventListener('dragleave', () => {
    box.classList.remove('drag-over');
  });

  box.addEventListener('drop', (e) => {
    e.preventDefault();
    box.classList.remove('drag-over');
    handleFiles([...e.dataTransfer.files]);
  });

  input.addEventListener('change', () => {
    handleFiles([...input.files]);
  });

  function handleFiles(newFiles) {
    const valid = newFiles.filter(file =>
      isVideo ? file.type.startsWith('video/') : file.type.startsWith('image/')
    );

    if (!isVideo) {
      if (files.length + valid.length > maxFiles) {
        alert(`Maximal ${maxFiles} Bilder erlaubt.`);
        return;
      }
      files.push(...valid);
      globalImageFiles = [...files]; // ✅ Wichtig!
      renderPreview();
    } else {
      valid.forEach(file => {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.src = url;
        video.preload = 'metadata';

        video.onloadedmetadata = () => {
          URL.revokeObjectURL(url);
          if (video.duration > 30) {
            alert(`Das Video "${file.name}" ist länger als 30 Sekunden und kann nicht hochgeladen werden.`);
          } else {
            files = [file]; // Nur 1 gültiges Video speichern
            globalVideoFiles = [...files]; // ✅ Wichtig!
            renderPreview();
          }
        };
      });
    }
  }

  function renderPreview() {
    preview.innerHTML = '';

    files.forEach((file, index) => {
      const container = document.createElement('div');
      container.className = 'media-item';
      container.setAttribute('draggable', true);
      container.dataset.index = index;

      const url = URL.createObjectURL(file);
      const media = document.createElement(isVideo ? 'video' : 'img');
      media.src = url;
      if (isVideo) media.controls = true;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.innerHTML = '&times;';
      removeBtn.onclick = () => {
        files.splice(index, 1);
        if (index === hauptbildIndex) hauptbildIndex = 0;
        else if (index < hauptbildIndex) hauptbildIndex--;
        if (isVideo) globalVideoFiles = [...files];
        else globalImageFiles = [...files];
        renderPreview();
      };

      container.addEventListener('dblclick', () => {
        hauptbildIndex = index;
        renderPreview();
      });

      container.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', index.toString());
        container.classList.add('dragging');
      });

      container.addEventListener('dragend', () => {
        container.classList.remove('dragging');
      });

      container.addEventListener('dragover', (e) => {
        e.preventDefault();
      });

      container.addEventListener('drop', (e) => {
        e.preventDefault();
        const fromIndex = Number(e.dataTransfer.getData('text/plain'));
        const toIndex = index;
        if (fromIndex === toIndex) return;

        const [moved] = files.splice(fromIndex, 1);
        files.splice(toIndex, 0, moved);

        if (hauptbildIndex === fromIndex) hauptbildIndex = toIndex;
        else if (fromIndex < hauptbildIndex && toIndex >= hauptbildIndex) hauptbildIndex--;
        else if (fromIndex > hauptbildIndex && toIndex <= hauptbildIndex) hauptbildIndex++;

        if (isVideo) globalVideoFiles = [...files];
        else globalImageFiles = [...files];

        renderPreview();
      });

      container.appendChild(media);
      container.appendChild(removeBtn);
      preview.appendChild(container);
    });
  }
}

// 🧠 Setup bei DOM-Start
window.addEventListener('DOMContentLoaded', () => {
  fetch("/getNutzerInfo")
    .then(res => res.json())
    .then(data => {
      if (!data.eingeloggt) {
        const ziel = sessionStorage.getItem("verkaeuferTyp") === "haendler" ? "haendler.html" : "privat.html";
        window.location.href = ziel;
        return;
      }

      // ✅ Optional: zusätzliche Prüfung, ob die Rolle zur Seite passt
      const erwarteteRolle = sessionStorage.getItem("verkaeuferTyp") || "privat";
      if (data.rolle !== erwarteteRolle) {
        const fallback = erwarteteRolle === "haendler" ? "haendler.html" : "privat.html";
        window.location.href = fallback;
        return;
      }

      // ✅ Upload-Funktion erst aufrufen, wenn Nutzer gültig ist
      setupUpload('image-upload-box', 'image-input', 'image-preview', false, 20);
      setupUpload('video-upload-box', 'video-input', 'video-preview', true, 1);
    })
    .catch((err) => {
      console.error("Fehler beim Abrufen der Nutzerinfo:", err);
      window.location.href = "index.html";
    });
});


document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch("/getVehicleData");
    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      const lastVehicle = data[data.length - 1];

      // 📷 Bilder einfügen
      if (lastVehicle.images && Array.isArray(lastVehicle.images)) {
        const imagePreview = document.getElementById("image-preview");
        lastVehicle.images.forEach((imgPath, index) => {
          const img = document.createElement("img");
          img.src = imgPath;
          img.classList.add("preview-thumb");
          imagePreview.appendChild(img);

          // ⬅️ Wichtig: Damit die Bilder beim Speichern nicht verloren gehen
          globalImageFiles.push({
            name: `server-image-${index}.jpg`,
            type: "image/jpeg",
            serverPath: imgPath
          });
        });
      }

      // 🎥 Video einfügen
      if (lastVehicle.video) {
        const videoPreview = document.getElementById("video-preview");
        const video = document.createElement("video");
        video.src = lastVehicle.video;
        video.controls = true;
        video.classList.add("preview-thumb");
        videoPreview.appendChild(video);

        globalVideoFiles.push({
          name: "server-video.mp4",
          type: "video/mp4",
          serverPath: lastVehicle.video
        });
      }
    }
  } catch (error) {
    console.error("Fehler beim Laden der gespeicherten Medien:", error);
  }

  document.getElementById('saveMedia').addEventListener('click', () => {
    console.log("🔘 Speichern-Button wurde geklickt");

    const videoPreview = document.getElementById('video-preview');
    const videoCount = videoPreview.querySelectorAll('video').length;

    if (videoCount === 0 && globalVideoFiles.length === 0) {
      alert('Bitte lade mindestens ein Video hoch.');
      return;
    }

    const formData = new FormData();

    // ✅ Nur neue Dateien senden, nicht die mit serverPath
    globalImageFiles.forEach(file => {
      if (!file.serverPath) formData.append("images", file);
    });

    globalVideoFiles.forEach(file => {
      if (!file.serverPath) formData.append("video", file);
    });

    console.log("📤 Sende Daten an /saveMedia ...");

    fetch("/saveMedia", {
        method: "POST",
        body: formData
      })
        .then(async (res) => {
          const text = await res.text();
          console.log("📥 Antwort von Server:", text);
      
          if (res.ok) {
            console.log("✅ Upload erfolgreich, weiter zur nächsten Seite");
            const userRole = localStorage.getItem("userRole");
            const ziel = userRole === "haendler" ? "haendler.html" : "privat.html";
            window.location.href = ziel;
          } else {
            console.error("❌ Fehler beim Speichern:", text);
            alert("Beim Speichern ist ein Fehler aufgetreten.");
          }
        })
        .catch((err) => {
          console.error("❌ Netzwerkfehler beim Hochladen:", err);
          alert("Netzwerkfehler beim Hochladen.");
        });
      
  });
});
