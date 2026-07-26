import React, { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { COLORS, MOCK_OTP } from "../lib/config.js";
import { supabase } from "../lib/db.js";
import { formatDetailedAddress, getStateFromPincode } from "../lib/address.js";

// QUICK LOGIN PANEL (slides from right — no approval needed)
// =============================================
export default function QuickLoginPanel({ onLogin, onClose }) {
  const [step, setStep] = useState("phone"); // phone → otp → details → done
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [addrLine1, setAddrLine1] = useState("");
  const [addrLine2, setAddrLine2] = useState("");
  const [addrLandmark, setAddrLandmark] = useState("");
  const [addrPincode, setAddrPincode] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("Rajasthan");
  const [gstNumber, setGstNumber] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const sendOtp = () => {
    if (!/^\d{10}$/.test(phone)) { setError("Enter a valid 10-digit number."); return; }
    setError(""); setStep("otp");
  };

  const verifyOtp = async () => {
    if (otp !== MOCK_OTP) { setError("Incorrect code. Please check your phone for the OTP."); return; }
    setError(""); setSaving(true);
    try {
      const rows = await supabase(`retailers?phone=eq.${phone}&select=*`);
      if (rows && rows.length > 0) {
        const r = rows[0];
        if (r.status === "rejected") { setError("This account was not approved. Contact Deetya Weaves."); setSaving(false); return; }
        // Existing retailer — log in directly
        onLogin({ ...r, is_admin: false });
      } else {
        setStep("details");
      }
    } catch (e) { setError("Could not connect. Try again."); }
    finally { setSaving(false); }
  };

  const submitDetails = async () => {
    if (!shopName.trim()) { setError("Shop name is mandatory."); return; }
    if (!ownerName.trim()) { setError("Your name is mandatory."); return; }
    if (!addrLine1.trim()) { setError("Address Line 1 is mandatory."); return; }
    if (!addrCity.trim()) { setError("City is mandatory."); return; }
    if (!addrPincode.trim()) { setError("Pincode is mandatory."); return; }
    if (!/^\d{6}$/.test(addrPincode.trim())) { setError("Please enter a valid 6-digit Pincode."); return; }
    setSaving(true); setError("");

    const formattedAddr = formatDetailedAddress({
      line1: addrLine1.trim(),
      line2: addrLine2.trim(),
      landmark: addrLandmark.trim(),
      city: addrCity.trim(),
      state: addrState.trim(),
      pincode: addrPincode.trim()
    });

    const payload = {
      phone,
      shop_name: shopName,
      owner_name: ownerName,
      detailed_address: formattedAddr,
      gst_number: gstNumber,
      email: email,
      status: "approved",
      credit_limit: 0,
      credit_used: 0,
      phone_verified: true,
      email_verified: false
    };

    try {
      let retailer;
      try {
        const rows = await supabase("retailers", "POST", payload);
        retailer = rows && rows[0] ? rows[0] : payload;
      } catch (dbErr) {
        console.warn("DB columns missing in Supabase, using fallback for sign up", dbErr);
        const fallbackPayload = {
          phone,
          shop_name: shopName,
          owner_name: ownerName,
          status: "approved",
          credit_limit: 0,
          credit_used: 0
        };
        const rows = await supabase("retailers", "POST", fallbackPayload);
        retailer = { ...(rows && rows[0] ? rows[0] : fallbackPayload), ...payload };
      }
      onLogin({ ...retailer, is_admin: false });
    } catch (e) { 
      setError("Could not save details. Try again."); 
    } finally { 
      setSaving(false); 
    }
  };

  const inputStyle = { width:"100%", background: COLORS.ivoryDeep, border:"none", borderRadius:8, padding:"10px 12px", fontSize:14, color: COLORS.charcoal, fontFamily:"var(--sans)", outline:"none", boxSizing:"border-box" };

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", zIndex:999, backdropFilter:"blur(2px)" }}/>
      <div style={{ position:"fixed", top:0, right:0, bottom:0, width:"min(400px, 100vw)", background: COLORS.cream, zIndex:1000, overflowY:"auto", boxShadow:"-4px 0 40px rgba(0,0,0,0.15)", animation:"slideIn 0.26s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 22px", borderBottom:`1px solid ${COLORS.charcoalSoft}18` }}>
          <div>
            <div style={{ fontFamily:"var(--serif)", fontSize:17, color: COLORS.indigo }}>View prices & order</div>
            <div style={{ fontSize:12, color: COLORS.charcoalSoft, marginTop:2 }}>Quick sign in to unlock the catalog</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:`1px solid ${COLORS.charcoalSoft}44`, borderRadius:"50%", width:30, height:30, cursor:"pointer", fontSize:18, color: COLORS.charcoalSoft, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>

        <div style={{ padding:"24px 22px" }}>
          {/* Progress dots */}
          <div style={{ display:"flex", gap:8, marginBottom:28 }}>
            {["phone","otp","details"].map((s, i) => (
              <div key={s} style={{ height:3, flex:1, borderRadius:2, background: ["phone","otp","details"].indexOf(step) >= i ? COLORS.indigo : COLORS.charcoalSoft+"33" }}/>
            ))}
          </div>

          {step === "phone" && (
            <>
              <div style={{ fontFamily:"var(--serif)", fontSize:15, color: COLORS.charcoal, marginBottom:16 }}>Enter your mobile number</div>
              <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:14 }}>
                <span style={{ fontSize:14, color: COLORS.charcoalSoft, whiteSpace:"nowrap" }}>+91</span>
                <input autoFocus value={phone} onChange={e => { setPhone(e.target.value.replace(/\D/g,"").slice(0,10)); setError(""); }}
                  placeholder="10-digit number" style={inputStyle} onKeyDown={e => e.key==="Enter" && sendOtp()}/>
              </div>
              {error && <div style={{ color: COLORS.madder, fontSize:12, marginBottom:10 }}>{error}</div>}
              <button onClick={sendOtp} style={{ width:"100%", background: COLORS.indigo, color: COLORS.cream, border:"none", padding:"12px", borderRadius:8, fontSize:14, cursor:"pointer", fontFamily:"var(--sans)" }}>
                Send OTP
              </button>
              <div style={{ fontSize:11.5, color: COLORS.charcoalSoft, marginTop:16, textAlign:"center", lineHeight:1.6 }}>
                New to Deetya Weaves? Register your shop right here.
              </div>
            </>
          )}

          {step === "otp" && (
            <>
              <button onClick={() => setStep("phone")} style={{ background:"none", border:"none", color: COLORS.charcoalSoft, fontSize:12.5, cursor:"pointer", display:"flex", alignItems:"center", gap:4, marginBottom:16, padding:0 }}>
                <ChevronLeft size={13}/> +91 {phone}
              </button>
              <div style={{ fontFamily:"var(--serif)", fontSize:15, color: COLORS.charcoal, marginBottom:16 }}>Enter the OTP sent to your number</div>
              <input autoFocus value={otp} onChange={e => { setOtp(e.target.value.replace(/\D/g,"").slice(0,4)); setError(""); }}
                placeholder="4-digit code" style={{ ...inputStyle, fontSize:22, letterSpacing:8, textAlign:"center", marginBottom:14 }}
                onKeyDown={e => e.key==="Enter" && verifyOtp()}/>
              {error && <div style={{ color: COLORS.madder, fontSize:12, marginBottom:10 }}>{error}</div>}
              <button onClick={verifyOtp} disabled={saving} style={{ width:"100%", background: COLORS.indigo, color: COLORS.cream, border:"none", padding:"12px", borderRadius:8, fontSize:14, cursor:"pointer", fontFamily:"var(--sans)" }}>
                {saving ? "Verifying…" : "Verify"}
              </button>
            </>
          )}

          {step === "details" && (
            <>
              <div style={{ fontFamily:"var(--serif)", fontSize:15, color: COLORS.charcoal, marginBottom:6 }}>Tell us about your shop</div>
              <div style={{ fontSize:13, color: COLORS.charcoalSoft, marginBottom:20 }}>You'll be able to see prices and place orders immediately after.</div>
              
              <label style={{ fontSize:12, color: COLORS.charcoalSoft, display:"block", marginBottom:5, fontWeight: 500 }}>Shop name *</label>
              <input autoFocus value={shopName} onChange={e => { setShopName(e.target.value); setError(""); }}
                placeholder="e.g. Lake City Sarees" style={{ ...inputStyle, marginBottom:14 }}/>
              
              <label style={{ fontSize:12, color: COLORS.charcoalSoft, display:"block", marginBottom:5, fontWeight: 500 }}>Owner / Your name *</label>
              <input value={ownerName} onChange={e => { setOwnerName(e.target.value); setError(""); }}
                placeholder="Your full name" style={{ ...inputStyle, marginBottom:14 }}/>

              <div style={{ background: "rgba(0,0,0,0.02)", padding: 12, borderRadius: 8, marginBottom: 14, border: `1px solid ${COLORS.charcoalSoft}15` }}>
                <div style={{ fontSize: 12.5, fontWeight: "600", color: COLORS.indigo, marginBottom: 10, fontFamily: "var(--sans)" }}>Detailed Shipping Address</div>
                
                <label style={{ fontSize:11.5, color: COLORS.charcoalSoft, display:"block", marginBottom:4, fontWeight: 500 }}>Address Line 1 (Street, Shop No.) *</label>
                <input value={addrLine1} onChange={e => { setAddrLine1(e.target.value); setError(""); }}
                  placeholder="e.g. Shop No. 24, Handloom Market" style={{ ...inputStyle, marginBottom:10 }}/>

                <label style={{ fontSize:11.5, color: COLORS.charcoalSoft, display:"block", marginBottom:4, fontWeight: 500 }}>Address Line 2 (Area, Sector) (Optional)</label>
                <input value={addrLine2} onChange={e => setAddrLine2(e.target.value)}
                  placeholder="e.g. Kota" style={{ ...inputStyle, marginBottom:10 }}/>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize:11.5, color: COLORS.charcoalSoft, display:"block", marginBottom:4, fontWeight: 500 }}>Landmark (Optional)</label>
                    <input value={addrLandmark} onChange={e => setAddrLandmark(e.target.value)}
                      placeholder="e.g. Near Post Office" style={{ ...inputStyle }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:11.5, color: COLORS.charcoalSoft, display:"block", marginBottom:4, fontWeight: 500 }}>Pincode *</label>
                    <input value={addrPincode} onChange={e => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setAddrPincode(val);
                      setError("");
                      if (val.length === 6) {
                        setAddrState(getStateFromPincode(val));
                      }
                    }}
                      placeholder="e.g. 302029" style={{ ...inputStyle }}/>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize:11.5, color: COLORS.charcoalSoft, display:"block", marginBottom:4, fontWeight: 500 }}>City *</label>
                    <input value={addrCity} onChange={e => { setAddrCity(e.target.value); setError(""); }}
                      placeholder="e.g. Jaipur" style={{ ...inputStyle }}/>
                  </div>
                  <div>
                    <label style={{ fontSize:11.5, color: COLORS.charcoalSoft, display:"block", marginBottom:4, fontWeight: 500 }}>State (Auto-populated)</label>
                    <input readOnly disabled value={addrState}
                      style={{ ...inputStyle, background: COLORS.ivoryDeep, color: COLORS.charcoalSoft, cursor: "not-allowed" }}/>
                  </div>
                </div>
              </div>

              <label style={{ fontSize:12, color: COLORS.charcoalSoft, display:"block", marginBottom:5, fontWeight: 500 }}>GST Number (Optional)</label>
              <input value={gstNumber} onChange={e => setGstNumber(e.target.value.toUpperCase())}
                placeholder="15-digit GSTIN" style={{ ...inputStyle, marginBottom:14 }}/>

              <label style={{ fontSize:12, color: COLORS.charcoalSoft, display:"block", marginBottom:5, fontWeight: 500 }}>Email Address (Optional)</label>
              <input value={email} onChange={e => setEmail(e.target.value)}
                placeholder="e.g. contact@myshop.com" style={{ ...inputStyle, marginBottom:18 }}/>

              {error && <div style={{ color: COLORS.madder, fontSize:12, marginBottom:10 }}>{error}</div>}
              
              <button onClick={submitDetails} disabled={saving} style={{ width:"100%", background: COLORS.indigo, color: COLORS.cream, border:"none", padding:"12px", borderRadius:8, fontSize:14, cursor:"pointer", fontFamily:"var(--sans)", fontWeight: 600 }}>
                {saving ? "Setting up…" : "Unlock prices & start ordering →"}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

