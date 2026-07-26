import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { COLORS, ADMIN_PIN } from "../lib/config.js";

// ADMIN / SELLER LOGIN SCREEN (Dedicated Separate Entity Feel)
// =============================================
export default function AdminLoginScreen({ onLogin, onBackToCatalog }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    if (pin === ADMIN_PIN) {
      setLoading(true);
      onLogin({ id: "admin", phone: "admin", shop_name: "Guru Kripa Traders", owner_name: "Admin", is_admin: true });
    } else {
      setError("Incorrect PIN. Please try again.");
    }
  };

  return (
    <div style={{ background: COLORS.indigo, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "var(--sans)" }}>
      <div style={{ width: "100%", maxWidth: 380, background: COLORS.cream, border: `1px solid ${COLORS.charcoalSoft}22`, borderRadius: 14, padding: "36px 32px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: COLORS.madder, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <svg width="26" height="26" viewBox="0 0 20 20">
              {[2,7,12,17].map(x => <line key={x} x1={x} y1="1" x2={x} y2="19" stroke={COLORS.turmeric} strokeWidth="1.6"/>)}
              {[2,7,12,17].map(y => <line key={"h"+y} x1="1" y1={y} x2="19" y2={y} stroke={COLORS.ivory} strokeWidth="1.2" opacity="0.5"/>)}
            </svg>
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 22, color: COLORS.indigo, fontWeight: "600" }}>Deetya Weaves</div>
          <div style={{ fontSize: 11.5, color: COLORS.madder, marginTop: 4, letterSpacing: 1, textTransform: "uppercase", fontWeight: "600" }}>Admin Portal</div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, color: COLORS.charcoalSoft, display: "block", marginBottom: 8, fontWeight: 500 }}>Enter Seller PIN</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.ivoryDeep, borderRadius: 8, padding: "11px 14px" }}>
            <ShieldCheck size={16} color={COLORS.indigo} />
            <input
              type="password"
              value={pin}
              onChange={e => { setPin(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="••••••••"
              autoFocus
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 16, color: COLORS.charcoal, width: "100%", fontFamily: "var(--sans)", letterSpacing: pin ? "4px" : "normal" }}
            />
          </div>
          {error && <div style={{ color: COLORS.madder, fontSize: 12, marginTop: 8 }}>{error}</div>}
        </div>

        <button onClick={handleLogin} disabled={loading}
          style={{ width: "100%", background: COLORS.indigo, color: COLORS.cream, border: "none", padding: "12px", borderRadius: 8, fontSize: 14, cursor: "pointer", fontFamily: "var(--sans)", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          {loading ? "Authorizing..." : "Access Admin Dashboard"}
        </button>

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button
            onClick={onBackToCatalog}
            style={{ background: "none", border: "none", color: COLORS.charcoalSoft, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
          >
            ← Back to Retailer Catalog
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
