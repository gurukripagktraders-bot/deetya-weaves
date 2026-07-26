import React from "react";
import { COLORS } from "../lib/config.js";

// GLOBAL FOOTER COMPONENT
// =============================================
// =============================================
// ARTICLE PAGE COMPONENT (For footer dynamic content)
// =============================================
export function formatArticleContent(text) {
  if (!text) return null;
  return text.split("\n").map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return null;
    
    if (trimmed.startsWith("###")) {
      return (
        <h3 key={idx} style={{ fontFamily: "var(--serif)", fontSize: 18, fontWeight: 700, color: COLORS.indigo, marginTop: 24, marginBottom: 12 }}>
          {trimmed.replace(/^###\s*/, "")}
        </h3>
      );
    }
    if (trimmed.startsWith("##")) {
      return (
        <h2 key={idx} style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 700, color: COLORS.indigo, marginTop: 28, marginBottom: 14 }}>
          {trimmed.replace(/^##\s*/, "")}
        </h2>
      );
    }
    if (trimmed.startsWith("#")) {
      return (
        <h1 key={idx} style={{ fontFamily: "var(--serif)", fontSize: 24, fontWeight: 700, color: COLORS.indigo, marginTop: 32, marginBottom: 16 }}>
          {trimmed.replace(/^#\s*/, "")}
        </h1>
      );
    }
    
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      return (
        <div key={idx} style={{ display: "flex", gap: 12, alignItems: "start", marginBottom: 12, lineHeight: 1.6, fontSize: 14.5, color: COLORS.charcoal }}>
          <span style={{ fontWeight: 600, color: COLORS.turmeric, minWidth: 20 }}>{numberedMatch[1]}.</span>
          <span>{numberedMatch[2]}</span>
        </div>
      );
    }
    
    if (trimmed.startsWith("-") || trimmed.startsWith("•")) {
      return (
        <div key={idx} style={{ display: "flex", gap: 12, alignItems: "start", marginBottom: 10, lineHeight: 1.6, fontSize: 14.5, color: COLORS.charcoal }}>
          <span style={{ color: COLORS.turmeric, fontWeight: 800 }}>•</span>
          <span>{trimmed.replace(/^[-•]\s*/, "")}</span>
        </div>
      );
    }
    
    return (
      <p key={idx} style={{ lineHeight: 1.7, fontSize: 14.5, color: COLORS.charcoal, marginBottom: 16, margin: "0 0 16px 0" }}>
        {trimmed}
      </p>
    );
  });
}

export default function ArticlePage({ title, content, onBack }) {
  return (
    <div style={{ background: COLORS.cream, border: `1px solid ${COLORS.charcoalSoft}18`, borderRadius: 16, padding: "36px 32px", maxWidth: 760, margin: "24px auto", fontFamily: "var(--sans)" }}>
      <button 
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          color: COLORS.indigo,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: 0,
          marginBottom: 24,
          fontFamily: "var(--sans)"
        }}
      >
        <span>←</span> Back to Retailer Catalog
      </button>

      <h1 style={{ fontFamily: "var(--serif)", fontSize: 32, fontWeight: 700, color: COLORS.indigo, margin: "0 0 24px 0", borderBottom: `1px solid ${COLORS.charcoalSoft}15`, paddingBottom: 16 }}>
        {title}
      </h1>

      <div style={{ textAlign: "left" }}>
        {formatArticleContent(content)}
      </div>
    </div>
  );
}

