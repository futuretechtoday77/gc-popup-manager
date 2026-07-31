import { NextResponse } from 'next/server';
import { buildPopup, successHtml } from '@/lib/popup-render';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The shared renderer is serialized to source and shipped verbatim so the
// embed script and the admin preview render from ONE implementation.
const BUILD_POPUP_SRC = buildPopup.toString();
const SUCCESS_HTML_SRC = successHtml.toString();

// Self-contained, dependency-free embed script. Served as application/javascript.
// Reads data-popup-id from its own <script> tag, fetches the public config,
// renders the selected template via the shared buildPopup(), and posts to
// /api/submit. Respects field order, per-session dismiss/show, and configured button, delayed, or desktop exit-intent triggers.
const SCRIPT = String.raw`(function () {
  "use strict";

  var buildPopup = BUILD_POPUP_PLACEHOLDER;
  var successHtml = SUCCESS_HTML_PLACEHOLDER;
  var current = document.currentScript;

  function findSelf() {
    if (current && current.src) return current;
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (/\/embed\.js(?:\?|$)/.test(scripts[i].src || "")) return scripts[i];
    }
    return null;
  }

  var self = findSelf();
  if (!self) return;
  var origin;
  try { origin = new URL(self.src).origin; } catch (e) { origin = ""; }
  var instances = {};
  var instanceOrder = [];

  function ss(key) {
    try { return window.sessionStorage.getItem(key); } catch (e) { return null; }
  }
  function ssSet(key, val) {
    try { window.sessionStorage.setItem(key, val); } catch (e) {}
  }
  function safeId(value) {
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  function makeInstance(popupId) {
    popupId = String(popupId || "").trim();
    if (!popupId) return null;
    if (instances[popupId]) return instances[popupId];

    var shownKey = "gc_popup_shown_" + popupId;
    var dismissKey = "gc_popup_dismissed_" + popupId;
    var state = { open: false, cfg: null, submitting: false, root: null, style: null, scheduled: false };
    var token = safeId(popupId);

    function fetchConfig(cb) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", origin + "/api/popup/" + encodeURIComponent(popupId) + "/config", true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 300) {
          try { cb(null, JSON.parse(xhr.responseText)); }
          catch (e) { cb(e); }
        } else { cb(new Error("config " + xhr.status)); }
      };
      xhr.send();
    }

    function submit(data, cb) {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", origin + "/api/submit", true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        var res = null;
        try { res = JSON.parse(xhr.responseText); } catch (e) {}
        if (xhr.status >= 200 && xhr.status < 300 && res && res.success) cb(null, res);
        else cb(new Error((res && res.error) || "Submission failed"));
      };
      xhr.send(JSON.stringify(data));
    }

    function teardown() {
      state.open = false;
      if (state.root && state.root.parentNode) state.root.parentNode.removeChild(state.root);
      if (state.style && state.style.parentNode) state.style.parentNode.removeChild(state.style);
      state.root = null;
      state.style = null;
    }

    function dismiss() {
      ssSet(dismissKey, "1");
      teardown();
    }

    function render(cfg) {
      var built = buildPopup(cfg);
      var style = document.createElement("style");
      style.id = "gcpm-style-" + token;
      style.textContent = built.css;
      (document.head || document.documentElement).appendChild(style);
      state.style = style;

      var host = document.createElement("div");
      host.innerHTML = built.html;
      var root = host.firstChild;
      root.setAttribute("data-gcpm-popup-id", popupId);
      document.body.appendChild(root);
      state.root = root;
      state.open = true;

      var closeEl = root.querySelector("[data-gcpm-close]");
      if (closeEl) closeEl.addEventListener("click", dismiss);
      var overlay = root.querySelector("[data-gcpm-overlay]");
      if (overlay) overlay.addEventListener("click", function (e) {
        if (e.target === overlay) dismiss();
      });

      var form = root.querySelector("[data-gcpm-form]");
      var msg = root.querySelector("[data-gcpm-msg]");
      var btn = root.querySelector("[data-gcpm-submit]");
      var body = root.querySelector(".gcpm-body");
      if (!form) return;

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (state.submitting) return;
        if (msg) msg.style.display = "none";

        var payload = { popupId: popupId };
        var inputs = form.querySelectorAll("[name]");
        var missing = false;
        for (var i = 0; i < inputs.length; i++) {
          var inp = inputs[i];
          var val = (inp.value || "").trim();
          payload[inp.name] = val;
          if (inp.hasAttribute("required") && !val) missing = true;
        }
        if (!payload.email) missing = true;
        if (missing) {
          if (msg) { msg.textContent = "Please fill in the required fields."; msg.style.display = "block"; }
          return;
        }

        state.submitting = true;
        var orig = btn && btn.textContent;
        if (btn) { btn.disabled = true; btn.textContent = "Please wait\u2026"; }
        submit(payload, function (err) {
          state.submitting = false;
          if (btn) { btn.disabled = false; btn.textContent = orig; }
          if (err) {
            if (msg) { msg.textContent = err.message || "Something went wrong."; msg.style.display = "block"; }
            return;
          }
          var successText = cfg.submissionSuccessText;
          var hasSuccessText = typeof successText === "string" && successText.replace(/\s+/g, "").length > 0;
          if (!hasSuccessText && cfg.thankYouUrl) {
            window.location.href = cfg.thankYouUrl;
            return;
          }
          var target = body || root.querySelector(".gcpm-split-form") || root.querySelector(".gcpm-card");
          if (target) target.innerHTML = successHtml(hasSuccessText ? successText : "Thanks! Your submission was received.");
        });
      });
    }

    function launch(force) {
      if (state.open) return;
      if (!force && (ss(dismissKey) || ss(shownKey))) return;
      function go(cfg) {
        state.cfg = cfg;
        ssSet(shownKey, "1");
        render(cfg);
      }
      if (state.cfg) { go(state.cfg); return; }
      fetchConfig(function (err, cfg) { if (!err && cfg) go(cfg); });
    }

    function bind(selector) {
      if (!selector) return;
      var nodes;
      try { nodes = document.querySelectorAll(selector); } catch (e) { return; }
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var bound = "data-gcpm-bound-" + token;
        if (node.getAttribute(bound)) continue;
        node.setAttribute(bound, "1");
        node.addEventListener("click", function (e) { e.preventDefault(); launch(true); });
      }
    }

    function setup(cb) {
      if (state.cfg) { if (cb) cb(state.cfg); return; }
      fetchConfig(function (err, cfg) {
        if (err || !cfg) return;
        state.cfg = cfg;
        // Attribute buttons are always an independent layer, regardless of
        // this popup's auto-trigger type or page override status.
        bind('[data-gc-popup-trigger="' + popupId + '"]');
        var trigger = cfg.trigger || { type: "button", delaySeconds: 30 };
        if (trigger.type === "button") bind(trigger.buttonSelector);
        if (cb) cb(cfg);
      });
    }

    function scheduleAuto() {
      if (state.scheduled) return;
      state.scheduled = true;
      setup(function (cfg) {
        var trigger = cfg.trigger || { type: "button", delaySeconds: 30 };
        if (trigger.type === "delay") {
          var seconds = Math.max(1, Math.min(86400, Number(trigger.delaySeconds) || 30));
          setTimeout(function () { launch(false); }, seconds * 1000);
        } else if (trigger.type === "exitIntent" && !("ontouchstart" in window) && !(navigator.maxTouchPoints > 0)) {
          document.addEventListener("mouseleave", function (e) { if (e.clientY <= 20) launch(false); }, { once: true });
        }
      });
    }

    var api = { id: popupId, launch: launch, close: teardown, setup: setup, scheduleAuto: scheduleAuto, bindDefaultButton: function () { bind('[data-gc-popup-trigger="' + popupId + '"]'); } };
    instances[popupId] = api;
    instanceOrder.push(api);
    return api;
  }

  function uniqueIds(nodes, attr) {
    var seen = {};
    var ids = [];
    for (var i = 0; i < nodes.length; i++) {
      var id = String(nodes[i].getAttribute(attr) || "").trim();
      if (id && !seen[id]) { seen[id] = true; ids.push(id); }
    }
    return ids;
  }

  function startup() {
    var markers = document.querySelectorAll("[data-gc-popup]");
    var overrides = [];
    for (var i = 0; i < markers.length; i++) {
      if (markers[i].hasAttribute("data-gc-override")) overrides.push(markers[i]);
    }
    var autoIds = uniqueIds(overrides.length ? overrides : markers, "data-gc-popup");

    // Legacy per-popup embed: preserve its original lifecycle and auto behavior.
    var legacyId = String(self.getAttribute("data-popup-id") || "").trim();
    if (legacyId && autoIds.indexOf(legacyId) < 0) autoIds.unshift(legacyId);

    // Marker popups bind configured selectors even when an override suppresses
    // their auto layer. Attribute buttons below also work without a marker.
    var markerIds = uniqueIds(markers, "data-gc-popup");
    for (var j = 0; j < markerIds.length; j++) {
      var marked = makeInstance(markerIds[j]);
      if (marked) { marked.bindDefaultButton(); marked.setup(); }
    }

    var buttonIds = uniqueIds(document.querySelectorAll("[data-gc-popup-trigger]"), "data-gc-popup-trigger");
    for (var k = 0; k < buttonIds.length; k++) {
      var buttonPopup = makeInstance(buttonIds[k]);
      if (buttonPopup) { buttonPopup.bindDefaultButton(); buttonPopup.setup(); }
    }

    var firstAuto = null;
    for (var n = 0; n < autoIds.length; n++) {
      var autoPopup = makeInstance(autoIds[n]);
      if (!autoPopup) continue;
      if (!firstAuto) firstAuto = autoPopup;
      autoPopup.scheduleAuto();
    }

    window.GCPopup = window.GCPopup || {};
    window.GCPopup.instances = instances;
    window.GCPopup.open = function (popupId) {
      var popup = popupId ? makeInstance(popupId) : (firstAuto || instanceOrder[0]);
      if (popup) popup.launch(true);
    };
    window.GCPopup.close = function (popupId) {
      var popup = popupId ? instances[popupId] : (firstAuto || instanceOrder[0]);
      if (popup) popup.close();
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startup);
  else startup();
})();`;

const FINAL_SCRIPT = SCRIPT.replace(
  'BUILD_POPUP_PLACEHOLDER',
  BUILD_POPUP_SRC,
).replace('SUCCESS_HTML_PLACEHOLDER', SUCCESS_HTML_SRC);

export function GET() {
  return new NextResponse(FINAL_SCRIPT, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
