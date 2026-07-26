import React, { useState } from "react";
import { Clock, Phone, ShieldCheck, ChevronLeft } from "lucide-react";
import { COLORS, ADMIN_PIN, MOCK_OTP } from "../lib/config.js";
import { supabase } from "../lib/db.js";
import { PhoneInput, SubmitBtn } from "./ui/atoms.jsx";

export default function LoginScreen({ onLogin }) {
  const [step, setStep] = useState("phone"); // phone, otp, register, pending, pending_existing, admin
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [adminPin, setAdminPin] = useState("");

  const verifyAdmin = () => {
    if (adminPin === ADMIN_PIN) {
      onLogin({ id: "admin", phone: "admin", shop_name: "Guru Kripa Traders", owner_name: "Admin", is_admin: true });
    } else {
      setError("Incorrect PIN.");
    }
  };

  const sendOtp = () => {
    if (!/^\d{10}$/.test(phone)) { setError("Enter a valid 10-digit phone number."); return; }
    setError(""); setStep("otp");
  };

  const verifyOtp = async () => {
    if (otp !== MOCK_OTP) { setError("Incorrect code. Please check your phone for the OTP."); return; }
    setError(""); setSaving(true);
    try {
      const rows = await supabase(`retailers?phone=eq.${phone}&select=*`);
      if (rows && rows.length > 0) {
        const retailer = rows[0];
        if (retailer.status === "pending") { setStep("pending_existing"); }
        else if (retailer.status === "rejected") { setError("This account was not approved. Contact Deetya Weaves."); }
        else { onLogin({ ...retailer, is_admin: false }); }
      } else {
        setStep("register");
      }
    } catch (e) { setError(e.message || "Unknown error"); }
    finally { setSaving(false); }
  };

  const submitRegistration = async () => {
    if (!shopName.trim()) { setError("Enter your shop name."); return; }
    setSaving(true); setError("");
    try {
      await supabase("retailers", "POST", { phone, shop_name: shopName, owner_name: ownerName, status: "pending" });
      setStep("pending");
    } catch (e) { setError("Could not submit. Try again."); }
    finally { setSaving(false); }
  };

  const verifyAdminPin = (pin) => {
    if (pin === ADMIN_PIN) {
      onLogin({ id: "admin", phone: "admin", shop_name: "Guru Kripa Traders", owner_name: "Admin", is_admin: true });
    } else {
      setError("Incorrect PIN.");
    }
  };

  return (
    <div style={{ background: COLORS.ivory, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "var(--sans)" }}>
      <div style={{ width: "100%", maxWidth: 380, background: COLORS.cream, border: `1px solid ${COLORS.charcoalSoft}22`, borderRadius: 14, padding: "32px 28px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: COLORS.indigo, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
            <svg width="24" height="24" viewBox="0 0 20 20">
              {[2,7,12,17].map(x => <line key={x} x1={x} y1="1" x2={x} y2="19" stroke={COLORS.turmeric} strokeWidth="1.6"/>)}
              {[2,7,12,17].map(y => <line key={"h"+y} x1="1" y1={y} x2="19" y2={y} stroke={COLORS.ivory} strokeWidth="1.2" opacity="0.5"/>)}
            </svg>
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 20, color: COLORS.indigo }}>Deetya Weaves</div>
          <div style={{ fontSize: 11, color: COLORS.charcoalSoft, marginTop: 2 }}>Retailer portal</div>
        </div>
        {step === "phone" && (
          <>
            <label style={{ fontSize: 12.5, color: COLORS.charcoalSoft, display: "block", marginBottom: 6 }}>Registered mobile number</label>
            <PhoneInput icon={Phone} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="10-digit number" />
            {error && <div style={{ color: COLORS.madder, fontSize: 12, marginBottom: 10 }}>{error}</div>}
            <SubmitBtn onClick={sendOtp}>Send OTP</SubmitBtn>
            <div style={{ fontSize: 11, color: COLORS.charcoalSoft, marginTop: 14, textAlign: "center", lineHeight: 1.6 }}>
              New retailer? Enter your number to register.<br />
              <span style={{ opacity: 0.6 }}>A service by Guru Kripa Traders</span>
            </div>
          </>
        )}
        {step === "otp" && (
          <>
            <button onClick={() => setStep("phone")} style={{ background:"none", border:"none", color: COLORS.charcoalSoft, fontSize: 12, cursor:"pointer", display:"flex", alignItems:"center", gap:4, marginBottom:12, padding:0 }}>
              <ChevronLeft size={13}/> Change number
            </button>
            <label style={{ fontSize: 12.5, color: COLORS.charcoalSoft, display:"block", marginBottom:6 }}>OTP sent to +91 {phone}</label>
            <PhoneInput icon={ShieldCheck} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="4-digit code  ()" />
            {error && <div style={{ color: COLORS.madder, fontSize: 12, marginBottom: 10 }}>{error}</div>}
            <SubmitBtn onClick={verifyOtp} disabled={saving}>{saving ? "Verifying…" : "Verify & continue"}</SubmitBtn>
          </>
        )}
        {step === "register" && (
          <>
            <div style={{ fontSize: 12.5, color: COLORS.charcoalSoft, marginBottom: 14, lineHeight: 1.6 }}>
              Number not registered yet. Fill in your details and we'll review your request.
            </div>
            <label style={{ fontSize: 12.5, color: COLORS.charcoalSoft, display:"block", marginBottom:6 }}>Shop name *</label>
            <PhoneInput value={shopName} onChange={e => setShopName(e.target.value)} placeholder="e.g. Lake City Sarees" />
            <label style={{ fontSize: 12.5, color: COLORS.charcoalSoft, display:"block", marginBottom:6 }}>Owner name</label>
            <PhoneInput value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Your name" />
            {error && <div style={{ color: COLORS.madder, fontSize: 12, marginBottom: 10 }}>{error}</div>}
            <SubmitBtn onClick={submitRegistration} disabled={saving}>{saving ? "Submitting…" : "Submit for approval"}</SubmitBtn>
          </>
        )}
        {(step === "pending" || step === "pending_existing") && (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <Clock size={30} color={COLORS.turmeric} style={{ marginBottom: 12 }} />
            <div style={{ fontFamily: "var(--serif)", fontSize: 17, color: COLORS.charcoal, marginBottom: 8 }}>
              {step === "pending" ? "Request submitted!" : "Approval pending"}
            </div>
            <div style={{ fontSize: 13, color: COLORS.charcoalSoft, lineHeight: 1.7 }}>
              {step === "pending"
                ? `Your shop has been submitted for review. You'll be contacted on +91 ${phone} once approved.`
                : `Your registration is under review. We'll contact you on +91 ${phone} once approved.`}
            </div>
          </div>
        )}

        {step === "admin" && (
          <>
            <button onClick={() => { setStep("phone"); setError(""); }} style={{ background:"none", border:"none", color: COLORS.charcoalSoft, fontSize: 12, cursor:"pointer", display:"flex", alignItems:"center", gap:4, marginBottom:12, padding:0 }}>
              <ChevronLeft size={13}/> Back
            </button>
            <div style={{ fontSize: 13, color: COLORS.charcoalSoft, marginBottom: 14 }}>Enter your seller PIN to access the dashboard.</div>
            <PhoneInput
              type="password"
              value={adminPin}
              onChange={e => setAdminPin(e.target.value)}
              placeholder="Seller PIN"
            />
            {error && <div style={{ color: COLORS.madder, fontSize: 12, marginBottom: 10 }}>{error}</div>}
            <SubmitBtn onClick={verifyAdmin}>Access dashboard</SubmitBtn>
          </>
        )}

        {step !== "admin" && step !== "pending" && step !== "pending_existing" && (
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button
              onClick={() => { setStep("admin"); setError(""); }}
              style={{ background: "none", border: "none", color: COLORS.charcoalSoft + "88", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
            >
              Seller / Admin login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================
// ACCOUNT PANEL
// =============================================
