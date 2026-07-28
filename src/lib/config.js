// =============================================
// CONFIGURATION — Replace with your Supabase details
// Go to Supabase → Project Settings → API
// =============================================
export const SUPABASE_URL = "https://jcdcfzkdddqgemlgtcxe.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZGNmemtkZGRxZ2VtbGd0Y3hlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4ODI4NzgsImV4cCI6MjA5ODQ1ODg3OH0.43wN6LH7-4F5D0tALxrRHge7BQhsVCK1bs5IVTDFxME";

export const DEFAULT_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQUtvYNbIkmNe5WyOBVo5B1O5mxl8YY8Wt4IS0nzsD1Lnao9nKP23UWadAm8gAF4RbftwNnSAwQk5nc/pub?output=csv";

export const MOCK_OTP = "1234"; // Replace with real SMS OTP service later
// Admin/seller access is now via Google Sign-In (Supabase Auth) instead of a
// shared PIN. Only these email addresses are allowed into the admin/seller
// dashboard — add every email that should have access. This is a first line
// of defense on the client; the real enforcement lives in your Supabase RLS
// policies (see the RLS setup notes you were given separately).
export const ADMIN_EMAILS = [
  "gurukripa.gktraders@gmail.com",
];

export const COLORS = {
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

export const STAGES = ["Pending", "Confirmed", "Packed", "Out for delivery", "Delivered"];
export const GST_RATE = 5; // % — handloom cotton textile rate in India
export const SYNC_INTERVAL_MS = 3 * 60 * 1000;
export const SAMPLE_CSV = `Item,Category,Variant,MOQ,Size,Weight,Price,Photo Link,Stock Avail
Khushi Uniform,Towel Choka,Parent,5,20*47,438,87.15,,
A1 Diamond,Towel Choka,Parent,5,20*44,440,88.2,,
Hero Chex,Towel Choka,Parent,5,23*51,530,102.9,,
Sri Shakti Chex,Towel Choka,Parent,5,24*53,690,123,,
Sri Shakti Uniform,Towel Choka,Child,5,24*53,690,123,,
Bombay Dyeing Chex,Towel Choka,Parent,5,26*54,680,140,,
Bombay Dyeing Jacquard,Towel Choka,Child,5,26*54,680,140,,`;

