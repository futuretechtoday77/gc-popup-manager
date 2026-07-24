"use client";

import { useMemo } from "react";
import { buildPopup } from "@/lib/popup-render";
import type {
  PopupField,
  PopupImageSettings,
  PopupContentStyle,
  PopupStyle,
  PopupTemplate,
} from "@/lib/types";

export interface PreviewData {
  id: string;
  template: PopupTemplate;
  headline: string;
  subHeadline: string;
  bodyText: string;
  buttonText: string;
  imageUrl: string;
  imageSettings: PopupImageSettings;
  contentStyle: PopupContentStyle;
  fields: PopupField[];
  style: PopupStyle;
}

// A faint placeholder "page" behind the popup so it reads as a real overlay.
const FAKE_PAGE = `
  <div style="padding:18px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#c7ccd6;">
    <div style="height:14px;width:45%;background:#e3e6ec;border-radius:4px;margin-bottom:14px;"></div>
    <div style="height:9px;width:92%;background:#eceef3;border-radius:4px;margin-bottom:8px;"></div>
    <div style="height:9px;width:85%;background:#eceef3;border-radius:4px;margin-bottom:8px;"></div>
    <div style="height:9px;width:88%;background:#eceef3;border-radius:4px;margin-bottom:8px;"></div>
    <div style="height:120px;width:100%;background:#eef0f4;border-radius:8px;margin:16px 0;"></div>
    <div style="height:9px;width:80%;background:#eceef3;border-radius:4px;margin-bottom:8px;"></div>
    <div style="height:9px;width:90%;background:#eceef3;border-radius:4px;margin-bottom:8px;"></div>
    <div style="height:9px;width:70%;background:#eceef3;border-radius:4px;"></div>
  </div>
`;

export default function PopupPreview({
  data,
  device,
}: {
  data: PreviewData;
  device: "mobile" | "desktop";
}) {
  const width = device === "mobile" ? 375 : 480;
  const height = device === "mobile" ? 600 : 520;

  const srcDoc = useMemo(() => {
    let built: { css: string; html: string };
    try {
      built = buildPopup(data);
    } catch {
      built = { css: "", html: "" };
    }
    return `<!doctype html><html><head><meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1"/>
      <style>html,body{margin:0;padding:0;background:#fff;height:100%;}
      ${built.css}</style></head>
      <body>${FAKE_PAGE}${built.html}</body></html>`;
  }, [data]);

  return (
    <div className="flex flex-col items-center">
      <div
        className="overflow-hidden rounded-[20px] border-[6px] border-gray-800 bg-white shadow-lg"
        style={{ width, height }}
      >
        <iframe
          title="Popup preview"
          srcDoc={srcDoc}
          style={{ width, height, border: "none", display: "block" }}
        />
      </div>
      <p className="mt-2 text-xs text-gray-400">
        {device === "mobile" ? "Mobile · 375px" : "Desktop · 480px"}
      </p>
    </div>
  );
}
