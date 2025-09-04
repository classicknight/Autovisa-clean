// chat.js – Chat-Übersicht (nur Liste von Threads, kein Schreiben)

// ---------- Helpers ----------
const $ = (s, r=document) => r.querySelector(s);

function fmtEUR(v){
  if (v == null || v === "") return "";
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/\./g,"").replace(",","."));
  return isNaN(n) ? String(v) : n.toLocaleString("de-DE") + " €";
}
function shortId(id){ return (id||"").slice(0,6) + "…"; }
function timeDesc(iso){
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("de-DE", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
}

// ---------- API ----------
async function getMe(){
  const r = await fetch("/getNutzerInfo", { credentials:"include" });
  const j = await r.json();
  if (!j?.eingeloggt || !j?.nutzerId) throw new Error("Nicht eingeloggt");
  return j; // {nutzerId, name?}
}

// Optionaler, „schöner“ Endpoint: versucht beide Richtungen zu laden.
// Fallback: nur empfangene Nachrichten.
async function loadAllMessagesFor(userId){
  try{
    const t = await fetch("/meine-nachrichten", { credentials:"include" });
    if (t.ok) return await t.json(); // [{...Nachricht}]
  }catch(_){}
  const r = await fetch(`/nachrichten/${encodeURIComponent(userId)}`, { credentials:"include" });
  if (!r.ok) throw new Error("Konnte Nachrichten nicht laden");
  return await r.json();
}

async function loadInserat(fid){
  try{
    const r = await fetch(`/inserat-details/${encodeURIComponent(fid)}`, { credentials:"include" });
    if (!r.ok) return null;
    return await r.json();
  }catch{ return null; }
}

// ---------- Thread-Bildung ----------
function groupThreads(messages, meId){
  const map = new Map();
  for (const m of messages){
    const otherId = (m.senderId === meId) ? m.empfaengerId : m.senderId;
    const key = `${otherId}::${m.fahrzeugId}`;
    if (!map.has(key)) map.set(key, { otherId, fahrzeugId: m.fahrzeugId, items: [] });
    map.get(key).items.push(m);
  }

  const threads = [];
  for (const t of map.values()){
    t.items.sort((a,b)=> new Date(a.zeit) - new Date(b.zeit));
    const last = t.items[t.items.length-1];
    const unread = t.items.filter(x => !x.gelesen && x.empfaengerId === meId).length;
    const lastFromOther = last.senderId !== meId;
    const nameForPreview = lastFromOther ? (last.absenderName || `Nutzer ${shortId(t.otherId)}`) : "Du";

    threads.push({
      otherId: t.otherId,
      fahrzeugId: t.fahrzeugId,
      last,
      unread,
      previewName: nameForPreview
    });
  }

  threads.sort((a,b)=> new Date(b.last.zeit) - new Date(a.last.zeit));
  return threads;
}

// ---------- Rendering ----------
function threadHTML({car, thread, meId}){
  const titel = car?.titel || "Unbekanntes Fahrzeug";
  const brutto = (car?.verkauf_brutto ?? car?.verkauf_preis ?? car?.preis);
  const preis = fmtEUR(brutto);
  const carTitleLine = preis ? `${titel} • ${preis}` : titel;

  const img = (Array.isArray(car?.images) && car.images[0]) ? car.images[0] : "";
  const previewText = (thread.last?.nachricht || "").split("\n").slice(0,2).join(" ");
  const previewName = thread.previewName;
  const stamp = timeDesc(thread.last?.zeit);
  const unreadBadge = thread.unread > 0 ? ` <span class="unread-badge">+${thread.unread}</span>` : "";

  // WICHTIG: Seite heißt "Nachricht.html"
  const openUrl = `nachricht.html?user1=${encodeURIComponent(meId)}&user2=${encodeURIComponent(thread.otherId)}&fahrzeugId=${encodeURIComponent(thread.fahrzeugId)}`;

  return `
  <div class="chat-card" data-thread="${thread.otherId}::${thread.fahrzeugId}">
    <div class="chat-media">
      ${img ? `<img src="${img}" alt="Auto" />` : `<div style="width:80px;height:60px;background:#e9eef5;border-radius:8px;"></div>`}
    </div>
    <div class="chat-info">
      <h2 class="chat-car-title">${carTitleLine}</h2>
      <p class="chat-message-preview"><strong>${previewName}:</strong> ${previewText || "…"}</p>
      <small class="chat-time">${stamp}${unreadBadge}</small>
    </div>
  </div>
  <div class="chat-buttons">
    <a href="${openUrl}" class="open-chat-btn"><i class="fas fa-comments"></i> Chat öffnen</a>
    <button class="delete-chat-btn" data-other="${thread.otherId}" data-fid="${thread.fahrzeugId}">
      <i class="fas fa-trash-alt"></i> Chat löschen
    </button>
  </div>`;
}

async function renderChatList(){
  const container = $("#chat-list");
  if (!container) return;

  try{
    const me = await getMe();
    const all = await loadAllMessagesFor(me.nutzerId);
    if (!Array.isArray(all) || all.length === 0){
      container.innerHTML = `<p>Keine Chats vorhanden.</p>`;
      return;
    }

    const threads = groupThreads(all, me.nutzerId);

    // Fahrzeuginfos einmalig laden
    const uniqueFids = [...new Set(threads.map(t=>t.fahrzeugId))];
    const detailsMap = new Map();
    await Promise.all(uniqueFids.map(async fid=>{
      detailsMap.set(fid, await loadInserat(fid));
    }));

    container.innerHTML = threads.map(th=>{
      const car = detailsMap.get(th.fahrzeugId) || null;
      return threadHTML({ car, thread: th, meId: me.nutzerId });
    }).join("");

  }catch(err){
    console.error(err);
    container.innerHTML = `<p>Fehler beim Laden der Chats.</p>`;
  }
}

// ---------- Events ----------
document.addEventListener("DOMContentLoaded", () => {
  renderChatList();

  // „Chat löschen“ – aktuell nur UI-Entfernung
  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest(".delete-chat-btn");
    if (!btn) return;
    const other = btn.dataset.other;
    const fid = btn.dataset.fid;
    if (!confirm("Diesen Chat aus der Übersicht entfernen?")) return;

    const key = `${other}::${fid}`;
    const card = document.querySelector(`.chat-card[data-thread="${key}"]`);
    const btns = card?.nextElementSibling;
    card?.remove();
    if (btns?.classList.contains("chat-buttons")) btns.remove();

    // Optional: Server-Archivierung auslösen
    // fetch(`/chat-thread/${encodeURIComponent(other)}/${encodeURIComponent(fid)}/archiv`, {method:"POST", credentials:"include"});
  });
});

  
  
  
  
  
  
  
  













document.addEventListener("DOMContentLoaded", () => {
  const navLinks = document.getElementById("nav-links");
  const hamburger = document.getElementById("hamburger");
  const dropdownLinks = document.querySelectorAll(".dropdown > a");
  const dropdownLis = document.querySelectorAll(".dropdown");
  
  // ===== Helpers =====
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  
  function closeAllDropdowns(except = null) {
    dropdownLis.forEach(li => {
      if (li !== except) {
        li.classList.remove("open");
        const trigger = li.querySelector('a[aria-haspopup="true"]');
        const menu = li.querySelector(".dropdown-menu");
        if (trigger) trigger.setAttribute("aria-expanded", "false");
        if (menu) {
          menu.classList.remove("show");
          menu.style.left = "";
          // Reset Stagger
          [...menu.children].forEach(item => (item.style.transitionDelay = ""));
        }
      }
    });
  }
  
  function positionMenu(li) {
    const trigger = li.querySelector('a[aria-haspopup="true"]');
    const menu = li.querySelector('.dropdown-menu');
    if (!trigger || !menu) return;
    
    // sichtbar messen
    const tRect = trigger.getBoundingClientRect();
    const mRect = menu.getBoundingClientRect();
    const liRect = li.getBoundingClientRect(); // <-- relativer Bezug zum LI
    const vw = window.innerWidth;
    
    // Ziel: Menü zentriert unter dem Pill, am Viewport geclamped (16px Rand)
    const center = tRect.left + tRect.width / 2;
    let leftAbs = center - mRect.width / 2;
    leftAbs = Math.max(16, Math.min(leftAbs, vw - mRect.width - 16));
    
    // in LI-Koordinaten umrechnen
    const relativeLeft = leftAbs - liRect.left;
    menu.style.left = `${relativeLeft}px`;
  }
  
  function openDropdown(trigger) {
  const li = trigger.closest(".dropdown");
  const menu = trigger.nextElementSibling;
  closeAllDropdowns(li);
  
  li.classList.add("open");
  trigger.setAttribute("aria-expanded", "true");
  menu.classList.add("show");
  
  // Stagger
  [...menu.children].forEach((item, i) => {
    item.style.transitionDelay = `${i * 25}ms`;
  });
  
  // Nur auf Desktop zentrieren
  const isMobile = window.matchMedia("(max-width: 900px)").matches;
  if (!isMobile) requestAnimationFrame(() => positionMenu(li));
}
  
  function toggleDropdown(trigger) {
    const li = trigger.closest(".dropdown");
    const menu = trigger.nextElementSibling;
    const isOpen = li.classList.contains("open");
    if (isOpen) {
      closeAllDropdowns();
    } else {
      openDropdown(trigger);
    }
  }
  
  // ===== Hamburger =====
  hamburger.addEventListener("click", (e) => {
    e.stopPropagation();
    navLinks.classList.toggle("active");
    closeAllDropdowns(); // immer schließen
    hamburger.setAttribute(
      "aria-expanded",
      navLinks.classList.contains("active") ? "true" : "false"
    );
  });
  
  // ===== Dropdown Click =====
  dropdownLinks.forEach(link => {
    // ARIA init
    link.setAttribute("aria-expanded", "false");
    
    link.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleDropdown(link);
    });
  });
  
  // ===== Optional Desktop Hover (kein Touch) =====
  const isCoarse = matchMedia("(pointer: coarse)").matches;
  if (!isCoarse) {
    dropdownLis.forEach(li => {
      const trigger = li.querySelector('a[aria-haspopup="true"]');
      const menu = li.querySelector(".dropdown-menu");
      if (!trigger || !menu) return;
      
      li.addEventListener("mouseenter", () => openDropdown(trigger));
      li.addEventListener("mouseleave", () => closeAllDropdowns());
    });
  }
  
  // ===== Outside Click schließt =====
  document.addEventListener("click", () => {
    navLinks.classList.remove("active");
    closeAllDropdowns();
  });
  
  // ===== Reposition on resize/scroll =====
  const repositionOpen = () =>
    document.querySelectorAll(".dropdown.open").forEach(positionMenu);
  window.addEventListener("resize", repositionOpen);
  window.addEventListener("scroll", repositionOpen);
  
  // ===== Login-Handling (dein bestehender Code) =====
  const isLoggedIn = false; // später dynamisch setzen
  const savedCarsLink = document.getElementById("saved-cars-link");
  const myCarsLink = document.getElementById("my-cars-link");
  
  if (savedCarsLink) {
    savedCarsLink.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = isLoggedIn ? "gespeicherte-autos.html" : "login.html";
    });
  }
  if (myCarsLink) {
    myCarsLink.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = isLoggedIn ? "meine-autos.html" : "login.html";
    });
  }
  
  // ===== Smooth Scroll =====
  const searchLink = document.querySelector('a[href="#search-section"]');
  if (searchLink) {
    searchLink.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
    });
  }
});