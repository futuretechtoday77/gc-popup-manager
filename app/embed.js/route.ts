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
    if (current && current.getAttribute) return current;
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].getAttribute("data-popup-id")) return scripts[i];
    }
    return null;
  }
  var self = findSelf();
  if (!self) return;
  var popupId = self.getAttribute("data-popup-id");
  if (!popupId) return;

  var origin;
  try { origin = new URL(self.src).origin; } catch (e) { origin = ""; }

  var SHOWN_KEY = "gc_popup_shown_" + popupId;
  var DISMISS_KEY = "gc_popup_dismissed_" + popupId;
  var STATE = { open: false, cfg: null, submitting: false };

  function ss(key) {
    try { return window.sessionStorage.getItem(key); } catch (e) { return null; }
  }
  function ssSet(key, val) {
    try { window.sessionStorage.setItem(key, val); } catch (e) {}
  }

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
    STATE.open = false;
    var root = document.getElementById("gcpm-root");
    if (root && root.parentNode) root.parentNode.removeChild(root);
    var st = document.getElementById("gcpm-style");
    if (st && st.parentNode) st.parentNode.removeChild(st);
  }

  function dismiss() {
    ssSet(DISMISS_KEY, "1");
    teardown();
  }

  function render(cfg) {
    var built = buildPopup(cfg);

    var style = document.getElementById("gcpm-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "gcpm-style";
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = built.css;

    var host = document.createElement("div");
    host.innerHTML = built.html;
    var root = host.firstChild;
    document.body.appendChild(root);
    STATE.open = true;

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

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (STATE.submitting) return;
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

      STATE.submitting = true;
      if (btn) { btn.disabled = true; var orig = btn.textContent; btn.textContent = "Please wait\u2026"; }
      submit(payload, function (err) {
        STATE.submitting = false;
        if (btn) { btn.disabled = false; btn.textContent = orig; }
        if (err) {
          if (msg) { msg.textContent = err.message || "Something went wrong."; msg.style.display = "block"; }
          return;
        }
        var successText = cfg.submissionSuccessText;
        var hasSuccessText =
          typeof successText === "string" && successText.replace(/\s+/g, "").length > 0;
        // New popups show an in-popup success notification. Legacy redirect is
        // only honored for old popups that set thankYouUrl and have no success
        // text of their own.
        if (!hasSuccessText && cfg.thankYouUrl) {
          window.location.href = cfg.thankYouUrl;
          return;
        }
        var successMarkup = successHtml(
          hasSuccessText ? successText : "Thanks! Your submission was received.",
        );
        var target =
          body ||
          root.querySelector(".gcpm-split-form") ||
          root.querySelector(".gcpm-card");
        if (target) target.innerHTML = successMarkup;
      });
    });
  }

  function launch(force) {
    if (STATE.open) return;
    if (!force) {
      if (ss(DISMISS_KEY)) return;
      if (ss(SHOWN_KEY)) return;
    }
    function go(cfg) {
      STATE.cfg = cfg;
      ssSet(SHOWN_KEY, "1");
      render(cfg);
    }
    if (STATE.cfg) { go(STATE.cfg); return; }
    fetchConfig(function (err, cfg) {
      if (err || !cfg) return;
      go(cfg);
    });
  }

  window.GCPopup = window.GCPopup || {};
  window.GCPopup.open = function () { launch(true); };
  window.GCPopup.close = teardown;

  function bind(selector) { if (!selector) return; var nodes; try { nodes = document.querySelectorAll(selector); } catch (e) { return; } for (var i = 0; i < nodes.length; i++) { var node = nodes[i]; if (node.getAttribute("data-gcpm-bound-" + popupId)) continue; node.setAttribute("data-gcpm-bound-" + popupId, "1"); node.addEventListener("click", function (e) { e.preventDefault(); launch(false); }); } }
  function schedule() { fetchConfig(function (err, cfg) { if (err || !cfg) return; STATE.cfg = cfg; var t = cfg.trigger || { type: "button", delaySeconds: 30 }; if (t.type === "button") { bind('[data-gc-popup-trigger="' + popupId + '"]'); bind(t.buttonSelector); return; } if (t.type === "delay") { var seconds = Math.max(1, Math.min(86400, Number(t.delaySeconds) || 30)); setTimeout(function () { launch(false); }, seconds * 1000); return; } if (t.type === "exitIntent" && !("ontouchstart" in window) && !(navigator.maxTouchPoints > 0)) { document.addEventListener("mouseleave", function (e) { if (e.clientY <= 20) launch(false); }, { once: true }); } }); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule);
  } else {
    schedule();
  }
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
