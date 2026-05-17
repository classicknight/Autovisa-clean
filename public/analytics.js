// GA4 bootstrap + Consent Banner (Autovisa)
(function () {
  var GA_ID = "G-2P3XYPXHYC";
  var CONSENT_KEY = "av_analytics_consent";
  var GA_DISABLE_KEY = "ga-disable-" + GA_ID;

  function injectStyles() {
    if (document.getElementById("cookie-banner-styles")) return;
    var style = document.createElement("style");
    style.id = "cookie-banner-styles";
    style.textContent =
      ".cookie-backdrop{position:fixed;inset:0;z-index:9998;background:rgba(12,18,28,.45);backdrop-filter:saturate(110%) blur(2px);pointer-events:none;}" +
      ".cookie-banner{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(760px,calc(100% - 32px));z-index:9999;background:#fff;color:#111827;padding:28px 30px;border:1px solid #e6edf3;border-radius:18px;box-shadow:0 30px 90px rgba(15,23,42,.35);}" +
      ".cookie-banner .cookie-inner{max-width:1200px;margin:0 auto;display:flex;gap:20px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;}" +
      ".cookie-banner .cookie-copy{max-width:520px;}" +
      ".cookie-header{display:flex;flex-direction:column;gap:6px;margin-bottom:8px;}" +
      ".cookie-brand{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#7b8a95;font-weight:700;}" +
      ".cookie-banner .cookie-title{margin:0;font-size:20px;font-weight:800;color:#0f1f26;}" +
      ".cookie-banner .cookie-text{margin:0;font-size:15px;line-height:1.65;color:#4b5b67;}" +
      ".cookie-banner a{color:#00bfa6;text-decoration:underline;text-underline-offset:3px;}" +
      ".cookie-actions{display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:flex-end;min-width:240px;}" +
      ".cookie-btn{border:none;border-radius:12px;padding:12px 18px;font-weight:700;cursor:pointer;font-size:14px;min-width:160px;}" +
      ".cookie-accept{background:#00bfa6;color:#fff;border:1px solid #00bfa6;box-shadow:0 10px 22px rgba(0,191,166,.28);}" +
      ".cookie-decline{background:#fff;color:#111827;border:1px solid #d6dee7;}" +
      ".cookie-btn:hover{filter:brightness(.98);}" +
      ".cookie-settings-link{background:none;border:none;color:#b7c3ce;font-weight:600;cursor:pointer;padding:0;margin-left:12px;text-decoration:underline;text-underline-offset:3px;font-size:.95rem;}" +
      ".cookie-settings-link:hover{color:#00b8a9;}" +
      ".cookie-settings-wrap{display:flex;align-items:center;gap:6px;}" +
      "@media (max-width:700px){.cookie-banner{width:calc(100% - 24px);padding:20px}.cookie-banner .cookie-inner{gap:12px}.cookie-actions{width:100%;justify-content:flex-start}.cookie-btn{min-width:140px}.cookie-banner .cookie-title{font-size:18px}}";
    document.head.appendChild(style);
  }

  function loadGtag() {
    if (window.__gaLoaded) return;
    window.__gaLoaded = true;
    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;

    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_ID);
    document.head.appendChild(s);

    gtag("js", new Date());
    gtag("config", GA_ID);
  }

  function setConsent(value) {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {}
  }

  function getConsent() {
    try {
      return localStorage.getItem(CONSENT_KEY);
    } catch {
      return null;
    }
  }

  function disableAnalytics() {
    window[GA_DISABLE_KEY] = true;
    // Best effort: delete GA cookies
    var suffix = GA_ID.replace("G-", "");
    var names = ["_ga", "_ga_" + suffix];
    var domains = [location.hostname, "." + location.hostname];
    names.forEach(function (n) {
      domains.forEach(function (d) {
        document.cookie = n + "=; Max-Age=0; path=/; domain=" + d + ";";
      });
    });
  }

  function enableAnalytics() {
    window[GA_DISABLE_KEY] = false;
    loadGtag();
  }

  function removeBanner() {
    var el = document.getElementById("cookie-banner");
    if (el) el.remove();
    var bg = document.getElementById("cookie-backdrop");
    if (bg) bg.remove();
  }

  function showBanner() {
    if (document.getElementById("cookie-banner")) return;
    injectStyles();
    if (!document.getElementById("cookie-backdrop")) {
      var backdrop = document.createElement("div");
      backdrop.id = "cookie-backdrop";
      backdrop.className = "cookie-backdrop";
      document.body.appendChild(backdrop);
    }
    var banner = document.createElement("div");
    banner.id = "cookie-banner";
    banner.className = "cookie-banner";
    banner.innerHTML =
      '<div class="cookie-inner">' +
      '<div class="cookie-copy">' +
      '<div class="cookie-header">' +
      '<span class="cookie-brand">Autovisa</span>' +
      '<div class="cookie-title">Datenschutz & Cookies</div>' +
      '</div>' +
      '<p class="cookie-text">Wir nutzen Cookies, um die Nutzung unserer Website zu analysieren und Autovisa zu verbessern (Google Analytics). Deine Auswahl kannst du jederzeit in den Cookie-Einstellungen ändern. Mehr Infos findest du in der <a href="datenschutz.html">Datenschutzerklärung</a>.</p>' +
      "</div>" +
      '<div class="cookie-actions">' +
      '<button type="button" class="cookie-btn cookie-decline" id="cookie-decline">Nur notwendige</button>' +
      '<button type="button" class="cookie-btn cookie-accept" id="cookie-accept">Akzeptieren</button>' +
      "</div>" +
      "</div>";
    document.body.appendChild(banner);

    var accept = document.getElementById("cookie-accept");
    var decline = document.getElementById("cookie-decline");

    if (accept) {
      accept.addEventListener("click", function () {
        setConsent("granted");
        enableAnalytics();
        removeBanner();
      });
    }
    if (decline) {
      decline.addEventListener("click", function () {
        setConsent("denied");
        disableAnalytics();
        removeBanner();
      });
    }
  }

  function injectSettingsLink() {
    var footer = document.querySelector(".site-footer .footer-bottom .bottom-inner");
    if (!footer || document.getElementById("cookie-settings-link")) return;
    var toTop = footer.querySelector(".to-top");

    var wrap = document.createElement("span");
    wrap.className = "cookie-settings-wrap";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "cookie-settings-link";
    btn.className = "cookie-settings-link";
    btn.textContent = "Cookie-Einstellungen";
    btn.addEventListener("click", function () {
      showBanner();
    });

    wrap.appendChild(btn);
    if (toTop) {
      footer.insertBefore(wrap, toTop);
    } else {
      footer.appendChild(wrap);
    }
  }

  // Init
  injectStyles(); // styles always, damit Footer-Link sofort korrekt aussieht
  var consent = getConsent();
  if (consent === "granted") {
    enableAnalytics();
  } else if (consent === "denied") {
    disableAnalytics();
  } else {
    showBanner();
  }
  injectSettingsLink();
})();

// Shared unread message badges (Navbar + Übersicht)
(function () {
  var STYLE_ID = "av-message-badge-styles";
  var NAV_BADGE_CLASS = "av-message-badge";
  var SIDE_BADGE_CLASS = "av-message-sidebar-badge";
  var state = { count: 0 };

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent =
      ".av-message-badge-anchor{position:relative;overflow:visible !important;}" +
      ".av-message-badge{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 6px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#ff6b6b,#ff3b5f);color:#fff;font-size:11px;font-weight:800;line-height:1;border:2px solid rgba(15,32,39,.92);box-shadow:0 8px 20px rgba(255,59,95,.32);pointer-events:none;z-index:2;}" +
      ".av-message-sidebar-badge{margin-left:8px;min-width:20px;height:20px;padding:0 7px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#ff6b6b,#ff3b5f);color:#fff;font-size:11px;font-weight:800;line-height:1;box-shadow:0 8px 20px rgba(255,59,95,.22);vertical-align:middle;}" +
      ".sidebar-link.active .av-message-sidebar-badge{background:linear-gradient(135deg,#ffffff,#f6fbff);color:#0f2027;}";
    document.head.appendChild(style);
  }

  function formatCount(count) {
    return count > 99 ? "99+" : String(count);
  }

  function getUnreadContactCount(messages, meId) {
    var uid = String(meId || "").trim();
    if (!uid || !Array.isArray(messages)) return 0;

    var contacts = new Set();
    messages.forEach(function (msg) {
      if (!msg) return;
      if (String(msg.empfaengerId || "") !== uid) return;
      if (msg.gelesen) return;
      var senderId = String(msg.senderId || "").trim();
      if (senderId) contacts.add(senderId);
    });
    return contacts.size;
  }

  function upsertBadge(parent, className, count) {
    if (!parent) return;
    var badge = parent.querySelector("." + className);

    if (!count) {
      if (badge) badge.remove();
      return;
    }

    if (!badge) {
      badge = document.createElement("span");
      badge.className = className;
      parent.appendChild(badge);
    }

    badge.textContent = formatCount(count);
    badge.setAttribute("aria-label", count + " ungelesene Nachrichten");
  }

  function applyCount(count) {
    injectStyles();
    state.count = Number(count) || 0;

    var desktopLink = document.getElementById("messages-link");
    var mobileLink = document.getElementById("mobile-messages");
    var sidebarLink = document.querySelector('.sidebar-link[data-section="messages-list"]');

    if (desktopLink) desktopLink.classList.add("av-message-badge-anchor");
    if (mobileLink) mobileLink.classList.add("av-message-badge-anchor");

    upsertBadge(desktopLink, NAV_BADGE_CLASS, state.count);
    upsertBadge(mobileLink, NAV_BADGE_CLASS, state.count);
    upsertBadge(sidebarLink, SIDE_BADGE_CLASS, state.count);

    try {
      window.dispatchEvent(new CustomEvent("autovisa:message-badge-updated", {
        detail: { count: state.count }
      }));
    } catch {}

    return state.count;
  }

  async function refresh(opts) {
    try {
      if (opts && Array.isArray(opts.messages) && opts.meId) {
        return applyCount(getUnreadContactCount(opts.messages, opts.meId));
      }

      var meRes = await fetch("/getNutzerInfo", { credentials: "include" });
      var me = await meRes.json().catch(function () { return {}; });
      if (!me || !me.eingeloggt) return applyCount(0);

      var meId = me.nutzerId || me.id || me.userId || "";
      if (!meId) return applyCount(0);

      var msgRes = await fetch("/meine-nachrichten", { credentials: "include" });
      if (!msgRes.ok) return applyCount(0);

      var messages = await msgRes.json().catch(function () { return []; });
      return applyCount(getUnreadContactCount(messages, meId));
    } catch (_err) {
      return applyCount(0);
    }
  }

  window.AutovisaMessageBadge = {
    refresh: refresh,
    applyCount: applyCount,
    getCount: function () { return state.count; },
    getUnreadContactCount: getUnreadContactCount
  };

  function init() {
    var hasTargets =
      document.getElementById("messages-link") ||
      document.getElementById("mobile-messages") ||
      document.querySelector('.sidebar-link[data-section="messages-list"]');
    if (!hasTargets) return;
    refresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
