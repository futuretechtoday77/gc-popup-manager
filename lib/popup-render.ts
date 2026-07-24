// Shared, self-contained popup renderer used by BOTH the vanilla-JS embed
// script and the React admin live preview.
//
// `buildPopup` MUST remain fully self-contained: it may only reference its own
// argument and its own nested helpers (no imports, no module-scope closures).
// The embed route serializes it with Function.prototype.toString() and ships
// the source to the browser, so any external reference would break at runtime.
//
// Returns { css, html }. Callers inject css into a <style> tag and html into
// the page. Interactivity (submit, close, delay, sessionStorage) is layered
// on by the caller using the stable data-gcpm-* hooks.

import type { PopupTemplate, PopupField, PopupStyle } from './types';

export interface RenderConfig {
  id: string;
  template: PopupTemplate;
  headline: string;
  subHeadline: string;
  bodyText: string;
  buttonText: string;
  imageUrl: string;
  fields: PopupField[];
  style: PopupStyle;
}

export function buildPopup(cfg: RenderConfig): { css: string; html: string } {
  // --- nested helpers (must be self-contained) ---
  function esc(v: any): string {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var TEMPLATES = ['classic', 'minimal', 'slideup', 'split'];
  var template: PopupTemplate = TEMPLATES.indexOf(cfg.template) !== -1 ? cfg.template : 'classic';

  var style = cfg.style || ({} as PopupStyle);
  // primaryColor = card/modal background colour
  var cardBg   = style.primaryColor || '#ffffff';
  var btnBg    = style.buttonColor  || '#22c55e';
  var textColor = style.textColor   || '#1a1a1a';
  // Button text is always white for maximum legibility.
  var btnText  = '#ffffff';

  // Ordered, enabled-only fields. Email always rendered first by caller.
  var fields = (cfg.fields || [])
    .slice()
    .sort(function (a, b) { return (a.order || 0) - (b.order || 0); })
    .filter(function (f) { return f && f.enabled; });

  var isSlide   = template === 'slideup';
  var isMinimal = template === 'minimal';
  var isSplit   = template === 'split';

  // ---- CSS ----
  var css =
    '#gcpm-root,#gcpm-root *{box-sizing:border-box;}' +
    '#gcpm-root{position:fixed;inset:0;z-index:2147483647;' +
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:" + textColor + ';}' +

    // Overlay backdrop
    '#gcpm-root .gcpm-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.55);' +
    'display:flex;padding:16px;' +
    (isSlide ? 'align-items:flex-end;justify-content:center;' : 'align-items:center;justify-content:center;') +
    '}' +

    // Card
    '#gcpm-root .gcpm-card{position:relative;background:' + cardBg + ';width:100%;' +
    'box-shadow:0 20px 60px rgba(0,0,0,0.28);overflow:hidden;' +
    (isSlide
      ? 'max-width:420px;border-radius:16px;'
      : isSplit
      ? 'max-width:760px;border-radius:14px;display:flex;flex-direction:row;'
      : isMinimal
      ? 'max-width:480px;border-radius:14px;'
      : 'max-width:480px;border-radius:12px;') +
    '}' +

    // Split-specific columns
    (isSplit
      ? '#gcpm-root .gcpm-split-img{flex:0 0 45%;position:relative;min-height:320px;}' +
        '#gcpm-root .gcpm-split-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;}' +
        '#gcpm-root .gcpm-split-form{flex:1;padding:32px 28px;}' +
        '@media (max-width:639px){' +
          '#gcpm-root .gcpm-split-img{display:none;}' +
          '#gcpm-root .gcpm-card{flex-direction:column;border-radius:12px;}' +
          '#gcpm-root .gcpm-split-form{padding:24px 20px;}' +
        '}'
      : '') +

    // Slide-up backdrop + animation
    (isSlide
      ? '#gcpm-root .gcpm-overlay{background:rgba(0,0,0,0.35);}' +
        '@media (max-width:640px){#gcpm-root .gcpm-card{border-radius:16px 16px 0 0;}' +
        '#gcpm-root .gcpm-overlay{padding:0;}}' +
        '@media (min-width:641px){#gcpm-root .gcpm-overlay{align-items:flex-end;justify-content:flex-end;padding:24px;}}' +
        '@keyframes gcpm-slide{from{transform:translateY(100%);opacity:.4;}to{transform:translateY(0);opacity:1;}}' +
        '#gcpm-root .gcpm-card{animation:gcpm-slide .32s cubic-bezier(.16,.84,.44,1);}'
      : '@keyframes gcpm-fade{from{opacity:0;transform:translateY(8px) scale(.98);}to{opacity:1;transform:none;}}' +
        '#gcpm-root .gcpm-card{animation:gcpm-fade .25s ease;}') +

    // Close button
    '#gcpm-root .gcpm-close{position:absolute;top:10px;right:12px;border:none;background:transparent;' +
    'font-size:26px;line-height:1;cursor:pointer;color:#9ca3af;z-index:3;padding:0;width:32px;height:32px;}' +
    '#gcpm-root .gcpm-close:hover{color:#374151;}' +

    // Classic/minimal image
    '#gcpm-root .gcpm-img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;}' +

    // Body / text
    '#gcpm-root .gcpm-body{padding:' +
    (isSlide ? '20px 20px 22px' : isSplit ? '0' : '24px') + ';}' +
    '#gcpm-root .gcpm-headline{margin:0 0 6px;font-weight:700;' +
    'font-size:' + (isMinimal ? '26px' : isSplit ? '24px' : isSlide ? '19px' : '22px') + ';line-height:1.2;padding-right:20px;}' +
    '#gcpm-root .gcpm-sub{margin:0 0 10px;font-size:14px;opacity:.72;}' +
    '#gcpm-root .gcpm-text{margin:0 0 16px;font-size:13px;opacity:.65;}' +
    '#gcpm-root .gcpm-form{margin:0;}' +
    '#gcpm-root .gcpm-row{display:flex;gap:8px;}' +

    // Inputs
    '#gcpm-root .gcpm-field{width:100%;box-sizing:border-box;padding:10px 12px;margin:0 0 10px;' +
    'border:1.5px solid #d1d5db;border-radius:8px;font-size:15px;outline:none;color:#111;background:#fff;}' +
    '#gcpm-root .gcpm-field:focus{border-color:' + btnBg + ';box-shadow:0 0 0 2px ' + btnBg + '33;}' +
    '#gcpm-root textarea.gcpm-field{resize:vertical;min-height:70px;}' +

    // Button — always white text
    '#gcpm-root .gcpm-btn{width:100%;padding:12px;border:none;border-radius:8px;cursor:pointer;' +
    'font-size:16px;font-weight:600;color:' + btnText + ';background:' + btnBg + ';transition:filter .15s;}' +
    '#gcpm-root .gcpm-btn:hover{filter:brightness(1.08);}' +
    '#gcpm-root .gcpm-btn[disabled]{opacity:.65;cursor:default;}' +
    '#gcpm-root .gcpm-msg{display:none;margin:0 0 10px;font-size:13px;color:#dc2626;}' +
    '#gcpm-root .gcpm-thanks{text-align:center;padding:18px 0;font-size:16px;font-weight:600;}';

  // ---- Field inputs HTML ----
  function inputFor(f: PopupField): string {
    var lbl = esc(f.label || f.key);
    var ph  = esc(f.placeholder || '');
    var req = f.required ? ' required' : '';
    if (f.key === 'notes') {
      return '<textarea class="gcpm-field" name="' + esc(f.key) + '" aria-label="' + lbl +
             '" placeholder="' + ph + '" rows="3"' + req + '></textarea>';
    }
    var type = f.key === 'phone' ? 'tel' : 'text';
    return '<input class="gcpm-field" type="' + type + '" name="' + esc(f.key) +
           '" aria-label="' + lbl + '" placeholder="' + ph + '"' + req + '/>';
  }

  var emailInput =
    '<input class="gcpm-field" type="email" name="email" aria-label="Email" ' +
    'placeholder="Email address" required/>';

  // Build the form field block, varying layout per template
  var fieldHtml = '';
  if (isSlide) {
    // Slide-up: email + firstName side-by-side when firstName enabled
    var firstName: PopupField | null = null;
    var rest: PopupField[] = [];
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].key === 'firstName' && !firstName) firstName = fields[i];
      else rest.push(fields[i]);
    }
    if (firstName) {
      fieldHtml += '<div class="gcpm-row"><div style="flex:1">' + emailInput + '</div>' +
                   '<div style="flex:1">' + inputFor(firstName) + '</div></div>';
    } else {
      fieldHtml += emailInput;
    }
    for (var j = 0; j < rest.length; j++) fieldHtml += inputFor(rest[j]);
  } else {
    fieldHtml += emailInput;
    for (var k = 0; k < fields.length; k++) fieldHtml += inputFor(fields[k]);
  }

  var formBlock =
    '<form class="gcpm-form" data-gcpm-form novalidate>' +
    fieldHtml +
    '<div class="gcpm-msg" data-gcpm-msg></div>' +
    '<button type="submit" class="gcpm-btn" data-gcpm-submit>' + esc(cfg.buttonText || 'Submit') + '</button>' +
    '</form>';

  var contentBlock =
    (cfg.headline    ? '<h2 class="gcpm-headline">'  + esc(cfg.headline)    + '</h2>' : '') +
    (cfg.subHeadline ? '<p class="gcpm-sub">'         + esc(cfg.subHeadline) + '</p>'  : '') +
    (cfg.bodyText    ? '<p class="gcpm-text">'        + esc(cfg.bodyText)    + '</p>'  : '') +
    formBlock;

  var showClassicImg = !isMinimal && !isSplit && cfg.imageUrl;

  var innerHtml: string;
  if (isSplit) {
    // Split: two-column. If no imageUrl, show just the form column full-width.
    if (cfg.imageUrl) {
      innerHtml =
        '<div class="gcpm-split-img"><img src="' + esc(cfg.imageUrl) + '" alt=""/></div>' +
        '<div class="gcpm-split-form">' + contentBlock + '</div>';
    } else {
      // Graceful fallback: single column, full width
      innerHtml = '<div style="padding:32px 28px;width:100%;">' + contentBlock + '</div>';
    }
  } else {
    innerHtml =
      (showClassicImg ? '<img class="gcpm-img" src="' + esc(cfg.imageUrl) + '" alt=""/>' : '') +
      '<div class="gcpm-body">' + contentBlock + '</div>';
  }

  var html =
    '<div id="gcpm-root">' +
    '<div class="gcpm-overlay" data-gcpm-overlay>' +
    '<div class="gcpm-card" role="dialog" aria-modal="true">' +
    '<button type="button" class="gcpm-close" data-gcpm-close aria-label="Close">\u00D7</button>' +
    innerHtml +
    '</div>' +
    '</div>' +
    '</div>';

  return { css: css, html: html };
}
