import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "motion/react";
import {
  Search, LayoutGrid, Clock, LogOut, User, ShoppingCart, Plus,
} from "lucide-react";
import { COLORS } from "./lib/config.js";
import { supabase } from "./lib/db.js";
import { supabaseClient } from "./lib/supabaseClient.js";
import { ensurePushSubscription } from "./lib/push.js";
import { useFilterSettings } from "./hooks/useFilterSettings.js";
import { useSheetData } from "./hooks/useSheetData.js";
import { SyncBar, Toast } from "./components/ui/atoms.jsx";
import QuickLoginPanel from "./components/QuickLoginPanel.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import AccountPanel from "./components/AccountPanel.jsx";
import RetailerView from "./components/RetailerView.jsx";
import SellerView from "./components/SellerView.jsx";
import ArticlePage from "./components/ArticlePage.jsx";
import GlobalFooter from "./components/GlobalFooter.jsx";
import AdminLoginScreen from "./components/AdminLoginScreen.jsx";
import MyOrdersPanel from "./components/MyOrdersPanel.jsx";

// MAIN APP
// =============================================
export default function HandloomB2BApp() {
  const [account, setAccount] = useState(() => {
    try {
      const saved = localStorage.getItem("deetya_account");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [dispatchLocation, setDispatchLocation] = useState(() => {
    try {
      const saved = localStorage.getItem("deetya_dispatch_origin");
      return saved ? JSON.parse(saved) : { lat: 25.2138, lng: 75.8648, address: "Kota Handloom Hub, Kota, Rajasthan" };
    } catch {
      return { lat: 25.2138, lng: 75.8648, address: "Kota Handloom Hub, Kota, Rajasthan" };
    }
  });

  const handleUpdateDispatchLocation = (newLoc) => {
    setDispatchLocation(newLoc);
    try {
      localStorage.setItem("deetya_dispatch_origin", JSON.stringify(newLoc));
    } catch {}
  };

  const getInitialRoute = () => {
    try {
      const hash = window.location.hash;
      if (hash === "#/cart") return { page: "catalog", cart: true };
      if (hash === "#/profile") return { page: "profile", cart: false };
      if (hash === "#/orders") return { page: "orders", cart: false };
      if (hash === "#/about") return { page: "about", cart: false };
      if (hash === "#/blogs") return { page: "blogs", cart: false };
      if (hash === "#/terms") return { page: "terms", cart: false };
      if (hash === "#/return") return { page: "return", cart: false };
      if (hash === "#/legal") return { page: "legal", cart: false };
    } catch {}
    return { page: "catalog", cart: false };
  };

  const initialRoute = getInitialRoute();
  const savedAccount = (() => { try { const s = localStorage.getItem("deetya_account"); return s ? JSON.parse(s) : null; } catch { return null; } })();
  const [tab, setTab] = useState(savedAccount?.is_admin ? "seller" : "retailer");
  const [activePage, setActivePage] = useState(initialRoute.page); // "catalog" or "profile"
  const isAdmin = account?.is_admin === true;

  useEffect(() => {
    if (isAdmin) ensurePushSubscription();
  }, [isAdmin]);
  const [showQuickLogin, setShowQuickLogin] = useState(false);
  const [toast, setToast] = useState(null); // { message, type }
  const showToast = (message, type = "success") => setToast({ message, type });
  const filterConfig = useFilterSettings();

  useEffect(() => {
    if (filterConfig.saveError) showToast("Could not save filter settings: " + filterConfig.saveError, "error");
  }, [filterConfig.saveError]);

  const systemFooter = useMemo(() => {
    const found = (filterConfig.rawSettings?.price_brackets || []).find(b => b.is_system_footer);
    
    const fallbackAbout = "We are Deetya Weaves, a premium B2B handloom supplier directly integrated with Kota's master artisans. We weave premium-grade cottons, mulmuls, doria, and custom hand-block prints for high-volume designers, boutique brands, and retail chain outlets. Every meter is spun with legacy, precision, and passion.";
    
    const fallbackBlogs = "### The Heritage of Kota Prints\nKotai hand-block printing has flourished for over three centuries. We work with 40+ families of block-printers, bringing you traditional bootis, jaals, and contemporary geometric repeats on sustainably sourced 60s and 80s cotton.\n\n### Weaving the Future: Ethical Weaves\nAt Deetya Weaves, ethical production isn't just a label. We secure reliable upfront deposits and prompt payouts for our weavers, ensuring year-round stable wages and keeping the majestic handloom arts alive.";
    
    const fallbackTerms = "1. All wholesale orders have a Minimum Order Quantity (MOQ) specified per product variant.\n2. Prices listed are exclusive of GST. Variant-specific GST rate and delivery charges will be added at checkout.\n3. Standard delivery takes 3-5 business days. Free delivery is applicable for delivery addresses within a 7 km radius of our Kota Hub.";
    
    const fallbackReturn = "1. Wholesale handloom orders are custom-woven or custom-printed and are eligible for returns or exchanges only in case of manufacturing defects or structural fabric damage.\n2. Any discrepancy in length, width, or printing must be reported within 48 hours of shipment arrival at your warehouse.\n3. Defective lots will be re-woven or fully refunded with standard bank transit times.";
    
    const fallbackLegal = "1. All commercial transactions, custom prints, and design IP registered with Deetya Weaves are protected under Jaipur jurisdiction legal frameworks.\n2. Trade secrets, proprietary block patterns, and loom specs remain the sole property of Deetya Weaves and its partner weaving houses.\n3. We comply with GST regulations and standard Indian trade codes for all regional and international wholesale distribution.";

    const fallbackContact = {
      phone: "+91 98290 12345",
      whatsapp: "9829012345",
      email: "contact@deetyaweaves.com",
      address: "Kota Handloom Hub, Kota, Rajasthan",
      timing: "Mon - Sat: 10:00 AM - 7:00 PM (Sunday Closed)"
    };

    if (found) {
      return {
        is_system_footer: true,
        aboutUs: found.aboutUs || fallbackAbout,
        blogs: found.blogs || fallbackBlogs,
        termsAndConditions: found.termsAndConditions || fallbackTerms,
        returnPolicy: found.returnPolicy || fallbackReturn,
        legalPolicy: found.legalPolicy || fallbackLegal,
        contactInfo: found.contactInfo || fallbackContact
      };
    }

    return {
      is_system_footer: true,
      aboutUs: fallbackAbout,
      blogs: fallbackBlogs,
      termsAndConditions: fallbackTerms,
      returnPolicy: fallbackReturn,
      legalPolicy: fallbackLegal,
      contactInfo: fallbackContact
    };
  }, [filterConfig.rawSettings?.price_brackets]);

  const handleUpdateFooterSettings = async (updatedFields) => {
    const currentBrackets = (filterConfig.rawSettings?.price_brackets || []).filter(b => !b.is_system_footer);
    const updatedBrackets = [
      ...currentBrackets,
      {
        is_system_footer: true,
        ...systemFooter,
        ...updatedFields
      }
    ];
    const payload = {
      ...filterConfig.rawSettings,
      price_brackets: updatedBrackets
    };
    await filterConfig.save(payload, true);
  };

  const contactInfo = systemFooter?.contactInfo || {};

  // Lifted cart and viewingCart state
  const [cart, setCart] = useState(() => {
    try { const s = localStorage.getItem("deetya_cart"); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const [viewingCart, setViewingCart] = useState(initialRoute.cart);

  useEffect(() => {
    try { localStorage.setItem("deetya_cart", JSON.stringify(cart)); } catch {}
  }, [cart]);

  // Sync URL hash with React state
  useEffect(() => {
    const handleHashChange = () => {
      try {
        const hash = window.location.hash;
        if (hash === "#/cart") {
          setViewingCart(true);
          setActivePage("catalog");
        } else if (hash === "#/profile") {
          setActivePage("profile");
          setViewingCart(false);
        } else if (hash === "#/orders") {
          setActivePage("orders");
          setViewingCart(false);
        } else if (hash === "#/about") {
          setActivePage("about");
          setViewingCart(false);
        } else if (hash === "#/blogs") {
          setActivePage("blogs");
          setViewingCart(false);
        } else if (hash === "#/terms") {
          setActivePage("terms");
          setViewingCart(false);
        } else if (hash === "#/return") {
          setActivePage("return");
          setViewingCart(false);
        } else if (hash === "#/legal") {
          setActivePage("legal");
          setViewingCart(false);
        } else {
          setActivePage("catalog");
          setViewingCart(false);
        }
      } catch {}
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    try {
      if (viewingCart) {
        if (window.location.hash !== "#/cart") {
          window.location.hash = "/cart";
        }
      } else if (activePage && activePage !== "catalog") {
        if (window.location.hash !== `#/${activePage}`) {
          window.location.hash = `/${activePage}`;
        }
      } else {
        if (window.location.hash && window.location.hash !== "#/" && window.location.hash !== "#/catalog") {
          window.location.hash = "/";
        }
      }
    } catch {}
  }, [activePage, viewingCart]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // Debounce search to fix INP — only filter after user stops typing 200ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [myOrders, setMyOrders] = useState([]);
  const sheetData = useSheetData();

  // Route state to support separate Admin / Customer entities
  const [isAdminPath, setIsAdminPath] = useState(() => {
    return window.location.pathname === "/admin" || window.location.search.includes("admin") || window.location.hostname.includes("admin");
  });

  const handleBackToCatalog = () => {
    setIsAdminPath(false);
    try { window.history.pushState({}, "", "/"); } catch {}
  };

  const fetchMyOrders = useCallback(async () => {
    if (!account) return;
    try {
      const data = await supabase(`orders?retailer_phone=eq.${account.phone}&select=*&order=created_at.desc`);
      setMyOrders(data || []);
    } catch (e) { console.error(e); }
  }, [account]);

  useEffect(() => { fetchMyOrders(); }, [fetchMyOrders]);

  useEffect(() => {
    const handlePopState = () => {
      setIsAdminPath(window.location.pathname === "/admin" || window.location.search.includes("admin") || window.location.hostname.includes("admin"));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Separate Admin login block if on the admin path
  if (isAdminPath && !isAdmin) {
    return (
      <AdminLoginScreen
        onLogin={acc => {
          setAccount(acc);
          try { localStorage.setItem("deetya_account", JSON.stringify(acc)); } catch {}
          setTab("seller");
        }}
        onBackToCatalog={handleBackToCatalog}
      />
    );
  }

  return (
    <div style={{ background: COLORS.ivory, minHeight:"100vh", fontFamily:"var(--sans)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
        :root {
          --serif: 'Playfair Display', Georgia, serif;
          --sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder, select { font-family: var(--sans); }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── ANIMATION SYSTEM ── */

        /* Skeleton shimmer */
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .skeleton-pulse {
          background: linear-gradient(90deg, #F0E4CE 25%, #FDF6EC 50%, #F0E4CE 75%);
          background-size: 200% 100%;
          animation: shimmer 1.6s ease-in-out infinite;
          border-radius: 6px;
        }

        /* Stagger card entry */
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .product-card {
          animation: cardIn 0.45s cubic-bezier(0.4, 0, 0.2, 1) both;
        }

        /* Price reveal when logging in */
        @keyframes priceReveal {
          from { opacity: 0; transform: scale(0.75) translateY(6px); filter: blur(4px); }
          to   { opacity: 1; transform: scale(1) translateY(0);      filter: blur(0); }
        }
        .price-revealed {
          animation: priceReveal 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }

        /* Quantity number pop */
        @keyframes qtyPop {
          0%   { transform: scale(0.7); }
          60%  { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        .qty-pop {
          animation: qtyPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }

        /* Filter chip spring */
        .filter-chip {
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
        }
        .filter-chip:hover {
          transform: scale(1.06) !important;
        }

        /* Toast slide-up */
        @keyframes toastIn {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes toastOut {
          from { transform: translateY(0);    opacity: 1; }
          to   { transform: translateY(24px); opacity: 0; }
        }
        .toast-enter { animation: toastIn  0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .toast-exit  { animation: toastOut 0.3s  cubic-bezier(0.4, 0, 1, 1)          both; }

        /* Custom scrollbars for a premium visual theme */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: ${COLORS.cream};
        }
        ::-webkit-scrollbar-thumb {
          background: ${COLORS.ivoryDeep};
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: ${COLORS.charcoalSoft}44;
        }

        /* Beautiful card styling with smooth lift and shadow transition */
        .product-card {
          transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.25s ease;
        }
        .product-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(61,31,92,0.14);
          border-color: ${COLORS.indigo}44 !important;
        }

        /* Image hover zoom inside card */
        .image-zoom-container img {
          transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .image-zoom-container:hover img {
          transform: scale(1.05);
        }

        /* Prevent selection carets globally to avoid text cursor on catalog clicks */
        body, .product-card, .product-card * {
          user-select: none;
          -webkit-user-select: none;
        }
        input, textarea, select, [contenteditable="true"] {
          user-select: text !important;
          -webkit-user-select: text !important;
        }

        /* Mobile specific helper classes */
        @media (max-width: 768px) {
          .hide-mobile {
            display: none !important;
          }
          .show-mobile {
            display: block !important;
          }
          .flex-show-mobile {
            display: flex !important;
          }
          .profile-btn-responsive {
            padding: 8px !important;
            border-radius: 50% !important;
            width: 36px !important;
            height: 36px !important;
            min-width: 36px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          .products-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px !important;
          }
          .product-card {
            padding: 10px !important;
            border-radius: 12px !important;
          }
          .product-card-title {
            font-size: 13.5px !important;
            min-height: 36px !important;
          }
          .product-card-category {
            font-size: 10px !important;
          }
        }
        @media (min-width: 769px) {
          .show-mobile {
            display: none !important;
          }
          .flex-show-mobile {
            display: none !important;
          }
        }
      `}</style>

      <div style={{ maxWidth:980, margin:"0 auto", padding:"24px 20px 60px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:14 }}>
          <div onClick={() => { setActivePage("catalog"); setViewingCart(false); }} style={{ display:"flex", alignItems:"center", gap:10, cursor: "pointer" }} title="Go to Catalog">
            <div style={{ width:36, height:36, borderRadius:8, background: COLORS.indigo, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="20" height="20" viewBox="0 0 20 20">
                {[2,7,12,17].map(x=><line key={x} x1={x} y1="1" x2={x} y2="19" stroke={COLORS.turmeric} strokeWidth="1.6"/>)}
                {[2,7,12,17].map(y=><line key={"h"+y} x1="1" y1={y} x2="19" y2={y} stroke={COLORS.ivory} strokeWidth="1.2" opacity="0.5"/>)}
              </svg>
            </div>
            <div>
              <div style={{ fontFamily:"var(--serif)", fontSize:19, color: COLORS.indigo }}>Deetya Weaves</div>
            </div>
          </div>
 
          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            {isAdmin && (
              <div style={{ display:"flex", background: COLORS.ivoryDeep, borderRadius:10, padding:4 }}>
                <button style={{ display:"flex", alignItems:"center", gap:6, border:"none", padding:"8px 16px", borderRadius:8, fontSize:13, cursor:"pointer", background: COLORS.cream, color: COLORS.indigo }}>
                  <LayoutGrid size={14}/> Seller Dashboard
                </button>
              </div>
            )}

            {/* Desktop Search Bar (visible on desktop) */}
            <div className="" style={{ display:"flex", alignItems:"center", gap:8, background: COLORS.cream, border:`1.5px solid ${COLORS.charcoalSoft}18`, borderRadius:10, padding:"6px 12px", boxShadow: "0 2px 6px rgba(42,36,29,0.02)" }}>
              <Search size={14} color={COLORS.indigo}/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search collection..."
                style={{ border:"none", outline:"none", background:"transparent", fontSize:13, width:130, color: COLORS.charcoal, fontFamily:"var(--sans)" }}/>
              {search && (
                <span onClick={() => setSearch("")} style={{ cursor: "pointer", fontSize: 11, color: COLORS.charcoalSoft, fontWeight: 700, padding: "0 2px" }}>✕</span>
              )}
            </div>

            {/* Mobile Search Toggle Button (visible on mobile) */}
            <button className="show-mobile" onClick={() => setShowSearchInput(!showSearchInput)}
              style={{
                display: "none", // overridden by .show-mobile media query
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: showSearchInput ? COLORS.indigo : COLORS.cream,
                color: showSearchInput ? COLORS.cream : COLORS.indigo,
                border: `1.5px solid ${COLORS.charcoalSoft}18`,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              title="Search collection..."
            >
              <Search size={15} />
            </button>

            {/* Shopping Cart Button */}
            {!isAdmin && (
              <button
                onClick={() => {
                  if (!account) {
                    setShowQuickLogin(true);
                  } else {
                    setActivePage("catalog");
                    setViewingCart(!viewingCart);
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: viewingCart ? COLORS.indigo : COLORS.cream,
                  border: `1px solid ${COLORS.charcoalSoft}33`,
                  borderRadius: 8,
                  padding: "7px 12px",
                  fontSize: 12.5,
                  cursor: "pointer",
                  color: viewingCart ? COLORS.cream : COLORS.indigo,
                  fontWeight: 600,
                  position: "relative",
                  fontFamily: "var(--sans)",
                  transition: "all 0.2s ease"
                }}
                className="profile-btn-responsive"
                title={account ? "Review Cart & Checkout" : "Login to view cart"}
              >
                <ShoppingCart size={14} color={viewingCart ? COLORS.cream : COLORS.indigo} />
                <span className="hide-mobile">Cart</span>
                {Object.values(cart).reduce((sum, q) => sum + q, 0) > 0 && (
                  <span style={{
                    background: COLORS.madder,
                    color: COLORS.cream,
                    borderRadius: "50%",
                    fontSize: 9,
                    fontWeight: "700",
                    width: 16,
                    height: 16,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "absolute",
                    top: -6,
                    right: -6,
                    boxShadow: "0 2px 5px rgba(0,0,0,0.2)"
                  }}>
                    {Object.values(cart).reduce((sum, q) => sum + q, 0)}
                  </span>
                )}
              </button>
            )}

            {/* Logged in User Profile Actions */}
            {account && !isAdmin && (
              <>
                <button
                  onClick={() => { setActivePage("orders"); setViewingCart(false); fetchMyOrders(); }}
                  className="hide-mobile"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: activePage === "orders" ? COLORS.indigo : COLORS.cream,
                    border: `1px solid ${COLORS.charcoalSoft}33`,
                    borderRadius: 8,
                    padding: "7px 12px",
                    fontSize: 12.5,
                    cursor: "pointer",
                    color: activePage === "orders" ? COLORS.cream : COLORS.charcoal,
                    fontWeight: 500,
                    transition: "all 0.2s ease"
                  }}
                >
                  <Clock size={13} color={activePage === "orders" ? COLORS.cream : COLORS.indigo} />
                  My Orders
                </button>
                <button
                  onClick={() => { setActivePage(activePage === "profile" ? "catalog" : "profile"); setViewingCart(false); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: activePage === "profile" ? COLORS.indigo : COLORS.cream,
                    border: `1px solid ${COLORS.charcoalSoft}33`,
                    borderRadius: 8,
                    padding: "7px 12px",
                    fontSize: 12.5,
                    cursor: "pointer",
                    color: activePage === "profile" ? COLORS.cream : COLORS.charcoal,
                    fontWeight: 500,
                    transition: "all 0.2s ease"
                  }}
                  className="profile-btn-responsive"
                  title="My Profile"
                >
                  <User size={13} color={activePage === "profile" ? COLORS.cream : COLORS.indigo} />
                  <span className="hide-mobile">My Profile</span>
                </button>
              </>
            )}

            {/* Non-Logged In User Action */}
            {!account && (
              <button onClick={() => setShowQuickLogin(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: COLORS.indigo,
                  color: COLORS.cream,
                  border: "none",
                  borderRadius: 8,
                  padding: "7px 12px",
                  fontSize: 12.5,
                  cursor: "pointer",
                  fontFamily: "var(--sans)",
                  fontWeight: 600,
                  boxShadow: "0 2px 6px rgba(30,41,59,0.12)"
                }}
                className="profile-btn-responsive"
                title="Login to view prices"
              >
                <User size={14} color={COLORS.cream} />
                <span className="hide-mobile">Login</span>
              </button>
            )}

            {/* Log Out Button */}
            {account && (
              <button onClick={() => { setAccount(null); setActivePage("catalog"); setViewingCart(false); setCart({}); try { localStorage.removeItem("deetya_account"); localStorage.removeItem("deetya_cart"); } catch {} if (isAdmin) { supabaseClient.auth.signOut(); handleBackToCatalog(); } }}
                className="hide-mobile"
                style={{ display:"flex", alignItems:"center", gap:5, background:"transparent", border:`1px solid ${COLORS.charcoalSoft}33`, borderRadius:8, padding:"7px 10px", fontSize:12, cursor:"pointer", color: COLORS.charcoalSoft, fontFamily:"var(--sans)" }}>
                <LogOut size={13}/> Log out
              </button>
            )}

          </div>
        </div>

        {/* Mobile Search Bar Row (visible on mobile only when search input is toggled open) */}
        {showSearchInput && (
          <div className="show-mobile" style={{ display: "none", width: "100%", marginTop: 10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, background: COLORS.cream, border:`1.5px solid ${COLORS.charcoalSoft}18`, borderRadius:10, padding:"8px 12px" }}>
              <Search size={14} color={COLORS.indigo}/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search collection..." autoFocus
                style={{ border:"none", outline:"none", background:"transparent", fontSize:13, width:"100%", color: COLORS.charcoal, fontFamily:"var(--sans)" }}/>
              <span onClick={() => { setSearch(""); setShowSearchInput(false); }} style={{ cursor: "pointer", fontSize: 13, color: COLORS.charcoalSoft, fontWeight: 700, paddingLeft: 8 }}>✕</span>
            </div>
          </div>
        )}

        {isAdmin && <div style={{ marginTop:16 }}><SyncBar {...sheetData}/></div>}

        <div style={{ marginTop:16 }}>
          {isAdmin ? (
            <div className="admin-panel">
              <SellerView
                sheetData={sheetData}
                filterConfig={filterConfig}
                dispatchLocation={dispatchLocation}
                onUpdateDispatchLocation={handleUpdateDispatchLocation}
                systemFooter={systemFooter}
                onUpdateFooterSettings={handleUpdateFooterSettings}
              />
            </div>
          ) : (
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {activePage === "about" ? (
                <ArticlePage title="About Us" content={systemFooter.aboutUs} onBack={() => setActivePage("catalog")} />
              ) : activePage === "blogs" ? (
                <ArticlePage title="Blogs" content={systemFooter.blogs} onBack={() => setActivePage("catalog")} />
              ) : activePage === "terms" ? (
                <ArticlePage title="Terms & Conditions" content={systemFooter.termsAndConditions} onBack={() => setActivePage("catalog")} />
              ) : activePage === "return" ? (
                <ArticlePage title="Return Policy" content={systemFooter.returnPolicy} onBack={() => setActivePage("catalog")} />
              ) : activePage === "legal" ? (
                <ArticlePage title="Legal Policy" content={systemFooter.legalPolicy} onBack={() => setActivePage("catalog")} />
              ) : activePage === "profile" && account ? (
                <AccountPanel
                  account={account}
                  orders={myOrders}
                  onClose={() => setActivePage("catalog")}
                  onAccountUpdated={(updated) => {
                    setAccount(updated);
                    try { localStorage.setItem("deetya_account", JSON.stringify(updated)); } catch {}
                  }}
                  contactInfo={contactInfo}
                  setActivePage={setActivePage}
                  onLogOut={() => {
                    if (isAdmin) supabaseClient.auth.signOut();
                    setAccount(null);
                    setActivePage("catalog");
                    setViewingCart(false);
                    try { localStorage.removeItem("deetya_account"); } catch {}
                  }}
                />
              ) : activePage === "orders" && account ? (
                <MyOrdersPanel
                  account={account}
                  orders={myOrders}
                  items={sheetData.items}
                  onClose={() => setActivePage("catalog")}
                  supabase={supabase}
                  setCart={setCart}
                />
              ) : (
                <RetailerView
                  sheetData={sheetData}
                  account={account}
                  onOrderPlaced={fetchMyOrders}
                  filterSettings={filterConfig.settings}
                  onShowLogin={() => setShowQuickLogin(true)}
                  onViewProfile={() => setActivePage("profile")}
                  dispatchLocation={dispatchLocation}
                  onAccountUpdated={(updated) => {
                    setAccount(updated);
                    try { localStorage.setItem("deetya_account", JSON.stringify(updated)); } catch {}
                  }}
                  cart={cart}
                  setCart={setCart}
                  viewingCart={viewingCart}
                  setViewingCart={setViewingCart}
                  contactInfo={contactInfo}
                  myOrders={myOrders}
                  search={search}
                  setSearch={setSearch}
                  debouncedSearch={debouncedSearch}
                />
              )}
            </motion.div>
          )}
        </div>

        {/* Quick login panel for guests */}
        {showQuickLogin && !account && (
          <QuickLoginPanel
            onLogin={acc => {
              setAccount(acc);
              try { localStorage.setItem("deetya_account", JSON.stringify(acc)); } catch {}
              setShowQuickLogin(false);
              if (acc.is_admin) setTab("seller");
            }}
            onClose={() => setShowQuickLogin(false)}
          />
        )}

        <GlobalFooter systemFooter={systemFooter} onNavigate={setActivePage} />
      </div>

      {/* Full admin/seller login screen */}
      {showAdminLogin && !account && (
        <div style={{ position:"fixed", inset:0, zIndex:2000 }}>
          <LoginScreen onLogin={acc => {
            setAccount(acc);
            try { localStorage.setItem("deetya_account", JSON.stringify(acc)); } catch {}
            setShowAdminLogin(false);
            if (acc.is_admin) setTab("seller");
          }}/>
          <button onClick={() => setShowAdminLogin(false)}
            style={{ position:"fixed", top:20, right:20, background:"rgba(0,0,0,0.5)", color:"#fff", border:"none", borderRadius:"50%", width:36, height:36, fontSize:20, cursor:"pointer", zIndex:2001, display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>
      )}
    </div>
  );
}
