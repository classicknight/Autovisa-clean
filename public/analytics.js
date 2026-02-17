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
      ".cookie-backdrop{position:fixed;inset:0;z-index:9998;background:rgba(10,22,32,.25);backdrop-filter:saturate(120%) blur(1px);pointer-events:none;}" +
      ".cookie-banner{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(820px,calc(100% - 32px));z-index:9999;background:#fff;color:#1a1a1a;padding:28px 30px;border:1px solid #e3e9ef;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.22);}" +
      ".cookie-banner:before{content:'';position:absolute;left:0;top:0;bottom:0;width:6px;border-radius:18px 0 0 18px;background:linear-gradient(180deg,#00d3b0,#00b8a9);}"+
      ".cookie-banner .cookie-inner{max-width:1200px;margin:0 auto;display:flex;gap:22px;align-items:center;justify-content:space-between;flex-wrap:wrap;}" +
      ".cookie-banner .cookie-copy{max-width:760px;}" +
      ".cookie-banner .cookie-title{margin:0 0 6px;font-size:18px;font-weight:800;color:#0f1f26;}" +
      ".cookie-banner .cookie-text{margin:0;font-size:15px;line-height:1.6;color:#3b4a57;}" +
      ".cookie-banner a{color:#00bfa6;text-decoration:underline;}" +
      ".cookie-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}" +
      ".cookie-btn{border:none;border-radius:12px;padding:12px 18px;font-weight:700;cursor:pointer;font-size:14px;}" +
      ".cookie-accept{background:#00bfa6;color:#fff;border:1px solid #00bfa6;box-shadow:0 10px 22px rgba(0,191,166,.28);}" +
      ".cookie-decline{background:#fff;color:#0f1f26;border:1px solid #cfd8df;}" +
      ".cookie-btn:hover{filter:brightness(.98);}" +
      ".cookie-settings-link{background:none;border:none;color:#b7c3ce;font-weight:600;cursor:pointer;padding:0;margin-left:12px;text-decoration:underline;text-underline-offset:3px;font-size:.95rem;}" +
      ".cookie-settings-link:hover{color:#00b8a9;}" +
      ".cookie-settings-wrap{display:flex;align-items:center;gap:6px;}" +
      "@media (max-width:700px){.cookie-banner{width:calc(100% - 24px);padding:20px}.cookie-banner .cookie-inner{gap:12px}.cookie-actions{width:100%;justify-content:flex-start}.cookie-banner .cookie-title{font-size:17px}}";
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
      '<div class="cookie-title">Wir respektieren deine Privatsphäre</div>' +
      '<p class="cookie-text">Wir verwenden Cookies, um die Nutzung unserer Website zu analysieren und Autovisa zu verbessern (Google Analytics). Deine Auswahl kannst du jederzeit in den Cookie-Einstellungen ändern. Mehr Infos findest du in der <a href="datenschutz.html">Datenschutzerklärung</a>.</p>' +
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
    footer.appendChild(wrap);
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
