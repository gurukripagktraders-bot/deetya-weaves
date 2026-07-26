import React from "react";
import { Phone } from "lucide-react";
import { COLORS } from "../lib/config.js";

export default function GlobalFooter({ systemFooter, onNavigate }) {
  const safeContactInfo = systemFooter?.contactInfo || {};
  const rawWhatsapp = safeContactInfo.whatsapp ? String(safeContactInfo.whatsapp) : "";
  const cleanWa = rawWhatsapp ? rawWhatsapp.replace(/\D/g, "") : "";
  const waLink = cleanWa.length === 10 ? `91${cleanWa}` : cleanWa;

  return (
    <footer id="global_footer" style={{ borderTop: `1px solid ${COLORS.charcoalSoft}18`, marginTop: 80, paddingTop: 40, paddingBottom: 40, fontFamily: "var(--sans)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: 40 }}>
        
        {/* Left Side: Editorial Links */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 240 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: COLORS.indigo, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="15" height="15" viewBox="0 0 20 20">
                {[2,7,12,17].map(x => <line key={x} x1={x} y1="1" x2={x} y2="19" stroke={COLORS.turmeric} strokeWidth="1.6"/>)}
                {[2,7,12,17].map(y => <line key={"h"+y} x1="1" y1={y} x2="19" y2={y} stroke={COLORS.ivory} strokeWidth="1.2" opacity="0.5"/>)}
              </svg>
            </div>
            <span style={{ fontFamily: "var(--serif)", fontSize: 15, fontWeight: 700, color: COLORS.indigo, letterSpacing: 0.5 }}>Deetya Weaves</span>
          </div>
          
          <nav style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "About Us", page: "about" },
              { label: "Blogs", page: "blogs" },
              { label: "Terms & Conditions", page: "terms" },
              { label: "Return Policy", page: "return" },
              { label: "Legal Policy", page: "legal" }
            ].map((link, idx) => (
              <button
                key={idx}
                onClick={() => {
                  onNavigate(link.page);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  margin: 0,
                  textAlign: "left",
                  fontSize: 13,
                  color: COLORS.charcoalSoft,
                  cursor: "pointer",
                  fontFamily: "var(--sans)",
                  fontWeight: 500,
                  transition: "color 0.2s"
                }}
                className="hover:text-indigo-600"
              >
                {link.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right Side: Contact & Timing with WhatsApp Logo Clicker */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 280, alignItems: "flex-end", textAlign: "right" }} className="mobile-align-left">
          <h4 style={{ fontFamily: "var(--serif)", fontSize: 14, color: COLORS.indigo, margin: "0 0 4px 0", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
            Get In Touch
          </h4>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }} className="mobile-align-left-inner">
            {/* Phone */}
            {safeContactInfo.phone && (
              <div style={{ fontSize: 13, color: COLORS.charcoal, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: COLORS.charcoalSoft, fontSize: 12 }}>📞</span>
                <a href={`tel:${safeContactInfo.phone}`} style={{ color: COLORS.charcoal, textDecoration: "none", fontWeight: 500 }} className="hover:underline">
                  {safeContactInfo.phone}
                </a>
              </div>
            )}
            
            {/* Timing */}
            {safeContactInfo.timing && (
              <div style={{ fontSize: 13, color: COLORS.charcoalSoft, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12 }}>🕒</span>
                <span>{safeContactInfo.timing}</span>
              </div>
            )}

            {/* Email */}
            {safeContactInfo.email && (
              <div style={{ fontSize: 13, color: COLORS.charcoal, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: COLORS.charcoalSoft, fontSize: 12 }}>✉️</span>
                <a href={`mailto:${safeContactInfo.email}`} style={{ color: COLORS.indigo, textDecoration: "none", fontWeight: 500 }} className="hover:underline">
                  {safeContactInfo.email}
                </a>
              </div>
            )}

            {/* WhatsApp Logo Clicker */}
            {rawWhatsapp && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                <span style={{ fontSize: 12, color: COLORS.charcoalSoft, fontWeight: 500 }}>Chat with us:</span>
                <a
                  href={`https://wa.me/${waLink}?text=Hello! I have a bulk inquiry about your Kota handloom catalog.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "#25D366",
                    boxShadow: "0 2px 8px rgba(37,211,102,0.3)",
                    transition: "transform 0.2s, background-color 0.2s",
                    cursor: "pointer"
                  }}
                  className="hover:scale-105 active:scale-95"
                  title="Open WhatsApp Chat"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.717-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.963C16.528 2.016 14.062.993 11.45.993 6.01.993 1.587 5.363 1.583 10.793c-.001 1.716.463 3.393 1.344 4.883L1.933 21.05l5.364-1.405c1.45.793 2.896 1.191 4.316 1.191zM17.93 14.93c-.268-.134-1.586-.782-1.831-.871-.246-.09-.425-.134-.605.134-.18.268-.693.871-.848 1.05-.156.18-.312.201-.58.067-.268-.134-1.134-.419-2.16-1.336-.799-.713-1.338-1.593-1.495-1.861-.156-.268-.017-.413.118-.546.12-.12.268-.313.402-.469.135-.156.179-.268.268-.447.09-.179.045-.335-.022-.469-.067-.134-.605-1.457-.828-1.993-.218-.524-.458-.453-.628-.461-.161-.008-.347-.009-.532-.009-.186 0-.488.07-.744.347-.256.277-.978.96-.978 2.342 0 1.382 1.002 2.715 1.14 2.902.14.187 1.973 3.012 4.778 4.219.667.287 1.188.458 1.595.587.67.213 1.281.183 1.763.111.538-.08 1.586-.648 1.81-.1273.223-.625.223-1.161.156-1.273-.067-.112-.246-.179-.514-.313z" />
                  </svg>
                </a>
              </div>
            )}
          </div>
        </div>

      </div>

      <style>{`
        @media (max-width: 640px) {
          .mobile-align-left {
            align-items: flex-start !important;
            text-align: left !important;
          }
          .mobile-align-left-inner {
            align-items: flex-start !important;
          }
        }
      `}</style>

      {/* Bottom bar */}
      <div style={{ borderTop: `1px solid ${COLORS.charcoalSoft}11`, marginTop: 32, paddingTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <span style={{ fontSize: 11.5, color: COLORS.charcoalSoft }}>
          © 2026 Deetya Weaves & Guru Kripa Traders. All rights reserved.
        </span>
        <span style={{ fontSize: 11, color: COLORS.charcoalSoft, opacity: 0.8, fontWeight: 500 }}>
          B2B Handloom Wholesale Hub, Kota
        </span>
      </div>
    </footer>
  );
}

// =============================================
