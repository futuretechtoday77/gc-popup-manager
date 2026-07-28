// Deterministic source-level regression check for popup rendering.
// Run: node scripts/check-popup-render.mjs   (no test framework in this repo)
import { buildPopup } from "../lib/popup-render.ts";

let failed = 0;
function check(name, cond) {
  if (cond) {
    console.log("ok   - " + name);
  } else {
    failed++;
    console.error("FAIL - " + name);
  }
}

const base = {
  id: "t",
  headline: "Headline",
  subHeadline: "Sub",
  bodyText: "Body",
  buttonText: "Go",
  fields: [],
  style: {},
};

const IMG = "https://example.public.blob.vercel-storage.com/pic-abc.jpg";

// --- Split with an image -------------------------------------------------
const split = buildPopup({ ...base, template: "split", imageUrl: IMG });
check("split renders the image panel", split.html.includes("gcpm-split-img"));
check("split keeps the exact image URL", split.html.includes(IMG));
check("split image is not pre-marked as error", !/gcpm-split-img gcpm-image-frame gcpm-image-error/.test(split.html));
check(
  "split panel stretches to the card height with a minimum floor",
  /\.gcpm-split-img\.gcpm-image-frame\{height:auto;align-self:stretch;min-height:\d+px;\}/.test(split.css),
);
check("split panel is a stretched flex item", /\.gcpm-split-img\{flex:0 0 42%;align-self:stretch;\}/.test(split.css));
check("split img fills the panel", /\.gcpm-image-frame img\{[^}]*height:100%/.test(split.css));
check(
  "split img and fallback fill the stretched panel",
  /\.gcpm-split-img\.gcpm-image-frame img,[^{]*\.gcpm-image-fallback\{position:absolute;inset:0;height:100%;width:100%;\}/.test(split.css),
);
check("split card keeps a minimum height", /\.gcpm-card\{min-height:\d+px;\}/.test(split.css));
check("split fallback exists", split.html.includes("Image unavailable"));
check(
  "split hides the image only under the mobile breakpoint",
  /@media \(max-width:639px\)\{[^}]*\.gcpm-split-img\{display:none;\}/.test(split.css),
);

// --- Split without an image ---------------------------------------------
const splitNoImg = buildPopup({ ...base, template: "split", imageUrl: "" });
check("split without an image still renders the panel", splitNoImg.html.includes("gcpm-split-img"));
check("split without an image shows the error state", splitNoImg.html.includes("gcpm-image-error"));

// --- Whitespace-only URL is treated as missing ---------------------------
const splitBlank = buildPopup({ ...base, template: "split", imageUrl: "   " });
check("blank image URL degrades to the fallback", splitBlank.html.includes("gcpm-image-error"));

// --- Classic keeps its existing behaviour --------------------------------
const classic = buildPopup({ ...base, template: "classic", imageUrl: IMG });
check("classic renders its image", classic.html.includes(IMG));
const classicNoImg = buildPopup({ ...base, template: "classic", imageUrl: "" });
check("classic without an image renders no image frame", !classicNoImg.html.includes("gcpm-image-frame"));

// --- Minimal never renders an image --------------------------------------
const minimal = buildPopup({ ...base, template: "minimal", imageUrl: IMG });
check("minimal renders no image", !minimal.html.includes("gcpm-image-frame"));

if (failed > 0) {
  console.error("\n" + failed + " check(s) failed");
  process.exit(1);
}
console.log("\nAll popup render checks passed");
