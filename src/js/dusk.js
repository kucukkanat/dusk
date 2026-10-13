/* @ds-bundle: {"format":4,"namespace":"Dusk","components":[{"name":"Button"},{"name":"IconButton"},{"name":"Avatar"},{"name":"Note"},{"name":"SwipeRow"},{"name":"FeedChips"},{"name":"TabBar"},{"name":"Sheet"},{"name":"Field"},{"name":"Toggle"},{"name":"SyncPill"},{"name":"Toast"}]} */
(function () {
  "use strict";
  var ICONS = {
    reply: "M9 15 4 10l5-5M4 10h10a6 6 0 0 1 6 6v3",
    like: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
    zap: "M13 3 5 13.5h6L10 21l8-10.5h-6l1-7.5z",
    repost: "M16.5 3.5 19.5 6.5l-3 3M4.5 11V9.5a3 3 0 0 1 3-3h12M7.5 20.5l-3-3 3-3M19.5 13v1.5a3 3 0 0 1-3 3h-12",
    home: "M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z",
    search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
    bell: "M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0",
    message: "M4 6h16v12H4zM4.5 6.5 12 12.5l7.5-6",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0",
    plus: "M12 5v14M5 12h14",
    more: "M6 12h.01M12 12h.01M18 12h.01",
    mute: "M11 5 6.5 9H3.5v6h3l4.5 4zM16 9.5l5 5M21 9.5l-5 5",
    share: "M12 4v11M7.5 8.5 12 4l4.5 4.5M5 14v5.5h14V14",
    copy: "M8.5 8.5h11v11h-11zM5 15.5V4.5h11",
    check: "M5 12.5 9.5 17 19 7",
    close: "M6 6l12 12M18 6 6 18",
    settings: "M4 7h10M18 7h2M4 17h2M10 17h10M16 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
  };

  function icon(name, label) {
    var d = ICONS[name] || ICONS.more;
    var a = label ? ' role="img" aria-label="' + label + '"' : ' aria-hidden="true"';
    return '<svg class="dk-icon" viewBox="0 0 24 24"' + a + '><path d="' + d + '"/></svg>';
  }

  function px(name, fallback) {
    var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--" + name));
    return isNaN(v) ? fallback : v;
  }

  function haptic() { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} }

  /* SwipeRow: root .dk-swipe > .dk-swipe__side--start, .dk-swipe__side--end, .dk-swipe__content
     opts.onAction(action, side) fires on a committed swipe. Returns { close, destroy }. */
  function swipe(root, opts) {
    opts = opts || {};
    var content = root.querySelector(".dk-swipe__content");
    var sides = { start: root.querySelector(".dk-swipe__side--start"), end: root.querySelector(".dk-swipe__side--end") };
    var slop = px("swipe-slop", 10), reveal = px("swipe-reveal", 80), commit = px("swipe-commit", 160);
    var x0 = 0, y0 = 0, dx = 0, base = 0, axis = null, armed = false, id = null;

    function set(x) {
      var side = x > 0 ? "start" : x < 0 ? "end" : "";
      if (side && !sides[side]) { x = x / 6; } // nothing on that side: resist
      root.style.setProperty("--dk-x", x + "px");
      root.style.setProperty("--dk-progress", Math.min(1, Math.abs(x) / commit).toFixed(3));
      if (side && sides[side]) root.setAttribute("data-side", side); else if (!x) root.removeAttribute("data-side");
      var nowArmed = !!(side && sides[side]) && Math.abs(x) >= commit;
      if (nowArmed !== armed) { armed = nowArmed; root.classList.toggle("is-armed", armed); if (armed) haptic(); }
      dx = x;
    }
    function close() { base = 0; root.classList.remove("is-dragging"); set(0); }

    function down(e) {
      if (e.button > 0) return;
      id = e.pointerId; x0 = e.clientX; y0 = e.clientY; axis = null;
    }
    function move(e) {
      if (e.pointerId !== id) return;
      var mx = e.clientX - x0, my = e.clientY - y0;
      if (!axis) {
        if (Math.abs(my) >= slop && Math.abs(my) >= Math.abs(mx)) { axis = "y"; id = null; return; }
        if (Math.abs(mx) < slop) return;
        axis = "x"; root.classList.add("is-dragging");
        try { root.setPointerCapture(id); } catch (err) {}
      }
      e.preventDefault();
      var x = base + mx;
      var lim = root.clientWidth * 0.85;
      if (Math.abs(x) > lim) x = (x > 0 ? 1 : -1) * (lim + (Math.abs(x) - lim) / 4);
      set(x);
    }
    function up(e) {
      if (e.pointerId !== id) return;
      id = null;
      if (axis !== "x") return;
      root.classList.remove("is-dragging");
      var side = dx > 0 ? "start" : "end", el = sides[side];
      if (armed && el) {
        var action = el.getAttribute("data-action");
        armed = false; root.classList.remove("is-armed");
        close();
        if (opts.onAction) opts.onAction(action, side);
        root.dispatchEvent(new CustomEvent("dusk:action", { bubbles: true, detail: { action: action, side: side } }));
      } else if (el && Math.abs(dx) >= reveal) {
        base = (dx > 0 ? 1 : -1) * reveal; set(base);
      } else close();
    }
    function tapSide(e) {
      var s = e.target.closest(".dk-swipe__side");
      if (s && base) { var a = s.getAttribute("data-action"); close(); if (opts.onAction) opts.onAction(a, s.classList.contains("dk-swipe__side--start") ? "start" : "end"); }
    }
    root.addEventListener("pointerdown", down);
    root.addEventListener("pointermove", move, { passive: false });
    root.addEventListener("pointerup", up);
    root.addEventListener("pointercancel", function (e) { if (e.pointerId === id) { id = null; close(); } });
    root.addEventListener("click", tapSide);
    return { close: close, destroy: function () { root.replaceWith(root.cloneNode(true)); } };
  }

  /* Sheet: drag .dk-sheet (by its grabber or anywhere at scrollTop 0) down to dismiss. */
  function sheet(el, opts) {
    opts = opts || {};
    var dismiss = px("sheet-dismiss", 120), y0 = 0, t0 = 0, dy = 0, id = null;
    el.addEventListener("pointerdown", function (e) { id = e.pointerId; y0 = e.clientY; t0 = Date.now(); dy = 0; });
    el.addEventListener("pointermove", function (e) {
      if (e.pointerId !== id) return;
      dy = Math.max(0, e.clientY - y0);
      if (dy > 4) { el.classList.add("is-dragging"); try { el.setPointerCapture(id); } catch (err) {} }
      el.style.setProperty("--dk-y", dy + "px");
    });
    function end(e) {
      if (e.pointerId !== id) return;
      id = null; el.classList.remove("is-dragging");
      var v = dy / Math.max(1, Date.now() - t0);
      if (dy >= dismiss || v > 0.6) { el.style.setProperty("--dk-y", "110%"); if (opts.onDismiss) setTimeout(opts.onDismiss, px("duration-calm", 220)); }
      else el.style.setProperty("--dk-y", "0px");
    }
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    return { open: function () { el.style.setProperty("--dk-y", "0px"); }, close: function () { el.style.setProperty("--dk-y", "110%"); } };
  }

  /* mount(root): fills <i data-icon="name"> with icons, wires [data-swipe] rows and .dk-sheet. */
  function mount(root) {
    root = root || document;
    root.querySelectorAll("i[data-icon]").forEach(function (i) {
      i.outerHTML = icon(i.getAttribute("data-icon"), i.getAttribute("aria-label"));
    });
    root.querySelectorAll(".dk-swipe").forEach(function (r) { if (!r._dusk) r._dusk = swipe(r); });
    root.querySelectorAll(".dk-sheet").forEach(function (s) { if (!s._dusk) s._dusk = sheet(s); });
    root.querySelectorAll("[aria-pressed]").forEach(function (b) {
      if (b._dusk) return; b._dusk = 1;
      b.addEventListener("click", function () { b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true"); });
    });
  }

  var noop = function () { return null; };
  window.Dusk = {
    icon: icon, icons: Object.keys(ICONS), swipe: swipe, sheet: sheet, mount: mount, haptic: haptic,
    Button: noop, IconButton: noop, Avatar: noop, Note: noop, SwipeRow: noop, FeedChips: noop,
    TabBar: noop, Sheet: noop, Field: noop, Toggle: noop, SyncPill: noop, Toast: noop
  };
})();
