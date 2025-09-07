// ===== Globale Zustände =====
let globalImageFiles = [];
let globalVideoFiles = [];
let hasDraft = false; // <— NEU

async function ensureDraftExists() {
  try {
    const r = await fetch("/getVehicleData", { credentials: "include" });
    const list = await r.json();
    hasDraft = Array.isArray(list) && list.length > 0;
    return hasDraft;
  } catch {
    hasDraft = false;
    return false;
  }
}

// ===== Uploader mit Preview, Reorder, Remove =====
function setupUpload(boxId, inputId, previewId, isVideo = false, maxFiles = 20) {
  const box = document.getElementById(boxId);
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);

  let files = [];
  let hauptbildIndex = 0;

  box.addEventListener("click", () => input.click());

  box.addEventListener("dragover", (e) => {
    e.preventDefault();
    box.classList.add("drag-over");
  });
  box.addEventListener("dragleave", () => box.classList.remove("drag-over"));
  box.addEventListener("drop", (e) => {
    e.preventDefault();
    box.classList.remove("drag-over");
    handleFiles([...e.dataTransfer.files]);
  });

  input.addEventListener("change", () => handleFiles([...input.files]));

  function handleFiles(newFiles) {
    const valid = newFiles.filter(f =>
      isVideo ? f.type.startsWith("video/") : f.type.startsWith("image/")
    );

    if (!isVideo) {
      if (files.length + valid.length > maxFiles) {
        safeToast(`Maximal ${maxFiles} Bilder erlaubt.`, "error");
        return;
      }
      files.push(...valid);
      globalImageFiles = [...files];
      renderPreview();
    } else {
      // nur 1 Video, max. 30s
      valid.forEach(file => {
        const url = URL.createObjectURL(file);
        const videoProbe = document.createElement("video");
        videoProbe.src = url;
        videoProbe.preload = "metadata";
        videoProbe.onloadedmetadata = () => {
          URL.revokeObjectURL(url);
          if (videoProbe.duration > 30) {
            safeToast(`"${file.name}" ist länger als 30 Sekunden.`, "error");
          } else {
            files = [file];
            globalVideoFiles = [...files];
            renderPreview();
          }
        };
      });
    }
  }

  function renderPreview() {
    preview.innerHTML = "";
    files.forEach((file, index) => {
      const container = document.createElement("div");
      container.className = "media-item";
      container.setAttribute("draggable", true);
      container.dataset.index = index;

      const url = URL.createObjectURL(file);
      const media = document.createElement(isVideo ? "video" : "img");
      media.src = url;
      if (isVideo) media.controls = true;

      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.innerHTML = "&times;";
      removeBtn.onclick = () => {
        files.splice(index, 1);
        if (index === hauptbildIndex) hauptbildIndex = 0;
        else if (index < hauptbildIndex) hauptbildIndex--;
        if (isVideo) globalVideoFiles = [...files];
        else globalImageFiles = [...files];
        renderPreview();
      };

      container.addEventListener("dblclick", () => { hauptbildIndex = index; });

      container.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", index.toString());
        container.classList.add("dragging");
      });
      container.addEventListener("dragend", () => container.classList.remove("dragging"));
      container.addEventListener("dragover", (e) => e.preventDefault());
      container.addEventListener("drop", (e) => {
        e.preventDefault();
        const fromIndex = Number(e.dataTransfer.getData("text/plain"));
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

// ===== Seite initialisieren =====
window.addEventListener("DOMContentLoaded", async () => {
  // 🔐 Login prüfen
  try {
    const info = await fetch("/getNutzerInfo", { credentials: "include" }).then(r => r.json());
    if (!info?.eingeloggt) {
      try { localStorage.setItem("redirectAfterLogin", "medien.html"); } catch {}
      window.location.href = "login.html";
      return;
    }
  } catch {
    try { localStorage.setItem("redirectAfterLogin", "medien.html"); } catch {}
    window.location.href = "login.html";
    return;
  }

  // Bevor irgendwas – sicherstellen, dass es einen Entwurf gibt
  const draftOk = await ensureDraftExists();
  if (!draftOk) {
    safeToast("Bitte zuerst die Fahrzeugdaten (Schritt 1) speichern.", "error");
    setTimeout(() => { window.location.href = "fahrzeugdaten.html"; }, 900);
    return;
  }

  // Uploader aktivieren
  setupUpload("image-upload-box", "image-input", "image-preview", false, 20);
  setupUpload("video-upload-box", "video-input", "video-preview", true, 1);

  // Bereits gespeicherte Medien laden (zur Anzeige)
  await preloadExistingMedia();

  // Speichern-Handler
  const saveBtn = document.getElementById("saveMedia");
  const loader = document.getElementById("upload-loader");
  saveBtn?.addEventListener("click", async () => {
    // Guard auch hier, falls Seite lange offen war und Entwurf zwischendurch gelöscht wurde
    if (!(await ensureDraftExists())) {
      safeToast("Kein Fahrzeugentwurf gefunden. Bitte Schritt 1 speichern.", "error");
      return;
    }

    saveBtn.disabled = true;
    if (loader) loader.classList.remove("hidden");

    const hasImgs = document.getElementById("image-preview")?.querySelectorAll("img")?.length > 0 || globalImageFiles.length > 0;
    const hasVid  = document.getElementById("video-preview")?.querySelectorAll("video")?.length > 0 || globalVideoFiles.length > 0;
    if (!hasImgs && !hasVid) {
      safeToast("Bitte mindestens ein Bild oder ein Video hochladen.", "error");
      saveBtn.disabled = false;
      if (loader) loader.classList.add("hidden");
      return;
    }

    const fd = new FormData();
    globalImageFiles.forEach(f => { if (!f.serverPath) fd.append("images", f); });
    globalVideoFiles.forEach(f => { if (!f.serverPath) fd.append("video",  f); });

    try {
      const res = await fetch("/saveMedia", {
        method: "POST",
        credentials: "include",
        body: fd
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        const msg = data?.error || "Fehler beim Speichern der Medien.";
        throw new Error(msg);
      }

      safeMarkStepDone(3);
      safeToast(data.message || "Medien gespeichert ✅");

      const userRole = localStorage.getItem("userRole");
      const ziel = userRole === "haendler" ? "haendler.html" : "privat.html";
      setTimeout(() => (window.location.href = ziel), 700);

    } catch (err) {
      console.error("❌ Uploadfehler:", err);
      safeToast(String(err.message || err) || "Upload fehlgeschlagen.", "error");
    } finally {
      saveBtn.disabled = false;
      if (loader) loader.classList.add("hidden");
    }
  });
});

// ===== Bereits gespeicherte Medien nachladen =====
async function preloadExistingMedia() {
  try {
    const res = await fetch("/getVehicleData", { credentials: "include" });
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return;

    const last = data[data.length - 1];

    if (Array.isArray(last.images) && last.images.length) {
      const imagePreview = document.getElementById("image-preview");
      last.images.forEach((imgPath, i) => {
        const img = document.createElement("img");
        img.src = imgPath;
        img.classList.add("preview-thumb");
        imagePreview?.appendChild(img);

        globalImageFiles.push({
          name: `server-image-${i}.jpg`,
          type: "image/jpeg",
          serverPath: imgPath
        });
      });
    }

    if (last.video) {
      const videoPreview = document.getElementById("video-preview");
      const video = document.createElement("video");
      video.src = last.video;
      video.controls = true;
      video.classList.add("preview-thumb");
      videoPreview?.appendChild(video);

      globalVideoFiles.push({
        name: "server-video.mp4",
        type: "video/mp4",
        serverPath: last.video
      });
    }
  } catch (err) {
    console.error("Fehler beim Laden der gespeicherten Medien:", err);
  }
}

// ===== Fallbacks =====
function safeToast(message, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = message;
  container.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    t.addEventListener("transitionend", () => t.remove(), { once: true });
  }, 3000);
}

function safeMarkStepDone(step) {
  try {
    const KEY = "haendlerSteps";
    const obj = JSON.parse(localStorage.getItem(KEY) || "{}");
    obj[String(step)] = true;
    localStorage.setItem(KEY, JSON.stringify(obj));
  } catch {}
  if (window.markStepDone) {
    try { window.markStepDone(step); } catch {}
  }
}











  document.getElementById("backToOverview")?.addEventListener("click", () => {
    const role = localStorage.getItem("userRole");
    window.location.href = role === "haendler" ? "haendler.html" : "privat.html";
  });

