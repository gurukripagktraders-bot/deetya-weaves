import React, { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle, CheckCircle2, Plus, Minus,
  ShoppingBag, ChevronRight, Clock, ChevronLeft, ChevronDown, X,
} from "lucide-react";
import { COLORS } from "../lib/config.js";
import { supabase } from "../lib/db.js";
import { calculateDistance } from "../lib/helpers.js";
import { ThreadDivider, WeavingProgress, ImageWithFallback } from "./ui/atoms.jsx";
import ProductPanel from "./ProductPanel.jsx";
import CartPage from "./CartPage.jsx";

// RETAILER CATALOG VIEW
// =============================================
export default function RetailerView({
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
  debouncedSearch: propsDebouncedSearch,
  showToast,
}) {
  const { items, loading: sheetLoading, usingSample } = sheetData;
  const [localCart, setLocalCart] = useState({});
  const cart = propsCart !== undefined ? propsCart : localCart;
  const setCart = propsSetCart !== undefined ? propsSetCart : setLocalCart;

  const [selectedVariant, setSelectedVariant] = useState({});
  const [localSearch, setLocalSearch] = useState("");
  const search = propsSearch !== undefined ? propsSearch : localSearch;
  const debouncedSearch = propsDebouncedSearch !== undefined ? propsDebouncedSearch : search;
  const setSearch = propsSetSearch !== undefined ? propsSetSearch : setLocalSearch;
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [category, setCategory] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("category") || "All"; } catch { return "All"; }
  });
  const [sortBy, setSortBy] = useState("price_asc"); // default | price_asc | price_desc | name_asc | weight_asc
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [subcategoryFilter, setSubcategoryFilter] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("subcategory") || ""; } catch { return ""; }
  });

  // --- URL / browser-history sync for category, subcategory, and the open
  // product panel. These three are kept in sync together (not as separate
  // effects) so they can't race or double-push against each other.
  //
  // - Selecting a category/subcategory, or opening a product, PUSHES a new
  //   history entry — so the back button undoes one step at a time, the way
  //   people expect. (An earlier version of this used replaceState, which
  //   meant there was nothing for "back" to undo, so on mobile it exited
  //   the site entirely after just one selection, and on desktop it took
  //   several presses to get anywhere since most "steps" weren't real
  //   history entries at all.)
  // - Pressing back/forward re-reads the URL and restores all three pieces
  //   of state together, so the visible category/subcategory/product
  //   actually changes when you navigate — not just the URL bar.
  const isPoppingRef = React.useRef(false);
  const isFirstUrlSyncRef = React.useRef(true);
  // If the page loaded with a ?product= param, hold off syncing state back
  // to the URL until that's been resolved — otherwise the sync effect below
  // can wipe the param out before the async restoration (which waits for
  // the real catalog to load) ever gets a chance to read it.
  const pendingRestoreRef = React.useRef(
    (() => { try { return !!new URLSearchParams(window.location.search).get("product"); } catch { return false; } })()
  );

  const applyStateFromUrl = React.useCallback(() => {
    isPoppingRef.current = true;
    try {
      const params = new URLSearchParams(window.location.search);
      setCategory(params.get("category") || "All");
      setSubcategoryFilter(params.get("subcategory") || "");
      const productId = params.get("product");
      if (productId && items && items.length > 0) {
        const found = items.find((p) => p.id === productId);
        setSelectedProduct(found || null);
      } else if (!productId) {
        setSelectedProduct(null);
      }
    } catch {}
  }, [items]);

  useEffect(() => {
    window.addEventListener("popstate", applyStateFromUrl);
    return () => window.removeEventListener("popstate", applyStateFromUrl);
  }, [applyStateFromUrl]);

  // Restore a product from the URL on initial load too (e.g. a refresh, or
  // a shared product link) — not just on back/forward. Waits for the real
  // catalog (not the placeholder sample data) before trying to match the id.
  const restoredOnLoadRef = React.useRef(false);
  useEffect(() => {
    if (restoredOnLoadRef.current || usingSample || !items || items.length === 0) return;
    restoredOnLoadRef.current = true;
    if (pendingRestoreRef.current) applyStateFromUrl();
    pendingRestoreRef.current = false;
  }, [items, usingSample, applyStateFromUrl]);

  useEffect(() => {
    if (pendingRestoreRef.current) return; // don't touch the URL until the line above resolves
    if (isPoppingRef.current) { isPoppingRef.current = false; return; }
    try {
      const params = new URLSearchParams(window.location.search);
      if (category && category !== "All") params.set("category", category); else params.delete("category");
      if (subcategoryFilter) params.set("subcategory", subcategoryFilter); else params.delete("subcategory");
      if (selectedProduct) params.set("product", selectedProduct.id); else params.delete("product");
      const newSearch = params.toString();
      const newUrl = `${window.location.pathname}${newSearch ? "?" + newSearch : ""}${window.location.hash}`;
      if (newUrl === window.location.pathname + window.location.search + window.location.hash) return;
      if (isFirstUrlSyncRef.current) {
        // Initial mount: the URL already reflects this state (that's where
        // we read it from) — replace rather than push, so simply loading
        // the page doesn't create a phantom back-button step.
        isFirstUrlSyncRef.current = false;
        window.history.replaceState({}, "", newUrl);
      } else {
        window.history.pushState({}, "", newUrl);
      }
    } catch {}
  }, [category, subcategoryFilter, selectedProduct]);

  // On some mobile browsers, the very first history entry when a page loads
  // isn't itself a landable "back" target — once the user backs past their
  // last real click, there's nothing left except exiting the site. Pushing
  // one duplicate "anchor" entry right on load gives the back button a real
  // step to land on, so backing out of a category/product lands on the
  // catalog home instead of exiting.
  const anchorPushedRef = React.useRef(false);
  useEffect(() => {
    if (anchorPushedRef.current) return;
    anchorPushedRef.current = true;
    try {
      const currentUrl = window.location.pathname + window.location.search + window.location.hash;
      window.history.pushState({ anchor: true }, "", currentUrl);
    } catch {}
  }, []);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const [expandedMobileCategories, setExpandedMobileCategories] = useState({});
  const [currentPage, setCurrentPage] = useState(1);

  // Without this, clicking "Next" at the bottom of the page loads new
  // products but leaves the scroll position where it was — so the user
  // stays scrolled near the bottom, which on the new page of products
  // often lines up with the site footer instead of the product grid.
  const isFirstPageRender = React.useRef(true);
  useEffect(() => {
    if (isFirstPageRender.current) { isFirstPageRender.current = false; return; }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage]);
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

  // GST calculation — priceW from the sheet is GST-INCLUSIVE (the final
  // selling price), so gstAmount below is the tax portion *within* that
  // price for invoice/record purposes. It is not added on top of the total.
  const gstAmountBeforeDiscount = cartEntries.reduce((sum, [key, qty]) => {
    const [productId, variantId] = key.split("__");
    const product = items.find(p => p.id === productId);
    const variant = product?.variants.find(v => v.id === variantId);
    if (!variant) return sum;
    const gstPct = variant.gstPct || product?.gstPct || 5;
    const inclusiveLineTotal = variant.priceW * qty;
    const baseLineTotal = inclusiveLineTotal / (1 + gstPct / 100);
    return sum + (inclusiveLineTotal - baseLineTotal);
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
  // taxableAmount already has GST baked in (it comes straight from the
  // sheet's GST-inclusive price), so gstAmount is informational only here —
  // it is NOT added again.
  const cartTotal = taxableAmount + deliveryFee;

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
    if (usingSample) {
      setError("The product catalog couldn't be loaded right now, so what you're seeing isn't live inventory or pricing. Please try again in a few minutes — orders can't be placed while this is showing.");
      return;
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
          Awaiting seller confirmation · {paymentType === "COD" ? "Cash on delivery" : "Paid via bank/QR"} · Prices excluding GST (Tax & Shipping Applied)
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
      {usingSample && (
        <div style={{
          background: `${COLORS.madder}12`, border: `1.5px solid ${COLORS.madder}44`, borderRadius: 10,
          padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <AlertTriangle size={16} color={COLORS.madder} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, color: COLORS.charcoal, lineHeight: 1.5 }}>
            <strong style={{ color: COLORS.madder }}>We're having trouble loading the live catalog.</strong>{" "}
            The products below are placeholder examples, not real inventory or pricing — please check back
            shortly. Orders can't be placed while this message is showing.
          </div>
        </div>
      )}
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
                      <ImageWithFallback src={product.photo} alt={product.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
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
                      <ImageWithFallback src={product.photo} alt={product.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
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
                  <ImageWithFallback src={product.photo} alt={product.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} iconSize={22} />
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
