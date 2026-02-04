// nachricht.js – Einzel-Chat (Thread)  ✅ BEREINIGT

// ------- Helpers ------- //
const $ = (s, r=document) => r.querySelector(s);
const qs = new URLSearchParams(location.search);
const fahrzeugId = qs.get("fahrzeugId");
const user1 = qs.get("user1");
const user2 = qs.get("user2");

function fmtEUR(v){
  if (v == null || v === "") return "";
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/\./g,"").replace(",","."));
  return isNaN(n) ? String(v) : n.toLocaleString("de-DE") + " €";
}
function when(iso){
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("de-DE", { hour:"2-digit", minute:"2-digit" });
}
function escapeHTML(s){
  return String(s)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

// ------- API ------- //
async function getMe(){
  const r = await fetch("/getNutzerInfo", { credentials:"include" });
  const j = await r.json();
  if (!j?.eingeloggt || !j?.nutzerId){
    alert("Bitte erst einloggen.");
    location.href = "login.html";
    throw new Error("Not logged in");
  }
  return j;
}

async function loadCar(fid){
  try{
    const r = await fetch(`/inserat-details/${encodeURIComponent(fid)}`, { credentials:"include" });
    if (!r.ok) return null;
    return await r.json();
  }catch{ return null; }
}

async function loadChat(u1, u2, fid){
  const url = `/chat?user1=${encodeURIComponent(u1)}&user2=${encodeURIComponent(u2)}&fahrzeugId=${encodeURIComponent(fid)}`;
  const r = await fetch(url, { credentials:"include" });
  if (!r.ok) throw new Error("Chat konnte nicht geladen werden.");
  return await r.json();
}

async function markThreadRead(u1, u2, fid){
  try{
    await fetch("/chat/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ user1: u1, user2: u2, fahrzeugId: fid })
    });
  }catch{}
}

async function sendMessage({ empfaengerId, fahrzeugId, absenderName, nachricht }){
  const r = await fetch("/nachricht-senden", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ empfaengerId, fahrzeugId, absenderName, nachricht })
  });
  if (!r.ok){
    const t = await r.text().catch(()=> "");
    console.error("Senden fehlgeschlagen:", r.status, t);
    throw new Error(t || "Senden fehlgeschlagen");
  }
  return await r.json();
}

// ------- Rendering ------- //
function setHeader(car){
  const img = (Array.isArray(car?.images) && car.images[0]) ? car.images[0] : "";
  $("#car-img").src = img || "placeholder.png";
  $("#car-img").alt = car?.titel || "Fahrzeug";
  $("#car-title").textContent = car?.titel || "Fahrzeug";
  const preis = car?.verkauf_brutto ?? car?.verkauf_preis ?? car?.preis;
  $("#car-price").textContent = fmtEUR(preis) || "";
}

function messageHTML(msg, meId){
  const mine = msg.senderId === meId;
  const who = mine ? "Ich" : (msg.absenderName || "Nutzer");
  const safe = escapeHTML(msg.nachricht || "");
  return `
    <div class="message ${mine ? "from-me" : "from-other"}">
      <p>${safe}</p>
      <span>${who}, ${when(msg.zeit)}</span>
    </div>
  `;
}

function renderMessages(list, meId){
  const box = $("#chat-messages");
  box.innerHTML = list.map(m => messageHTML(m, meId)).join("");
  box.scrollTop = box.scrollHeight;
}

function isNearBottom(el){ return (el.scrollHeight - el.scrollTop - el.clientHeight) < 48; }

// ------- Live-Logik ------- //
let me, otherId;
let lastRenderedCount = 0;
let pollTimer = null;

async function init(){
  if (!fahrzeugId || !user1 || !user2){
    alert("Ungültiger Chat-Link.");
    history.back();
    return;
  }

  me = await getMe();
  otherId = (me.nutzerId === user1) ? user2 : user1;

  // Header (falls Endpoint existiert)
  const car = await loadCar(fahrzeugId);
  if (car) setHeader(car);

  // Initial laden + Polling
  await refreshChat(true);
  startPolling();

  bindForm();
}

async function refreshChat(forceScroll){
  try{
    const list = await loadChat(user1, user2, fahrzeugId);
    const box = $("#chat-messages");
    const stick = forceScroll || isNearBottom(box);

    renderMessages(list, me.nutzerId);

    if (stick || list.length !== lastRenderedCount){
      box.scrollTop = box.scrollHeight;
    }
    lastRenderedCount = list.length;

    const hasUnread = list.some(m => m.empfaengerId === me.nutzerId && !m.gelesen);
    if (hasUnread) {
      await markThreadRead(user1, user2, fahrzeugId);
    }
  }catch(e){
    console.error(e);
  }
}

function startPolling(){
  stopPolling();
  pollTimer = setInterval(()=> refreshChat(false), 5000);
}
function stopPolling(){
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

// ------- Senden ------- //
function bindForm(){
  const form = $("#chat-form");
  const input = $("#chat-input");
  const box = $("#chat-messages");

  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    // Optimistisch anhängen
    const optimistic = {
      senderId: me.nutzerId,
      empfaengerId: otherId,
      fahrzeugId,
      absenderName: me.name || me.vorname || "Ich",
      nachricht: text,
      zeit: new Date().toISOString()
    };
    box.insertAdjacentHTML("beforeend", messageHTML(optimistic, me.nutzerId));
    box.scrollTop = box.scrollHeight;
    input.value = "";

    try{
      await sendMessage({
        empfaengerId: otherId,
        fahrzeugId,
        absenderName: me.name || me.vorname || "Ich",
        nachricht: text
      });
      await refreshChat(true); // echten Stand ziehen
    }catch(err){
      alert("Nachricht konnte nicht gesendet werden.");
      await refreshChat(true);
    }
  });
}

// Tab-Wechsel: Poll pausieren
document.addEventListener("visibilitychange", ()=>{
  if (document.hidden) stopPolling(); else startPolling();
});

document.addEventListener("DOMContentLoaded", init);















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
  
  // ===== Auth + Guards =====
  const authLi = document.getElementById("auth-link");
  const authLoginHTML = authLi ? authLi.innerHTML : "";

  const savedCarsLink = document.getElementById("saved-cars-link");
  const myCarsLink = document.getElementById("my-cars-link");
  const soldCarsLink = document.getElementById("sold-cars-link");
  const messagesLink = document.getElementById("messages-link");

  const mobileSaved = document.getElementById("mobile-saved");
  const mobileMessages = document.getElementById("mobile-messages");

  const closeMenu = () => {
    navLinks?.classList.remove("active");
    hamburger?.setAttribute("aria-expanded", "false");
    closeAllDropdowns();
  };

  function checkLoginAndRedirect(targetUrl) {
    fetch("/getNutzerInfo", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.eingeloggt) {
          window.location.href = targetUrl;
        } else {
          localStorage.setItem("redirectAfterLogin", targetUrl);
          window.location.href = "login.html";
        }
      })
      .catch(() => {
        localStorage.setItem("redirectAfterLogin", targetUrl);
        window.location.href = "login.html";
      });
  }

  const bindGuard = (el, url) => {
    if (!el) return;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      closeMenu();
      checkLoginAndRedirect(url);
    });
  };

  bindGuard(savedCarsLink, "übersicht.html#saved-cars");
  bindGuard(myCarsLink, "übersicht.html#car-list");
  bindGuard(soldCarsLink, "übersicht.html#sold-cars");
  bindGuard(messagesLink, "übersicht.html#messages-list");
  bindGuard(mobileSaved, "übersicht.html#saved-cars");
  bindGuard(mobileMessages, "übersicht.html#messages-list");

  const clearAuthStorage = () => {
    ["isLoggedIn", "userRole", "userId"].forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem("redirectAfterLogin");
  };

  const clearAuthFlags = () => {
    ["isLoggedIn", "userRole", "userId"].forEach((k) => localStorage.removeItem(k));
  };

  function renderLogin() {
    if (!authLi) return;
    authLi.innerHTML = authLoginHTML;
  }

  function renderLogout() {
    if (!authLi) return;
    authLi.innerHTML = `
      <a href="#" id="logout-link">
        <i class="fas fa-sign-out-alt"></i> Abmelden
      </a>
    `;
    const logoutLink = document.getElementById("logout-link");
    if (logoutLink) {
      logoutLink.addEventListener("click", (e) => {
        e.preventDefault();
        closeMenu();
        fetch("/logout", { method: "POST", credentials: "include" })
          .finally(() => {
            clearAuthStorage();
            window.location.href = "index.html";
          });
      });
    }
  }

  if (authLi) {
    const isLoggedInLS = localStorage.getItem("isLoggedIn") === "true";
    if (isLoggedInLS) {
      renderLogout();
    }
  }

  fetch("/getNutzerInfo", { credentials: "include" })
    .then((res) => res.json())
    .then((data) => {
      if (data?.eingeloggt) {
        try {
          localStorage.setItem("isLoggedIn", "true");
          const roleValue = data?.role || data?.rolle;
          if (roleValue) localStorage.setItem("userRole", String(roleValue));
          const userIdValue = data?.id || data?._id || data?.userId || data?.nutzerId;
          if (userIdValue) localStorage.setItem("userId", String(userIdValue));
        } catch {}
        renderLogout();
      } else {
        clearAuthFlags();
        renderLogin();
      }
    })
    .catch(() => {});

  // ===== Smooth Scroll =====
  const searchLink = document.querySelector('a[href="#search-section"]');
  if (searchLink) {
    searchLink.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector("#search-section")?.scrollIntoView({ behavior: "smooth" });
    });
  }
});
