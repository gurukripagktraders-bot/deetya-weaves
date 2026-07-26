import React, { useState, useEffect, useMemo, useCallback, useRef, useTransition, startTransition } from "react";
import Papa from "papaparse";
import {
  Search, RefreshCw, AlertTriangle, Image as ImageIcon, CheckCircle2, Plus, Minus,
  ShoppingBag, LayoutGrid, ChevronRight, Truck, Clock, Package, Wallet,
  Phone, ShieldCheck, LogOut, User, CreditCard, ChevronLeft, Bell, ChevronDown,
  Trash2, MapPin, Copy, Sparkles, ShoppingCart, FileText, Menu, X,
} from "lucide-react";
import { motion } from "motion/react";
import CartPage from "./components/CartPage.jsx";
import MyOrdersPanel from "./components/MyOrdersPanel.jsx";

// =============================================
// CONFIGURATION — Replace with your Supabase details
// Go to Supabase → Project Settings → API
// =============================================
const SUPABASE_URL = "https://jcdcfzkdddqgemlgtcxe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZGNmemtkZGRxZ2VtbGd0Y3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4ODI4NzgsImV4cCI6MjA5ODQ1ODg3OH0.43wN6LH7-4F5D0tALxrRHge7BQhsVCK1bs5IVTDFxME";

const DEFAULT_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQUtvYNbIkmNe5WyOBVo5B1O5mxl8YY8Wt4IS0nzsD1Lnao9nKP23UWadAm8gAF4RbftwNnSAwQk5nc/pub?output=csv";

const MOCK_OTP = "1234"; // Replace with real SMS OTP service later
const ADMIN_PIN = "GKT@2024"; // Change this to your own secret PIN

const COLORS = {
  // Backgrounds — warm desert sand
  ivory:        "#FDF6EC",   // main page background
  ivoryDeep:    "#F0E4CE",   // inputs, secondary backgrounds
  cream:        "#FFFFFF",   // card surfaces

  // Primary — Deep Plum (natural indigo-madder mix)
  indigo:       "#3D1F5C",   // nav, primary buttons, active

  // Accent — Marigold (festival flowers)
  turmeric:     "#E8980A",   // badges, bestseller, highlights

  // Price / CTA — Sunset Orange
  madder:       "#D45A2A",   // prices, primary CTAs, alerts

  // Success — Leaf Green
  sage:         "#2E6B4A",   // in-stock, success, approved

  // Text hierarchy — warm dark plum
  charcoal:     "#1A0E28",   // headings, primary text
  charcoalSoft: "#6B4E8A",   // body, secondary text, meta
};

const STAGES = ["Pending", "Confirmed", "Packed", "Out for delivery", "Delivered"];
const GST_RATE = 5; // % — handloom cotton textile rate in India
const SYNC_INTERVAL_MS = 3 * 60 * 1000;
const SAMPLE_CSV = `Item,Category,Variant,MOQ,Size,Weight,Price,Photo Link,Stock Avail
Khushi Uniform,Towel Choka,Parent,5,20*47,438,87.15,,
A1 Diamond,Towel Choka,Parent,5,20*44,440,88.2,,
Hero Chex,Towel Choka,Parent,5,23*51,530,102.9,,
Sri Shakti Chex,Towel Choka,Parent,5,24*53,690,123,,
Sri Shakti Uniform,Towel Choka,Child,5,24*53,690,123,,
Bombay Dyeing Chex,Towel Choka,Parent,5,26*54,680,140,,
Bombay Dyeing Jacquard,Towel Choka,Child,5,26*54,680,140,,`;

// =============================================
// SUPABASE HELPER WITH LOCAL STORAGE FALLBACK
// =============================================
function getLocalCollection(name) {
  try {
    const raw = localStorage.getItem(`deetya_db_${name}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Local storage read error", e);
  }

  // Seed data if empty
  if (name === "filter_settings") {
    const defaultSettings = [
      {
        id: "main",
        show_price_filter: true,
        show_weight_filter: true,
        show_size_filter: true,
        show_sort: true,
        price_brackets: [
          { label: "Under ₹100", min: 0, max: 100 },
          { label: "₹100 – ₹200", min: 100, max: 200 },
          { label: "₹200 – ₹500", min: 200, max: 500 },
          { label: "Above ₹500", min: 500, max: 999999 },
        ],
      }
    ];
    saveLocalCollection(name, defaultSettings);
    return defaultSettings;
  }

  if (name === "discount_codes") {
    const defaultCodes = [
      { id: "d1", code: "WELCOME10", discount_type: "percentage", discount_value: 10, min_order_value: 0, times_used: 0, max_uses: 100, is_active: true, created_at: new Date().toISOString() },
      { id: "d2", code: "DEETYA50", discount_type: "flat", discount_value: 50, min_order_value: 500, times_used: 0, max_uses: 100, is_active: true, created_at: new Date().toISOString() },
    ];
    saveLocalCollection(name, defaultCodes);
    return defaultCodes;
  }

  if (name === "retailers") {
    const defaultRetailers = [
      {
        id: "r_admin",
        phone: "9999999999",
        shop_name: "Deetya Weaves Admin",
        owner_name: "Admin",
        status: "approved",
        credit_limit: 1000000,
        credit_used: 0,
        phone_verified: true,
        email_verified: true,
        email: "admin@deetyaweaves.com",
        is_admin: true,
        created_at: new Date().toISOString()
      }
    ];
    saveLocalCollection(name, defaultRetailers);
    return defaultRetailers;
  }

  return [];
}

function saveLocalCollection(name, data) {
  try {
    localStorage.setItem(`deetya_db_${name}`, JSON.stringify(data));
  } catch (e) {
    console.error("Local storage write error", e);
  }
}

function runLocalDb(table, method = "GET", body = null, extra = "") {
  const [tableName, queryStr] = table.split("?");
  let data = getLocalCollection(tableName);

  // Parse filters
  const filters = {};
  if (queryStr) {
    const parts = queryStr.split("&");
    parts.forEach(p => {
      const [key, val] = p.split("=");
      if (key && val && val.startsWith("eq.")) {
        let actualVal = val.slice(3);
        if (actualVal === "true") actualVal = true;
        if (actualVal === "false") actualVal = false;
        filters[key] = decodeURIComponent(actualVal);
      }
    });
  }

  if (method === "GET") {
    let result = data.filter(item => {
      for (const [key, val] of Object.entries(filters)) {
        if (String(item[key]) !== String(val)) {
          return false;
        }
      }
      return true;
    });

    if (queryStr && queryStr.includes("order=created_at.desc")) {
      result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    const limitMatch = queryStr && queryStr.match(/limit=(\d+)/);
    if (limitMatch) {
      const limit = parseInt(limitMatch[1], 10);
      result = result.slice(0, limit);
    }

    return result;
  }

  if (method === "POST") {
    const makeItem = (b) => ({
      id: b.id || (tableName.slice(0, 2) + "_" + Math.random().toString(36).slice(2, 9)),
      created_at: new Date().toISOString(),
      ...b
    });

    if (Array.isArray(body)) {
      const insertedList = body.map(makeItem);
      data.push(...insertedList);
      saveLocalCollection(tableName, data);
      return insertedList;
    } else {
      const newItem = makeItem(body);
      data.push(newItem);
      saveLocalCollection(tableName, data);
      return [newItem];
    }
  }

  if (method === "PATCH") {
    const updatedList = [];
    data = data.map(item => {
      let matches = true;
      for (const [key, val] of Object.entries(filters)) {
        if (String(item[key]) !== String(val)) {
          matches = false;
          break;
        }
      }
      if (matches) {
        const updatedItem = { ...item, ...body, updated_at: new Date().toISOString() };
        updatedList.push(updatedItem);
        return updatedItem;
      }
      return item;
    });

    saveLocalCollection(tableName, data);
    return updatedList;
  }

  if (method === "DELETE") {
    data = data.filter(item => {
      let matches = true;
      for (const [key, val] of Object.entries(filters)) {
        if (String(item[key]) !== String(val)) {
          matches = false;
          break;
        }
      }
      return !matches;
    });
    saveLocalCollection(tableName, data);
    return null;
  }

  return [];
}

async function supabase(table, method = "GET", body = null, extra = "") {
  try {
    const headers = {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    };
    if (method === "POST") headers["Prefer"] = "return=representation";
    if (method === "PATCH") headers["Prefer"] = "return=representation";

    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${extra}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      let errMsg = `Supabase error ${res.status}`;
      try { errMsg = JSON.parse(errText).message || errMsg; } catch {}
      throw new Error(errMsg);
    }
    if (method === "DELETE") return null;
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  } catch (error) {
    console.warn("Supabase network error, falling back on Local Storage Database:", error);
    return runLocalDb(table, method, body, extra);
  }
}

// =============================================
// SHEET PARSING
// =============================================
function driveDirectLink(url) {
  if (!url) return null;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  return url;
}

function parsePhotos(rawString) {
  if (!rawString) return [];
  // Split by comma or semicolon or whitespace, ignoring multiple spaces
  const parts = rawString.split(/[\s,;\n]+/).filter(Boolean);
  return parts.map(part => {
    // Strip any enclosing quotes (which can occur in CSV fields with commas)
    const trimmed = part.replace(/^["']|["']$/g, '').trim();
    if (!trimmed) return null;
    return driveDirectLink(trimmed);
  }).filter(url => url && (url.startsWith("http://") || url.startsWith("https://")));
}

// Flexible column finder — handles extra spaces, different cases, aliases
function col(row, ...names) {
  for (const name of names) {
    for (const key of Object.keys(row)) {
      if (key.trim().toLowerCase() === name.trim().toLowerCase()) {
        return row[key]?.trim() || "";
      }
    }
  }
  return "";
}

function parseSheet(csvText) {
  const result = Papa.parse(csvText.trim(), { header: true, skipEmptyLines: true });
  const rows = result.data;
  const grouped = [];
  let currentParent = null;
  let idx = 0;

  rows.forEach((row) => {
    // Skip blank/separator rows but keep currentParent intact
    if (col(row, "item") === "") return;
    const i = idx++;
    const priceW = parseFloat(col(row, "price (w)", "price(w)", "wholesale price", "w price", "price")) || 0;
    const priceR = parseFloat(col(row, "price (r)", "price(r)", "retail price", "mrp", "r price")) || 0;
    const moq = parseInt(col(row, "moq", "min order", "minimum order"), 10) || 12;
    const stockRaw = parseInt(col(row, "stock availabe", "stock available", "stock avail", "quantity", "qty", "stock", "availabe"), 10);
    const stock = Number.isFinite(stockRaw) ? stockRaw : null;
    const variantType = col(row, "variant", "type", "variant type") || "Parent";
    const name = col(row, "item", "item name", "product", "product name");
    const size = col(row, "size", "dimensions");
    const weight = col(row, "weight", "wt", "grams");
    const photos = parsePhotos(col(row, "photo link", "photo", "image", "image link", "photo url"));
    const photo = photos.length > 0 ? photos[0] : null;
    const category = col(row, "category", "cat", "main category", "main cat") || "Uncategorised";
    const subcategory = col(row, "subcategory", "sub category", "sub cat", "sub-category") || "";

    const gstPct = parseFloat(col(row, "gst %", "gst%", "gst", "tax %", "tax")) || 5;
    const isBestseller = col(row, "bestseller", "best seller", "featured").toLowerCase() === "yes";
    const isNewlyAdded = ["yes", "true", "1"].includes(col(row, "newly added", "newlyadded", "new_added", "new", "new arrival").toLowerCase());
    const description = col(row, "description", "desc", "product description");
    const variantObj = { id: "v" + i, label: name, size, weight, priceW, priceR, moq, stock, gstPct };

    if (variantType.toLowerCase() === "child" && currentParent) {
      currentParent.variants.push(variantObj);
    } else {
      const product = { id: "p" + i, name, category, subcategory, photo, photos, variants: [variantObj], gstPct, isBestseller, isNewlyAdded, description };
      grouped.push(product);
      currentParent = product;
    }
  });

  return grouped.filter((p) => p.variants.some((v) => v.priceW > 0));
}

// =============================================
// FILTER SETTINGS HOOK
// =============================================
function useFilterSettings() {
  const [settings, setSettings] = useState({
    show_price_filter: true,
    show_weight_filter: true,
    show_size_filter: true,
    show_sort: true,
    price_brackets: [
      { label: "Under ₹100", min: 0, max: 100 },
      { label: "₹100 – ₹200", min: 100, max: 200 },
      { label: "₹200 – ₹500", min: 200, max: 500 },
      { label: "Above ₹500", min: 500, max: 999999 },
    ],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase("filter_settings?id=eq.main&select=*")
      .then(rows => { if (rows && rows[0]) setSettings(prev => ({ ...prev, ...rows[0] })); })
      .catch(() => {});
  }, []);

  // Filter out any system footer from settings for standard UI usage
  const cleanSettings = useMemo(() => {
    return {
      ...settings,
      price_brackets: (settings.price_brackets || []).filter(b => !b.is_system_footer)
    };
  }, [settings]);

  const save = async (updated, isRaw = false) => {
    setSaving(true);
    try {
      let payload;
      if (isRaw) {
        payload = updated;
      } else {
        const currentSystemFooter = (settings.price_brackets || []).find(b => b.is_system_footer);
        const price_brackets = [
          ...(updated.price_brackets || []).filter(b => !b.is_system_footer)
        ];
        if (currentSystemFooter) {
          price_brackets.push(currentSystemFooter);
        }
        payload = {
          ...updated,
          price_brackets
        };
      }
      await supabase("filter_settings?id=eq.main", "PATCH", { ...payload, updated_at: new Date().toISOString() });
      setSettings(payload);
    } catch (e) { alert("Could not save filter settings: " + e.message); }
    finally { setSaving(false); }
  };

  return { settings: cleanSettings, rawSettings: settings, setSettings, save, saving };
}

function useSheetData() {
  const [items, setItems] = useState(() => parseSheet(SAMPLE_CSV));
  const [usingSample, setUsingSample] = useState(true);
  const [lastSynced, setLastSynced] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sync = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(DEFAULT_CSV_URL);
      if (!res.ok) throw new Error("Could not reach the sheet.");
      const text = await res.text();
      const parsed = parseSheet(text);
      if (parsed.length === 0) throw new Error("No priced items found.");
      setItems(parsed); setUsingSample(false); setLastSynced(new Date());
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { sync(); const t = setInterval(sync, SYNC_INTERVAL_MS); return () => clearInterval(t); }, [sync]);
  return { items, usingSample, lastSynced, loading, error, sync };
}

// =============================================
// UI COMPONENTS
// =============================================
function ThreadDivider() {
  return (
    <div style={{ height: "1.5px", background: `${COLORS.charcoalSoft}10`, margin: "24px 0", width: "100%" }} />
  );
}

function WeavingProgress({ stage }) {
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

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: COLORS.cream, border: `1px solid ${COLORS.charcoalSoft}22`, borderRadius: 10, padding: "16px 18px", flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 12, color: COLORS.charcoalSoft, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontFamily: "var(--serif)", color: accent || COLORS.indigo, fontWeight: 600 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: COLORS.charcoalSoft, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function SyncBar({ usingSample, lastSynced, loading, error, sync }) {
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
function PhoneInput({ icon: Icon, ...props }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.ivoryDeep, borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
      {Icon && <Icon size={15} color={COLORS.charcoalSoft} />}
      <input {...props} style={{ border: "none", outline: "none", background: "transparent", fontSize: 14, color: COLORS.charcoal, width: "100%", fontFamily: "var(--sans)" }} />
    </div>
  );
}

function SubmitBtn({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ width: "100%", background: disabled ? COLORS.charcoalSoft : COLORS.indigo, color: COLORS.cream, border: "none", padding: "11px", borderRadius: 8, fontSize: 13.5, cursor: disabled ? "default" : "pointer", fontFamily: "var(--sans)" }}>
      {children}
    </button>
  );
}

function AdminPinInput({ onVerify, error, setError }) {
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
function SkeletonCard() {
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

function SkeletonGrid() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
      {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

// ─────────────────────────────────────────────
// TOAST NOTIFICATION
// ─────────────────────────────────────────────
function Toast({ message, type = "success", onDone }) {
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

// =============================================
// QUICK LOGIN PANEL (slides from right — no approval needed)
// =============================================
function QuickLoginPanel({ onLogin, onClose }) {
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

function LoginScreen({ onLogin }) {
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
function AccountPanel({ account, orders, onClose, onAccountUpdated, setActivePage, onLogOut, contactInfo }) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form fields
  const [formName, setFormName] = useState(account.owner_name || "");
  const [formShopName, setFormShopName] = useState(account.shop_name || "");
  const [formGstNumber, setFormGstNumber] = useState(account.gst_number || "");
  const [formAddrLine1, setFormAddrLine1] = useState(() => parseDetailedAddress(account.detailed_address).line1 || "");
  const [formAddrLine2, setFormAddrLine2] = useState(() => parseDetailedAddress(account.detailed_address).line2 || "");
  const [formAddrLandmark, setFormAddrLandmark] = useState(() => parseDetailedAddress(account.detailed_address).landmark || "");
  const [formAddrPincode, setFormAddrPincode] = useState(() => parseDetailedAddress(account.detailed_address).pincode || "");
  const [formAddrCity, setFormAddrCity] = useState(() => parseDetailedAddress(account.detailed_address).city || "");
  const [formAddrState, setFormAddrState] = useState(() => parseDetailedAddress(account.detailed_address).state || "Rajasthan");
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

  const pct = account.credit_limit > 0 ? Math.round((account.credit_used / account.credit_limit) * 100) : 0;

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
      alert(`[Deetya Weaves Email Verification Code]\nYour verification code is: ${code}`);
      setEmailMessage(`Verification code sent. Use '${code}' (alert shown)`);
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

    const updatedFields = {
      shop_name: formShopName,
      owner_name: formName,
      phone: formPhone,
      email: formEmail,
      gst_number: formGstNumber,
      detailed_address: formattedAddr,
      email_verified: emailVerified,
      phone_verified: phoneVerified,
    };

    try {
      let updatedData;
      try {
        const rows = await supabase(`retailers?id=eq.${account.id}`, "PATCH", updatedFields);
        updatedData = rows && rows[0] ? rows[0] : { ...account, ...updatedFields };
      } catch (err) {
        console.warn("Falling back on standard database save", err);
        const fallbackFields = {
          shop_name: formShopName,
          owner_name: formName,
          phone: formPhone,
        };
        await supabase(`retailers?id=eq.${account.id}`, "PATCH", fallbackFields);
        updatedData = { ...account, ...updatedFields };
      }

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
                  <span style={{ fontSize: 13, color: COLORS.charcoal, background: COLORS.ivory, padding: 8, borderRadius: 6, lineHeight: 1.4 }}>{getHumanReadableAddress(account.detailed_address) || "No address provided yet. Please click 'Update Details' to add your address."}</span>
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
                    <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "8px 10px", background: COLORS.cream, borderRadius: 6, borderLeft: `3px solid ${o.payment_type === "credit" ? COLORS.turmeric : COLORS.sage}` }}>
                      <div>
                        <strong style={{ color: COLORS.charcoal }}>Order #{o.order_number}</strong>
                        <div style={{ fontSize: 10.5, color: COLORS.charcoalSoft }}>{new Date(o.created_at).toLocaleDateString("en-IN")} · {o.payment_type === "credit" ? "Credit Charge" : "Direct Settlement"}</div>
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
// DETAILED ADDRESS HELPERS
// =============================================
function getStateFromPincode(pincode) {
  const pin = pincode.trim().slice(0, 2);
  if (!pin) return "Rajasthan";
  const code = parseInt(pin, 10);
  if (code >= 30 && code <= 34) return "Rajasthan";
  if (code === 11) return "Delhi";
  if (code >= 12 && code <= 13) return "Haryana";
  if (code >= 14 && code <= 16) return "Punjab";
  if (code >= 20 && code <= 28) return "Uttar Pradesh";
  if (code >= 36 && code <= 39) return "Gujarat";
  if (code >= 40 && code <= 44) return "Maharashtra";
  if (code >= 45 && code <= 48) return "Madhya Pradesh";
  if (code >= 50 && code <= 53) return "Andhra Pradesh";
  if (code >= 56 && code <= 59) return "Karnataka";
  if (code >= 60 && code <= 64) return "Tamil Nadu";
  if (code >= 67 && code <= 69) return "Kerala";
  if (code >= 70 && code <= 74) return "West Bengal";
  if (code >= 80 && code <= 85) return "Bihar";
  return "Rajasthan";
}

function parseDetailedAddress(addressStr) {
  const defaultObj = { line1: "", line2: "", landmark: "", pincode: "", city: "", state: "Rajasthan" };
  if (!addressStr) return defaultObj;
  
  if (addressStr.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(addressStr);
      return {
        line1: parsed.line1 || "",
        line2: parsed.line2 || "",
        landmark: parsed.landmark || "",
        pincode: parsed.pincode || "",
        city: parsed.city || "",
        state: parsed.state || "Rajasthan"
      };
    } catch (e) {}
  }
  
  if (addressStr.includes("Line 1:")) {
    const parts = addressStr.split(" | ");
    const obj = { ...defaultObj };
    parts.forEach(part => {
      const partsOfPart = part.split(": ");
      const key = partsOfPart[0];
      const val = partsOfPart.slice(1).join(": ").trim();
      if (key === "Line 1") obj.line1 = val;
      else if (key === "Line 2") obj.line2 = val;
      else if (key === "Landmark") obj.landmark = val;
      else if (key === "City") obj.city = val;
      else if (key === "State") obj.state = val;
      else if (key === "Pincode") obj.pincode = val;
    });
    return obj;
  }
  
  // Try to extract pincode if present (6 digits)
  const pinMatch = addressStr.match(/\b\d{6}\b/);
  const pin = pinMatch ? pinMatch[0] : "";
  
  return { ...defaultObj, line1: addressStr, pincode: pin, state: pin ? getStateFromPincode(pin) : "Rajasthan" };
}

function formatDetailedAddress(obj) {
  return `Line 1: ${obj.line1} | Line 2: ${obj.line2 || ""} | Landmark: ${obj.landmark || ""} | City: ${obj.city} | State: ${obj.state} | Pincode: ${obj.pincode}`;
}

function getHumanReadableAddress(addressStr) {
  if (!addressStr) return "";
  const parsed = parseDetailedAddress(addressStr);
  if (!parsed.line1) return addressStr;
  const parts = [
    parsed.line1,
    parsed.line2,
    parsed.landmark,
    parsed.city,
    parsed.state ? `${parsed.state} - ${parsed.pincode}` : parsed.pincode
  ].filter(p => p && p.trim().length > 0);
  return parts.join(", ");
}

// =============================================
// GST & DISTANCE HELPERS (price is exclusive of GST)
// =============================================
function calcGST(exclusivePrice, gstPct) {
  const base = exclusivePrice;
  const gst = exclusivePrice * (gstPct / 100);
  return { base: Math.round(base * 100) / 100, gst: Math.round(gst * 100) / 100, total: Math.round((base + gst) * 100) / 100 };
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return 8.5;
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c * 100) / 100; // distance in km
}

// =============================================
// PRODUCT DETAIL SIDE PANEL
// =============================================
function ProductPanel({ product, variant, onClose, onAddToCart, cart, account, onShowLogin }) {
  const [scale, setScale] = useState(1);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [selVariantId, setSelVariantId] = useState(variant?.id || product?.variants[0]?.id);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  const lastTouchTimeRef = useRef(0);
  const touchStartDistRef = useRef(null);
  const startScaleRef = useRef(1);
  const panStartRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);

  useEffect(() => {
    setActivePhotoIdx(0);
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    setZoomOrigin({ x: 50, y: 50 });
  }, [product?.id]);

  const selVariant = product?.variants.find(v => v.id === selVariantId) || product?.variants[0];
  const cartKey = product?.id + "__" + selVariantId;
  const qty = cart[cartKey] || 0;
  const { base, gst, total } = calcGST(selVariant?.priceW || 0, product?.gstPct || 5);

  const photos = product?.photos || (product?.photo ? [product.photo] : []);
  const activePhoto = photos[activePhotoIdx] || product?.photo;

  const handleMouseMove = (e) => {
    if (scale > 1) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setZoomOrigin({ x, y });
    }
  };

  const handleDoubleClick = (e) => {
    e.preventDefault();
    if (scale > 1) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top) / rect.height) * 100;
      setZoomOrigin({ x: xPct, y: yPct });
      setScale(2.5);
    }
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      touchStartDistRef.current = dist;
      startScaleRef.current = scale;

      const midX = (touch1.clientX + touch2.clientX) / 2;
      const midY = (touch1.clientY + touch2.clientY) / 2;
      const rect = e.currentTarget.getBoundingClientRect();
      const xPct = ((midX - rect.left) / rect.width) * 100;
      const yPct = ((midY - rect.top) / rect.height) * 100;
      setZoomOrigin({ x: xPct, y: yPct });
    } else if (e.touches.length === 1) {
      const now = Date.now();
      const DELTA_DOUBLE_TAP = 300;
      if (now - lastTouchTimeRef.current < DELTA_DOUBLE_TAP) {
        e.preventDefault();
        if (scale > 1) {
          setScale(1);
          setTranslate({ x: 0, y: 0 });
        } else {
          const touch = e.touches[0];
          const rect = e.currentTarget.getBoundingClientRect();
          const xPct = ((touch.clientX - rect.left) / rect.width) * 100;
          const yPct = ((touch.clientY - rect.top) / rect.height) * 100;
          setZoomOrigin({ x: xPct, y: yPct });
          setScale(2.5);
        }
      }
      lastTouchTimeRef.current = now;

      if (scale > 1) {
        panStartRef.current = {
          x: e.touches[0].clientX - translate.x,
          y: e.touches[0].clientY - translate.y,
        };
        isPanningRef.current = true;
      }
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && touchStartDistRef.current) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      const factor = dist / touchStartDistRef.current;
      const newScale = Math.min(Math.max(startScaleRef.current * factor, 1), 4);
      setScale(newScale);
      if (newScale === 1) {
        setTranslate({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && isPanningRef.current && scale > 1) {
      e.preventDefault();
      const touch = e.touches[0];
      const tx = touch.clientX - panStartRef.current.x;
      const ty = touch.clientY - panStartRef.current.y;
      setTranslate({ x: tx, y: ty });
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) {
      touchStartDistRef.current = null;
    }
    if (e.touches.length === 0) {
      isPanningRef.current = false;
    }
  };

  // Auto-generate description from specs
  const descParts = [
    product?.category && `Category: ${product.category}`,
    selVariant?.size && `Dimensions: ${selVariant.size} cm`,
    selVariant?.weight && `Weight: ${selVariant.weight} g`,
    `MOQ: ${selVariant?.moq} pieces`,
    product?.gstPct && `GST: ${product.gstPct}% (included in price)`,
    product?.variants.length > 1 && `Available in ${product.variants.length} variants`,
  ].filter(Boolean);

  if (!product) return null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(42,36,29,0.45)", zIndex:100, backdropFilter:"blur(2px)" }}/>

      {/* Panel */}
      <div style={{
        position:"fixed", top:0, right:0, bottom:0, width:"min(520px, 100vw)",
        background: "#FBF8F2", zIndex:101, overflowY:"auto",
        boxShadow:"-8px 0 40px rgba(0,0,0,0.18)",
        animation:"slideIn 0.28s cubic-bezier(0.32,0,0.16,1)",
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"18px 22px", borderBottom:`1px solid ${COLORS.charcoalSoft}18` }}>
          <div style={{ fontSize:11.5, color: COLORS.charcoalSoft, textTransform:"uppercase", letterSpacing:0.8 }}>{product.category}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color: COLORS.charcoalSoft, lineHeight:1, padding:"0 4px" }}>×</button>
        </div>

        {/* Image with zoom */}
        <div
          onDoubleClick={handleDoubleClick}
          onMouseMove={handleMouseMove}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ width:"100%", aspectRatio:"4/3", overflow:"hidden", background: COLORS.ivoryDeep, position:"relative", cursor: scale > 1 ? "zoom-out" : "zoom-in", touchAction: "none" }}
        >
          {activePhoto ? (
            <img
              src={activePhoto}
              alt={product.name}
              style={{
                width:"100%", height:"100%", objectFit:"cover",
                transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
                transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                transition: isPanningRef.current ? "none" : "transform 0.15s ease-out, transform-origin 0.15s ease-out",
              }}
              onError={e => { e.target.style.display = "none"; }}
            />
          ) : (
            <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:8 }}>
              <ImageIcon size={40} color={COLORS.charcoalSoft+"66"}/>
              <div style={{ fontSize:12, color: COLORS.charcoalSoft+"88" }}>No image yet</div>
            </div>
          )}
          {product.isBestseller && (
            <div style={{ position:"absolute", top:12, left:12, background: COLORS.turmeric, color: COLORS.cream, fontSize:11, fontFamily:"var(--sans)", padding:"4px 10px", borderRadius:20 }}>
              ⭐ Bestseller
            </div>
          )}
          {activePhoto && (
            <div style={{ position:"absolute", bottom:10, right:12, background:"rgba(42,36,29,0.55)", color:"#fff", fontSize:11, padding:"3px 9px", borderRadius:12, fontFamily:"var(--sans)" }}>
              {scale > 1 ? "Double click/tap or Pinch to Zoom Out" : "Double click/tap or Pinch to Zoom"}
            </div>
          )}
        </div>

        {/* Thumbnail switcher (only if multiple photos exist) */}
        {photos.length > 1 && (
          <div style={{ display:"flex", gap:8, padding:"12px 22px 4px", background: COLORS.cream }}>
            {photos.map((p, idx) => {
              const isSelected = activePhotoIdx === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setActivePhotoIdx(idx)}
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 6,
                    overflow: "hidden",
                    border: isSelected ? `2.5px solid ${COLORS.indigo}` : `1px solid ${COLORS.charcoalSoft}33`,
                    cursor: "pointer",
                    padding: 0,
                    background: COLORS.cream,
                    transition: "border 0.2s ease, transform 0.1s ease",
                    transform: isSelected ? "scale(1.05)" : "scale(1)",
                  }}
                >
                  <img
                    src={p}
                    alt={`Thumbnail ${idx + 1}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={e => { e.target.style.display = "none"; }}
                  />
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div style={{ padding:"22px 22px 32px" }}>
          <h2 style={{ fontFamily:"var(--serif)", fontSize:22, color: COLORS.indigo, margin:"0 0 6px" }}>{product.name}</h2>

          {/* Variants */}
          {product.variants.length > 1 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, color: COLORS.charcoalSoft, marginBottom:8 }}>Select variant</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {product.variants.map(v => (
                  <button key={v.id} onClick={() => setSelVariantId(v.id)} disabled={v.stock === 0}
                    style={{
                      border:`1.5px solid ${selVariantId===v.id ? COLORS.indigo : COLORS.charcoalSoft+"44"}`,
                      background: selVariantId===v.id ? COLORS.indigo : "transparent",
                      color: v.stock===0 ? COLORS.charcoalSoft+"66" : selVariantId===v.id ? COLORS.cream : COLORS.charcoal,
                      borderRadius:8, padding:"7px 14px", fontSize:13, cursor: v.stock===0 ? "not-allowed" : "pointer",
                      textDecoration: v.stock===0 ? "line-through" : "none", fontFamily:"var(--sans)",
                    }}>{v.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Specs grid */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
            {[
              ["Size", selVariant?.size ? selVariant.size + " cm" : "—"],
              ["Weight", selVariant?.weight ? selVariant.weight + " g" : "—"],
              ["MOQ", selVariant?.moq + " pcs"],
              ["Availability", selVariant?.stock === null ? "In stock" : selVariant?.stock === 0 ? "Out of stock" : selVariant?.stock < 15 ? `Low stock (${selVariant.stock})` : `${selVariant.stock} in stock`],
            ].map(([label, val]) => (
              <div key={label} style={{ background: COLORS.ivoryDeep, borderRadius:8, padding:"10px 13px" }}>
                <div style={{ fontSize:11, color: COLORS.charcoalSoft, marginBottom:3 }}>{label}</div>
                <div style={{ fontSize:13.5, color: COLORS.charcoal, fontFamily:"var(--sans)" }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12.5, color: COLORS.charcoalSoft, marginBottom:8, fontWeight:500 }}>Product details</div>
            {descParts.map((d, i) => (
              <div key={i} style={{ fontSize:13.5, color: COLORS.charcoal, marginBottom:5, display:"flex", alignItems:"center", gap:8, fontFamily:"var(--sans)" }}>
                <span style={{ color: COLORS.madder, fontSize:10 }}>◆</span> {d}
              </div>
            ))}
          </div>

          {/* Pricing breakdown */}
          {account ? (
            <div style={{ background: COLORS.cream, border:`1px solid ${COLORS.charcoalSoft}22`, borderRadius:10, padding:"14px 16px", marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color: COLORS.charcoalSoft, marginBottom:6 }}>
                <span>Base price (excl. GST)</span>
                <span>₹{base.toLocaleString("en-IN")}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color: COLORS.charcoalSoft, marginBottom:8 }}>
                <span>GST ({product.gstPct || 5}%)</span>
                <span>₹{gst.toLocaleString("en-IN")}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontFamily:"var(--sans)", fontSize:17, color: COLORS.madder, borderTop:`1px solid ${COLORS.charcoalSoft}22`, paddingTop:8, fontWeight: 700 }}>
                <span>Price (incl. GST)</span>
                <span>₹{total.toLocaleString("en-IN")}</span>
              </div>
              <div style={{ fontSize:11, color: COLORS.charcoalSoft, marginTop:4 }}>Wholesale price per piece · MOQ {selVariant?.moq} pcs</div>
            </div>
          ) : (
            <div style={{ background: COLORS.cream, border:`1px solid ${COLORS.charcoalSoft}22`, borderRadius:12, padding:"20px 18px", marginBottom:20, textAlign: "center" }}>
              <div style={{ fontSize:14, color: COLORS.indigo, fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <span>🔒 Wholesale Price Locked</span>
              </div>
              <div style={{ fontSize:12, color: COLORS.charcoalSoft, marginBottom: 14, lineHeight: 1.6 }}>
                Register your shop details to unlock verified wholesale pricing, variants, and to place orders.
              </div>
              <button onClick={onShowLogin} style={{ background: COLORS.indigo, color: COLORS.cream, border: "none", padding: "8px 18px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "var(--sans)", fontWeight: 500 }}>
                Unlock Prices / Login
              </button>
            </div>
          )}

          {/* Add to cart / Login action */}
          {!account ? (
            <button onClick={onShowLogin} style={{ width:"100%", background: COLORS.indigo, color: COLORS.cream, border:"none", padding:"12px", borderRadius:8, fontSize:14, cursor:"pointer", fontFamily:"var(--sans)", fontWeight: 500, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              💬 Ask Price & Register Shop
            </button>
          ) : selVariant?.stock !== 0 ? (
            <div style={{ display:"flex", gap:12, alignItems:"center" }}>
              <div style={{ display:"flex", alignItems:"center", gap:0, background: COLORS.ivoryDeep, borderRadius:8, overflow:"hidden", border:`1px solid ${COLORS.charcoalSoft}22` }}>
                <button onClick={() => onAddToCart(product, selVariant, -1)} disabled={qty===0}
                  style={{ border:"none", background:"transparent", width:40, height:44, cursor: qty===0?"default":"pointer", color: qty===0?COLORS.charcoalSoft+"55":COLORS.indigo, fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
                <span style={{ minWidth:40, textAlign:"center", fontSize:14, color: COLORS.charcoal, fontFamily:"var(--sans)" }}>{qty}</span>
                <button onClick={() => onAddToCart(product, selVariant, 1)}
                  style={{ border:"none", background:"transparent", width:40, height:44, cursor:"pointer", color: COLORS.indigo, fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
              </div>
              <div style={{ flex:1, background: COLORS.indigo, color: COLORS.cream, borderRadius:8, height:44, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontFamily:"var(--sans)", cursor:"pointer" }}
                onClick={() => { onAddToCart(product, selVariant, qty === 0 ? 1 : 0); }}>
                {qty > 0 ? `${qty} in cart — update` : `Add to cart (min ${selVariant?.moq})`}
              </div>
            </div>
          ) : (
            <div style={{ background: COLORS.ivoryDeep, borderRadius:8, padding:"12px 16px", textAlign:"center", fontSize:13, color: COLORS.charcoalSoft }}>
              Out of stock — check back soon
            </div>
          )}
        </div>
      </div>
    </>
  );
}


// =============================================
// RETAILER CATALOG VIEW
// =============================================
function RetailerView({
  sheetData,
  account,
  onOrderPlaced,
  filterSettings,
  onShowLogin,
  onAccountUpdated,
  dispatchLocation,
  cart: propsCart,
  setCart: propsSetCart,
  viewingCart: propsViewingCart,
  setViewingCart: propsSetViewingCart,
  contactInfo,
  myOrders,
  search: propsSearch,
  setSearch: propsSetSearch,
  showToast,
}) {
  const { items, loading: sheetLoading, usingSample } = sheetData;
  const [localCart, setLocalCart] = useState({});
  const cart = propsCart !== undefined ? propsCart : localCart;
  const setCart = propsSetCart !== undefined ? propsSetCart : setLocalCart;

  const [selectedVariant, setSelectedVariant] = useState({});
  const [localSearch, setLocalSearch] = useState("");
  const search = propsSearch !== undefined ? propsSearch : localSearch;
  const setSearch = propsSetSearch !== undefined ? propsSetSearch : setLocalSearch;
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [category, setCategory] = useState("All");
  const [sortBy, setSortBy] = useState("price_asc"); // default | price_asc | price_desc | name_asc | weight_asc
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Mobile back button: push history when panel opens, intercept popstate to close
  useEffect(() => {
    if (selectedProduct) {
      window.history.pushState({ panel: "product" }, "");
      const onPop = () => setSelectedProduct(null);
      window.addEventListener("popstate", onPop);
      return () => window.removeEventListener("popstate", onPop);
    }
  }, [selectedProduct]);
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const [expandedMobileCategories, setExpandedMobileCategories] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [priceBracket, setPriceBracket] = useState(null);
  const [weightFilter, setWeightFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [placed, setPlaced] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [paymentType, setPaymentType] = useState("upfront");
  
  const [localViewingCart, setLocalViewingCart] = useState(false);
  const viewingCart = propsViewingCart !== undefined ? propsViewingCart : localViewingCart;
  const setViewingCart = propsSetViewingCart !== undefined ? propsSetViewingCart : setLocalViewingCart;
  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState(null); // {valid, discount, message}
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [error, setError] = useState("");

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [category, subcategoryFilter, search, priceBracket, priceMin, priceMax, weightFilter, sizeFilter, inStockOnly, sortBy]);

  // Category hierarchy for single heading dropdown
  const categoryHierarchy = useMemo(() => {
    const map = {};
    items.forEach(p => {
      if (!p.category) return;
      if (!map[p.category]) {
        map[p.category] = new Set();
      }
      if (p.subcategory) {
        map[p.category].add(p.subcategory);
      }
    });
    return Object.keys(map).map(cat => ({
      name: cat,
      subcategories: Array.from(map[cat])
    }));
  }, [items]);

  const mainCategories = useMemo(() => ["All", ...new Set(items.map(p => p.category))], [items]);
  const subcategories = useMemo(() =>
    category === "All" ? [] : [...new Set(items.filter(p => p.category === category && p.subcategory).map(p => p.subcategory))],
    [items, category]
  );

  // Price range across all variants of a product
  const productMinPrice = (p) => {
    const prices = p.variants.map(v => v.priceW).filter(Boolean);
    return prices.length ? Math.min(...prices) : 0;
  };

  const filtered = useMemo(() => {
    let result = items.filter(p => {
      if (category !== "All" && p.category !== category) return false;
      if (subcategoryFilter && p.subcategory !== subcategoryFilter) return false;
      if (debouncedSearch && !p.name.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
      const minP = productMinPrice(p);
      if (priceBracket && (minP < priceBracket.min || minP > priceBracket.max)) return false;
      if (!priceBracket && priceMin && minP < parseFloat(priceMin)) return false;
      if (!priceBracket && priceMax && minP > parseFloat(priceMax)) return false;
      if (weightFilter && !p.variants.some(v => v.weight === weightFilter)) return false;
      if (sizeFilter && !p.variants.some(v => v.size === sizeFilter)) return false;
      if (inStockOnly && p.variants.every(v => v.stock === 0)) return false;
      return true;
    });
    if (sortBy === "default" || sortBy === "price_asc") result = [...result].sort((a, b) => productMinPrice(a) - productMinPrice(b));
    else if (sortBy === "price_desc") result = [...result].sort((a, b) => productMinPrice(b) - productMinPrice(a));
    else if (sortBy === "name_asc") result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "weight_asc") result = [...result].sort((a, b) => (parseFloat(a.variants[0]?.weight) || 0) - (parseFloat(b.variants[0]?.weight) || 0));
    else if (sortBy === "weight_desc") result = [...result].sort((a, b) => (parseFloat(b.variants[0]?.weight) || 0) - (parseFloat(a.variants[0]?.weight) || 0));
    return result;
  }, [items, category, subcategoryFilter, search, debouncedSearch, priceBracket, priceMin, priceMax, weightFilter, sizeFilter, inStockOnly, sortBy]);

  const ITEMS_PER_PAGE = 24;
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedFiltered = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const activeFilterCount = [
    category !== "All", subcategoryFilter, priceBracket, priceMin, priceMax, weightFilter, sizeFilter, inStockOnly, (sortBy !== "default" && sortBy !== "price_asc")
  ].filter(Boolean).length;

  const clearFilters = () => { setCategory("All"); setSubcategoryFilter(""); setPriceBracket(null); setPriceMin(""); setPriceMax(""); setWeightFilter(""); setSizeFilter(""); setInStockOnly(false); setSortBy("price_asc"); };

  const setQty = (product, variant, delta, addOnce = false) => {
    const key = product.id + "__" + variant.id;
    setCart(prev => {
      const current = prev[key] || 0;
      if (addOnce && current > 0) return prev; // already in cart
      const next = Math.max(0, current === 0 && delta > 0 ? variant.moq : current + delta * variant.moq);
      return { ...prev, [key]: next };
    });
  };

  const [retailerLocation, setRetailerLocation] = useState(() => {
    try {
      const saved = localStorage.getItem("deetya_retailer_location");
      return saved ? JSON.parse(saved) : { lat: null, lng: null, detected: false, distanceKm: 0, isManual: true };
    } catch {
      return { lat: null, lng: null, detected: false, distanceKm: 0, isManual: true };
    }
  });

  const handleUpdateRetailerLocation = (newLoc) => {
    setRetailerLocation(newLoc);
    try {
      localStorage.setItem("deetya_retailer_location", JSON.stringify(newLoc));
    } catch {}
  };

  const cartEntries = Object.entries(cart).filter(([, qty]) => qty > 0);
  const subtotal = cartEntries.reduce((sum, [key, qty]) => {
    const [productId, variantId] = key.split("__");
    const product = items.find(p => p.id === productId);
    const variant = product?.variants.find(v => v.id === variantId);
    return sum + (variant ? variant.priceW * qty : 0);
  }, 0);

  const discountAmount = couponResult?.valid ? couponResult.discount : 0;
  
  // GST calculation (priceW is exclusive of GST)
  const gstAmountBeforeDiscount = cartEntries.reduce((sum, [key, qty]) => {
    const [productId, variantId] = key.split("__");
    const product = items.find(p => p.id === productId);
    const variant = product?.variants.find(v => v.id === variantId);
    if (!variant) return sum;
    const gstPct = variant.gstPct || product?.gstPct || 5;
    return sum + (variant.priceW * qty * (gstPct / 100));
  }, 0);

  const effectiveGstRatio = subtotal > 0 ? (gstAmountBeforeDiscount / subtotal) : 0.05;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const gstAmount = Math.round(taxableAmount * effectiveGstRatio * 100) / 100;

  // Delivery Fee calculation based on radius from active dispatch location
  const activeDistance = retailerLocation.isManual
    ? retailerLocation.distanceKm
    : (retailerLocation.lat && retailerLocation.lng && dispatchLocation.lat && dispatchLocation.lng
       ? calculateDistance(dispatchLocation.lat, dispatchLocation.lng, retailerLocation.lat, retailerLocation.lng)
       : 8.5);

  const deliveryFee = activeDistance > 7 ? 30 : 0;
  const cartTotal = taxableAmount + gstAmount + deliveryFee;

  const applyCoupon = async (customCode) => {
    const codeToApply = (typeof customCode === "string" ? customCode : couponCode).trim().toUpperCase();
    if (!codeToApply) return;
    setApplyingCoupon(true); setCouponResult(null);
    try {
      const codes = await supabase(`discount_codes?code=eq.${codeToApply}&is_active=eq.true&select=*`);
      if (!codes || codes.length === 0) { setCouponResult({ valid: false, message: "Invalid or expired code." }); return; }
      const c = codes[0];
      if (c.valid_until && new Date(c.valid_until) < new Date()) { setCouponResult({ valid: false, message: "This code has expired." }); return; }
      if (c.max_uses !== null && c.times_used >= c.max_uses) { setCouponResult({ valid: false, message: "This code has reached its usage limit." }); return; }
      if (subtotal < c.min_order_value) { setCouponResult({ valid: false, message: `Minimum order of ₹${c.min_order_value} required.` }); return; }
      const disc = c.discount_type === "percentage" ? Math.round(subtotal * c.discount_value / 100 * 100) / 100 : c.discount_value;
      setCouponResult({ valid: true, discount: disc, code: c.code, message: `${c.discount_type === "percentage" ? c.discount_value + "%" : "₹" + c.discount_value} off applied!`, id: c.id });
    } catch (e) { setCouponResult({ valid: false, message: "Could not validate code." }); }
    finally { setApplyingCoupon(false); }
  };

  const buildLineItems = () => cartEntries.map(([key, qty]) => {
    const [productId, variantId] = key.split("__");
    const product = items.find(p => p.id === productId);
    const variant = product?.variants.find(v => v.id === variantId);
    return { item_name: variant?.label || product?.name, category: product?.category, price_w: variant?.priceW, quantity: qty, subtotal: (variant?.priceW || 0) * qty };
  });

  const placeOrder = async () => {
        // Credit limit check
    if (paymentType === "credit" && account?.credit_limit > 0) {
      const remaining = account.credit_limit - (account.credit_used || 0);
      if (cartTotal > remaining) {
        setOrderError(`Credit limit exceeded. Available: ₹${remaining.toLocaleString("en-IN")}`);
        return;
      }
    }
    setPlacing(true); setError("");
    try {
      const lineItems = buildLineItems();
      const deliveryNotes = `Shipping distance: ${activeDistance.toFixed(1)} km from ${dispatchLocation.address}. Shipping charge applied: ₹${deliveryFee}.`;
      const orderRows = await supabase("orders", "POST", {
        retailer_id: account?.id, retailer_phone: account?.phone, retailer_name: account?.shop_name,
        subtotal, discount_amount: discountAmount, gst_rate: Math.round(effectiveGstRatio * 100), gst_amount: gstAmount,
        total: cartTotal, payment_type: paymentType, stage: "Pending",
        coupon_code: couponResult?.valid ? couponResult.code : null,
        notes: deliveryNotes,
      });
      const order = orderRows[0];
      const dbItems = lineItems.map(li => ({ ...li, order_id: order.id }));
      await supabase("order_items", "POST", dbItems);
      if (couponResult?.valid) {
        await supabase(`discount_codes?id=eq.${couponResult.id}`, "PATCH", { times_used: (await supabase(`discount_codes?id=eq.${couponResult.id}&select=times_used`))[0].times_used + 1 });
      }
      setPlaced({ order, lineItems, subtotal, discountAmount, gstAmount, total: cartTotal, coupon: couponResult?.valid ? couponResult.code : null, deliveryFee, notes: deliveryNotes });
      setCart({}); setCouponCode(""); setCouponResult(null);
      if (onOrderPlaced) onOrderPlaced();
    } catch (e) { setError("Could not place order: " + e.message); }
    finally { setPlacing(false); }
  };

// =============================================
// CartPage is now imported from "./components/CartPage.jsx"
// =============================================
  if (viewingCart) {
    return (
      <CartPage
        cart={cart}
        items={items}
        account={account}
        onBack={() => setViewingCart(false)}
        subtotal={subtotal}
        discountAmount={discountAmount}
        couponCode={couponCode}
        setCouponCode={setCouponCode}
        couponResult={couponResult}
        setCouponResult={setCouponResult}
        applyingCoupon={applyingCoupon}
        applyCoupon={applyCoupon}
        gstAmount={gstAmount}
        cartTotal={cartTotal}
        paymentType={paymentType}
        setPaymentType={setPaymentType}
        placeOrder={async () => {
          await placeOrder();
          setViewingCart(false);
        }}
        placing={placing}
        error={error}
        setQty={setQty}
        onAccountUpdated={onAccountUpdated}
        onShowLogin={onShowLogin}
        dispatchLocation={dispatchLocation}
        retailerLocation={retailerLocation}
        setRetailerLocation={handleUpdateRetailerLocation}
        deliveryFee={deliveryFee}
        activeDistance={activeDistance}
        myOrders={myOrders}
        supabase={supabase}
      />
    );
  }

  // ---- INVOICE SCREEN ----
  if (placed) {
    const { order, lineItems, subtotal: sub, discountAmount: disc, gstAmount: gst, total, coupon } = placed;
    return (
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
          <CheckCircle2 size={22} color={COLORS.sage}/>
          <h2 style={{ fontFamily:"var(--serif)", fontSize:21, color: COLORS.indigo, margin:0 }}>Order placed — #{order.order_number}</h2>
        </div>
        <p style={{ color: COLORS.charcoalSoft, fontSize:13.5, marginTop:4 }}>
          Awaiting seller confirmation · {paymentType === "credit" ? "On credit" : "Paid upfront"} · Prices excluding GST (Tax & Shipping Applied)
        </p>
        <ThreadDivider />

        {/* INVOICE */}
        <div style={{ background: COLORS.cream, border:`1px solid ${COLORS.charcoalSoft}22`, borderRadius:12, padding:"22px 24px", maxWidth:560 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
            <div>
              <div style={{ fontFamily:"var(--serif)", fontSize:18, color: COLORS.indigo }}>Tax Invoice</div>
              <div style={{ fontSize:12, color: COLORS.charcoalSoft, marginTop:2 }}>Guru Kripa Traders · Deetya Weaves</div>
            </div>
            <div style={{ textAlign:"right", fontSize:12, color: COLORS.charcoalSoft }}>
              <div>Order #{order.order_number}</div>
              <div>{new Date().toLocaleDateString("en-IN")}</div>
            </div>
          </div>

          <div style={{ fontSize:12.5, color: COLORS.charcoalSoft, marginBottom:8 }}>Bill to: <strong style={{ color: COLORS.charcoal }}>{account?.shop_name}</strong> · +91 {account?.phone}</div>

          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12.5, marginTop:12 }}>
            <thead>
              <tr style={{ borderBottom:`2px solid ${COLORS.charcoalSoft}22`, textAlign:"left" }}>
                <th style={{ padding:"6px 0", color: COLORS.charcoalSoft, fontWeight:500 }}>Item</th>
                <th style={{ padding:"6px 8px", color: COLORS.charcoalSoft, fontWeight:500, textAlign:"center" }}>Qty</th>
                <th style={{ padding:"6px 0", color: COLORS.charcoalSoft, fontWeight:500, textAlign:"right" }}>Rate</th>
                <th style={{ padding:"6px 0 6px 8px", color: COLORS.charcoalSoft, fontWeight:500, textAlign:"right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li, i) => (
                <tr key={i} style={{ borderBottom:`1px solid ${COLORS.charcoalSoft}11` }}>
                  <td style={{ padding:"7px 0", color: COLORS.charcoal }}>{li.item_name}</td>
                  <td style={{ padding:"7px 8px", color: COLORS.charcoalSoft, textAlign:"center" }}>{li.quantity}</td>
                  <td style={{ padding:"7px 0", color: COLORS.charcoal, textAlign:"right" }}>₹{li.price_w}</td>
                  <td style={{ padding:"7px 0 7px 8px", color: COLORS.charcoal, textAlign:"right" }}>₹{li.subtotal.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop:14, borderTop:`1px solid ${COLORS.charcoalSoft}22`, paddingTop:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color: COLORS.charcoalSoft, marginBottom:6 }}>
              <span>Subtotal</span><span>₹{sub.toLocaleString("en-IN")}</span>
            </div>
            {disc > 0 && (
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color: COLORS.sage, marginBottom:6 }}>
                <span>Discount {coupon ? `(${coupon})` : ""}</span><span>− ₹{disc.toLocaleString("en-IN")}</span>
              </div>
            )}
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color: COLORS.charcoalSoft, marginBottom:6 }}>
              <span>GST</span><span>+ ₹{gst.toLocaleString("en-IN")}</span>
            </div>
            {deliveryFee > 0 && (
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color: COLORS.charcoalSoft, marginBottom:6 }}>
                <span>Standard Delivery Fee</span><span>+ ₹{deliveryFee.toLocaleString("en-IN")}</span>
              </div>
            )}
            <div style={{ display:"flex", justifyContent:"space-between", fontFamily:"var(--sans)", fontSize:16, color: COLORS.charcoal, borderTop:`2px solid ${COLORS.charcoalSoft}22`, paddingTop:10, fontWeight: 700 }}>
              <span>Total</span><span>₹{total.toLocaleString("en-IN")}</span>
            </div>
          </div>

          <div style={{ marginTop:14, fontSize:11.5, color: COLORS.charcoalSoft, lineHeight:1.6 }}>
            Guru Kripa Traders, Kota, Rajasthan · This is a computer-generated invoice.
          </div>
        </div>

        <div style={{ marginTop:18, background: COLORS.cream, border:`1px solid ${COLORS.charcoalSoft}22`, borderRadius:12, padding:"18px 22px", maxWidth:560 }}>
          <div style={{ fontSize:13, color: COLORS.charcoalSoft, marginBottom:14 }}>Order status</div>
          <WeavingProgress stage="Pending" />
          <div style={{ marginTop:14, fontSize:13, color: COLORS.turmeric, display:"flex", alignItems:"center", gap:6 }}>
            <Clock size={14}/> Waiting for seller to confirm your order.
          </div>
        </div>

        {/* WhatsApp updates block */}
        <div style={{ marginTop:18, background: "#E8F5E9", border:`1px solid #A5D6A7`, borderRadius:12, padding:"18px 22px", maxWidth:560, fontFamily: "var(--sans)" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "start" }}>
            <div style={{ fontSize: 22 }}>💬</div>
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: "#1B5E20", margin: 0 }}>Get Real-time WhatsApp Updates</h4>
              <p style={{ fontSize: 12, color: "#2E7D32", marginTop: 4, marginBottom: 12, lineHeight: 1.4 }}>
                Connect your WhatsApp to receive direct dispatch tracking details, progress logs, and settlement notifications from our team.
              </p>
              
              {contactInfo && contactInfo.whatsapp ? (
                <a
                  href={`https://wa.me/${contactInfo.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
                    `Hello! I just placed wholesale order *#${order.order_number}* on Deetya Weaves for *₹${total.toLocaleString("en-IN")}*. Please send me updates and tracking details here.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#128C7E",
                    color: "#FFF",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 16px",
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: "none",
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    transition: "opacity 0.2s"
                  }}
                  className="hover:opacity-90"
                >
                  Receive Tracking Updates on WhatsApp
                </a>
              ) : (
                <span style={{ fontSize: 11.5, color: "#C62828" }}>WhatsApp updates are currently unavailable (seller has not configured their WhatsApp number).</span>
              )}
            </div>
          </div>
        </div>

        <button onClick={() => setPlaced(null)} style={{ marginTop:18, background:"transparent", border:`1px solid ${COLORS.indigo}`, color: COLORS.indigo, padding:"9px 18px", borderRadius:8, fontSize:13.5, cursor:"pointer" }}>
          Back to catalog
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Desktop Horizontal Category Navigation & Filters at same horizontal level */}
      <div className="hide-mobile" style={{ marginTop: 12, marginBottom: 18 }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          borderBottom: `1.5px solid ${COLORS.charcoalSoft}12`,
          paddingBottom: "2px",
          marginBottom: "16px",
          gap: "12px",
          flexWrap: "wrap"
        }}>
          {/* Categories Tab Strip */}
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            {mainCategories.map((c, idx) => {
              const isActive = category === c;
              // Get subcategories of this category to see if it has any
              const catSubcategories = c === "All" ? [] : [...new Set(items.filter(p => p.category === c && p.subcategory).map(p => p.subcategory))];
              const hasSubs = catSubcategories.length > 0;
              const isDropdownOpen = categoryDropdownOpen && category === c;
              
              // Text to display on the tab button
              const displayText = c === "All" 
                ? "All Products" 
                : (isActive && subcategoryFilter) 
                  ? `${c}: ${subcategoryFilter}` 
                  : c;

              return (
                <React.Fragment key={c}>
                  {idx > 0 && (
                    <div style={{ width: "1px", height: "14px", background: `${COLORS.charcoalSoft}33`, margin: "0 4px" }} />
                  )}
                  
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <button
                      onClick={() => {
                        if (!hasSubs) {
                          setCategory(c);
                          setSubcategoryFilter("");
                          setCategoryDropdownOpen(false);
                        } else {
                          if (category !== c) {
                            setCategory(c);
                            setSubcategoryFilter("");
                            setCategoryDropdownOpen(true);
                          } else {
                            setCategoryDropdownOpen(!categoryDropdownOpen);
                          }
                        }
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        padding: "8px 14px 10px 14px",
                        fontSize: "14px",
                        fontFamily: "var(--sans)",
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? COLORS.indigo : COLORS.charcoalSoft,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        position: "relative",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <span>{displayText}</span>
                      {hasSubs && (
                        <ChevronDown
                          size={13}
                          style={{
                            transform: isDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.15s ease",
                            color: isActive ? COLORS.indigo : COLORS.charcoalSoft,
                            opacity: 0.7,
                          }}
                        />
                      )}
                      
                      {isActive && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: "-2px",
                            left: "14px",
                            right: "14px",
                            height: "2.5px",
                            background: COLORS.indigo,
                            borderRadius: "2px",
                          }}
                        />
                      )}
                    </button>

                    {/* Integrated Subcategory Floating Dropdown */}
                    {hasSubs && isDropdownOpen && (
                      <>
                        {/* Backdrop for closing */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setCategoryDropdownOpen(false);
                          }}
                          style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 40,
                          }}
                        />
                        
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: "14px",
                            background: COLORS.cream,
                            border: `1px solid ${COLORS.charcoalSoft}22`,
                            borderRadius: "8px",
                            boxShadow: "0 8px 24px rgba(42,36,29,0.08)",
                            padding: "6px",
                            zIndex: 45,
                            minWidth: "170px",
                            marginTop: "2px",
                          }}
                        >
                          {/* Option: All Products of this Category */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSubcategoryFilter("");
                              setCategoryDropdownOpen(false);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              width: "100%",
                              padding: "7px 10px",
                              borderRadius: "6px",
                              fontSize: "12.5px",
                              fontFamily: "var(--sans)",
                              cursor: "pointer",
                              border: "none",
                              background: subcategoryFilter === "" ? `${COLORS.indigo}12` : "transparent",
                              color: subcategoryFilter === "" ? COLORS.indigo : COLORS.charcoal,
                              fontWeight: subcategoryFilter === "" ? 600 : 500,
                              textAlign: "left",
                              transition: "all 0.15s",
                            }}
                          >
                            <span>All {c}</span>
                            {subcategoryFilter === "" && <span style={{ fontSize: 9 }}>●</span>}
                          </button>

                          {/* Subcategory options */}
                          {catSubcategories.map(s => {
                            const isSelected = subcategoryFilter === s;
                            return (
                              <button
                                key={s}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSubcategoryFilter(s);
                                  setCategoryDropdownOpen(false);
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  width: "100%",
                                  padding: "7px 10px",
                                  borderRadius: "6px",
                                  fontSize: "12.5px",
                                  fontFamily: "var(--sans)",
                                  cursor: "pointer",
                                  border: "none",
                                  background: isSelected ? `${COLORS.indigo}12` : "transparent",
                                  color: isSelected ? COLORS.indigo : COLORS.charcoal,
                                  fontWeight: isSelected ? 600 : 500,
                                  textAlign: "left",
                                  transition: "all 0.15s",
                                }}
                              >
                                <span>{s}</span>
                                {isSelected && <span style={{ fontSize: 9 }}>●</span>}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Category Navigation & Filters — Side by Side Row */}
      <div className="show-mobile" style={{ marginTop: 12, marginBottom: 18, display: "none" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
        }}>
          {/* Category Selector Trigger */}
          <button
            onClick={() => setMobileCategoriesOpen(true)}
            style={{
              width: "100%",
              background: COLORS.cream,
              border: `1px solid ${COLORS.charcoalSoft}18`,
              borderRadius: "12px",
              padding: "11px 14px",
              boxShadow: "0 2px 8px rgba(42,36,29,0.03)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              textAlign: "left"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
              {/* Three horizontal lines menu indicator */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4.5px", width: "16px", minWidth: "16px" }}>
                <div style={{ height: "1.8px", background: COLORS.indigo, borderRadius: "1px", width: "100%" }} />
                <div style={{ height: "1.8px", background: COLORS.indigo, borderRadius: "1px", width: "70%" }} />
                <div style={{ height: "1.8px", background: COLORS.indigo, borderRadius: "1px", width: "100%" }} />
              </div>
              <span style={{ fontSize: "13px", fontWeight: 700, color: COLORS.indigo, fontFamily: "var(--sans)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {category === "All" ? "All Products" : `${category}${subcategoryFilter ? ` · ${subcategoryFilter}` : ""}`}
              </span>
            </div>
            <span style={{ fontSize: "11px", color: COLORS.charcoalSoft, fontWeight: 600, display: "flex", alignItems: "center", gap: 2, minWidth: "55px" }}>
              Browse <ChevronRight size={12} style={{ color: COLORS.indigo }} />
            </span>
          </button>
        </div>
      </div>

      {/* Mobile Categories Sliding Drawer */}
      {mobileCategoriesOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex" }}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileCategoriesOpen(false)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(27,24,21,0.5)",
              backdropFilter: "blur(2px)",
            }}
          />
          
          {/* Drawer Panel */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            style={{
              position: "relative",
              width: "85%",
              maxWidth: "320px",
              height: "100%",
              background: COLORS.ivory,
              boxShadow: "4px 0 24px rgba(0,0,0,0.15)",
              display: "flex",
              flexDirection: "column",
              zIndex: 10001,
            }}
          >
            {/* Drawer Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "18px 20px",
              borderBottom: `1px solid ${COLORS.charcoalSoft}15`,
              background: COLORS.cream
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 20 20">
                  {[2,7,12,17].map(x => <line key={x} x1={x} y1="1" x2={x} y2="19" stroke={COLORS.turmeric} strokeWidth="1.6"/>)}
                  {[2,7,12,17].map(y => <line key={"h"+y} x1="1" y1={y} x2="19" y2={y} stroke={COLORS.ivory} strokeWidth="1.2" opacity="0.5"/>)}
                </svg>
                <span style={{ fontFamily: "var(--serif)", fontSize: "16px", fontWeight: 700, color: COLORS.indigo }}>
                  Browse Categories
                </span>
              </div>
              <button
                onClick={() => setMobileCategoriesOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 4,
                  cursor: "pointer",
                  color: COLORS.charcoalSoft,
                  display: "flex",
                  alignItems: "center"
                }}
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Drawer Content (Scrollable) */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                
                {/* Option: All Products */}
                <button
                  onClick={() => {
                    setCategory("All");
                    setSubcategoryFilter("");
                    setMobileCategoriesOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    background: category === "All" ? `${COLORS.indigo}12` : "transparent",
                    color: category === "All" ? COLORS.indigo : COLORS.charcoal,
                    fontWeight: category === "All" ? 700 : 500,
                    fontSize: "14px",
                    fontFamily: "var(--sans)",
                    border: "none",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                >
                  <span style={{ flex: 1 }}>All Products</span>
                  {category === "All" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.indigo }} />}
                </button>
                
                {/* Custom Main Categories */}
                {mainCategories.filter(c => c !== "All").map(c => {
                  const isActive = category === c;
                  const catSubcategories = [...new Set(items.filter(p => p.category === c && p.subcategory).map(p => p.subcategory))];
                  const hasSubs = catSubcategories.length > 0;
                  const isExpanded = !!expandedMobileCategories[c];
                  
                  return (
                    <div key={c} style={{ display: "flex", flexDirection: "column", background: isActive ? `${COLORS.cream}88` : "transparent", borderRadius: "8px", overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                        {/* Main Category Clicker */}
                        <button
                          onClick={() => {
                            setCategory(c);
                            setSubcategoryFilter("");
                            if (!hasSubs) {
                              setMobileCategoriesOpen(false);
                            } else {
                              setExpandedMobileCategories(prev => ({
                                ...prev,
                                [c]: !prev[c]
                              }));
                            }
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            flex: 1,
                            padding: "12px 14px",
                            background: "transparent",
                            color: isActive ? COLORS.indigo : COLORS.charcoal,
                            fontWeight: isActive ? 700 : 500,
                            fontSize: "14px",
                            fontFamily: "var(--sans)",
                            border: "none",
                            textAlign: "left",
                            cursor: "pointer",
                          }}
                        >
                          <span style={{ flex: 1 }}>{c}</span>
                          {isActive && !subcategoryFilter && <span style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.indigo, marginRight: hasSubs ? 8 : 0 }} />}
                        </button>
                        
                        {/* Expand toggle */}
                        {hasSubs && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedMobileCategories(prev => ({
                                ...prev,
                                [c]: !prev[c]
                              }));
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              padding: "12px 14px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: COLORS.charcoalSoft
                            }}
                          >
                            <ChevronDown
                              size={16}
                              style={{
                                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                transition: "transform 0.15s ease",
                              }}
                            />
                          </button>
                        )}
                      </div>
                      
                      {/* Subcategories list */}
                      {hasSubs && isExpanded && (
                        <div style={{
                          paddingLeft: "24px",
                          paddingRight: "14px",
                          paddingBottom: "8px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          borderLeft: `1.5px solid ${COLORS.indigo}22`,
                          marginLeft: "20px",
                          marginTop: "2px",
                          marginBottom: "4px"
                        }}>
                          {/* Option: View All of this category */}
                          <button
                            onClick={() => {
                              setCategory(c);
                              setSubcategoryFilter("");
                              setMobileCategoriesOpen(false);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              width: "100%",
                              padding: "8px 10px",
                              borderRadius: "6px",
                              background: isActive && subcategoryFilter === "" ? `${COLORS.indigo}0c` : "transparent",
                              color: isActive && subcategoryFilter === "" ? COLORS.indigo : COLORS.charcoalSoft,
                              fontWeight: isActive && subcategoryFilter === "" ? 600 : 500,
                              fontSize: "13px",
                              fontFamily: "var(--sans)",
                              border: "none",
                              textAlign: "left",
                              cursor: "pointer",
                            }}
                          >
                            <span style={{ flex: 1 }}>All {c}</span>
                          </button>
                          
                          {/* Specific subcategories */}
                          {catSubcategories.map(s => {
                            const isSelected = isActive && subcategoryFilter === s;
                            return (
                              <button
                                key={s}
                                onClick={() => {
                                  setCategory(c);
                                  setSubcategoryFilter(s);
                                  setMobileCategoriesOpen(false);
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  width: "100%",
                                  padding: "8px 10px",
                                  borderRadius: "6px",
                                  background: isSelected ? `${COLORS.indigo}0c` : "transparent",
                                  color: isSelected ? COLORS.indigo : COLORS.charcoal,
                                  fontWeight: isSelected ? 600 : 500,
                                  fontSize: "13px",
                                  fontFamily: "var(--sans)",
                                  border: "none",
                                  textAlign: "left",
                                  cursor: "pointer",
                                }}
                              >
                                <span style={{ flex: 1 }}>{s}</span>
                                {isSelected && <span style={{ width: 4, height: 4, borderRadius: "50%", background: COLORS.indigo }} />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                
              </div>
            </div>
            
            {/* Drawer Footer info */}
            <div style={{
              padding: "20px",
              borderTop: `1px solid ${COLORS.charcoalSoft}15`,
              background: COLORS.cream,
              textAlign: "center"
            }}>
              <span style={{ fontSize: "11px", color: COLORS.charcoalSoft }}>
                Deetya Weaves Wholesale Catalog
              </span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Filter panel */}
      {showFilters && (
        <div style={{ background: COLORS.cream, border:`1px solid ${COLORS.charcoalSoft}22`, borderRadius:12, padding:"18px 20px", marginTop:14 }}>
          <div style={{ display:"flex", gap:24, flexWrap:"wrap", alignItems:"flex-start" }}>

            {/* Price bracket chips */}
            {filterSettings?.show_price_filter !== false && (
              <div>
                <div style={{ fontSize:11.5, color: COLORS.charcoalSoft, marginBottom:8, fontWeight:500 }}>Price range</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {(filterSettings?.price_brackets || []).map((b, i) => (
                    <button key={i} onClick={() => setPriceBracket(priceBracket?.label === b.label ? null : b)}
                      style={{
                        border:`1px solid ${priceBracket?.label === b.label ? COLORS.indigo : COLORS.charcoalSoft+"44"}`,
                        background: priceBracket?.label === b.label ? COLORS.indigo : "transparent",
                        color: priceBracket?.label === b.label ? COLORS.cream : COLORS.charcoalSoft,
                        borderRadius:20, padding:"5px 13px", fontSize:12, cursor:"pointer", fontFamily:"var(--sans)",
                      }}>{b.label}</button>
                  ))}
                </div>
                <div style={{ display:"flex", gap:6, alignItems:"center", marginTop:8 }}>
                  <input type="number" value={priceMin} onChange={e => { setPriceMin(e.target.value); setPriceBracket(null); }} placeholder="Custom min"
                    style={{ width:90, background: COLORS.ivoryDeep, border:"none", borderRadius:7, padding:"6px 10px", fontSize:12.5, color: COLORS.charcoal, fontFamily:"var(--sans)", outline:"none" }}/>
                  <span style={{ color: COLORS.charcoalSoft, fontSize:12 }}>–</span>
                  <input type="number" value={priceMax} onChange={e => { setPriceMax(e.target.value); setPriceBracket(null); }} placeholder="Custom max"
                    style={{ width:90, background: COLORS.ivoryDeep, border:"none", borderRadius:7, padding:"6px 10px", fontSize:12.5, color: COLORS.charcoal, fontFamily:"var(--sans)", outline:"none" }}/>
                </div>
              </div>
            )}

            {/* Weight filter */}
            {filterSettings?.show_weight_filter !== false && (() => {
              const weights = [...new Set(items.flatMap(p => p.variants.map(v => v.weight)).filter(Boolean))].sort((a,b) => parseFloat(a)-parseFloat(b));
              return weights.length > 0 ? (
                <div>
                  <div style={{ fontSize:11.5, color: COLORS.charcoalSoft, marginBottom:8, fontWeight:500 }}>Weight (g)</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {weights.map(w => {
                      const active = weightFilter === w;
                      return (
                        <button key={w} onClick={() => setWeightFilter(active ? "" : w)}
                          style={{
                            border:`1px solid ${active ? COLORS.turmeric : COLORS.charcoalSoft+"44"}`,
                            background: active ? COLORS.turmeric : "transparent",
                            color: active ? COLORS.cream : COLORS.charcoalSoft,
                            borderRadius:20, padding:"5px 12px", fontSize:12, cursor:"pointer", fontFamily:"var(--sans)",
                          }}>{w} g</button>
                      );
                    })}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Size filter */}
            {filterSettings?.show_size_filter !== false && (() => {
              const sizes = [...new Set(items.flatMap(p => p.variants.map(v => v.size)).filter(Boolean))];
              return sizes.length > 0 ? (
                <div>
                  <div style={{ fontSize:11.5, color: COLORS.charcoalSoft, marginBottom:8, fontWeight:500 }}>Size</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {sizes.map(s => {
                      const active = sizeFilter === s;
                      return (
                        <button key={s} onClick={() => setSizeFilter(active ? "" : s)}
                          style={{
                            border:`1px solid ${active ? COLORS.madder : COLORS.charcoalSoft+"44"}`,
                            background: active ? COLORS.madder : "transparent",
                            color: active ? COLORS.cream : COLORS.charcoalSoft,
                            borderRadius:20, padding:"5px 12px", fontSize:12, cursor:"pointer", fontFamily:"var(--sans)",
                          }}>{s}</button>
                      );
                    })}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Sort */}
            {filterSettings?.show_sort !== false && (
              <div>
                <div style={{ fontSize:11.5, color: COLORS.charcoalSoft, marginBottom:8, fontWeight:500 }}>Sort by</div>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  style={{ background: COLORS.ivoryDeep, border:"none", borderRadius:7, padding:"8px 12px", fontSize:13, color: COLORS.charcoal, cursor:"pointer", fontFamily:"var(--sans)", outline:"none" }}>
                  <option value="default">Default</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="name_asc">Name: A to Z</option>
                  <option value="weight_asc">Weight: Light first</option>
                  <option value="weight_desc">Weight: Heavy first</option>
                </select>
              </div>
            )}

            {/* In stock toggle */}
            <div>
              <div style={{ fontSize:11.5, color: COLORS.charcoalSoft, marginBottom:8, fontWeight:500 }}>Availability</div>
              <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:13, color: COLORS.charcoal }}>
                <div onClick={() => setInStockOnly(!inStockOnly)}
                  style={{ width:36, height:20, borderRadius:10, background: inStockOnly ? COLORS.sage : COLORS.charcoalSoft+"44", position:"relative", transition:"background 0.2s", cursor:"pointer" }}>
                  <div style={{ width:16, height:16, borderRadius:"50%", background: COLORS.cream, position:"absolute", top:2, left: inStockOnly ? 18 : 2, transition:"left 0.2s" }}/>
                </div>
                In stock only
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Newly Added strip — only when no filters active */}
      {activeFilterCount === 0 && !search && (() => {
        const newlyAdded = items.filter(p => p.isNewlyAdded);
        if (newlyAdded.length === 0) return null;
        return (
          <div style={{
            marginTop: 18,
            marginBottom: 24,
            background: COLORS.cream,
            border: `1.5px solid ${COLORS.sage}22`,
            borderRadius: 16,
            padding: "20px 24px",
            boxShadow: "0 2px 10px rgba(42,36,29,0.02)"
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
              <span style={{ background: COLORS.sage, color: COLORS.cream, fontSize:10, fontFamily:"var(--sans)", padding:"3px 8px", borderRadius:12, fontWeight:600, letterSpacing:0.5 }}>NEW ARRIVAL</span>
              <h3 style={{ fontFamily:"var(--serif)", fontSize:18, color: COLORS.indigo, margin:0, fontWeight: 700 }}>Newly Added Arrivals</h3>
            </div>
            <div style={{ display:"flex", gap:14, overflowX:"auto", paddingBottom:8, scrollbarWidth: "thin" }}>
              {newlyAdded.map(product => {
                const variant = product.variants[0];
                return (
                  <div key={product.id} onClick={() => { setSelectedProduct(product); setSelectedVariant(prev => ({ ...prev, [product.id]: variant.id })); }}
                    className="product-card"
                    style={{ minWidth:180, background: COLORS.ivory, border:`1.5px solid ${COLORS.sage}22`, borderRadius:12, padding:14, cursor:"pointer", flexShrink:0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div className="image-zoom-container" style={{ width:"100%", aspectRatio:"4/3", borderRadius:10, background: COLORS.ivoryDeep, overflow:"hidden", marginBottom:10 }}>
                      {product.photo
                        ? <img src={product.photo} alt={product.name} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                        : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}><ImageIcon size={18} color={COLORS.charcoalSoft+"55"}/></div>}
                    </div>
                    <div style={{ fontSize:13, fontFamily:"var(--serif)", color: COLORS.charcoal, marginBottom:4, lineHeight:1.3, fontWeight: 600 }}>{product.name}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 8 }}>
                      {account ? (
                        <div style={{ fontSize:13.5, fontWeight: 700, color: COLORS.madder }}>₹{variant.priceW}</div>
                      ) : (
                        <div style={{ fontSize:12, color: COLORS.indigo, textDecoration: "underline", fontWeight: 500 }}>Ask Price</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Bestsellers strip — only when no filters active */}
      {activeFilterCount === 0 && !search && (() => {
        const bestsellers = items.filter(p => p.isBestseller);
        if (bestsellers.length === 0) return null;
        return (
          <div style={{
            marginTop: 18,
            marginBottom: 24,
            background: COLORS.cream,
            border: `1.5px solid ${COLORS.charcoalSoft}15`,
            borderRadius: 16,
            padding: "20px 24px",
            boxShadow: "0 2px 10px rgba(42,36,29,0.02)"
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
              <h3 style={{ fontFamily:"var(--serif)", fontSize:18, color: COLORS.indigo, margin:0, fontWeight: 700 }}>Featured Bestsellers</h3>
            </div>
            <div style={{ display:"flex", gap:14, overflowX:"auto", paddingBottom:8, scrollbarWidth: "thin" }}>
              {bestsellers.map(product => {
                const variant = product.variants[0];
                return (
                  <div key={product.id} onClick={() => { setSelectedProduct(product); setSelectedVariant(prev => ({ ...prev, [product.id]: variant.id })); }}
                    className="product-card"
                    style={{ minWidth:220, maxWidth:220, background: COLORS.cream, border:`1.5px solid ${COLORS.turmeric}44`, borderRadius:16, padding:14, cursor:"pointer", flexShrink:0, display: "flex", flexDirection: "column" }}>
                    <div className="image-zoom-container" style={{ width:"100%", aspectRatio:"4/3", borderRadius:10, background: COLORS.ivoryDeep, overflow:"hidden", marginBottom:10 }}>
                      {product.photo
                        ? <img src={product.photo} alt={product.name} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                        : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}><ImageIcon size={18} color={COLORS.charcoalSoft+"55"}/></div>}
                    </div>
                    <div style={{ fontSize:13, fontFamily:"var(--serif)", color: COLORS.charcoal, marginBottom:4, lineHeight:1.3, fontWeight: 600 }}>{product.name}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 8 }}>
                      {account ? (
                        <div style={{ fontSize:13.5, fontWeight: 700, color: COLORS.madder }}>₹{variant.priceW}</div>
                      ) : (
                        <div style={{ fontSize:12, color: COLORS.indigo, textDecoration: "underline", fontWeight: 500 }}>Ask Price</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Results count and pagination status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize:12, color: COLORS.charcoalSoft, marginTop:14, marginBottom:12, fontFamily: "var(--sans)" }}>
        <div>
          {filtered.length} product{filtered.length !== 1 ? "s" : ""}{activeFilterCount > 0 ? " (filtered)" : ""}
        </div>
        {totalPages > 1 && (
          <div>
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
          </div>
        )}
      </div>

      <ThreadDivider />

      <div className="products-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(250px, 1fr))", gap:20 }}>
        {paginatedFiltered.map((product, index) => {
          const selVId = selectedVariant[product.id] || product.variants.find(v => v.stock !== 0)?.id || product.variants[0].id;
          const variant = product.variants.find(v => v.id === selVId) || product.variants[0];
          const cartKey = product.id + "__" + variant.id;
          const qty = cart[cartKey] || 0;
          const outOfStock = variant.stock === 0;
          const hasVariants = product.variants.length > 1;
          return (
            <div key={product.id} className="product-card" style={{ background: COLORS.cream, border:`1px solid ${product.isBestseller ? COLORS.turmeric+"44" : `${COLORS.charcoalSoft}18`}`, borderRadius:16, padding:16, position:"relative", display:"flex", flexDirection:"column", justifyContent:"space-between", animationDelay:`${Math.min(index * 50, 400)}ms` }}>
              <div>
                {product.isBestseller && (
                  <div style={{ position:"absolute", top:12, left:12, background: COLORS.turmeric, color: COLORS.cream, fontSize:10, fontFamily:"var(--sans)", padding:"4px 10px", borderRadius:20, fontWeight:600, letterSpacing:0.5, zIndex:1, boxShadow: "0 2px 8px rgba(200, 147, 46, 0.2)" }}>⭐ BESTSELLER</div>
                )}
                <div onClick={() => { setSelectedProduct(product); setSelectedVariant(prev => ({ ...prev, [product.id]: variant.id })); }}
                  className="image-zoom-container"
                  style={{ width:"100%", aspectRatio:"4/3", borderRadius:12, background: COLORS.ivoryDeep, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", marginBottom:12, cursor:"pointer" }}>
                  {product.photo ? <img src={product.photo} alt={product.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e => { e.target.style.display="none"; }}/> : <ImageIcon size={22} color={COLORS.charcoalSoft+"55"}/>}
                </div>
                <div onClick={() => { setSelectedProduct(product); setSelectedVariant(prev => ({ ...prev, [product.id]: variant.id })); }}
                  className="product-card-title"
                  style={{ fontFamily:"var(--serif)", fontSize:15.5, color: COLORS.charcoal, fontWeight: 600, lineHeight:1.35, cursor:"pointer", minHeight: 42, display: "flex", alignItems: "flex-start" }}>{product.name}</div>
                <div className="product-card-category" style={{ fontSize:11.5, color: COLORS.charcoalSoft, marginTop:4, textTransform:"uppercase", letterSpacing:0.5, fontWeight:500 }}>
                  {product.category} {product.subcategory ? `· ${product.subcategory}` : ""}
                </div>
                {hasVariants && (
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:12, marginBottom: 12 }}>
                    {product.variants.map(v => (
                      <button key={v.id} onClick={() => setSelectedVariant(prev => ({ ...prev, [product.id]: v.id }))}
                        disabled={v.stock === 0}
                        style={{
                          fontSize:11, fontFamily:"var(--sans)", borderRadius:20, padding:"4px 10px", cursor: v.stock===0 ? "not-allowed" : "pointer",
                          border:`1.5px solid ${selVId===v.id ? COLORS.indigo : `${COLORS.charcoalSoft}33`}`,
                          background: selVId===v.id ? `${COLORS.indigo}11` : "transparent",
                          color: v.stock===0 ? COLORS.charcoalSoft+"55" : selVId===v.id ? COLORS.indigo : COLORS.charcoalSoft,
                          fontWeight: selVId===v.id ? 600 : 500,
                          textDecoration: v.stock===0 ? "line-through" : "none",
                          transition: "all 0.15s ease",
                        }}>{v.label}</button>
                    ))}
                  </div>
                )}
              </div>
              
              <div style={{ borderTop: `1px solid ${COLORS.charcoalSoft}15`, marginTop: 12, paddingTop: 12 }}>
                {account ? (
                  <>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ fontFamily:"var(--sans)", fontSize:17, color: COLORS.madder, fontWeight: 700 }}>₹{variant.priceW}</div>
                      {outOfStock ? (
                        <span style={{ fontSize:11, color: COLORS.madder, fontWeight: 600, background: `${COLORS.madder}12`, padding: "3px 8px", borderRadius: 12 }}>Out of stock</span>
                      ) : variant.stock !== null && variant.stock < 15 ? (
                        <span style={{ fontSize:11, color: COLORS.turmeric, fontWeight: 600, background: `${COLORS.turmeric}12`, padding: "3px 8px", borderRadius: 12, display:"flex", alignItems:"center", gap:4 }}>
                          <AlertTriangle size={11}/> {variant.stock} left
                        </span>
                      ) : (
                        <span style={{ fontSize:11, color: COLORS.sage, fontWeight: 600, background: `${COLORS.sage}12`, padding: "3px 8px", borderRadius: 12 }}>In stock</span>
                      )}
                    </div>
                    <div style={{ fontSize:10.5, color: COLORS.charcoalSoft, marginTop: 4, marginBottom: 8 }}>
                      MOQ {variant.moq} pcs {variant.size ? `· ${variant.size} cm` : ""}{variant.weight ? `· ${variant.weight} g` : ""}
                    </div>
                    {!outOfStock && (
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:10, background: COLORS.ivoryDeep, borderRadius:8, padding:"6px 8px" }}>
                        <button onClick={() => setQty(product, variant, -1)} disabled={qty===0} style={{ border:"none", background:"transparent", cursor: qty===0 ? "default":"pointer", color: qty===0 ? COLORS.charcoalSoft+"55" : COLORS.indigo, display:"flex" }}><Minus size={15}/></button>
                        <span key={`qty-${cartKey}-${qty}`} className={qty > 0 ? "qty-pop" : ""} style={{ fontSize:13.5, color: COLORS.charcoal, minWidth:30, textAlign:"center", fontWeight: 600 }}>{qty}</span>
                        <button onClick={() => setQty(product, variant, 1)} style={{ border:"none", background:"transparent", cursor:"pointer", color: COLORS.indigo, display:"flex" }}><Plus size={15}/></button>
                      </div>
                    )}
                  </>
                ) : (
                  <div>
                    <div style={{ fontSize:10.5, color: COLORS.charcoalSoft, marginBottom: 8 }}>
                      MOQ {variant.moq} pcs {variant.size ? `· ${variant.size} cm` : ""}{variant.weight ? `· ${variant.weight} g` : ""}
                    </div>
                    <button onClick={onShowLogin}
                      style={{
                        width:"100%", background: COLORS.indigo, color: COLORS.cream, border:"none", borderRadius:10, padding:"10px 12px", fontSize:13, cursor:"pointer", fontFamily:"var(--sans)", fontWeight: 500, display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                        boxShadow: "0 2px 8px rgba(43, 58, 85, 0.15)",
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = COLORS.madder}
                      onMouseLeave={e => e.currentTarget.style.background = COLORS.indigo}
                    >
                      Ask Price / Register
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 16,
          marginTop: 32,
          marginBottom: 12,
          fontFamily: "var(--sans)"
        }}>
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            style={{
              background: currentPage === 1 ? `${COLORS.charcoalSoft}15` : COLORS.indigo,
              color: currentPage === 1 ? COLORS.charcoalSoft : COLORS.cream,
              border: "none",
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: currentPage === 1 ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
              boxShadow: currentPage === 1 ? "none" : "0 2px 6px rgba(43, 58, 85, 0.15)",
              display: "flex",
              alignItems: "center",
              gap: 4
            }}
          >
            <ChevronLeft size={16} /> Previous
          </button>

          <span style={{ fontSize: 14, fontWeight: 500, color: COLORS.charcoal }}>
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            style={{
              background: currentPage === totalPages ? `${COLORS.charcoalSoft}15` : COLORS.indigo,
              color: currentPage === totalPages ? COLORS.charcoalSoft : COLORS.cream,
              border: "none",
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: currentPage === totalPages ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
              boxShadow: currentPage === totalPages ? "none" : "0 2px 6px rgba(43, 58, 85, 0.15)",
              display: "flex",
              alignItems: "center",
              gap: 4
            }}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
      {filtered.length === 0 && <div style={{ textAlign:"center", padding:"40px 0", color: COLORS.charcoalSoft, fontSize:13.5 }}>No items match.</div>}

      {cartEntries.length > 0 && (
        <div style={{
          position: "sticky",
          bottom: 12,
          marginTop: 22,
          background: COLORS.indigo,
          borderRadius: 12,
          padding: "12px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          boxShadow: "0 8px 32px rgba(43, 58, 85, 0.25)",
          zIndex: 100
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 8, padding: 8, color: COLORS.cream, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShoppingBag size={20} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.cream }}>
                {cartEntries.length} Item{cartEntries.length !== 1 ? "s" : ""} selected for Wholesale
              </div>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.7)", marginTop: 1 }}>
                Estimated Order Total: <strong style={{ color: COLORS.cream }}>₹{cartTotal.toLocaleString("en-IN")}</strong>
              </div>
            </div>
          </div>

          <button
            onClick={() => setViewingCart(true)}
            style={{
              background: COLORS.madder,
              color: COLORS.cream,
              border: "none",
              padding: "10px 20px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--sans)",
              transition: "transform 0.2s ease",
              boxShadow: "0 2px 8px rgba(181, 72, 46, 0.2)"
            }}
          >
            Review Cart & Checkout <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Product detail side panel */}
      {selectedProduct && (
        <ProductPanel
          product={selectedProduct}
          variant={selectedProduct.variants.find(v => v.id === (selectedVariant[selectedProduct.id] || selectedProduct.variants[0].id)) || selectedProduct.variants[0]}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={setQty}
          cart={cart}
          account={account}
          onShowLogin={onShowLogin}
        />
      )}
    </div>
  );
}

// =============================================
// SELLER DASHBOARD
// =============================================
function SellerView({
  sheetData,
  filterConfig,
  dispatchLocation,
  onUpdateDispatchLocation,
  systemFooter,
  onUpdateFooterSettings
}) {
  const { items } = sheetData;
  const [orders, setOrders] = useState([]);
  const [allRetailers, setAllRetailers] = useState([]);
  const [loadingRetailers, setLoadingRetailers] = useState(true);
  const [discountCodes, setDiscountCodes] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState({});
  
  // Tabs state
  const [activeTab, setActiveTab] = useState("overview"); // "overview", "sellers", "offers", "dispatch", "footer_settings"
  
  // Footer and Terms state
  const [localAboutUs, setLocalAboutUs] = useState("");
  const [localBlogs, setLocalBlogs] = useState("");
  const [localTerms, setLocalTerms] = useState("");
  const [localReturnPolicy, setLocalReturnPolicy] = useState("");
  const [localLegalPolicy, setLocalLegalPolicy] = useState("");
  const [localContact, setLocalContact] = useState({ whatsapp: "", phone: "", email: "", address: "", timing: "" });
  const [savingFooter, setSavingFooter] = useState(false);
  const [footerSuccess, setFooterSuccess] = useState(false);

  useEffect(() => {
    if (systemFooter) {
      setLocalAboutUs(systemFooter.aboutUs || "");
      setLocalBlogs(systemFooter.blogs || "");
      setLocalTerms(systemFooter.termsAndConditions || "");
      setLocalReturnPolicy(systemFooter.returnPolicy || "");
      setLocalLegalPolicy(systemFooter.legalPolicy || "");
      setLocalContact(systemFooter.contactInfo || { whatsapp: "", phone: "", email: "", address: "", timing: "" });
    }
  }, [systemFooter]);
  
  // Sellers Tab states
  const [searchSeller, setSearchSeller] = useState("");
  const [sellerStatusFilter, setSellerStatusFilter] = useState("All"); // All | Approved | Pending | Rejected
  const [expandedRetailerHistory, setExpandedRetailerHistory] = useState(null); // retailerId
  const [tempLimits, setTempLimits] = useState({}); // retailerId -> tempLimitString
  const [updatingLimitId, setUpdatingLimitId] = useState(null);

  // Discount code form
  const [dcCode, setDcCode] = useState("");
  const [dcDesc, setDcDesc] = useState("");
  const [dcType, setDcType] = useState("percentage");
  const [dcValue, setDcValue] = useState("");
  const [dcMin, setDcMin] = useState("");
  const [dcMaxUses, setDcMaxUses] = useState("");
  const [dcExpiry, setDcExpiry] = useState("");
  const [savingCode, setSavingCode] = useState(false);
  const [showDiscountForm, setShowDiscountForm] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await supabase("orders?select=*&order=created_at.desc");
      setOrders(data || []);
    } catch (e) { console.error(e); }
    finally { setLoadingOrders(false); }
  }, []);

  const fetchAllRetailers = useCallback(async () => {
    setLoadingRetailers(true);
    try {
      const data = await supabase("retailers?select=*&order=created_at.desc");
      setAllRetailers(data || []);
    } catch (e) { console.error(e); }
    finally { setLoadingRetailers(false); }
  }, []);

  const fetchDiscountCodes = useCallback(async () => {
    try {
      const data = await supabase("discount_codes?select=*&order=created_at.desc");
      setDiscountCodes(data || []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { 
    fetchOrders(); 
    fetchAllRetailers(); 
    fetchDiscountCodes(); 
  }, [fetchOrders, fetchAllRetailers, fetchDiscountCodes]);

  const updateStage = async (orderId, newStage) => {
    setUpdatingId(orderId);
    try {
      await supabase(`orders?id=eq.${orderId}`, "PATCH", { stage: newStage, updated_at: new Date().toISOString() });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, stage: newStage } : o));
    } catch (e) { alert("Could not update: " + e.message); }
    finally { setUpdatingId(null); }
  };

  const updateRetailerStatus = async (id, newStatus) => {
    setApprovingId(id);
    try {
      await supabase(`retailers?id=eq.${id}`, "PATCH", { status: newStatus });
      setAllRetailers(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    } catch (e) { alert("Could not update status: " + e.message); }
    finally { setApprovingId(null); }
  };

  const updateCreditLimit = async (id, limitValue) => {
    const val = parseFloat(limitValue);
    if (isNaN(val) || val < 0) {
      alert("Please enter a valid credit limit");
      return;
    }
    setUpdatingLimitId(id);
    try {
      await supabase(`retailers?id=eq.${id}`, "PATCH", { credit_limit: val });
      setAllRetailers(prev => prev.map(r => r.id === id ? { ...r, credit_limit: val } : r));
      alert("Credit limit updated successfully!");
    } catch (e) {
      alert("Could not update credit limit: " + e.message);
    } finally {
      setUpdatingLimitId(null);
    }
  };

  const loadOrderItems = async (orderId) => {
    if (orderItems[orderId]) { setExpandedOrder(expandedOrder === orderId ? null : orderId); return; }
    try {
      const data = await supabase(`order_items?order_id=eq.${orderId}&select=*`);
      setOrderItems(prev => ({ ...prev, [orderId]: data || [] }));
      setExpandedOrder(orderId);
    } catch (e) { console.error(e); }
  };

  const saveDiscountCode = async () => {
    if (!dcCode.trim() || !dcValue) return;
    setSavingCode(true);
    try {
      await supabase("discount_codes", "POST", {
        code: dcCode.trim().toUpperCase(), description: dcDesc, discount_type: dcType,
        discount_value: parseFloat(dcValue), min_order_value: parseFloat(dcMin) || 0,
        max_uses: dcMaxUses ? parseInt(dcMaxUses) : null,
        valid_until: dcExpiry || null, is_active: true,
      });
      setDcCode(""); setDcDesc(""); setDcValue(""); setDcMin(""); setDcMaxUses(""); setDcExpiry("");
      setShowDiscountForm(false);
      fetchDiscountCodes();
    } catch (e) { alert("Could not save code: " + e.message); }
    finally { setSavingCode(false); }
  };

  const toggleCode = async (id, current) => {
    try {
      await supabase(`discount_codes?id=eq.${id}`, "PATCH", { is_active: !current });
      fetchDiscountCodes();
    } catch (e) { alert("Could not update code."); }
  };

  const nextStage = (stage) => {
    if (stage === "Cancelled") return null;
    const idx = STAGES.indexOf(stage);
    return idx >= 0 && idx < STAGES.length - 1 ? STAGES[idx + 1] : null;
  };

  // Filter retailers for the list/directory
  const filteredSellers = useMemo(() => {
    return allRetailers.filter(r => {
      const matchSearch = 
        (r.shop_name || "").toLowerCase().includes(searchSeller.toLowerCase()) ||
        (r.owner_name || "").toLowerCase().includes(searchSeller.toLowerCase()) ||
        (r.phone || "").toLowerCase().includes(searchSeller.toLowerCase()) ||
        (r.email || "").toLowerCase().includes(searchSeller.toLowerCase());
      
      if (sellerStatusFilter === "All") return matchSearch;
      return matchSearch && (r.status || "").toLowerCase() === sellerStatusFilter.toLowerCase();
    });
  }, [allRetailers, searchSeller, sellerStatusFilter]);

  const pendingRetailers = useMemo(() => {
    return allRetailers.filter(r => (r.status || "").toLowerCase() === "pending");
  }, [allRetailers]);

  const allVariants = items.flatMap(p => p.variants);
  const lowStock = allVariants.filter(v => v.stock !== null && v.stock > 0 && v.stock < 15);
  const outStock = allVariants.filter(v => v.stock === 0);

  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString());
  const todayValue = todayOrders.reduce((s, o) => s + (o.total || 0), 0);
  const pendingOrders = orders.filter(o => o.stage === "Pending");

  return (
    <div>
      <h2 style={{ fontFamily:"var(--serif)", fontSize:23, color: COLORS.indigo, margin:"2px 0 0" }}>Seller dashboard</h2>
      <p style={{ color: COLORS.charcoalSoft, fontSize:13.5, marginTop:4 }}>Deetya Weaves · Guru Kripa Traders</p>

      {/* Tabs */}
      <div style={{ display:"flex", gap:8, borderBottom:`1.5px solid ${COLORS.ivoryDeep}`, paddingBottom:0, marginTop:18, marginBottom:18 }}>
        {[
          { id: "overview", label: "Orders & Overview", icon: <Truck size={14} /> },
          { id: "sellers", label: "Sellers (Retailers) Details", icon: <User size={14} /> },
          { id: "offers", label: "Offers & Inventory", icon: <Package size={14} /> },
          { id: "dispatch", label: "Dispatch Settings", icon: <MapPin size={14} /> },
          { id: "footer_settings", label: "Footer & T&C Settings", icon: <FileText size={14} /> }
        ].map(t => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display:"flex",
                alignItems:"center",
                gap:6,
                background: isActive ? COLORS.cream : "transparent",
                color: isActive ? COLORS.indigo : COLORS.charcoalSoft,
                border: "none",
                borderBottom: isActive ? `3px solid ${COLORS.indigo}` : "3px solid transparent",
                padding: "8px 16px",
                fontSize: 13.5,
                fontWeight: isActive ? 600 : 500,
                cursor: "pointer",
                fontFamily: "var(--sans)",
                transition: "all 0.2s ease",
                borderTopLeftRadius: 6,
                borderTopRightRadius: 6,
                marginBottom: -1.5,
              }}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ================= ACTIVE TAB RENDERING ================= */}
      
      {activeTab === "overview" && (
        <div>
          <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
            <StatCard label="Orders today" value={todayOrders.length} sub={`₹${todayValue.toLocaleString("en-IN")} value`}/>
            <StatCard label="Awaiting acceptance" value={pendingOrders.length} accent={COLORS.madder} sub="needs your action"/>
            <StatCard label="Low / out of stock" value={lowStock.length + outStock.length} accent={COLORS.turmeric} sub="restock soon"/>
            <StatCard label="New registrations" value={pendingRetailers.length} accent={COLORS.sage} sub="awaiting approval"/>
          </div>

          {pendingRetailers.length > 0 && (
            <>
              <ThreadDivider />
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                <Bell size={16} color={COLORS.turmeric}/>
                <h3 style={{ fontFamily:"var(--serif)", fontSize:16.5, color: COLORS.charcoal, margin:0 }}>Pending approvals ({pendingRetailers.length})</h3>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {pendingRetailers.map(r => (
                  <div key={r.id} style={{ background: COLORS.cream, border:`1px solid ${COLORS.turmeric}44`, borderRadius:10, padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
                    <div>
                      <div style={{ fontSize:13.5, color: COLORS.charcoal, fontWeight:600 }}>{r.shop_name}</div>
                      <div style={{ fontSize:12, color: COLORS.charcoalSoft, marginTop:2 }}>{r.owner_name || "—"} · +91 {r.phone} · Registered {new Date(r.created_at).toLocaleDateString("en-IN")}</div>
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={() => updateRetailerStatus(r.id, "approved")} disabled={approvingId===r.id}
                        style={{ background: COLORS.sage, color: COLORS.cream, border:"none", padding:"7px 14px", borderRadius:7, fontSize:12, cursor:"pointer", fontFamily:"var(--sans)" }}>
                        Approve
                      </button>
                      <button onClick={() => updateRetailerStatus(r.id, "rejected")} disabled={approvingId===r.id}
                        style={{ background:"transparent", color: COLORS.madder, border:`1px solid ${COLORS.madder}`, padding:"7px 14px", borderRadius:7, fontSize:12, cursor:"pointer", fontFamily:"var(--sans)" }}>
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <ThreadDivider />
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <Truck size={16} color={COLORS.indigo}/>
            <h3 style={{ fontFamily:"var(--serif)", fontSize:16.5, color: COLORS.charcoal, margin:0 }}>Orders</h3>
          </div>

          {loadingOrders ? (
            <div style={{ textAlign:"center", padding:"30px 0", color: COLORS.charcoalSoft, fontSize:13 }}>Loading orders…</div>
          ) : orders.length === 0 ? (
            <div style={{ textAlign:"center", padding:"30px 0", color: COLORS.charcoalSoft, fontSize:13 }}>No orders yet.</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {orders.map(o => {
                const next = nextStage(o.stage);
                const isPending = o.stage === "Pending";
                const isCancelled = o.stage === "Cancelled";
                const stageColor = isPending ? COLORS.turmeric : isCancelled ? COLORS.madder : COLORS.indigo;
                const isExpanded = expandedOrder === o.id;
                return (
                  <div key={o.id} style={{ background: COLORS.cream, border:`1px solid ${isPending ? COLORS.turmeric+"66" : COLORS.charcoalSoft+"22"}`, borderRadius:10, padding:"14px 16px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:10 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13.5, color: COLORS.charcoal }}>
                          <strong>#{o.order_number}</strong> · {o.retailer_name}
                        </div>
                        <div style={{ fontSize:12, color: COLORS.charcoalSoft, marginTop:2, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                          <span>Subtotal ₹{o.subtotal?.toLocaleString("en-IN") || o.total?.toLocaleString("en-IN")}</span>
                          {o.discount_amount > 0 && <span style={{ color: COLORS.sage }}>· Disc −₹{o.discount_amount}</span>}
                          <span>· GST ₹{o.gst_amount?.toLocaleString("en-IN") || "—"}</span>
                          <span style={{ fontWeight:600, color: COLORS.charcoal }}>· Total ₹{o.total?.toLocaleString("en-IN")}</span>
                          <span style={{ display:"flex", alignItems:"center", gap:3, color: o.payment_type==="credit" ? COLORS.turmeric : COLORS.sage }}>
                            <Wallet size={11}/>{o.payment_type==="credit" ? "On credit" : "Paid upfront"}
                          </span>
                          · {new Date(o.created_at).toLocaleDateString("en-IN")}
                          {o.coupon_code && <span style={{ color: COLORS.sage }}>· Coupon: {o.coupon_code}</span>}
                        </div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                        <span style={{ fontSize:12, color: stageColor, background: COLORS.ivoryDeep, padding:"4px 10px", borderRadius:20 }}>{o.stage}</span>
                        {isPending && (
                          <>
                            <button onClick={() => updateStage(o.id, "Confirmed")} disabled={updatingId===o.id}
                              style={{ background: COLORS.sage, color: COLORS.cream, border:"none", padding:"7px 12px", borderRadius:7, fontSize:12, cursor:"pointer", fontFamily:"var(--sans)" }}>
                              {updatingId===o.id ? "…" : "✓ Accept"}
                            </button>
                            <button onClick={() => updateStage(o.id, "Cancelled")} disabled={updatingId===o.id}
                              style={{ background:"transparent", color: COLORS.madder, border:`1px solid ${COLORS.madder}`, padding:"7px 12px", borderRadius:7, fontSize:12, cursor:"pointer", fontFamily:"var(--sans)" }}>
                              ✕ Cancel
                            </button>
                          </>
                        )}
                        {!isPending && !isCancelled && next && (
                          <button onClick={() => updateStage(o.id, next)} disabled={updatingId===o.id}
                            style={{ background: COLORS.indigo, color: COLORS.cream, border:"none", padding:"7px 12px", borderRadius:7, fontSize:12, cursor:"pointer", fontFamily:"var(--sans)" }}>
                            {updatingId===o.id ? "…" : `Mark ${next}`}
                          </button>
                        )}
                        {!isPending && !isCancelled && (
                          <button onClick={() => updateStage(o.id, "Cancelled")} disabled={updatingId===o.id}
                            style={{ background:"transparent", color: COLORS.madder, border:`1px solid ${COLORS.madder}55`, padding:"7px 10px", borderRadius:7, fontSize:11, cursor:"pointer", fontFamily:"var(--sans)" }}>
                            Cancel
                          </button>
                        )}
                        <button onClick={() => loadOrderItems(o.id)}
                          style={{ background:"transparent", color: COLORS.indigo, border:`1px solid ${COLORS.indigo}44`, padding:"7px 10px", borderRadius:7, fontSize:11, cursor:"pointer", fontFamily:"var(--sans)" }}>
                          {isExpanded ? "Hide items" : "View items"}
                        </button>
                      </div>
                    </div>
                    {isExpanded && orderItems[o.id] && (
                      <div style={{ marginTop:12, background: COLORS.ivoryDeep, borderRadius:8, padding:"10px 14px" }}>
                        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12.5, fontFamily:"var(--sans)" }}>
                          <thead>
                            <tr style={{ borderBottom:`1px solid ${COLORS.charcoalSoft}22`, textAlign:"left" }}>
                              <th style={{ padding:"4px 0", color: COLORS.charcoalSoft, fontWeight:500 }}>Item</th>
                              <th style={{ padding:"4px 8px", color: COLORS.charcoalSoft, fontWeight:500, textAlign:"center" }}>Qty</th>
                              <th style={{ padding:"4px 0", color: COLORS.charcoalSoft, fontWeight:500, textAlign:"right" }}>Rate</th>
                              <th style={{ padding:"4px 0 4px 8px", color: COLORS.charcoalSoft, fontWeight:500, textAlign:"right" }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orderItems[o.id].map((item, i) => (
                              <tr key={i} style={{ borderBottom:`1px solid ${COLORS.charcoalSoft}11` }}>
                                <td style={{ padding:"5px 0", color: COLORS.charcoal }}>{item.item_name}</td>
                                <td style={{ padding:"5px 8px", color: COLORS.charcoalSoft, textAlign:"center" }}>{item.quantity}</td>
                                <td style={{ padding:"5px 0", color: COLORS.charcoal, textAlign:"right" }}>₹{item.price_w}</td>
                                <td style={{ padding:"5px 0 5px 8px", color: COLORS.charcoal, textAlign:"right" }}>₹{(item.price_w * item.quantity).toLocaleString("en-IN")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {!isCancelled && (
                      <div style={{ marginTop:12 }}>
                        <WeavingProgress stage={o.stage}/>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "sellers" && (
        <div>
          {/* Search & Status filter controls */}
          <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
            <div style={{ flex:1, minWidth:260, display:"flex", alignItems:"center", gap:8, background: COLORS.cream, border:`1px solid ${COLORS.charcoalSoft}33`, borderRadius:8, padding:"8px 12px" }}>
              <Search size={16} color={COLORS.charcoalSoft} />
              <input 
                type="text" 
                placeholder="Search by shop name, owner, phone or email..."
                value={searchSeller}
                onChange={e => setSearchSeller(e.target.value)}
                style={{ border:"none", outline:"none", background:"transparent", width:"100%", fontSize:13.5, color: COLORS.charcoal, fontFamily:"var(--sans)" }}
              />
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {["All", "Approved", "Pending", "Rejected"].map(status => {
                const isActive = sellerStatusFilter === status;
                return (
                  <button
                    key={status}
                    onClick={() => setSellerStatusFilter(status)}
                    style={{
                      background: isActive ? COLORS.indigo : COLORS.cream,
                      color: isActive ? COLORS.cream : COLORS.charcoalSoft,
                      border: `1px solid ${isActive ? COLORS.indigo : COLORS.charcoalSoft+"33"}`,
                      borderRadius: 20,
                      padding: "6px 14px",
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: "var(--sans)",
                      transition: "all 0.2s"
                    }}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Directory Listings */}
          {loadingRetailers ? (
            <div style={{ textAlign:"center", padding:"30px 0", color: COLORS.charcoalSoft, fontSize:13 }}>Loading sellers directory...</div>
          ) : filteredSellers.length === 0 ? (
            <div style={{ textAlign:"center", padding:"30px 0", color: COLORS.charcoalSoft, fontSize:13, background: COLORS.cream, borderRadius:12 }}>
              No sellers found matching the criteria.
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {filteredSellers.map(r => {
                const sellerOrders = orders.filter(o => o.retailer_id === r.id || o.retailer_phone === r.phone);
                const totalOrdersValue = sellerOrders.reduce((accVal, o) => accVal + (o.total || 0), 0);
                const isHistoryExpanded = expandedRetailerHistory === r.id;
                const badgeColor = (r.status || "").toLowerCase() === "approved" ? COLORS.sage : (r.status || "").toLowerCase() === "rejected" ? COLORS.madder : COLORS.turmeric;
                
                return (
                  <div key={r.id} style={{ background: COLORS.cream, border: `1px solid ${COLORS.charcoalSoft}18`, borderRadius:12, padding:"16px 18px" }}>
                    {/* Header */}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                          <h4 style={{ fontFamily:"var(--serif)", fontSize:16.5, color: COLORS.indigo, margin:0, fontWeight:600 }}>{r.shop_name}</h4>
                          <span style={{ fontSize:11, color: COLORS.cream, background: badgeColor, padding:"3px 9px", borderRadius:12, fontWeight: 500, textTransform: "capitalize" }}>
                            {r.status || "Pending"}
                          </span>
                        </div>
                        <p style={{ fontSize:12.5, color: COLORS.charcoalSoft, marginTop:4, margin:0 }}>
                          Owner: <strong>{r.owner_name || "—"}</strong> · +91 {r.phone} {r.email ? `· ${r.email}` : ""}
                        </p>
                        <p style={{ fontSize:11, color: COLORS.charcoalSoft, marginTop:2, margin:0 }}>
                          Registered: {new Date(r.created_at).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                      
                      {/* Status quick actions */}
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {(r.status || "").toLowerCase() !== "approved" && (
                          <button 
                            onClick={() => updateRetailerStatus(r.id, "approved")}
                            disabled={approvingId === r.id}
                            style={{ background: COLORS.sage, color: COLORS.cream, border:"none", borderRadius:6, padding:"6px 12px", fontSize:12, cursor:"pointer", fontFamily:"var(--sans)" }}
                          >
                            Approve
                          </button>
                        )}
                        {(r.status || "").toLowerCase() !== "rejected" && (
                          <button 
                            onClick={() => updateRetailerStatus(r.id, "rejected")}
                            disabled={approvingId === r.id}
                            style={{ background:"transparent", color: COLORS.madder, border:`1px solid ${COLORS.madder}`, borderRadius:6, padding:"5px 12px", fontSize:12, cursor:"pointer", fontFamily:"var(--sans)" }}
                          >
                            Reject / Suspend
                          </button>
                        )}
                        {(r.status || "").toLowerCase() === "rejected" && (
                          <button 
                            onClick={() => updateRetailerStatus(r.id, "pending")}
                            disabled={approvingId === r.id}
                            style={{ background: COLORS.ivoryDeep, color: COLORS.charcoal, border:"none", borderRadius:6, padding:"6px 12px", fontSize:12, cursor:"pointer", fontFamily:"var(--sans)" }}
                          >
                            Reset to Pending
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ height:"1px", background:`${COLORS.charcoalSoft}12`, margin:"12px 0" }} />

                    {/* Credit Parameters and Orders Summary Card */}
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:16 }}>
                      {/* Credit Parameters */}
                      <div style={{ background: COLORS.ivoryDeep+"44", borderRadius:8, padding:12 }}>
                        <div style={{ fontSize:11.5, color: COLORS.charcoalSoft, fontWeight:600, textTransform:"uppercase", letterSpacing:0.3, marginBottom:6, display:"flex", alignItems:"center", gap:4 }}>
                          <Wallet size={12}/> Credit Parameters
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                          <div style={{ fontSize:12.5, color: COLORS.charcoal }}>
                            Limit: <strong style={{ fontFamily:"var(--sans)" }}>₹{(r.credit_limit || 0).toLocaleString("en-IN")}</strong>
                          </div>
                          <div style={{ fontSize:12.5, color: COLORS.charcoalSoft }}>
                            Used: ₹{(r.credit_used || 0).toLocaleString("en-IN")}
                          </div>
                          <div style={{ fontSize:12.5, color: COLORS.sage, fontWeight: 500 }}>
                            Available: ₹{Math.max(0, (r.credit_limit || 0) - (r.credit_used || 0)).toLocaleString("en-IN")}
                          </div>
                        </div>

                        {/* Credit Adjuster input */}
                        <div style={{ marginTop:8, display:"flex", gap:6, alignItems:"center" }}>
                          <input 
                            type="number" 
                            placeholder="New Limit"
                            value={tempLimits[r.id] ?? ""}
                            onChange={e => setTempLimits(prev => ({ ...prev, [r.id]: e.target.value }))}
                            style={{ width:90, fontSize:11.5, padding:"4px 8px", border:`1px solid ${COLORS.charcoalSoft}33`, borderRadius:4, background: COLORS.cream, color:COLORS.charcoal, outline:"none" }}
                          />
                          <button 
                            onClick={() => {
                              updateCreditLimit(r.id, tempLimits[r.id]);
                              setTempLimits(prev => {
                                const copy = { ...prev };
                                delete copy[r.id];
                                return copy;
                              });
                            }}
                            disabled={updatingLimitId === r.id}
                            style={{ background: COLORS.indigo, color: COLORS.cream, border:"none", borderRadius:4, padding:"4px 8px", fontSize:11, cursor:"pointer", fontWeight:500, fontFamily:"var(--sans)" }}
                          >
                            Update
                          </button>
                        </div>
                      </div>

                      {/* Orders Summary */}
                      <div style={{ background: COLORS.ivoryDeep+"44", borderRadius:8, padding:12, display:"flex", flexDirection:"column", justifyContent:"space-between" }}>
                        <div>
                          <div style={{ fontSize:11.5, color: COLORS.charcoalSoft, fontWeight:600, textTransform:"uppercase", letterSpacing:0.3, marginBottom:6, display:"flex", alignItems:"center", gap:4 }}>
                            <ShoppingBag size={12}/> Order Summary
                          </div>
                          <div style={{ fontSize:13, color: COLORS.charcoal }}>
                            Total Orders placed: <strong>{sellerOrders.length}</strong>
                          </div>
                          <div style={{ fontSize:13, color: COLORS.charcoal, marginTop:3 }}>
                            Total Business Value: <strong style={{ color: COLORS.indigo }}>₹{totalOrdersValue.toLocaleString("en-IN")}</strong>
                          </div>
                        </div>

                        <button 
                          onClick={() => setExpandedRetailerHistory(isHistoryExpanded ? null : r.id)}
                          style={{
                            marginTop: 10,
                            alignSelf: "flex-start",
                            background: "transparent",
                            border: `1.5px solid ${COLORS.indigo}44`,
                            borderRadius: 6,
                            padding: "5px 12px",
                            fontSize: 11.5,
                            color: COLORS.indigo,
                            fontWeight: 600,
                            cursor: "pointer",
                            fontFamily: "var(--sans)",
                            display:"flex",
                            alignItems:"center",
                            gap:4
                          }}
                        >
                          {isHistoryExpanded ? "Hide History" : "View Order History"} 
                          <ChevronDown size={12} style={{ transform: isHistoryExpanded ? "rotate(180deg)" : "none", transition:"transform 0.2s" }}/>
                        </button>
                      </div>
                    </div>

                    {/* Expandable detailed history logs */}
                    {isHistoryExpanded && (
                      <div style={{ marginTop:14, background: COLORS.ivoryDeep+"22", borderRadius:8, padding:12, border:`1px solid ${COLORS.charcoalSoft}11` }}>
                        <h5 style={{ margin:"0 0 10px 0", fontFamily:"var(--sans)", fontSize:12.5, color: COLORS.indigo, fontWeight:600 }}>Order History Logs</h5>
                        {sellerOrders.length === 0 ? (
                          <div style={{ fontSize:12, color: COLORS.charcoalSoft, padding:"10px 0", textAlign:"center" }}>No orders placed by this seller yet.</div>
                        ) : (
                          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                            {sellerOrders.map(o => {
                              const isOrderItemsExpanded = expandedOrder === o.id;
                              const isCancelled = o.stage === "Cancelled";
                              const isPending = o.stage === "Pending";
                              const stageColor = isPending ? COLORS.turmeric : isCancelled ? COLORS.madder : COLORS.indigo;

                              return (
                                <div key={o.id} style={{ background: COLORS.cream, borderRadius:6, padding:10, border:`1px solid ${COLORS.charcoalSoft}11` }}>
                                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                                    <div>
                                      <div style={{ fontSize:12, color: COLORS.charcoal, fontWeight:600 }}>
                                        Order #{o.order_number}
                                      </div>
                                      <div style={{ fontSize:11, color: COLORS.charcoalSoft, marginTop:2 }}>
                                        {new Date(o.created_at).toLocaleDateString("en-IN")} · Total: ₹{o.total?.toLocaleString("en-IN")} · {o.payment_type === "credit" ? "On credit" : "Upfront"}
                                      </div>
                                    </div>
                                    
                                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                      <span style={{ fontSize:10.5, color: stageColor, background: COLORS.ivoryDeep, padding:"2px 8px", borderRadius:12, fontWeight:500 }}>{o.stage}</span>
                                      <button 
                                        onClick={() => loadOrderItems(o.id)}
                                        style={{ background:"transparent", color: COLORS.indigo, border:`1px solid ${COLORS.indigo}33`, borderRadius:4, padding:"3px 8px", fontSize:11, cursor:"pointer" }}
                                      >
                                        {isOrderItemsExpanded ? "Hide" : "Items"}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Inner Items Table */}
                                  {isOrderItemsExpanded && orderItems[o.id] && (
                                    <div style={{ marginTop:8, background: COLORS.ivoryDeep+"55", borderRadius:6, padding:8 }}>
                                      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11.5 }}>
                                        <thead>
                                          <tr style={{ borderBottom:`1px solid ${COLORS.charcoalSoft}22`, textAlign:"left" }}>
                                            <th style={{ padding:"3px 0", color: COLORS.charcoalSoft, fontWeight:500 }}>Item</th>
                                            <th style={{ padding:"3px 6px", color: COLORS.charcoalSoft, fontWeight:500, textAlign:"center" }}>Qty</th>
                                            <th style={{ padding:"3px 0", color: COLORS.charcoalSoft, fontWeight:500, textAlign:"right" }}>Rate</th>
                                            <th style={{ padding:"3px 0 3px 6px", color: COLORS.charcoalSoft, fontWeight:500, textAlign:"right" }}>Amount</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {orderItems[o.id].map((item, i) => (
                                            <tr key={i} style={{ borderBottom:`1px solid ${COLORS.charcoalSoft}11` }}>
                                              <td style={{ padding:"4px 0", color: COLORS.charcoal }}>{item.item_name}</td>
                                              <td style={{ padding:"4px 6px", color: COLORS.charcoalSoft, textAlign:"center" }}>{item.quantity}</td>
                                              <td style={{ padding:"4px 0", color: COLORS.charcoal, textAlign:"right" }}>₹{item.price_w}</td>
                                              <td style={{ padding:"4px 0 4px 6px", color: COLORS.charcoal, textAlign:"right" }}>₹{(item.price_w * item.quantity).toLocaleString("en-IN")}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "offers" && (
        <div>
          {/* DISCOUNT CODE MANAGER */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:18 }}>🏷️</span>
              <h3 style={{ fontFamily:"var(--serif)", fontSize:16.5, color: COLORS.charcoal, margin:0 }}>Discount codes</h3>
            </div>
            <button onClick={() => setShowDiscountForm(!showDiscountForm)}
              style={{ background: COLORS.indigo, color: COLORS.cream, border:"none", padding:"7px 14px", borderRadius:8, fontSize:12.5, cursor:"pointer", fontFamily:"var(--sans)" }}>
              {showDiscountForm ? "Cancel" : "+ New code"}
            </button>
          </div>

          {showDiscountForm && (
            <div style={{ background: COLORS.cream, border:`1px solid ${COLORS.charcoalSoft}22`, borderRadius:12, padding:"18px 20px", marginBottom:16 }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))", gap:12 }}>
                {[
                  ["Code", dcCode, setDcCode, "e.g. SAVE20", "text"],
                  ["Description", dcDesc, setDcDesc, "e.g. Welcome discount", "text"],
                  ["Value", dcValue, setDcValue, "e.g. 10", "number"],
                  ["Min order (₹)", dcMin, setDcMin, "e.g. 500", "number"],
                  ["Max uses", dcMaxUses, setDcMaxUses, "blank = unlimited", "number"],
                  ["Valid until", dcExpiry, setDcExpiry, "", "date"],
                ].map(([label, val, setter, ph, type]) => (
                  <div key={label}>
                    <label style={{ fontSize:11.5, color: COLORS.charcoalSoft, display:"block", marginBottom:4 }}>{label}</label>
                    <input type={type} value={val} onChange={e => setter(type === "text" && label === "Code" ? e.target.value.toUpperCase() : e.target.value)}
                      placeholder={ph}
                      style={{ width:"100%", background: COLORS.ivoryDeep, border:"none", borderRadius:7, padding:"8px 10px", fontSize:13, color: COLORS.charcoal, fontFamily:"var(--sans)", outline:"none" }}/>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:12 }}>
                <label style={{ fontSize:11.5, color: COLORS.charcoalSoft, marginRight:12 }}>Type:</label>
                <label style={{ fontSize:13, color: COLORS.charcoal, marginRight:16, cursor:"pointer" }}>
                  <input type="radio" value="percentage" checked={dcType==="percentage"} onChange={() => setDcType("percentage")} style={{ marginRight:5 }}/>
                  Percentage (%)
                </label>
                <label style={{ fontSize:13, color: COLORS.charcoal, cursor:"pointer" }}>
                  <input type="radio" value="flat" checked={dcType==="flat"} onChange={() => setDcType("flat")} style={{ marginRight:5 }}/>
                  Flat amount (₹)
                </label>
              </div>
              <button onClick={saveDiscountCode} disabled={savingCode || !dcCode || !dcValue}
                style={{ marginTop:14, background: COLORS.indigo, color: COLORS.cream, border:"none", padding:"9px 18px", borderRadius:8, fontSize:13, cursor:"pointer", fontFamily:"var(--sans)" }}>
                {savingCode ? "Saving…" : "Save code"}
              </button>
            </div>
          )}

          {discountCodes.length > 0 && (
            <div style={{ background: COLORS.cream, border:`1px solid ${COLORS.charcoalSoft}22`, borderRadius:12, overflow:"auto", marginBottom:24 }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, fontFamily:"var(--sans)" }}>
                <thead>
                  <tr style={{ background: COLORS.ivoryDeep, textAlign:"left" }}>
                    {["Code","Type","Value","Min order","Used / Max","Expires","Status"].map(h => (
                      <th key={h} style={{ padding:"10px 14px", fontWeight:500, color: COLORS.charcoalSoft, whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {discountCodes.map((c, i) => (
                    <tr key={c.id} style={{ borderTop: i===0?"none":`1px solid ${COLORS.charcoalSoft}18` }}>
                      <td style={{ padding:"10px 14px", color: COLORS.charcoal, fontWeight:600 }}>{c.code}</td>
                      <td style={{ padding:"10px 14px", color: COLORS.charcoalSoft }}>{c.discount_type}</td>
                      <td style={{ padding:"10px 14px", color: COLORS.charcoal }}>{c.discount_type==="percentage" ? `${c.discount_value}%` : `₹${c.discount_value}`}</td>
                      <td style={{ padding:"10px 14px", color: COLORS.charcoalSoft }}>₹{c.min_order_value}</td>
                      <td style={{ padding:"10px 14px", color: COLORS.charcoalSoft }}>{c.times_used} / {c.max_uses ?? "∞"}</td>
                      <td style={{ padding:"10px 14px", color: COLORS.charcoalSoft }}>{c.valid_until ? new Date(c.valid_until).toLocaleDateString("en-IN") : "No expiry"}</td>
                      <td style={{ padding:"10px 14px" }}>
                        <button onClick={() => toggleCode(c.id, c.is_active)}
                          style={{ fontSize:11.5, background: c.is_active ? COLORS.sage+"22" : COLORS.madder+"22", color: c.is_active ? COLORS.sage : COLORS.madder, border:"none", padding:"3px 10px", borderRadius:12, cursor:"pointer", fontFamily:"var(--sans)" }}>
                          {c.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <ThreadDivider />
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <Package size={16} color={COLORS.indigo}/>
            <h3 style={{ fontFamily:"var(--serif)", fontSize:16.5, color: COLORS.charcoal, margin:0 }}>Inventory (from sheet)</h3>
          </div>
          <div style={{ background: COLORS.cream, border:`1px solid ${COLORS.charcoalSoft}22`, borderRadius:12, overflow:"auto", marginBottom:24 }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, fontFamily:"var(--sans)" }}>
              <thead>
                <tr style={{ background: COLORS.ivoryDeep, textAlign:"left" }}>
                  {["Item","Category","Variant / Size","Price (W)","MOQ","Current Stock"].map(h => (
                    <th key={h} style={{ padding:"10px 14px", fontWeight:500, color: COLORS.charcoalSoft }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.flatMap((product) =>
                  product.variants.map((v, vi) => (
                    <tr key={product.id + v.id} style={{ borderTop: `1px solid ${COLORS.charcoalSoft}18` }}>
                      <td style={{ padding:"10px 14px", color: COLORS.charcoal }}>{vi === 0 ? product.name : ""}</td>
                      <td style={{ padding:"10px 14px", color: COLORS.charcoalSoft }}>{vi === 0 ? product.category : ""}</td>
                      <td style={{ padding:"10px 14px", color: COLORS.charcoalSoft }}>{v.label !== product.name ? v.label : "—"}{v.size ? ` (${v.size})` : ""}</td>
                      <td style={{ padding:"10px 14px", color: COLORS.charcoal }}>₹{v.priceW}</td>
                      <td style={{ padding:"10px 14px", color: COLORS.charcoal }}>{v.moq}</td>
                      <td style={{ padding:"10px 14px" }}>
                        {v.stock === null ? <span style={{ color: COLORS.charcoalSoft, fontSize:12 }}>Not tracked</span>
                          : v.stock === 0 ? <span style={{ color: COLORS.madder, fontSize:12, fontWeight: 600 }}>Out of stock</span>
                          : v.stock < 15 ? <span style={{ color: COLORS.turmeric, fontSize:12, fontWeight: 600 }}>Low ({v.stock})</span>
                          : <span style={{ color: COLORS.sage, fontSize:12, fontWeight: 600 }}>{v.stock}</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "dispatch" && (
        <div style={{ background: COLORS.cream, border: `1px solid ${COLORS.charcoalSoft}22`, borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <MapPin size={20} color={COLORS.indigo} />
            <h3 style={{ fontFamily: "var(--serif)", fontSize: 18, color: COLORS.charcoal, margin: 0 }}>Dispatch Source Location Settings</h3>
          </div>
          <p style={{ color: COLORS.charcoalSoft, fontSize: 13, marginTop: -8, marginBottom: 20, lineHeight: 1.4 }}>
            Set your warehouse or shop's current coordinates. This serves as the dispatch origin point. We calculate the distance of the retailer's delivery address from this origin point to determine standard shipping charges (₹30 for distance over 7 km radius, FREE within 7 km).
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 12, color: COLORS.charcoalSoft, display: "block", marginBottom: 6, fontWeight: 500 }}>Warehouse / Dispatch Address Name</label>
              <input
                type="text"
                value={dispatchLocation.address}
                onChange={e => onUpdateDispatchLocation({ ...dispatchLocation, address: e.target.value })}
                placeholder="e.g. Jaipur Warehouse, Kota"
                style={{ width: "100%", background: COLORS.ivoryDeep, border: `1px solid ${COLORS.charcoalSoft}18`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, color: COLORS.charcoal, outline: "none" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.charcoalSoft, display: "block", marginBottom: 6, fontWeight: 500 }}>Latitude Coordinate</label>
              <input
                type="number"
                step="any"
                value={dispatchLocation.lat}
                onChange={e => onUpdateDispatchLocation({ ...dispatchLocation, lat: parseFloat(e.target.value) || 0 })}
                placeholder="e.g. 25.2138"
                style={{ width: "100%", background: COLORS.ivoryDeep, border: `1px solid ${COLORS.charcoalSoft}18`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, color: COLORS.charcoal, outline: "none", fontFamily: "var(--mono)" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.charcoalSoft, display: "block", marginBottom: 6, fontWeight: 500 }}>Longitude Coordinate</label>
              <input
                type="number"
                step="any"
                value={dispatchLocation.lng}
                onChange={e => onUpdateDispatchLocation({ ...dispatchLocation, lng: parseFloat(e.target.value) || 0 })}
                placeholder="e.g. 75.8648"
                style={{ width: "100%", background: COLORS.ivoryDeep, border: `1px solid ${COLORS.charcoalSoft}18`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, color: COLORS.charcoal, outline: "none", fontFamily: "var(--mono)" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <button
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      onUpdateDispatchLocation({
                        address: "Seller's Current Detected Location",
                        lat: Math.round(position.coords.latitude * 1000000) / 1000000,
                        lng: Math.round(position.coords.longitude * 1000000) / 1000000
                      });
                      alert("Successfully detected and updated your dispatch location to your current GPS coordinates!");
                    },
                    (error) => {
                      alert("Could not detect location automatically: " + error.message + ". Please enter coordinates manually.");
                    }
                  );
                } else {
                  alert("Geolocation is not supported by your browser.");
                }
              }}
              style={{ background: COLORS.indigo, color: COLORS.cream, border: "none", padding: "10px 18px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "var(--sans)", display: "flex", alignItems: "center", gap: 8, fontWeight: 500 }}
            >
              <MapPin size={15} />
              Detect My Current GPS Location
            </button>

          </div>
          
          <div style={{ marginTop: 20, padding: 14, background: `${COLORS.indigo}08`, borderRadius: 8, borderLeft: `4px solid ${COLORS.indigo}` }}>
            <div style={{ fontSize: 13, color: COLORS.indigo, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <ShieldCheck size={14} /> Active Settings Synced
            </div>
            <div style={{ fontSize: 12.5, color: COLORS.charcoal }}>
              Current Active Dispatch Address: <strong>{dispatchLocation.address}</strong> <span style={{ color: COLORS.charcoalSoft }}>(Coord: {dispatchLocation.lat}, {dispatchLocation.lng})</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === "footer_settings" && (
        <div style={{ background: COLORS.cream, border: `1px solid ${COLORS.charcoalSoft}22`, borderRadius: 12, padding: "20px 24px", marginBottom: 24, fontFamily: "var(--sans)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <FileText size={20} color={COLORS.indigo} />
            <h3 style={{ fontFamily: "var(--serif)", fontSize: 18, color: COLORS.charcoal, margin: 0 }}>Footer & Page Content Manager</h3>
          </div>
          <p style={{ color: COLORS.charcoalSoft, fontSize: 13, marginTop: -8, marginBottom: 20, lineHeight: 1.4 }}>
            Update the dynamic contents for the entire website's pages (About Us, Blogs, Terms, Return, Legal) and the business contact details shown in the minimal footer.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            
            {/* Section 1: Page Content Fields */}
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: COLORS.indigo, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${COLORS.charcoalSoft}15`, paddingBottom: 6 }}>
                1. Left Side Pages Content
              </h4>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12.5, color: COLORS.charcoal, display: "block", marginBottom: 6, fontWeight: 600 }}>About Us Page Content</label>
                  <textarea
                    value={localAboutUs}
                    onChange={e => setLocalAboutUs(e.target.value)}
                    placeholder="Describe Deetya Weaves, our heritage, our artisans, and our mission..."
                    rows={4}
                    style={{ width: "100%", background: COLORS.ivoryDeep, border: `1px solid ${COLORS.charcoalSoft}18`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, color: COLORS.charcoal, outline: "none", resize: "vertical", lineHeight: 1.5, fontFamily: "var(--sans)" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12.5, color: COLORS.charcoal, display: "block", marginBottom: 6, fontWeight: 600 }}>Blogs Page Content (Markdown-friendly)</label>
                  <textarea
                    value={localBlogs}
                    onChange={e => setLocalBlogs(e.target.value)}
                    placeholder="Use ### for headers to list articles or updates..."
                    rows={5}
                    style={{ width: "100%", background: COLORS.ivoryDeep, border: `1px solid ${COLORS.charcoalSoft}18`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, color: COLORS.charcoal, outline: "none", resize: "vertical", lineHeight: 1.5, fontFamily: "var(--sans)" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12.5, color: COLORS.charcoal, display: "block", marginBottom: 6, fontWeight: 600 }}>Terms & Conditions (Enter each terms rule on a new line)</label>
                  <textarea
                    value={localTerms}
                    onChange={e => setLocalTerms(e.target.value)}
                    placeholder="e.g. 1. MOQ is applicable...&#10;2. Prices are exclusive of GST..."
                    rows={4}
                    style={{ width: "100%", background: COLORS.ivoryDeep, border: `1px solid ${COLORS.charcoalSoft}18`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, color: COLORS.charcoal, outline: "none", resize: "vertical", lineHeight: 1.5, fontFamily: "var(--sans)" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12.5, color: COLORS.charcoal, display: "block", marginBottom: 6, fontWeight: 600 }}>Return Policy</label>
                  <textarea
                    value={localReturnPolicy}
                    onChange={e => setLocalReturnPolicy(e.target.value)}
                    placeholder="Specify exchange rules, defect timelines, and refund options..."
                    rows={4}
                    style={{ width: "100%", background: COLORS.ivoryDeep, border: `1px solid ${COLORS.charcoalSoft}18`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, color: COLORS.charcoal, outline: "none", resize: "vertical", lineHeight: 1.5, fontFamily: "var(--sans)" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12.5, color: COLORS.charcoal, display: "block", marginBottom: 6, fontWeight: 600 }}>Legal & Privacy Policy</label>
                  <textarea
                    value={localLegalPolicy}
                    onChange={e => setLocalLegalPolicy(e.target.value)}
                    placeholder="Specify legal jurisdiction, trade codes, and copyright rules..."
                    rows={4}
                    style={{ width: "100%", background: COLORS.ivoryDeep, border: `1px solid ${COLORS.charcoalSoft}18`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, color: COLORS.charcoal, outline: "none", resize: "vertical", lineHeight: 1.5, fontFamily: "var(--sans)" }}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Contact Information */}
            <div style={{ borderTop: `1px solid ${COLORS.charcoalSoft}15`, paddingTop: 18 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: COLORS.indigo, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5, borderBottom: `1px solid ${COLORS.charcoalSoft}15`, paddingBottom: 6 }}>
                2. Right Side Contact Info & Timing (Minimal Footer)
              </h4>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, color: COLORS.charcoalSoft, display: "block", marginBottom: 6, fontWeight: 500 }}>WhatsApp Number (for logo clicker)</label>
                  <input
                    type="text"
                    value={localContact.whatsapp || ""}
                    onChange={e => setLocalContact(prev => ({ ...prev, whatsapp: e.target.value }))}
                    placeholder="e.g. 919829012345"
                    style={{ width: "100%", background: COLORS.ivoryDeep, border: `1px solid ${COLORS.charcoalSoft}18`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, color: COLORS.charcoal, outline: "none" }}
                  />
                  <span style={{ fontSize: 10.5, color: COLORS.charcoalSoft, marginTop: 4, display: "block" }}>Include country code, no symbols (e.g. 919829012345)</span>
                </div>
                
                <div>
                  <label style={{ fontSize: 12, color: COLORS.charcoalSoft, display: "block", marginBottom: 6, fontWeight: 500 }}>Call / Phone Number</label>
                  <input
                    type="text"
                    value={localContact.phone || ""}
                    onChange={e => setLocalContact(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="e.g. +91 98290 12345"
                    style={{ width: "100%", background: COLORS.ivoryDeep, border: `1px solid ${COLORS.charcoalSoft}18`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, color: COLORS.charcoal, outline: "none" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, color: COLORS.charcoalSoft, display: "block", marginBottom: 6, fontWeight: 500 }}>Support timing & Hours</label>
                  <input
                    type="text"
                    value={localContact.timing || ""}
                    onChange={e => setLocalContact(prev => ({ ...prev, timing: e.target.value }))}
                    placeholder="e.g. Mon - Sat: 10:00 AM - 7:00 PM"
                    style={{ width: "100%", background: COLORS.ivoryDeep, border: `1px solid ${COLORS.charcoalSoft}18`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, color: COLORS.charcoal, outline: "none" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, color: COLORS.charcoalSoft, display: "block", marginBottom: 6, fontWeight: 500 }}>Email Address</label>
                  <input
                    type="email"
                    value={localContact.email || ""}
                    onChange={e => setLocalContact(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="e.g. contact@deetyaweaves.com"
                    style={{ width: "100%", background: COLORS.ivoryDeep, border: `1px solid ${COLORS.charcoalSoft}18`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, color: COLORS.charcoal, outline: "none" }}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 12, color: COLORS.charcoalSoft, display: "block", marginBottom: 6, fontWeight: 500 }}>Physical Business Address</label>
                  <input
                    type="text"
                    value={localContact.address || ""}
                    onChange={e => setLocalContact(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="e.g. Shop 24-B, Handloom Cluster, Jaipur, Rajasthan"
                    style={{ width: "100%", background: COLORS.ivoryDeep, border: `1px solid ${COLORS.charcoalSoft}18`, borderRadius: 8, padding: "10px 12px", fontSize: 13.5, color: COLORS.charcoal, outline: "none" }}
                  />
                </div>
              </div>
            </div>

          </div>

          <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", borderTop: `1px solid ${COLORS.charcoalSoft}15`, paddingTop: 20 }}>
            <button
              onClick={async () => {
                setSavingFooter(true);
                setFooterSuccess(false);
                try {
                  await onUpdateFooterSettings({
                    aboutUs: localAboutUs,
                    blogs: localBlogs,
                    termsAndConditions: localTerms,
                    returnPolicy: localReturnPolicy,
                    legalPolicy: localLegalPolicy,
                    contactInfo: localContact
                  });
                  setFooterSuccess(true);
                  setTimeout(() => setFooterSuccess(false), 4000);
                } catch (e) {
                  alert("Error saving: " + e.message);
                } finally {
                  setSavingFooter(false);
                }
              }}
              disabled={savingFooter}
              style={{ background: COLORS.indigo, color: COLORS.cream, border: "none", padding: "12px 24px", borderRadius: 8, fontSize: 13.5, cursor: "pointer", fontFamily: "var(--sans)", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}
            >
              {savingFooter ? "Saving All Settings…" : "Save Changes"}
            </button>
            
            {footerSuccess && (
              <span style={{ fontSize: 13, color: COLORS.sage, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                <CheckCircle2 size={15} /> All pages & footer content successfully updated and live!
              </span>
            )}
          </div>
        </div>
      )}

      <div style={{ textAlign:"center", marginTop:40, fontSize:11, color: COLORS.charcoalSoft+"99" }}>
        © Guru Kripa Traders · All rights reserved
      </div>
    </div>
  );
}

// =============================================
// GLOBAL FOOTER COMPONENT
// =============================================
// =============================================
// ARTICLE PAGE COMPONENT (For footer dynamic content)
// =============================================
function formatArticleContent(text) {
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

function ArticlePage({ title, content, onBack }) {
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

function GlobalFooter({ systemFooter, onNavigate }) {
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
// ADMIN / SELLER LOGIN SCREEN (Dedicated Separate Entity Feel)
// =============================================
function AdminLoginScreen({ onLogin, onBackToCatalog }) {
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
  const [showQuickLogin, setShowQuickLogin] = useState(false);
  const [toast, setToast] = useState(null); // { message, type }
  const showToast = (message, type = "success") => setToast({ message, type });
  const filterConfig = useFilterSettings();

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
  const [cart, setCart] = useState({});
  const [viewingCart, setViewingCart] = useState(initialRoute.cart);

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

  const handleGoToAdmin = () => {
    setIsAdminPath(true);
    try { window.history.pushState({}, "", "/admin"); } catch {}
  };

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
              <button onClick={() => { setAccount(null); setActivePage("catalog"); setViewingCart(false); try { localStorage.removeItem("deetya_account"); } catch {} if (isAdmin) handleBackToCatalog(); }}
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
