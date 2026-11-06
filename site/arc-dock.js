/* Stealth X hub dock.
 *
 * The site is a static Next export, so its nav lives in three tightly coupled
 * carriers (markup, RSC flight payload, JS chunk) and cannot be edited safely
 * per-page. Instead this appends its own element to <body>, giving one
 * consistent way into the loader, tracker, shop and admin pages from anywhere
 * on the site.
 *
 * This site hydrates the whole document (Next calls hydrateRoot(document, …)),
 * so two precautions matter:
 *   - attach on `load`, i.e. strictly AFTER hydration has finished, so the
 *     extra node can never take part in a hydration match;
 *   - watch the body and re-attach if a route change ever drops the node.
 */
(function () {
  if (window.__arcDock) return;
  window.__arcDock = true;

  var ITEMS = [
    { href: "/script/", label: "Loader", d: "M4 4h16v5H4zM4 13h16v7H4z" },
    { href: "/script/games/", label: "Games", d: "M4 6h16v12H4zM8 10h8M8 14h5" },
    { href: "/script/statistics/", label: "Stats", d: "M5 19V9M12 19V5M19 19v-6" },
    { href: "/get-key", label: "Key", d: "M15 7a4 4 0 1 1-3.9 5H4v-2h7.1A4 4 0 0 1 15 7z" },
    { href: "/pricing", label: "Pricing", d: "M12 3v18M16 7H10a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H8" },
  ];

  var CSS =
    ".arc-dock{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483000;" +
    "display:flex;align-items:center;gap:2px;padding:5px;border-radius:14px;" +
    "background:rgba(14,14,15,.82);border:1px solid rgba(255,255,255,.09);" +
    "backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);" +
    "box-shadow:0 14px 40px rgba(0,0,0,.55);" +
    "font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;" +
    // Base state IS the final state, with no entrance animation: a dock that
    // depends on the compositor ticking a frame can sit at opacity 0 forever.
    "opacity:1;transform:translate(-50%,0)}" +
    ".arc-dock a{position:relative;display:flex;align-items:center;gap:6px;padding:8px 11px;" +
    "border-radius:9px;color:#a3a3a3;text-decoration:none;font-size:12px;font-weight:560;" +
    "letter-spacing:.01em;white-space:nowrap;transition:color .16s ease,background .16s ease}" +
    ".arc-dock a:hover{color:#fff;background:rgba(255,255,255,.07)}" +
    ".arc-dock svg{width:15px;height:15px;flex:none;display:block}" +
    ".arc-dock .sep{width:1px;height:20px;margin:0 4px;background:rgba(255,255,255,.1)}" +
    "@media (max-width:620px){.arc-dock{gap:0;padding:4px}.arc-dock a{padding:8px 9px}" +
    ".arc-dock a span{display:none}}" +
    "@media (prefers-reduced-motion:reduce){.arc-dock a{transition:none}}";

  var style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  var dock = document.createElement("nav");
  dock.className = "arc-dock";
  dock.setAttribute("aria-label", "Stealth X hub");

  ITEMS.forEach(function (item) {
    var a = document.createElement("a");
    a.href = item.href;
    a.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
      item.d + '"/></svg><span></span>';
    a.querySelector("span").textContent = item.label;
    dock.appendChild(a);
  });

  var sep = document.createElement("span");
  sep.className = "sep";
  dock.appendChild(sep);

  var discord = document.createElement("a");
  discord.href = "https://discord.gg/XXXXXXXXXX";
  discord.target = "_blank";
  discord.rel = "noopener noreferrer";
  discord.innerHTML =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M19.6 5.6A16 16 0 0 0 15.7 4.4l-.2.4a13 13 0 0 0-7 0l-.2-.4a16 16 0 0 0-3.9 1.2C1.6 9.4 1 13.1 1.3 16.7a16 16 0 0 0 4.8 2.4l.6-1a11 11 0 0 1-1.7-.8l.4-.3a11 11 0 0 0 9.2 0l.4.3a11 11 0 0 1-1.7.8l.6 1a16 16 0 0 0 4.8-2.4c.4-4.2-.6-7.9-2.8-11.1ZM8.6 14.4c-1 0-1.7-.9-1.7-2s.8-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2Zm6.8 0c-1 0-1.7-.9-1.7-2s.8-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2Z"/></svg>' +
    '<span>Discord</span>';
  dock.appendChild(discord);

  // ------------------------------------------------------------------ top nav
  // Pages below the landing page ship one of three different headers: the doc
  // layout's `.doc-header`, the auth layout's floating `.auth-brand` mark, or
  // the hand-built `.topnav`. The first two are hidden by the unified stylesheet
  // and replaced here, so every one of those pages carries the same bar as the
  // landing page.
  //
  // This reuses the landing page's own class names (`.landing-nav`, `.landing-
  // nav-inner`, `.landing-logo`, `.landing-chip`) rather than copying styles, so
  // the injected bar is style-identical by construction and keeps tracking any
  // future change to the landing nav.
  var NAV_LINKS = [
    { href: "/script/", label: "Loader", d: "M4 4h16v5H4zM4 13h16v7H4z" },
    { href: "/script/statistics/", label: "Stats", d: "M5 19V9M12 19V5M19 19v-6" },
  ];
  var NAV_DISCORD = "https://discord.gg/XXXXXXXXXX";

  function buildNav() {
    var nav = document.createElement("header");
    nav.className = "landing-nav arc-nav";
    nav.setAttribute("aria-label", "Stealth X");

    var inner = document.createElement("div");
    inner.className = "landing-nav-inner";

    var logo = document.createElement("a");
    logo.className = "landing-logo";
    logo.href = "/";
    logo.setAttribute("aria-label", "Stealth X home");
    var img = document.createElement("img");
    img.src = "/arc-logo-white.png";
    img.width = 38;
    img.height = 38;
    img.alt = "";
    logo.appendChild(img);

    var actions = document.createElement("div");
    actions.className = "landing-nav-actions";

    NAV_LINKS.forEach(function (item) {
      actions.appendChild(chip(item.href, item.label, item.d, false));
    });
    actions.appendChild(chip(NAV_DISCORD, "Discord", "", true));

    inner.appendChild(logo);
    inner.appendChild(actions);
    nav.appendChild(inner);
    return nav;
  }

  function chip(href, label, path, external) {
    var a = document.createElement("a");
    a.className = "landing-chip landing-chip-nav";
    a.href = href;
    if (external) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
    if (external) {
      // Discord mark (filled), matching the dock's.
      a.innerHTML =
        '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
        '<path d="M19.6 5.6A16 16 0 0 0 15.7 4.4l-.2.4a13 13 0 0 0-7 0l-.2-.4a16 16 0 0 0-3.9 1.2C1.6 9.4 1 13.1 1.3 16.7a16 16 0 0 0 4.8 2.4l.6-1a11 11 0 0 1-1.7-.8l.4-.3a11 11 0 0 0 9.2 0l.4.3a11 11 0 0 1-1.7.8l.6 1a16 16 0 0 0 4.8-2.4c.4-4.2-.6-7.9-2.8-11.1ZM8.6 14.4c-1 0-1.7-.9-1.7-2s.8-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2Zm6.8 0c-1 0-1.7-.9-1.7-2s.8-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2Z"/></svg>';
    } else {
      a.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
        path + '"/></svg>';
    }
    var span = document.createElement("span");
    span.textContent = label;
    a.appendChild(span);
    return a;
  }

  // Every Stealth X page shows the same chips in its bar, so the landing page (whose
  // actions slot held only the login chip, now removed) gets them too.
  function fillActions(slot) {
    if (!slot || slot.querySelector(".landing-chip")) return;
    NAV_LINKS.forEach(function (item) {
      slot.appendChild(chip(item.href, item.label, item.d, false));
    });
    slot.appendChild(chip(NAV_DISCORD, "Discord", "", true));
  }

  // Only pages with no chrome of their own get the injected bar: the landing
  // page already renders it (so we top up its chips instead), the hand-built
  // pages carry `.topnav`, and the docs sub-app needs its own header for the
  // sidebar toggle.
  //
  // Every lookup below is re-queried on each pass on purpose: hydration can
  // replace these nodes wholesale, and a captured reference would then point at
  // a detached element while the live one sits empty.
  var injectedNav = document.querySelector(".landing-nav, .topnav, .docs-header")
    ? null
    : buildNav();

  function topUpLandingNav() {
    var bar = document.querySelector(".landing-nav");
    if (!bar) return;
    fillActions(bar.querySelector(".landing-nav-actions"));
  }

  function stateOk() {
    if (!dock.isConnected) return false;
    if (injectedNav && !injectedNav.isConnected) return false;
    var bar = document.querySelector(".landing-nav");
    if (bar) {
      var slot = bar.querySelector(".landing-nav-actions");
      if (slot && !slot.querySelector(".landing-chip")) return false;
    }
    return true;
  }

  function attach() {
    if (!dock.isConnected) document.body.appendChild(dock);
    if (injectedNav && !injectedNav.isConnected) document.body.appendChild(injectedNav);
    topUpLandingNav();
  }

  // React stamps every node it owns with a fiber key when hydration commits.
  // Appending before that is what makes React report a hydration mismatch (and
  // then throw the whole subtree away), so wait for the stamp. This is a poll,
  // not a promise: it is bounded and the fallback still attaches.
  function hydrated() {
    var el = document.querySelector("main") || document.body;
    if (!el) return false;
    return Object.keys(el).some(function (k) {
      return k.indexOf("__reactFiber$") === 0;
    });
  }

  function whenHydrated(fn, tries) {
    if (hydrated()) return fn();
    if (tries <= 0) return fn();
    window.setTimeout(function () {
      whenHydrated(fn, tries - 1);
    }, 100);
  }

  function start() {
    whenHydrated(function () {
      attach();
      // React owns <body> here, so if a re-render ever drops any of this, put it
      // back. Coalesced to one check per frame because a busy page mutates a lot.
      if (window.MutationObserver) {
        var queued = false;
        new MutationObserver(function () {
          if (queued) return;
          queued = true;
          window.requestAnimationFrame(function () {
            queued = false;
            if (!stateOk()) attach();
          });
        }).observe(document.body, { childList: true, subtree: true });
      }
    }, 50);
  }

  // `load` is the earliest sane point; the hydration gate above handles the rest.
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
})();
