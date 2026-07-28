import type {
  PopupTemplate,
  PopupField,
  PopupStyle,
  PopupImageSettings,
  PopupContentStyle,
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
  contentStyle?: PopupContentStyle;
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

  // ---- Content typography (contentStyle) ----
  var clampNum = function (v: any, min: number, max: number, fallback: number) {
    var n = Number(v);
    return isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
  };
  var alignOf = function (v: any, fb: string) {
    return v === "left" || v === "center" || v === "right" ? v : fb;
  };
  var fontStacks: any = {
    system:
      "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
    arial: "Arial,Helvetica,sans-serif",
    georgia: "Georgia,'Times New Roman',serif",
    verdana: "Verdana,Geneva,sans-serif",
    "sans-serif": "sans-serif",
  };
  var csRaw: any = cfg.contentStyle || {};
  var famKey = String(csRaw.fontFamily || "system").toLowerCase();
  var fontFamily = fontStacks[famKey] || fontStacks.system;
  var hRaw: any = csRaw.headline || {},
    sRaw: any = csRaw.subHeadline || {},
    bRaw: any = csRaw.bodyText || {};
  // Desktop values (authorable range).
  var hAlign = alignOf(hRaw.align, "center"),
    hSize = clampNum(hRaw.fontSize, 10, 48, 22),
    hWeight = clampNum(hRaw.fontWeight, 300, 900, 700);
  var sAlign = alignOf(sRaw.align, "left"),
    sSize = clampNum(sRaw.fontSize, 10, 48, 14),
    sWeight = clampNum(sRaw.fontWeight, 300, 900, 400);
  var bAlign = alignOf(bRaw.align, "left"),
    bSize = clampNum(bRaw.fontSize, 10, 48, 13),
    bWeight = clampNum(bRaw.fontWeight, 300, 900, 400);
  // Mobile-safe clamps: never tiny, never layout-breaking.
  var mClamp = function (v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
  };
  var hSizeM = mClamp(hSize, 18, 28),
    sSizeM = mClamp(sSize, 13, 18),
    bSizeM = mClamp(bSize, 13, 16);
  var hWeightM = mClamp(hWeight, 400, 800),
    sWeightM = mClamp(sWeight, 400, 800),
    bWeightM = mClamp(bWeight, 400, 800);

  // Normalize the image URL once: trim stray whitespace/newlines that would
  // otherwise produce a broken src. External and Blob URLs pass through as-is.
  var imageUrl = String(cfg.imageUrl == null ? "" : cfg.imageUrl).trim();
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
  var scale = clampNum(raw.scale, 50, 150, 100);
  var desktopHeight = clampNum(
    raw.desktopHeight,
    100,
    360,
    template === "split" ? 360 : 180,
  );
  var mobileHeight = clampNum(raw.mobileHeight, 100, 260, 150);
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
  // Split needs a resolved panel height: `align-self:stretch` + `height:auto`
  // gives the absolutely-positioned <img> no height to fill, so the image
  // panel collapses. Pin an explicit height for both panel and card instead.
  var splitPanelHeight = Math.max(desktopHeight, 320);
  var css =
    "#gcpm-root,#gcpm-root *{box-sizing:border-box;}" +
    "#gcpm-root{position:fixed;inset:0;z-index:2147483647;font-family:" +
    fontFamily +
    ";color:" +
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
        ? "max-width:760px;border-radius:14px;display:flex;flex-direction:row;align-items:stretch;"
        : isMinimal
          ? "max-width:480px;border-radius:14px;"
          : "max-width:480px;border-radius:12px;") +
    "}" +
    // Stable image frame: a real block element with a resolved height. The
    // <img> fills it absolutely so it can never collapse; a fallback panel
    // shows if the image is missing or fails to load.
    "#gcpm-root .gcpm-image-frame{position:relative;width:100%;height:" +
    desktopHeight +
    "px;overflow:hidden;background:#eef2f7;}" +
    "#gcpm-root .gcpm-image-frame img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:" +
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
      ? "#gcpm-root .gcpm-split-img{flex:0 0 42%;}#gcpm-root .gcpm-split-img.gcpm-image-frame{height:" +
        splitPanelHeight +
        "px;min-height:" +
        splitPanelHeight +
        "px;}#gcpm-root .gcpm-split-img.gcpm-image-frame img{height:100%;}#gcpm-root .gcpm-card{min-height:" +
        splitPanelHeight +
        "px;}#gcpm-root .gcpm-split-form{flex:1;min-width:0;padding:32px 28px;}@media (max-width:639px){#gcpm-root .gcpm-split-img{display:none;}#gcpm-root .gcpm-card{flex-direction:column;border-radius:12px;min-height:0;}#gcpm-root .gcpm-split-form{padding:24px 20px;}}"
      : "") +
    (isSlide
      ? "#gcpm-root .gcpm-overlay{background:rgba(0,0,0,.35);}@media (max-width:640px){#gcpm-root .gcpm-card{border-radius:16px 16px 0 0;}#gcpm-root .gcpm-overlay{padding:0;}}@media (min-width:641px){#gcpm-root .gcpm-overlay{align-items:flex-end;justify-content:flex-end;padding:24px;}}@keyframes gcpm-slide{from{transform:translateY(100%);opacity:.4;}to{transform:translateY(0);opacity:1;}}#gcpm-root .gcpm-card{animation:gcpm-slide .32s cubic-bezier(.16,.84,.44,1);}"
      : "@keyframes gcpm-fade{from{opacity:0;transform:translateY(8px) scale(.98);}to{opacity:1;}}#gcpm-root .gcpm-card{animation:gcpm-fade .25s ease;}") +
    "#gcpm-root .gcpm-close{position:absolute;top:10px;right:12px;border:0;background:transparent;font-size:26px;line-height:1;cursor:pointer;color:#9ca3af;z-index:3;padding:0;width:32px;height:32px;}#gcpm-root .gcpm-close:hover{color:#374151;}#gcpm-root .gcpm-body{padding:" +
    (isSlide ? "20px 20px 22px" : isSplit ? "0" : "24px") +
    ";}" +
    // Content typography driven by contentStyle (desktop values).
    "#gcpm-root .gcpm-headline{margin:0 0 6px;line-height:1.2;padding-right:20px;font-size:" +
    hSize +
    "px;font-weight:" +
    hWeight +
    ";text-align:" +
    hAlign +
    ";}#gcpm-root .gcpm-sub{margin:0 0 10px;opacity:.72;font-size:" +
    sSize +
    "px;font-weight:" +
    sWeight +
    ";text-align:" +
    sAlign +
    ";}#gcpm-root .gcpm-text{margin:0 0 16px;opacity:.65;font-size:" +
    bSize +
    "px;font-weight:" +
    bWeight +
    ";text-align:" +
    bAlign +
    ";}" +
    // Mobile clamps: readable safe ranges only.
    "@media (max-width:639px){#gcpm-root .gcpm-headline{font-size:" +
    hSizeM +
    "px;font-weight:" +
    hWeightM +
    ";}#gcpm-root .gcpm-sub{font-size:" +
    sSizeM +
    "px;font-weight:" +
    sWeightM +
    ";}#gcpm-root .gcpm-text{font-size:" +
    bSizeM +
    "px;font-weight:" +
    bWeightM +
    ";}}" +
    "#gcpm-root .gcpm-form{margin:0;}#gcpm-root .gcpm-row{display:flex;gap:8px;}#gcpm-root .gcpm-field{width:100%;padding:10px 12px;margin:0 0 10px;border:1.5px solid #d1d5db;border-radius:8px;font-size:15px;outline:none;color:#111;background:#fff;font-family:inherit;}#gcpm-root .gcpm-field:focus{border-color:" +
    btnBg +
    ";box-shadow:0 0 0 2px " +
    btnBg +
    "33;}#gcpm-root textarea.gcpm-field{resize:vertical;min-height:70px;}#gcpm-root .gcpm-btn{width:100%;padding:12px;border:0;border-radius:8px;cursor:pointer;font-size:16px;font-weight:600;color:#fff;font-family:inherit;background:" +
    btnBg +
    ";transition:filter .15s;}#gcpm-root .gcpm-btn:hover{filter:brightness(1.08);}#gcpm-root .gcpm-btn[disabled]{opacity:.65;cursor:default;}#gcpm-root .gcpm-msg{display:none;margin:0 0 10px;font-size:13px;color:#dc2626;}#gcpm-root .gcpm-thanks{text-align:center;padding:22px 6px;font-size:16px;font-weight:600;line-height:1.45;}";
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
  // Ordering rule: Name (if enabled) first, then Email, then the remaining
  // enabled fields in their configured order.
  var nameField: PopupField | null = null,
    rest: PopupField[] = [];
  for (var fi = 0; fi < fields.length; fi++) {
    if (fields[fi].key === "name" && !nameField) nameField = fields[fi];
    else rest.push(fields[fi]);
  }
  var fieldHtml = "";
  if (nameField) fieldHtml += inputFor(nameField);
  fieldHtml += emailInput;
  for (var ri = 0; ri < rest.length; ri++) fieldHtml += inputFor(rest[ri]);
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
  // A stable image panel. The frame always has a resolved size, so a missing or
  // failed image degrades to a visible "Image unavailable" panel instead of
  // collapsing the column away.
  function imageBlock(className: string): string {
    var missing = !imageUrl;
    return (
      '<div class="' +
      className +
      ' gcpm-image-frame' +
      (missing ? " gcpm-image-error" : "") +
      '"><img src="' +
      esc(imageUrl) +
      '" alt="" onerror="this.parentNode.className+=\' gcpm-image-error\'"/><div class="gcpm-image-fallback" role="status">Image unavailable</div></div>'
    );
  }
  // Split always renders its image column on desktop. When no image is set the
  // panel shows the "Image unavailable" state rather than disappearing, so the
  // two-column layout stays predictable in the admin preview and the embed.
  var inner = isSplit
    ? imageBlock("gcpm-split-img") +
      '<div class="gcpm-split-form">' +
      content +
      "</div>"
    : (!isMinimal && imageUrl ? imageBlock("") : "") +
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

// Build the in-popup success notification markup from the configured success
// text. Escapes content and converts newlines to <br>; never renders HTML.
export function successHtml(text: string): string {
  function esc(v: any): string {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  var safe = esc(text).replace(/\n/g, "<br>");
  return '<div class="gcpm-thanks" role="status">' + safe + "</div>";
}
