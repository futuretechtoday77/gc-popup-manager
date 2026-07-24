import type {
  PopupTemplate,
  PopupField,
  PopupStyle,
  PopupImageSettings,
} from "./types";

export interface RenderConfig {
  id: string;
  template: PopupTemplate;
  headline: string;
  subHeadline: string;
  bodyText: string;
  buttonText: string;
  imageUrl: string;
  imageSettings?: PopupImageSettings;
  fields: PopupField[];
  style: PopupStyle;
}

// Serialized into the embed script, so this function must only use arguments
// and nested helpers: no imports or module-scope references at runtime.
export function buildPopup(cfg: RenderConfig): { css: string; html: string } {
  function esc(v: any): string {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  var templates = ["classic", "minimal", "slideup", "split"];
  var template: PopupTemplate =
    templates.indexOf(cfg.template) !== -1 ? cfg.template : "classic";
  var style = cfg.style || ({} as PopupStyle);
  var cardBg = style.primaryColor || "#ffffff",
    btnBg = style.buttonColor || "#22c55e",
    textColor = style.textColor || "#1a1a1a";
  var raw: any = cfg.imageSettings || {};
  var fit =
    raw.fit === "contain" || raw.fit === "fill" || raw.fit === "cover"
      ? raw.fit
      : "cover";
  var candidatePosition = String(raw.position || "").toLowerCase();
  var position =
    /^(left|center|right)(?: (top|center|bottom))?$|^(top|center|bottom)(?: (left|center|right))?$/.test(
      candidatePosition,
    )
      ? candidatePosition
      : "center center";
  var clamp = function (v: any, min: number, max: number, fallback: number) {
    var n = Number(v);
    return isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
  };
  var scale = clamp(raw.scale, 50, 150, 100);
  var desktopHeight = clamp(
    raw.desktopHeight,
    100,
    360,
    template === "split" ? 360 : 180,
  );
  var mobileHeight = clamp(raw.mobileHeight, 100, 260, 150);
  var fields = (cfg.fields || [])
    .slice()
    .sort(function (a, b) {
      return (a.order || 0) - (b.order || 0);
    })
    .filter(function (f) {
      return f && f.enabled;
    });
  var isSlide = template === "slideup",
    isMinimal = template === "minimal",
    isSplit = template === "split";
  var css =
    "#gcpm-root,#gcpm-root *{box-sizing:border-box;}" +
    "#gcpm-root{position:fixed;inset:0;z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:" +
    textColor +
    ";}" +
    "#gcpm-root .gcpm-overlay{position:absolute;inset:0;background:rgba(0,0,0,.55);display:flex;padding:16px;" +
    (isSlide
      ? "align-items:flex-end;justify-content:center;"
      : "align-items:center;justify-content:center;") +
    "}" +
    "#gcpm-root .gcpm-card{position:relative;background:" +
    cardBg +
    ";width:100%;box-shadow:0 20px 60px rgba(0,0,0,.28);overflow:hidden;" +
    (isSlide
      ? "max-width:420px;border-radius:16px;"
      : isSplit
        ? "max-width:760px;border-radius:14px;display:flex;flex-direction:row;"
        : isMinimal
          ? "max-width:480px;border-radius:14px;"
          : "max-width:480px;border-radius:12px;") +
    "}" +
    "#gcpm-root .gcpm-image-frame{position:relative;width:100%;height:" +
    desktopHeight +
    "px;overflow:hidden;background:#eef2f7;display:flex;align-items:center;justify-content:center;}" +
    "#gcpm-root .gcpm-image-frame img{display:block;width:100%;height:100%;object-fit:" +
    fit +
    ";object-position:" +
    position +
    ";transform:scale(" +
    scale / 100 +
    ");transform-origin:" +
    position +
    ";}" +
    "#gcpm-root .gcpm-image-fallback{display:none;position:absolute;inset:0;align-items:center;justify-content:center;padding:20px;text-align:center;background:linear-gradient(135deg,#eef2f7,#dfe7f1);color:#64748b;font-size:13px;font-weight:600;}#gcpm-root .gcpm-image-frame.gcpm-image-error .gcpm-image-fallback{display:flex;}#gcpm-root .gcpm-image-frame.gcpm-image-error img{display:none;}" +
    "@media (max-width:639px){#gcpm-root .gcpm-image-frame{height:" +
    mobileHeight +
    "px;}}" +
    (isSplit
      ? "#gcpm-root .gcpm-split-img{flex:0 0 45%;min-height:360px;display:flex;align-items:stretch;}#gcpm-root .gcpm-split-img.gcpm-image-frame{height:auto;min-height:360px;}#gcpm-root .gcpm-split-form{flex:1;padding:32px 28px;}@media (max-width:639px){#gcpm-root .gcpm-split-img{display:none;}#gcpm-root .gcpm-card{flex-direction:column;border-radius:12px;}#gcpm-root .gcpm-split-form{padding:24px 20px;}}"
      : "") +
    (isSlide
      ? "#gcpm-root .gcpm-overlay{background:rgba(0,0,0,.35);}@media (max-width:640px){#gcpm-root .gcpm-card{border-radius:16px 16px 0 0;}#gcpm-root .gcpm-overlay{padding:0;}}@media (min-width:641px){#gcpm-root .gcpm-overlay{align-items:flex-end;justify-content:flex-end;padding:24px;}}@keyframes gcpm-slide{from{transform:translateY(100%);opacity:.4;}to{transform:translateY(0);opacity:1;}}#gcpm-root .gcpm-card{animation:gcpm-slide .32s cubic-bezier(.16,.84,.44,1);}"
      : "@keyframes gcpm-fade{from{opacity:0;transform:translateY(8px) scale(.98);}to{opacity:1;}}#gcpm-root .gcpm-card{animation:gcpm-fade .25s ease;}") +
    "#gcpm-root .gcpm-close{position:absolute;top:10px;right:12px;border:0;background:transparent;font-size:26px;line-height:1;cursor:pointer;color:#9ca3af;z-index:3;padding:0;width:32px;height:32px;}#gcpm-root .gcpm-close:hover{color:#374151;}#gcpm-root .gcpm-body{padding:" +
    (isSlide ? "20px 20px 22px" : isSplit ? "0" : "24px") +
    ";}#gcpm-root .gcpm-headline{margin:0 0 6px;font-weight:700;font-size:" +
    (isMinimal ? "26px" : isSplit ? "24px" : isSlide ? "19px" : "22px") +
    ";line-height:1.2;padding-right:20px;}#gcpm-root .gcpm-sub{margin:0 0 10px;font-size:14px;opacity:.72;}#gcpm-root .gcpm-text{margin:0 0 16px;font-size:13px;opacity:.65;}#gcpm-root .gcpm-form{margin:0;}#gcpm-root .gcpm-row{display:flex;gap:8px;}#gcpm-root .gcpm-field{width:100%;padding:10px 12px;margin:0 0 10px;border:1.5px solid #d1d5db;border-radius:8px;font-size:15px;outline:none;color:#111;background:#fff;}#gcpm-root .gcpm-field:focus{border-color:" +
    btnBg +
    ";box-shadow:0 0 0 2px " +
    btnBg +
    "33;}#gcpm-root textarea.gcpm-field{resize:vertical;min-height:70px;}#gcpm-root .gcpm-btn{width:100%;padding:12px;border:0;border-radius:8px;cursor:pointer;font-size:16px;font-weight:600;color:#fff;background:" +
    btnBg +
    ";transition:filter .15s;}#gcpm-root .gcpm-btn:hover{filter:brightness(1.08);}#gcpm-root .gcpm-btn[disabled]{opacity:.65;cursor:default;}#gcpm-root .gcpm-msg{display:none;margin:0 0 10px;font-size:13px;color:#dc2626;}#gcpm-root .gcpm-thanks{text-align:center;padding:18px 0;font-size:16px;font-weight:600;}";
  function inputFor(f: PopupField): string {
    var label = esc(f.label || f.key),
      placeholder = esc(f.placeholder || ""),
      required = f.required ? " required" : "";
    return f.key === "notes"
      ? '<textarea class="gcpm-field" name="' +
          esc(f.key) +
          '" aria-label="' +
          label +
          '" placeholder="' +
          placeholder +
          '" rows="3"' +
          required +
          "></textarea>"
      : '<input class="gcpm-field" type="' +
          (f.key === "phone" ? "tel" : "text") +
          '" name="' +
          esc(f.key) +
          '" aria-label="' +
          label +
          '" placeholder="' +
          placeholder +
          '"' +
          required +
          "/>";
  }
  var emailInput =
    '<input class="gcpm-field" type="email" name="email" aria-label="Email" placeholder="Email address" required/>';
  var fieldHtml = "";
  if (isSlide) {
    var firstName: PopupField | null = null,
      rest: PopupField[] = [];
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].key === "firstName" && !firstName) firstName = fields[i];
      else rest.push(fields[i]);
    }
    fieldHtml += firstName
      ? '<div class="gcpm-row"><div style="flex:1">' +
        emailInput +
        '</div><div style="flex:1">' +
        inputFor(firstName) +
        "</div></div>"
      : emailInput;
    for (var j = 0; j < rest.length; j++) fieldHtml += inputFor(rest[j]);
  } else {
    fieldHtml += emailInput;
    for (var k = 0; k < fields.length; k++) fieldHtml += inputFor(fields[k]);
  }
  var content =
    (cfg.headline
      ? '<h2 class="gcpm-headline">' + esc(cfg.headline) + "</h2>"
      : "") +
    (cfg.subHeadline
      ? '<p class="gcpm-sub">' + esc(cfg.subHeadline) + "</p>"
      : "") +
    (cfg.bodyText ? '<p class="gcpm-text">' + esc(cfg.bodyText) + "</p>" : "") +
    '<form class="gcpm-form" data-gcpm-form novalidate>' +
    fieldHtml +
    '<div class="gcpm-msg" data-gcpm-msg></div><button type="submit" class="gcpm-btn" data-gcpm-submit>' +
    esc(cfg.buttonText || "Submit") +
    "</button></form>";
  function imageBlock(className: string): string {
    return (
      '<div class="' +
      className +
      ' gcpm-image-frame"><img src="' +
      esc(cfg.imageUrl) +
      '" alt="" onerror="this.parentNode.className+=\' gcpm-image-error\'"/><div class="gcpm-image-fallback" role="status">Image unavailable</div></div>'
    );
  }
  var inner = isSplit
    ? cfg.imageUrl
      ? imageBlock("gcpm-split-img") +
        '<div class="gcpm-split-form">' +
        content +
        "</div>"
      : '<div class="gcpm-split-form" style="width:100%">' + content + "</div>"
    : (!isMinimal && cfg.imageUrl ? imageBlock("") : "") +
      '<div class="gcpm-body">' +
      content +
      "</div>";
  return {
    css: css,
    html:
      '<div id="gcpm-root"><div class="gcpm-overlay" data-gcpm-overlay><div class="gcpm-card" role="dialog" aria-modal="true"><button type="button" class="gcpm-close" data-gcpm-close aria-label="Close">×</button>' +
      inner +
      "</div></div></div>",
  };
}
