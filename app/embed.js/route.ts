import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Self-contained, dependency-free embed script. Served as application/javascript.
// It reads data-popup-id from its own <script> tag, fetches the public config
// from the script's origin, injects a modal, and posts to /api/submit.
const SCRIPT = String.raw`(function () {
  "use strict";
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

  // Derive the hub origin from the script's own src.
  var origin;
  try {
    origin = new URL(self.src).origin;
  } catch (e) {
    origin = "";
  }

  var STATE = { open: false, cfg: null, submitting: false };

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === "style") node.style.cssText = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else node.setAttribute(k, attrs[k]);
      }
    }
    (children || []).forEach(function (c) {
      if (typeof c === "string") node.appendChild(document.createTextNode(c));
      else if (c) node.appendChild(c);
    });
    return node;
  }

  function fetchConfig(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", origin + "/api/popup/" + encodeURIComponent(popupId) + "/config", true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        try { cb(null, JSON.parse(xhr.responseText)); }
        catch (e) { cb(e); }
      } else {
        cb(new Error("config " + xhr.status));
      }
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

  function close() {
    STATE.open = false;
    var root = document.getElementById("gcpm-root");
    if (root) root.parentNode.removeChild(root);
  }

  function render(cfg) {
    var primary = (cfg.style && cfg.style.primaryColor) || "#111827";
    var btnColor = (cfg.style && cfg.style.buttonColor) || "#2563eb";
    var f = cfg.fields || {};

    var overlay = el("div", {
      id: "gcpm-root",
      style:
        "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.55);" +
        "display:flex;align-items:center;justify-content:center;padding:16px;" +
        "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;",
    });
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });

    var card = el("div", {
      style:
        "background:#fff;max-width:420px;width:100%;border-radius:12px;overflow:hidden;" +
        "box-shadow:0 20px 60px rgba(0,0,0,0.35);position:relative;",
    });

    var closeBtn = el("button", {
      type: "button",
      "aria-label": "Close",
      style:
        "position:absolute;top:10px;right:12px;border:none;background:transparent;" +
        "font-size:24px;line-height:1;cursor:pointer;color:#9ca3af;z-index:2;",
    }, ["\u00D7"]);
    closeBtn.addEventListener("click", close);
    card.appendChild(closeBtn);

    if (cfg.imageUrl) {
      card.appendChild(
        el("img", {
          src: cfg.imageUrl,
          alt: "",
          style: "width:100%;height:140px;object-fit:cover;display:block;",
        })
      );
    }

    var body = el("div", { style: "padding:24px;" });
    if (cfg.headline)
      body.appendChild(
        el("h2", {
          style: "margin:0 0 6px;font-size:22px;font-weight:700;color:" + primary + ";",
        }, [cfg.headline])
      );
    if (cfg.subHeadline)
      body.appendChild(
        el("p", { style: "margin:0 0 12px;font-size:15px;color:#4b5563;" }, [cfg.subHeadline])
      );
    if (cfg.bodyText)
      body.appendChild(
        el("p", { style: "margin:0 0 16px;font-size:14px;color:#6b7280;" }, [cfg.bodyText])
      );

    var msg = el("div", {
      style: "display:none;margin:0 0 12px;font-size:13px;color:#dc2626;",
    });

    var inputStyle =
      "width:100%;box-sizing:border-box;padding:11px 12px;margin:0 0 10px;" +
      "border:1px solid #d1d5db;border-radius:8px;font-size:15px;outline:none;";

    var form = el("form");
    var emailInput = el("input", {
      type: "email", name: "email", placeholder: "Email address",
      required: "required", style: inputStyle,
    });
    form.appendChild(emailInput);

    var firstNameInput, phoneInput, notesInput;
    if (f.firstName) {
      firstNameInput = el("input", {
        type: "text", name: "firstName", placeholder: "First name", style: inputStyle,
      });
      form.appendChild(firstNameInput);
    }
    if (f.phone) {
      phoneInput = el("input", {
        type: "tel", name: "phone", placeholder: "Phone", style: inputStyle,
      });
      form.appendChild(phoneInput);
    }
    if (f.notes) {
      notesInput = el("textarea", {
        name: "notes", placeholder: "Notes", rows: "3",
        style: inputStyle + "resize:vertical;",
      });
      form.appendChild(notesInput);
    }

    var submitBtn = el("button", {
      type: "submit",
      style:
        "width:100%;padding:12px;border:none;border-radius:8px;cursor:pointer;" +
        "font-size:16px;font-weight:600;color:#fff;background:" + btnColor + ";",
    }, [cfg.buttonText || "Submit"]);
    form.appendChild(msg);
    form.appendChild(submitBtn);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (STATE.submitting) return;
      msg.style.display = "none";
      var payload = {
        popupId: popupId,
        email: emailInput.value.trim(),
        firstName: firstNameInput ? firstNameInput.value.trim() : "",
        phone: phoneInput ? phoneInput.value.trim() : "",
        notes: notesInput ? notesInput.value.trim() : "",
      };
      if (!payload.email) {
        msg.textContent = "Please enter your email.";
        msg.style.display = "block";
        return;
      }
      STATE.submitting = true;
      submitBtn.disabled = true;
      var original = submitBtn.textContent;
      submitBtn.textContent = "Please wait\u2026";
      submit(payload, function (err) {
        STATE.submitting = false;
        submitBtn.disabled = false;
        submitBtn.textContent = original;
        if (err) {
          msg.textContent = err.message || "Something went wrong.";
          msg.style.display = "block";
          return;
        }
        if (cfg.thankYouUrl) {
          window.location.href = cfg.thankYouUrl;
        } else {
          body.innerHTML =
            '<p style="text-align:center;padding:20px 0;font-size:16px;color:' +
            primary + ';">Thank you!</p>';
        }
      });
    });

    body.appendChild(form);
    card.appendChild(body);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    STATE.open = true;
  }

  function launch() {
    if (STATE.open) return;
    if (STATE.cfg) { render(STATE.cfg); return; }
    fetchConfig(function (err, cfg) {
      if (err || !cfg) return;
      STATE.cfg = cfg;
      render(cfg);
    });
  }

  // Expose a manual trigger and auto-open on load.
  window.GCPopup = window.GCPopup || {};
  window.GCPopup.open = launch;
  window.GCPopup.close = close;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", launch);
  } else {
    launch();
  }
})();`;

export function GET() {
  return new NextResponse(SCRIPT, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
