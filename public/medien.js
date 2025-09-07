// ===== Globale Zustände =====
let globalImageFiles = [];
let globalVideoFiles = [];

// ===== Uploader mit Preview, Reorder, Remove =====
function setupUpload(boxId, inputId, previewId, isVideo = false, maxFiles = 20) {
  const box     = document.getElementById(boxId);
  const input   = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!box || !input || !preview) return null;

  const MAX_VIDEO_SEC = 30;

  let files = [];
  let hauptbildIndex = 0;

  // Klick öffnet Dateiauswahl
  box.addEventListener("click", () => input.click());

  // Drag & Drop
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

  // File picker
  input.addEventListener("change", () => handleFiles([...input.files]));

  function handleFiles(newFiles) {
    const valid = newFiles.filter(f =>
      isVideo ? f.type.startsWith("video/") : f.type.startsWith("image/")
    );
    if (!valid.length) return;

    if (!isVideo) {
      // Bilder: Limit beachten
      const rest = Math.max(0, maxFiles - files.length);
      const toAdd = valid.slice(0, rest);
      if (toAdd.length < valid.length) {
        safeToast(`Maximal ${maxFiles} Bilder erlaubt. Überschüssige Dateien wurden ignoriert.`, "error");
      }
      files.push(...toAdd);
      globalImageFiles = [...files];
      renderPreview();
    } else {
      // Video: genau 1, max. 30s – nimm die erste gültige Datei
      const candidate = valid[0];
      const tmpUrl = URL.createObjectURL(candidate);
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.src = tmpUrl;
      probe.onloadedmetadata = () => {
        URL.revokeObjectURL(tmpUrl);
        if (probe.duration > MAX_VIDEO_SEC) {
          safeToast(`"${candidate.name}" ist länger als ${MAX_VIDEO_SEC} Sekunden.`, "error");
          return;
        }
        files = [candidate];
        globalVideoFiles = [...files];
        renderPreview();
      };
      probe.onerror = () => {
        URL.revokeObjectURL(tmpUrl);
        safeToast(`"${candidate.name}" konnte nicht geprüft werden.`, "error");
      };
    }
  }

  // Vor dem Neu-Rendern alte blob:-URLs aufräumen
  function revokeOldBlobURLs() {
    [...preview.children].forEach(node => {
      const url = node?.dataset?.blobUrl;
      if (url && url.startsWith("blob:")) {
        try { URL.revokeObjectURL(url); } catch {}
      }
    });
  }

  function renderPreview() {
    revokeOldBlobURLs();
    preview.innerHTML = "";

    files.forEach((file, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "media-item";
      wrapper.setAttribute("draggable", "true");
      wrapper.dataset.index = String(index);

      // Quelle bestimmen
      let url = "";
      let isBlob = false;
      if (file.serverPath) {
        url = file.serverPath; // bereits auf dem Server
      } else {
        url = URL.createObjectURL(file);
        isBlob = true;
      }
      if (isBlob) wrapper.dataset.blobUrl = url;

      // Media-Element
      const media = document.createElement(isVideo ? "video" : "img");
      media.src = url;
      if (isVideo) {
        media.controls = true;
        media.playsinline = true;
      }
      media.className = "preview-thumb";

      // Hauptbild-Badge
      const mainBadge = document.createElement("div");
      mainBadge.className = "main-badge";
      mainBadge.textContent = "Titelbild";
      if (index !== hauptbildIndex) mainBadge.style.display = "none";

      // Entfernen-Button
      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.type = "button";
      removeBtn.title = "Entfernen";
      removeBtn.setAttribute("aria-label", "Datei entfernen");
      removeBtn.innerHTML = "&times;";
      removeBtn.addEventListener("click", () => {
        files.splice(index, 1);
        if (index === hauptbildIndex) {
          hauptbildIndex = 0;
        } else if (index < hauptbildIndex) {
          hauptbildIndex--;
        }
        if (isVideo) globalVideoFiles = [...files];
        else globalImageFiles = [...files];
        renderPreview();
      });

      // Doppelklick → Hauptbild setzen
      wrapper.addEventListener("dblclick", () => {
        hauptbildIndex = index;
        renderPreview();
      });

      // Drag & Drop Reorder
      wrapper.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", String(index));
        wrapper.classList.add("dragging");
      });
      wrapper.addEventListener("dragend", () => wrapper.classList.remove("dragging"));
      wrapper.addEventListener("dragover", (e) => e.preventDefault());
      wrapper.addEventListener("drop", (e) => {
        e.preventDefault();
        const fromIndex = Number(e.dataTransfer.getData("text/plain"));
        const toIndex = index;
        if (fromIndex === toIndex) return;

        const [moved] = files.splice(fromIndex, 1);
        files.splice(toIndex, 0, moved);

        if (hauptbildIndex === fromIndex) {
          hauptbildIndex = toIndex;
        } else if (fromIndex < hauptbildIndex && toIndex >= hauptbildIndex) {
          hauptbildIndex--;
        } else if (fromIndex > hauptbildIndex && toIndex <= hauptbildIndex) {
          hauptbildIndex++;
        }

        if (isVideo) globalVideoFiles = [...files];
        else globalImageFiles = [...files];

        renderPreview();
      });

      wrapper.appendChild(media);
      wrapper.appendChild(mainBadge);
      wrapper.appendChild(removeBtn);
      preview.appendChild(wrapper);
    });
  }

  // API nach außen, damit wir Server-Dateien sauber setzen können
  function setServerFiles(paths) {
    if (!Array.isArray(paths)) return;
    files = paths.map((p, i) => ({
      serverPath: p,
      // grobe Fallback-Typen
      type: isVideo ? "video/mp4" : "image/jpeg",
      name: isVideo ? `server-video-${i}.mp4` : `server-image-${i}.jpg`
    }));
    if (isVideo) globalVideoFiles = [...files];
    else globalImageFiles = [...files];
    hauptbildIndex = 0;
    renderPreview();
  }

  function getFiles() {
    return [...files];
  }

  return { setServerFiles, getFiles };
}

// ===== Seite initialisieren =====
window.addEventListener("DOMContentLoaded", async () => {
  // 🔐 Login prüfen (httpOnly Cookie)
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

  // Uploader aktivieren (und API referenzieren)
  const imageUploader = setupUpload("image-upload-box", "image-input", "image-preview", false, 20);
  const videoUploader = setupUpload("video-upload-box", "video-input", "video-preview", true, 1);

  // Bereits gespeicherte Medien laden (zur Anzeige)
  await preloadExistingMedia({ imageUploader, videoUploader });

  // Speichern-Handler
  const saveBtn = document.getElementById("saveMedia");
  const loader  = document.getElementById("upload-loader"); // Overlay
  saveBtn?.addEventListener("click", async () => {
    saveBtn.disabled = true;
    if (loader) {
      loader.classList.remove("hidden");
      loader.setAttribute("aria-busy", "true");
      document.body.classList.add("is-loading");
    }

    // Mindestens 1 Bild ODER 1 Video (gesamt) verlangen
    const hasImgs = (imageUploader?.getFiles()?.length || 0) > 0;
    const hasVid  = (videoUploader?.getFiles()?.length || 0) > 0;
    if (!hasImgs && !hasVid) {
      safeToast("Bitte mindestens ein Bild oder ein Video hochladen.", "error");
      saveBtn.disabled = false;
      if (loader) {
        loader.classList.add("hidden");
        loader.removeAttribute("aria-busy");
        document.body.classList.remove("is-loading");
      }
      return;
    }

    const fd = new FormData();
    // Nur NEUE Dateien hochladen (serverPath = bereits vorhanden)
    globalImageFiles.forEach(f => { if (!f.serverPath) fd.append("images", f); });
    globalVideoFiles.forEach(f => { if (!f.serverPath) fd.append("video",  f); });

    try {
      const res  = await fetch("/saveMedia", { method: "POST", credentials: "include", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        const msg = data?.error || "Fehler beim Speichern der Medien.";
        throw new Error(msg);
      }

      // ✅ Erfolg: Step 3 abhaken + Toast + Redirect
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
      if (loader) {
        loader.classList.add("hidden");
        loader.removeAttribute("aria-busy");
        document.body.classList.remove("is-loading");
      }
    }
  });
});

// ===== Bereits gespeicherte Medien nachladen =====
async function preloadExistingMedia({ imageUploader, videoUploader }) {
  try {
    const res  = await fetch("/getVehicleData", { credentials: "include" });
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return;

    const last = data[data.length - 1];

    if (Array.isArray(last.images) && last.images.length && imageUploader) {
      imageUploader.setServerFiles(last.images);
    }
    if (last.video && videoUploader) {
      videoUploader.setServerFiles([last.video]);
    }
  } catch (err) {
    console.error("Fehler beim Laden der gespeicherten Medien:", err);
  }
}

// ===== Fallbacks, falls haendler.js nicht auf der Seite ist =====
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
