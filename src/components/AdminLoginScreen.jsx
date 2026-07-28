import React, { useState, useEffect } from "react";
import { ShieldCheck } from "lucide-react";
import { COLORS, ADMIN_EMAILS } from "../lib/config.js";
import { supabaseClient } from "../lib/supabaseClient.js";

// ADMIN / SELLER LOGIN SCREEN (Dedicated Separate Entity Feel)
// Google Sign-In via Supabase Auth, restricted to ADMIN_EMAILS.
// =============================================
export default function AdminLoginScreen({ onLogin, onBackToCatalog }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub;

    const authorizeSession = async (session) => {
      if (!session?.user?.email) {
        setLoading(false);
        return;
      }
      const email = session.user.email.toLowerCase();
      if (ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email)) {
        onLogin({
          id: "admin",
          phone: "admin",
          shop_name: "Guru Kripa Traders",
          owner_name: session.user.user_metadata?.full_name || email,
          email,
          is_admin: true,
        });
      } else {
        setError(`${email} is not authorized for admin access.`);
        await supabaseClient.auth.signOut();
        setLoading(false);
      }
    };

    // Check for an existing session first (e.g. returning from Google's redirect)
    supabaseClient.auth.getSession().then(({ data }) => {
      if (data?.session) authorizeSession(data.session);
      else setLoading(false);
    });

    // Also listen for the session appearing after the OAuth redirect completes
    const { data: listener } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (session) authorizeSession(session);
    });
    unsub = listener?.subscription;

    return () => unsub?.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleSignIn = async () => {
    setError(""); setLoading(true);
    const { error: signInError } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/?admin` },
    });
    if (signInError) {
      setError(signInError.message || "Could not start Google sign-in.");
      setLoading(false);
    }
    // On success, the browser redirects to Google, then back — the useEffect
    // above picks up the resulting session automatically.
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

        <div style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.ivoryDeep, borderRadius: 8, padding: "11px 14px", marginBottom: 16 }}>
          <ShieldCheck size={16} color={COLORS.indigo} />
          <span style={{ fontSize: 12.5, color: COLORS.charcoalSoft }}>Access is restricted to approved Google accounts.</span>
        </div>

        {error && <div style={{ color: COLORS.madder, fontSize: 12, marginBottom: 14 }}>{error}</div>}

        <button onClick={handleGoogleSignIn} disabled={loading}
          style={{ width: "100%", background: COLORS.cream, color: COLORS.charcoal, border: `1px solid ${COLORS.charcoalSoft}33`, padding: "12px", borderRadius: 8, fontSize: 14, cursor: "pointer", fontFamily: "var(--sans)", fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.9v2.33A9 9 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.05l3.07-2.33z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.95l3.07 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
          </svg>
          {loading ? "Checking session…" : "Sign in with Google"}
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
