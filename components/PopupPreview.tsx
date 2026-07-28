"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  // Native device frame dimensions — these drive popup CSS media queries.
  const nativeWidth = device === "mobile" ? 375 : 480;
  const nativeHeight = device === "mobile" ? 600 : 520;

  // Measure the available container width so we can scale the frame to fit
  // without ever overflowing or clipping horizontally.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    // Initial measurement
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth;
      setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Leave a few pixels of breathing room so the border/shadow never clips.
  const available = containerWidth > 0 ? containerWidth - 12 : nativeWidth;
  const scale = available < nativeWidth ? available / nativeWidth : 1;
  const scaledWidth = Math.round(nativeWidth * scale);
  const scaledHeight = Math.round(nativeHeight * scale);

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
    // ref wrapper fills the full column width so ResizeObserver captures it.
    <div ref={wrapRef} className="w-full">
      <div className="flex flex-col items-center">
        {/* Outer wrapper constrains layout to the scaled visual size.
            The inner device frame uses native dimensions (so popup CSS media
            queries fire correctly) then is CSS-scaled down to fit. */}
        <div style={{ width: scaledWidth, height: scaledHeight }}>
          <div
            className="overflow-hidden rounded-[20px] border-[6px] border-gray-800 bg-white shadow-lg"
            style={{
              width: nativeWidth,
              height: nativeHeight,
              transform: scale < 1 ? `scale(${scale})` : undefined,
              transformOrigin: "top left",
            }}
          >
            <iframe
              title="Popup preview"
              srcDoc={srcDoc}
              style={{ width: nativeWidth, height: nativeHeight, border: "none", display: "block" }}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {device === "mobile" ? "Mobile · 375px" : "Desktop · 480px"}
        </p>
      </div>
    </div>
  );
}
