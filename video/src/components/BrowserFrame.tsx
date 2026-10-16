import React from "react";
import { violet } from "../theme";

export const BROWSER = { width: 1360, toolbar: 56, contentHeight: 765 };

export const BrowserFrame: React.FC<{ children: React.ReactNode; url?: string; style?: React.CSSProperties }> = ({
  children,
  url = "alcancia-celo.vercel.app",
  style,
}) => (
  <div
    style={{
      width: BROWSER.width,
      borderRadius: 26,
      overflow: "hidden",
      background: "#ffffff",
      boxShadow: "0 50px 120px rgba(13,10,60,0.45), 0 0 0 1px rgba(255,255,255,0.25)",
      ...style,
    }}
  >
    <div
      style={{
        height: BROWSER.toolbar,
        background: "#f6f5fb",
        borderBottom: `1px solid ${violet[100]}`,
        display: "flex",
        alignItems: "center",
        padding: "0 22px",
        gap: 10,
        position: "relative",
      }}
    >
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <div key={c} style={{ width: 15, height: 15, borderRadius: "50%", background: c }} />
      ))}
      <div
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          width: 560,
          height: 34,
          borderRadius: 10,
          background: "#ffffff",
          border: `1px solid ${violet[100]}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          fontSize: 18,
          fontWeight: 500,
          color: "#4b4a6b",
        }}
      >
        <span style={{ fontSize: 14 }}>🔒</span>
        {url}
      </div>
    </div>
    <div style={{ height: BROWSER.contentHeight, position: "relative", overflow: "hidden", background: "#ffffff" }}>
      {children}
    </div>
  </div>
);
