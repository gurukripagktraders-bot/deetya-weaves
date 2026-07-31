import React, { useState } from "react";
import { CheckCircle2, Clock, RefreshCw, AlertTriangle, ShieldCheck, Image as ImageIcon } from "lucide-react";
import { COLORS, STAGES } from "../../lib/config.js";

// UI COMPONENTS
// =============================================
export function ThreadDivider() {
  return (
    <div style={{ height: "1.5px", background: `${COLORS.charcoalSoft}10`, margin: "24px 0", width: "100%" }} />
  );
}

export function WeavingProgress({ stage }) {
  const idx = STAGES.indexOf(stage);
  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
      {STAGES.map((s, i) => {
        const done = i <= idx;
        return (
          <React.Fragment key={s}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 64 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: done ? COLORS.sage : COLORS.ivoryDeep, color: done ? COLORS.cream : COLORS.charcoalSoft, border: done ? "none" : `1px solid ${COLORS.charcoalSoft}55` }}>
                {done ? <CheckCircle2 size={16} /> : <Clock size={14} />}
              </div>
              <span style={{ fontSize: 11, marginTop: 6, color: COLORS.charcoalSoft, textAlign: "center" }}>{s}</span>
            </div>
            {i < STAGES.length - 1 && <div style={{ flex: 1, height: 2, background: i < idx ? COLORS.sage : `${COLORS.charcoalSoft}33`, marginBottom: 18 }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: COLORS.cream, border: `1px solid ${COLORS.charcoalSoft}22`, borderRadius: 10, padding: "16px 18px", flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 12, color: COLORS.charcoalSoft, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontFamily: "var(--serif)", color: accent || COLORS.indigo, fontWeight: 600 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: COLORS.charcoalSoft, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function SyncBar({ usingSample, lastSynced, loading, error, sync }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12 }}>
      <button onClick={sync} disabled={loading} style={{ background: "transparent", border: `1px solid ${COLORS.charcoalSoft}44`, color: COLORS.charcoalSoft, padding: "5px 10px", borderRadius: 7, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
        <RefreshCw size={12} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
        {loading ? "Syncing…" : "Sync now"}
      </button>
      {error ? <span style={{ color: COLORS.madder, display: "flex", alignItems: "center", gap: 5 }}><AlertTriangle size={12} />{error}</span>
        : usingSample ? <span style={{ color: COLORS.turmeric }}>Showing sample data…</span>
        : <span style={{ color: COLORS.sage, display: "flex", alignItems: "center", gap: 5 }}><CheckCircle2 size={12} />Live from sheet · {lastSynced?.toLocaleTimeString()}</span>}
    </div>
  );
}

// =============================================
// LOGIN SCREEN
// =============================================
export function PhoneInput({ icon: Icon, ...props }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.ivoryDeep, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
      {Icon && <Icon size={15} color={COLORS.charcoalSoft} />}
      <input {...props} style={{ border: "none", outline: "none", background: "transparent", fontSize: 14, color: COLORS.charcoal, width: "100%", fontFamily: "var(--sans)" }} />
    </div>
  );
}

export function SubmitBtn({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width: "100%", background: disabled ? COLORS.charcoalSoft : COLORS.indigo, color: COLORS.cream, border: "none", padding: "11px", borderRadius: 8, fontSize: 13.5, cursor: disabled ? "default" : "pointer", fontFamily: "var(--sans)" }}>
      {children}
    </button>
  );
}

export function AdminPinInput({ onVerify, error, setError }) {
  const [pin, setPin] = useState("");
  return (
    <>
      <div style={{ display:"flex", alignItems:"center", gap:8, background: COLORS.ivoryDeep, borderRadius:8, padding:"10px 12px", marginBottom:12 }}>
        <ShieldCheck size={15} color={COLORS.charcoalSoft}/>
        <input
          type="password"
          value={pin}
          onChange={e => { setPin(e.target.value); setError(""); }}
          placeholder="Admin PIN"
          style={{ border:"none", outline:"none", background:"transparent", fontSize:14, color: COLORS.charcoal, width:"100%", fontFamily:"var(--sans)" }}
        />
      </div>
      {error && <div style={{ color: COLORS.madder, fontSize:12, marginBottom:10 }}>{error}</div>}
      <button onClick={() => onVerify(pin)}
        style={{ width:"100%", background: COLORS.indigo, color: COLORS.cream, border:"none", padding:"11px", borderRadius:8, fontSize:13.5, cursor:"pointer", fontFamily:"var(--sans)" }}>
        Enter dashboard
      </button>
    </>
  );
}

// ─────────────────────────────────────────────
// SKELETON LOADING CARDS
// ─────────────────────────────────────────────
export function SkeletonCard() {
  return (
    <div style={{ background: COLORS.cream, border: `1px solid ${COLORS.ivoryDeep}`, borderRadius: 16, padding: 14 }}>
      <div className="skeleton-pulse" style={{ width: "100%", aspectRatio: "4/3", borderRadius: 10, marginBottom: 10 }}/>
      <div className="skeleton-pulse" style={{ height: 14, width: "80%", marginBottom: 6 }}/>
      <div className="skeleton-pulse" style={{ height: 11, width: "55%", marginBottom: 10 }}/>
      <div className="skeleton-pulse" style={{ height: 16, width: "40%", marginBottom: 8 }}/>
      <div className="skeleton-pulse" style={{ height: 32, width: "100%", borderRadius: 8 }}/>
    </div>
  );
}

export function SkeletonGrid() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
      {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

// ─────────────────────────────────────────────
// TOAST NOTIFICATION
// ─────────────────────────────────────────────
export function Toast({ message, type = "success", onDone }) {
  const [exiting, setExiting] = React.useState(false);

  React.useEffect(() => {
    const t1 = setTimeout(() => setExiting(true), 2600);
    const t2 = setTimeout(() => onDone && onDone(), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const icon = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";
  const iconBg = type === "success" ? COLORS.sage : type === "error" ? COLORS.madder : COLORS.turmeric;

  return (
    <div className={exiting ? "toast-exit" : "toast-enter"} style={{
      position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
      background: COLORS.charcoal, color: COLORS.ivory, borderRadius: 12,
      padding: "12px 18px", display: "flex", alignItems: "center", gap: 10,
      zIndex: 9999, boxShadow: "0 8px 32px rgba(26,14,40,0.35)",
      fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 500,
      whiteSpace: "nowrap", maxWidth: "90vw",
    }}>
      <div style={{ width: 24, height: 24, borderRadius: "50%", background: iconBg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, color: "#fff", fontWeight: 700, flexShrink: 0 }}>
        {icon}
      </div>
      {message}
    </div>
  );
}

// Shows a product/order image, falling back to a placeholder icon if the
// src is missing OR fails to load (e.g. a dead Google Drive link) — instead
// of the browser's default broken-image icon.
export function ImageWithFallback({ src, alt, style, iconSize = 18, referrerPolicy }) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center", background: COLORS.ivoryDeep }}>
        <ImageIcon size={iconSize} color={COLORS.charcoalSoft + "55"} />
      </div>
    );
  }
  return <img src={src} alt={alt} style={style} referrerPolicy={referrerPolicy} onError={() => setErrored(true)} />;
}

// =============================================
