import React, { useState } from "react";
import { ShoppingBag, Clock, Wallet, ShieldCheck, LogOut, User, Phone } from "lucide-react";
import { COLORS, GST_RATE } from "../lib/config.js";
import { supabase } from "../lib/db.js";
import { getStateFromPincode, parseDetailedAddress, formatDetailedAddress, getHumanReadableAddress } from "../lib/address.js";
import { WeavingProgress } from "./ui/atoms.jsx";

export default function AccountPanel({ account, orders, onClose, onAccountUpdated, setActivePage, onLogOut, contactInfo }) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form fields
  const [formName, setFormName] = useState(account.owner_name || "");
  const [formShopName, setFormShopName] = useState(account.shop_name || "");
  const [formGstNumber, setFormGstNumber] = useState(account.gst_number || "");
  const [formAddrLine1, setFormAddrLine1] = useState(() => parseDetailedAddress(account.address).line1 || "");
  const [formAddrLine2, setFormAddrLine2] = useState(() => parseDetailedAddress(account.address).line2 || "");
  const [formAddrLandmark, setFormAddrLandmark] = useState(() => parseDetailedAddress(account.address).landmark || "");
  const [formAddrPincode, setFormAddrPincode] = useState(() => parseDetailedAddress(account.address).pincode || "");
  const [formAddrCity, setFormAddrCity] = useState(() => parseDetailedAddress(account.address).city || "");
  const [formAddrState, setFormAddrState] = useState(() => parseDetailedAddress(account.address).state || "Rajasthan");
  const [formPhone, setFormPhone] = useState(account.phone || "");
  const [formEmail, setFormEmail] = useState(account.email || "");
  
  // Verification states
  const [phoneVerified, setPhoneVerified] = useState(true);
  const [emailVerified, setEmailVerified] = useState(!!account.email_verified);
  
  const [phoneOtp, setPhoneOtp] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [showPhoneOtp, setShowPhoneOtp] = useState(false);
  const [showEmailOtp, setShowEmailOtp] = useState(false);
  const [phoneVerifying, setPhoneVerifying] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [generatedEmailOtp, setGeneratedEmailOtp] = useState("");
  const [formError, setFormError] = useState("");

  const [expandedOrder, setExpandedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState({});

  // Handle phone input changes
  const handlePhoneChange = (val) => {
    const clean = val.replace(/\D/g, "").slice(0, 10);
    setFormPhone(clean);
    if (clean !== account.phone) {
      setPhoneVerified(false);
    } else {
      setPhoneVerified(true);
    }
    setShowPhoneOtp(false);
    setPhoneMessage("");
  };

  // Handle email input changes
  const handleEmailChange = (val) => {
    setFormEmail(val);
    if (val !== account.email) {
      setEmailVerified(false);
    } else {
      setEmailVerified(!!account.email_verified);
    }
    setShowEmailOtp(false);
    setEmailMessage("");
  };

  const handleSendPhoneOtp = () => {
    if (!/^\d{10}$/.test(formPhone)) {
      setPhoneMessage("Enter a valid 10-digit phone number.");
      return;
    }
    setPhoneVerifying(true);
    setTimeout(() => {
      setPhoneVerifying(false);
      setShowPhoneOtp(true);
      setPhoneMessage("Demo OTP '1234' sent to +91 " + formPhone);
    }, 600);
  };

  const handleVerifyPhoneOtp = () => {
    if (phoneOtp === "1234") {
      setPhoneVerified(true);
      setShowPhoneOtp(false);
      setPhoneMessage("✓ Phone number verified!");
    } else {
      setPhoneMessage("Incorrect code. Please use 1234.");
    }
  };

  const handleSendEmailOtp = () => {
    if (!formEmail.trim() || !formEmail.includes("@")) {
      setEmailMessage("Please enter a valid email address first.");
      return;
    }
    setEmailVerifying(true);
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedEmailOtp(code);
    setTimeout(() => {
      setEmailVerifying(false);
      setShowEmailOtp(true);
      setEmailMessage(`Verification code: ${code} (demo mode — no real email is sent yet)`);
    }, 600);
  };

  const handleVerifyEmailOtp = () => {
    if (emailOtp === generatedEmailOtp || emailOtp === "1234") {
      setEmailVerified(true);
      setShowEmailOtp(false);
      setEmailMessage("✓ Email address verified!");
    } else {
      setEmailMessage("Incorrect code. Try again.");
    }
  };

  const loadOrderItems = async (orderId) => {
    if (orderItems[orderId]) {
      setExpandedOrder(expandedOrder === orderId ? null : orderId);
      return;
    }
    try {
      const data = await supabase(`order_items?order_id=eq.${orderId}&select=*`);
      setOrderItems(prev => ({ ...prev, [orderId]: data || [] }));
      setExpandedOrder(orderId);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveProfile = async () => {
    if (!formShopName.trim()) {
      setFormError("Shop name is mandatory.");
      return;
    }
    if (!formName.trim()) {
      setFormError("Owner / Name is mandatory.");
      return;
    }
    if (!formAddrLine1.trim()) {
      setFormError("Address Line 1 is mandatory.");
      return;
    }
    if (!formAddrCity.trim()) {
      setFormError("City is mandatory.");
      return;
    }
    if (!formAddrPincode.trim()) {
      setFormError("Pincode is mandatory.");
      return;
    }
    if (!/^\d{6}$/.test(formAddrPincode.trim())) {
      setFormError("Please enter a valid 6-digit Pincode.");
      return;
    }
    if (!formPhone.trim() || !/^\d{10}$/.test(formPhone)) {
      setFormError("A valid 10-digit phone number is mandatory.");
      return;
    }
    if (!phoneVerified) {
      setFormError("Please verify your updated phone number first.");
      return;
    }

    setSaving(true);
    setFormError("");

    const formattedAddr = formatDetailedAddress({
      line1: formAddrLine1.trim(),
      line2: formAddrLine2.trim(),
      landmark: formAddrLandmark.trim(),
      city: formAddrCity.trim(),
      state: formAddrState.trim(),
      pincode: formAddrPincode.trim()
    });

    // NOTE: your retailers table only has phone, shop_name, owner_name,
    // and address as editable columns today — email, gst_number,
    // email_verified, and phone_verified aren't columns in the database
    // yet, so they're kept in local UI state only and won't survive a
    // page reload until those columns are added (ask if you want that).
    const updatedFields = {
      shop_name: formShopName,
      owner_name: formName,
      phone: formPhone,
      address: formattedAddr,
    };

    try {
      const rows = await supabase(`retailers?id=eq.${account.id}`, "PATCH", updatedFields);
      const savedRow = rows && rows[0] ? rows[0] : updatedFields;
      const updatedData = { ...account, ...savedRow, email: formEmail, gst_number: formGstNumber, email_verified: emailVerified, phone_verified: phoneVerified };

      onAccountUpdated(updatedData);
      setIsEditing(false);
    } catch (e) {
      setFormError("Failed to save profile details. " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: COLORS.cream, border: `1px solid ${COLORS.charcoalSoft}22`, borderRadius: 14, padding: "24px", marginBottom: 20, boxShadow: "0 4px 20px rgba(42,36,29,0.04)" }}>
      {/* Panel Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: `1px solid ${COLORS.charcoalSoft}15`, paddingBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <User size={18} color={COLORS.indigo} />
          <h2 style={{ fontFamily: "var(--serif)", fontSize: 19, color: COLORS.indigo, margin: 0 }}>My Profile</h2>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.charcoalSoft, fontSize: 13, cursor: "pointer", fontWeight: 500 }}>✕ Back to Catalog</button>
      </div>

      {/* Mobile-Only Actions Panel */}
      <div className="flex-show-mobile" style={{
        background: "#FFF",
        borderRadius: 12,
        padding: "16px",
        border: `1.5px solid ${COLORS.indigo}22`,
        marginBottom: 20,
        flexDirection: "column",
        gap: 12
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.indigo, letterSpacing: 0.5, textTransform: "uppercase" }}>
          Mobile Quick Operations
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => { if (setActivePage) setActivePage("orders"); }}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: COLORS.indigo,
              color: COLORS.cream,
              border: "none",
              borderRadius: 8,
              padding: "12px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--sans)"
            }}
          >
            <Clock size={15} /> My Orders & Tracking
          </button>
          
          <button
            onClick={() => { if (onLogOut) onLogOut(); }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              background: "transparent",
              color: COLORS.madder,
              border: `1.5px solid ${COLORS.madder}40`,
              borderRadius: 8,
              padding: "12px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--sans)"
            }}
          >
            <LogOut size={15} /> Log Out
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px" }} className="profile-grid">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          
          {/* PROFILE DETAILS COLUMN */}
          <div style={{ background: "#FFF", borderRadius: 12, padding: 20, border: `1px solid ${COLORS.charcoalSoft}11` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14.5, color: COLORS.indigo, fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>User & Shop Details</h3>
              {!isEditing && (
                <button onClick={() => setIsEditing(true)} style={{ background: "none", border: `1px solid ${COLORS.indigo}33`, borderRadius: 6, color: COLORS.indigo, fontSize: 12, padding: "4px 10px", cursor: "pointer", fontWeight: 500, fontFamily: "var(--sans)" }}>
                  Update Details
                </button>
              )}
            </div>

            {isEditing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11.5, color: COLORS.charcoalSoft, display: "block", marginBottom: 4, fontWeight: 500 }}>Name *</label>
                  <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Enter owner name" style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1px solid ${COLORS.charcoalSoft}33`, background: COLORS.cream, fontFamily: "var(--sans)", fontSize: 13.5, color: COLORS.charcoal }} />
                </div>

                <div>
                  <label style={{ fontSize: 11.5, color: COLORS.charcoalSoft, display: "block", marginBottom: 4, fontWeight: 500 }}>Shop Name *</label>
                  <input value={formShopName} onChange={e => setFormShopName(e.target.value)} placeholder="Enter shop name" style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1px solid ${COLORS.charcoalSoft}33`, background: COLORS.cream, fontFamily: "var(--sans)", fontSize: 13.5, color: COLORS.charcoal }} />
                </div>

                <div style={{ background: "rgba(0,0,0,0.015)", padding: "12px", borderRadius: 8, border: `1px solid ${COLORS.charcoalSoft}15` }}>
                  <div style={{ fontSize: 12, fontWeight: "600", color: COLORS.indigo, marginBottom: 10, fontFamily: "var(--sans)" }}>Detailed Shipping Address</div>
                  
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: COLORS.charcoalSoft, display: "block", marginBottom: 4, fontWeight: 500 }}>Address Line 1 (Street, Shop No.) *</label>
                    <input value={formAddrLine1} onChange={e => setFormAddrLine1(e.target.value)} placeholder="e.g. Shop No. 24, Handloom Market" style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1px solid ${COLORS.charcoalSoft}33`, background: COLORS.cream, fontFamily: "var(--sans)", fontSize: 13, color: COLORS.charcoal }} />
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: COLORS.charcoalSoft, display: "block", marginBottom: 4, fontWeight: 500 }}>Address Line 2 (Area, Sector) (Optional)</label>
                    <input value={formAddrLine2} onChange={e => setFormAddrLine2(e.target.value)} placeholder="e.g. Kota" style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1px solid ${COLORS.charcoalSoft}33`, background: COLORS.cream, fontFamily: "var(--sans)", fontSize: 13, color: COLORS.charcoal }} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.charcoalSoft, display: "block", marginBottom: 4, fontWeight: 500 }}>Landmark (Optional)</label>
                      <input value={formAddrLandmark} onChange={e => setFormAddrLandmark(e.target.value)} placeholder="e.g. Near Post Office" style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1px solid ${COLORS.charcoalSoft}33`, background: COLORS.cream, fontFamily: "var(--sans)", fontSize: 13, color: COLORS.charcoal }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.charcoalSoft, display: "block", marginBottom: 4, fontWeight: 500 }}>Pincode *</label>
                      <input value={formAddrPincode} onChange={e => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setFormAddrPincode(val);
                        if (val.length === 6) {
                          setFormAddrState(getStateFromPincode(val));
                        }
                      }} placeholder="e.g. 302029" style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1px solid ${COLORS.charcoalSoft}33`, background: COLORS.cream, fontFamily: "var(--sans)", fontSize: 13, color: COLORS.charcoal }} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.charcoalSoft, display: "block", marginBottom: 4, fontWeight: 500 }}>City *</label>
                      <input value={formAddrCity} onChange={e => setFormAddrCity(e.target.value)} placeholder="e.g. Jaipur" style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1px solid ${COLORS.charcoalSoft}33`, background: COLORS.cream, fontFamily: "var(--sans)", fontSize: 13, color: COLORS.charcoal }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.charcoalSoft, display: "block", marginBottom: 4, fontWeight: 500 }}>State (Auto-populated)</label>
                      <input readOnly disabled value={formAddrState} style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1px solid ${COLORS.charcoalSoft}33`, background: COLORS.ivoryDeep, fontFamily: "var(--sans)", fontSize: 13, color: COLORS.charcoalSoft, cursor: "not-allowed" }} />
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11.5, color: COLORS.charcoalSoft, display: "block", marginBottom: 4, fontWeight: 500 }}>Phone Number *</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <div style={{ flex: 1, position: "relative" }}>
                      <input value={formPhone} onChange={e => handlePhoneChange(e.target.value)} placeholder="10-digit Phone" style={{ width: "100%", padding: "10px 10px 10px 32px", borderRadius: 8, border: `1px solid ${COLORS.charcoalSoft}33`, background: COLORS.cream, fontFamily: "var(--sans)", fontSize: 13.5, color: COLORS.charcoal }} />
                      <span style={{ position: "absolute", left: 10, top: "11px", fontSize: 13, color: COLORS.charcoalSoft }}>+91</span>
                    </div>
                    {phoneVerified ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, color: COLORS.sage, fontSize: 11, fontWeight: 600, padding: "0 8px" }}>
                        <ShieldCheck size={14} /> Verified
                      </span>
                    ) : (
                      <button onClick={handleSendPhoneOtp} disabled={phoneVerifying} style={{ background: COLORS.indigo, color: COLORS.cream, border: "none", borderRadius: 6, padding: "0 12px", fontSize: 11.5, cursor: "pointer", fontFamily: "var(--sans)" }}>
                        {phoneVerifying ? "Sending…" : "Verify"}
                      </button>
                    )}
                  </div>
                  {phoneMessage && <div style={{ fontSize: 11, color: phoneVerified ? COLORS.sage : COLORS.madder, marginTop: 4, fontWeight: 500 }}>{phoneMessage}</div>}
                  {showPhoneOtp && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8, background: `${COLORS.indigo}08`, padding: 8, borderRadius: 6 }}>
                      <input value={phoneOtp} onChange={e => setPhoneOtp(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="4-digit OTP" style={{ width: 100, padding: "6px", borderRadius: 6, border: `1px solid ${COLORS.charcoalSoft}33`, fontSize: 12, fontFamily: "var(--sans)" }} />
                      <button onClick={handleVerifyPhoneOtp} style={{ background: COLORS.sage, color: COLORS.cream, border: "none", padding: "4px 10px", borderRadius: 6, fontSize: 11.5, cursor: "pointer" }}>Verify OTP</button>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: 11.5, color: COLORS.charcoalSoft, display: "block", marginBottom: 4, fontWeight: 500 }}>GST Number</label>
                  <input value={formGstNumber} onChange={e => setFormGstNumber(e.target.value.toUpperCase())} placeholder="15-digit GSTIN (Optional)" style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1px solid ${COLORS.charcoalSoft}33`, background: COLORS.cream, fontFamily: "var(--sans)", fontSize: 13.5, color: COLORS.charcoal }} />
                </div>

                <div>
                  <label style={{ fontSize: 11.5, color: COLORS.charcoalSoft, display: "block", marginBottom: 4, fontWeight: 500 }}>Email Address</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input value={formEmail} onChange={e => handleEmailChange(e.target.value)} placeholder="Email Address (Optional)" style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${COLORS.charcoalSoft}33`, background: COLORS.cream, fontFamily: "var(--sans)", fontSize: 13.5, color: COLORS.charcoal }} />
                    {formEmail.trim() && (
                      emailVerified ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, color: COLORS.sage, fontSize: 11, fontWeight: 600, padding: "0 8px" }}>
                          <ShieldCheck size={14} /> Verified
                        </span>
                      ) : (
                        <button onClick={handleSendEmailOtp} disabled={emailVerifying} style={{ background: COLORS.indigo, color: COLORS.cream, border: "none", borderRadius: 6, padding: "0 12px", fontSize: 11.5, cursor: "pointer", fontFamily: "var(--sans)" }}>
                          {emailVerifying ? "Sending…" : "Verify"}
                        </button>
                      )
                    )}
                  </div>
                  {emailMessage && <div style={{ fontSize: 11, color: emailVerified ? COLORS.sage : COLORS.madder, marginTop: 4, fontWeight: 500 }}>{emailMessage}</div>}
                  {showEmailOtp && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8, background: `${COLORS.indigo}08`, padding: 8, borderRadius: 6 }}>
                      <input value={emailOtp} onChange={e => setEmailOtp(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="4-digit Code" style={{ width: 100, padding: "6px", borderRadius: 6, border: `1px solid ${COLORS.charcoalSoft}33`, fontSize: 12, fontFamily: "var(--sans)" }} />
                      <button onClick={handleVerifyEmailOtp} style={{ background: COLORS.sage, color: COLORS.cream, border: "none", padding: "4px 10px", borderRadius: 6, fontSize: 11.5, cursor: "pointer" }}>Verify Code</button>
                    </div>
                  )}
                </div>

                {formError && <div style={{ color: COLORS.madder, fontSize: 12, marginTop: 6, fontWeight: 500 }}>✕ {formError}</div>}

                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  <button onClick={handleSaveProfile} disabled={saving} style={{ flex: 1, background: COLORS.indigo, color: COLORS.cream, border: "none", borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", fontWeight: 600, fontFamily: "var(--sans)" }}>
                    {saving ? "Saving Changes…" : "Save Changes"}
                  </button>
                  <button onClick={() => { setIsEditing(false); setFormError(""); }} style={{ background: "transparent", border: `1px solid ${COLORS.charcoalSoft}33`, color: COLORS.charcoalSoft, borderRadius: 8, padding: "10px 14px", fontSize: 13, cursor: "pointer", fontWeight: 500, fontFamily: "var(--sans)" }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${COLORS.charcoalSoft}10`, paddingBottom: 6 }}>
                  <span style={{ fontSize: 12.5, color: COLORS.charcoalSoft }}>Shop Name</span>
                  <span style={{ fontSize: 13.5, color: COLORS.charcoal, fontWeight: 600 }}>{account.shop_name}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${COLORS.charcoalSoft}10`, paddingBottom: 6 }}>
                  <span style={{ fontSize: 12.5, color: COLORS.charcoalSoft }}>Owner Name</span>
                  <span style={{ fontSize: 13.5, color: COLORS.charcoal, fontWeight: 500 }}>{account.owner_name || "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${COLORS.charcoalSoft}10`, paddingBottom: 6 }}>
                  <span style={{ fontSize: 12.5, color: COLORS.charcoalSoft }}>Mobile Phone</span>
                  <span style={{ fontSize: 13.5, color: COLORS.charcoal, display: "flex", alignItems: "center", gap: 4 }}>
                    +91 {account.phone} <ShieldCheck size={14} color={COLORS.sage} />
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${COLORS.charcoalSoft}10`, paddingBottom: 6 }}>
                  <span style={{ fontSize: 12.5, color: COLORS.charcoalSoft }}>Email Address</span>
                  <span style={{ fontSize: 13.5, color: COLORS.charcoal, display: "flex", alignItems: "center", gap: 4 }}>
                    {account.email || "Not specified"}
                    {account.email && (account.email_verified ? <ShieldCheck size={14} color={COLORS.sage} /> : <span style={{ fontSize: 10, background: `${COLORS.turmeric}15`, color: COLORS.turmeric, padding: "1px 6px", borderRadius: 4 }}>Unverified</span>)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${COLORS.charcoalSoft}10`, paddingBottom: 6 }}>
                  <span style={{ fontSize: 12.5, color: COLORS.charcoalSoft }}>GSTIN</span>
                  <span style={{ fontSize: 13.5, color: COLORS.charcoal, fontWeight: 500, fontFamily: "var(--sans)" }}>{account.gst_number || "Not specified"}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 12.5, color: COLORS.charcoalSoft }}>Detailed Address</span>
                  <span style={{ fontSize: 13, color: COLORS.charcoal, background: COLORS.ivory, padding: 8, borderRadius: 6, lineHeight: 1.4 }}>{getHumanReadableAddress(account.address) || "No address provided yet. Please click 'Update Details' to add your address."}</span>
                </div>
              </div>
            )}
          </div>

          {/* FINANCIAL ACCOUNT & TRANSACTION LEDGER COLUMN */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* TRANSACTION HISTORY */}
            <div style={{ background: "#FFF", borderRadius: 12, padding: 18, border: `1px solid ${COLORS.charcoalSoft}11`, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Wallet size={16} color={COLORS.indigo} />
                <h3 style={{ fontSize: 14, color: COLORS.indigo, fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>Transaction Ledger</h3>
              </div>
              {orders.length === 0 ? (
                <div style={{ fontSize: 12.5, color: COLORS.charcoalSoft, textAlign: "center", padding: "16px 0" }}>No financial transactions logged yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 160, overflowY: "auto", paddingRight: 4 }}>
                  {orders.map(o => (
                    <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "8px 10px", background: COLORS.cream, borderRadius: 6, borderLeft: `3px solid ${o.payment_type === "COD" ? COLORS.turmeric : COLORS.sage}` }}>
                      <div>
                        <strong style={{ color: COLORS.charcoal }}>Order #{o.order_number}</strong>
                        <div style={{ fontSize: 10.5, color: COLORS.charcoalSoft }}>{new Date(o.created_at).toLocaleDateString("en-IN")} · {o.payment_type === "COD" ? "Cash on Delivery" : "Bank/QR Payment"}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontWeight: 600, color: COLORS.charcoal, fontFamily: "var(--sans)" }}>₹{o.total?.toLocaleString("en-IN")}</span>
                        <div style={{ fontSize: 9.5, color: o.stage === "Cancelled" ? COLORS.madder : COLORS.sage }}>{o.stage}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* PREVIOUS ORDERS SECTION WITH COMPLETE DESCRIPTION OF EACH ITEM */}
        <div style={{ background: "#FFF", borderRadius: 12, padding: 20, border: `1px solid ${COLORS.charcoalSoft}11`, marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <ShoppingBag size={17} color={COLORS.indigo} />
            <h3 style={{ fontSize: 15, color: COLORS.indigo, fontWeight: 700, margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>Previous Order Logs & Item Specifications</h3>
          </div>
          
          {orders.length === 0 ? (
            <div style={{ fontSize: 13, color: COLORS.charcoalSoft, padding: "20px 0", textAlign: "center", background: COLORS.ivory, borderRadius: 8 }}>No orders placed yet. Add items to your cart to start ordering!</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {orders.map(o => {
                const isExpanded = expandedOrder === o.id;
                return (
                  <div key={o.id} style={{ border: `1px solid ${COLORS.charcoalSoft}22`, borderRadius: 8, overflow: "hidden", background: COLORS.cream }}>
                    <div onClick={() => loadOrderItems(o.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", cursor: "pointer", hover: { background: COLORS.ivoryDeep }, transition: "background 0.2s" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.indigo }}>Order #{o.order_number}</span>
                          <span style={{ fontSize: 11, color: COLORS.charcoalSoft }}>· {new Date(o.created_at).toLocaleDateString("en-IN")}</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: COLORS.charcoalSoft, marginTop: 2 }}>
                          Total value: <strong style={{ color: COLORS.charcoal, fontFamily: "var(--sans)" }}>₹{o.total?.toLocaleString("en-IN")}</strong> · Method: <span style={{ textTransform: "capitalize" }}>{o.payment_type}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.cream, background: o.stage === "Pending" ? COLORS.turmeric : o.stage === "Cancelled" ? COLORS.madder : COLORS.sage, padding: "3px 8px", borderRadius: 10 }}>
                          {o.stage}
                        </span>
                        <span style={{ fontSize: 12, color: COLORS.charcoalSoft }}>{isExpanded ? "▲ Hide" : "▼ Details"}</span>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div style={{ background: "#FFF", borderTop: `1px solid ${COLORS.charcoalSoft}18`, padding: 14 }}>
                        <div style={{ fontSize: 12, color: COLORS.indigo, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Detailed Item Description
                        </div>
                        
                        {orderItems[o.id] ? (
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, fontFamily: "var(--sans)", minWidth: 460 }}>
                              <thead>
                                <tr style={{ borderBottom: `1px solid ${COLORS.charcoalSoft}22`, textAlign: "left", background: COLORS.cream }}>
                                  <th style={{ padding: "8px 10px", color: COLORS.charcoalSoft, fontWeight: 600 }}>Product / Variant</th>
                                  <th style={{ padding: "8px 10px", color: COLORS.charcoalSoft, fontWeight: 600, textAlign: "center" }}>Category</th>
                                  <th style={{ padding: "8px 10px", color: COLORS.charcoalSoft, fontWeight: 600, textAlign: "center" }}>Qty</th>
                                  <th style={{ padding: "8px 10px", color: COLORS.charcoalSoft, fontWeight: 600, textAlign: "right" }}>Rate</th>
                                  <th style={{ padding: "8px 10px", color: COLORS.charcoalSoft, fontWeight: 600, textAlign: "right" }}>Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {orderItems[o.id].map((item, i) => (
                                  <tr key={i} style={{ borderBottom: `1px solid ${COLORS.charcoalSoft}11` }}>
                                    <td style={{ padding: "8px 10px", color: COLORS.charcoal, fontWeight: 500 }}>
                                      {item.item_name}
                                    </td>
                                    <td style={{ padding: "8px 10px", color: COLORS.charcoalSoft, textAlign: "center", fontSize: 11.5 }}>
                                      {item.category || "Handloom"}
                                    </td>
                                    <td style={{ padding: "8px 10px", color: COLORS.charcoal, textAlign: "center", fontWeight: 600 }}>
                                      {item.quantity} pcs
                                    </td>
                                    <td style={{ padding: "8px 10px", color: COLORS.charcoalSoft, textAlign: "right", fontFamily: "var(--sans)" }}>
                                      ₹{item.price_w}
                                    </td>
                                    <td style={{ padding: "8px 10px", color: COLORS.indigo, textAlign: "right", fontWeight: 600, fontFamily: "var(--sans)" }}>
                                      ₹{(item.price_w * item.quantity).toLocaleString("en-IN")}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            
                            <div style={{ marginTop: 12, padding: "8px 10px", background: COLORS.cream, borderRadius: 6, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, fontSize: 12 }}>
                              <div style={{ color: COLORS.charcoalSoft }}>
                                GST Rate Applied: <strong>{GST_RATE}% (included in total)</strong> · GST: <strong>₹{o.gst_amount?.toLocaleString("en-IN") || "—"}</strong>
                              </div>
                              <div style={{ color: COLORS.indigo }}>
                                Subtotal: <span style={{ fontWeight: 600 }}>₹{o.subtotal?.toLocaleString("en-IN")}</span>
                                {o.discount_amount > 0 && <span style={{ color: COLORS.madder }}> · Discount: −₹{o.discount_amount}</span>}
                                 · Order Total: <span style={{ fontWeight: 700, fontSize: 13.5, color: COLORS.madder, fontFamily: "var(--sans)" }}>₹{o.total?.toLocaleString("en-IN")}</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: COLORS.charcoalSoft, textAlign: "center", padding: "10px 0" }}>Loading specifications…</div>
                        )}
                        
                        <div style={{ marginTop: 12, borderTop: `1px solid ${COLORS.charcoalSoft}15`, paddingTop: 10 }}>
                          <span style={{ fontSize: 11.5, color: COLORS.charcoalSoft, display: "block", marginBottom: 8 }}>Current Logistics Timeline:</span>
                          <WeavingProgress stage={o.stage} />
                          
                          {contactInfo && contactInfo.whatsapp && (
                            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                              <a
                                href={`https://wa.me/${contactInfo.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
                                  `Hello! I am tracking wholesale order *#${o.order_number}* on Deetya Weaves. Current status is listed as "${o.stage}". Please send me the latest dispatch or tracking info.`
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  background: "#E8F5E9",
                                  border: "1px solid #A5D6A7",
                                  color: "#1B5E20",
                                  padding: "5px 12px",
                                  borderRadius: 6,
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  textDecoration: "none",
                                  transition: "all 0.2s ease"
                                }}
                                className="hover:bg-[#C8E6C9]"
                              >
                                💬 Get Updates on WhatsApp
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================
