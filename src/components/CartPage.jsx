import React, { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft, MapPin, Truck, Wallet, Copy, CreditCard, CheckCircle2,
  AlertTriangle, Sparkles, Trash2, ShoppingBag, Plus, Minus, ArrowRight
} from "lucide-react";
import { ImageWithFallback } from "./ui/atoms.jsx";

import { COLORS } from "../lib/config.js";
import {
  getStateFromPincode,
  parseDetailedAddress,
  formatDetailedAddress,
  getHumanReadableAddress,
} from "../lib/address.js";
import { calculateDistance } from "../lib/helpers.js";

export default function CartPage({
  cart,
  items,
  account,
  onBack,
  subtotal,
  discountAmount,
  couponCode,
  setCouponCode,
  couponResult,
  setCouponResult,
  applyingCoupon,
  applyCoupon,
  gstAmount,
  cartTotal,
  paymentType,
  setPaymentType,
  placeOrder,
  placing,
  error,
  setQty,
  onAccountUpdated,
  onShowLogin,
  dispatchLocation,
  retailerLocation,
  setRetailerLocation,
  deliveryFee,
  activeDistance,
  myOrders,
  supabase
}) {
  const [checkoutStep, setCheckoutStep] = useState(1); // 1 = Review Cart & Suggestions, 2 = Shipping, Payment & Summary
  const [cartAddrLine1, setCartAddrLine1] = useState("");
  const [cartAddrLine2, setCartAddrLine2] = useState("");
  const [cartAddrLandmark, setCartAddrLandmark] = useState("");
  const [cartAddrPincode, setCartAddrPincode] = useState("");
  const [cartAddrCity, setCartAddrCity] = useState("");
  const [cartAddrState, setCartAddrState] = useState("Rajasthan");
  const [isEditingAddress, setIsEditingAddress] = useState(!account?.address);
  const [isAddressConfirmed, setIsAddressConfirmed] = useState(!!account?.address);
  const [addressError, setAddressError] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [copied, setCopied] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationMsg, setLocationMsg] = useState("");
  
  const [suggestedPromoCodes, setSuggestedPromoCodes] = useState([]);
  const [loadingPromoCodes, setLoadingPromoCodes] = useState(false);
  const [previouslyOrderedItemNames, setPreviouslyOrderedItemNames] = useState([]);

  // Scroll to the top of the page upon mounting or changing steps
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [checkoutStep]);

  useEffect(() => {
    const loadPromoCodes = async () => {
      setLoadingPromoCodes(true);
      try {
        const data = await supabase("discount_codes?is_active=eq.true&select=*");
        setSuggestedPromoCodes(data || []);
      } catch (e) {
        console.error("Could not load promo codes:", e);
      } finally {
        setLoadingPromoCodes(false);
      }
    };
    loadPromoCodes();
  }, [supabase]);

  // Sync state with account updates
  useEffect(() => {
    if (account?.address) {
      const parsed = parseDetailedAddress(account.address);
      setCartAddrLine1(parsed.line1 || "");
      setCartAddrLine2(parsed.line2 || "");
      setCartAddrLandmark(parsed.landmark || "");
      setCartAddrPincode(parsed.pincode || "");
      setCartAddrCity(parsed.city || "");
      setCartAddrState(parsed.state || "Rajasthan");
      setIsEditingAddress(false);
      setIsAddressConfirmed(true);
    } else {
      setIsEditingAddress(true);
      setIsAddressConfirmed(false);
    }
  }, [account]);

  // Fetch historically ordered items to generate smart suggested items
  useEffect(() => {
    const fetchHistory = async () => {
      if (!account || !myOrders || myOrders.length === 0) return;
      try {
        const orderIds = myOrders.map(o => o.id);
        const allItems = await supabase("order_items?select=*");
        if (allItems && allItems.length > 0) {
          const matching = allItems.filter(item => orderIds.includes(item.order_id));
          const names = [...new Set(matching.map(item => item.item_name))];
          setPreviouslyOrderedItemNames(names);
        }
      } catch (e) {
        console.error("Error loading previously ordered items:", e);
      }
    };
    fetchHistory();
  }, [account, myOrders, supabase]);

  const cartEntries = Object.entries(cart).filter(([, qty]) => qty > 0);

  // Suggested Items based on Previous Orders
  const suggestedBasedOnHistory = useMemo(() => {
    if (previouslyOrderedItemNames.length === 0) {
      // Fallback: Return first 4 items from the catalog if no past orders
      return items.slice(0, 4);
    }
    // Filter catalog items that match previously ordered names
    const matched = items.filter(p => 
      previouslyOrderedItemNames.some(name => 
        p.name.toLowerCase().includes(name.toLowerCase()) ||
        p.variants.some(v => v.label.toLowerCase().includes(name.toLowerCase()))
      )
    );
    // Pad with first available items if matched list has less than 4 items
    if (matched.length < 4) {
      const ids = new Set(matched.map(m => m.id));
      const remaining = items.filter(p => !ids.has(p.id));
      return [...matched, ...remaining].slice(0, 4);
    }
    return matched.slice(0, 4);
  }, [items, previouslyOrderedItemNames]);

  // Bestsellers Carousel items
  const bestsellerSuggestions = useMemo(() => {
    const filteredBest = items.filter(p => p.isBestseller);
    return filteredBest.length > 0 ? filteredBest.slice(0, 4) : items.slice(4, 8);
  }, [items]);

  // Suggested Items NOT already in the cart (prioritizing history and bestsellers)
  const suggestedItemsForCart = useMemo(() => {
    const cartProductIds = new Set(cartEntries.map(([key]) => key.split("__")[0]));
    const itemsNotInCart = items.filter(p => !cartProductIds.has(p.id));
    
    // First, try to get from previous orders
    let recommended = itemsNotInCart.filter(p => 
      previouslyOrderedItemNames.some(name => 
        p.name.toLowerCase().includes(name.toLowerCase()) ||
        p.variants.some(v => v.label.toLowerCase().includes(name.toLowerCase()))
      )
    );
    
    // Include bestsellers not in cart
    const bestsellersNotInCart = itemsNotInCart.filter(p => p.isBestseller && !recommended.some(r => r.id === p.id));
    recommended = [...recommended, ...bestsellersNotInCart];
    
    // Fallback if less than 6
    if (recommended.length < 6) {
      const remaining = itemsNotInCart.filter(p => !recommended.some(r => r.id === p.id));
      recommended = [...recommended, ...remaining];
    }
    
    return recommended.slice(0, 6);
  }, [items, cartEntries, previouslyOrderedItemNames]);

  // Similar Items based on items currently in the cart
  const similarItemsForCart = useMemo(() => {
    const cartProductIds = new Set(cartEntries.map(([key]) => key.split("__")[0]));
    const cartItems = items.filter(p => cartProductIds.has(p.id));
    const cartCategories = new Set(cartItems.map(p => p.category));
    
    const itemsNotInCart = items.filter(p => !cartProductIds.has(p.id));
    let similar = itemsNotInCart.filter(p => cartCategories.has(p.category));
    
    // Fallback if less than 6
    if (similar.length < 6) {
      const remaining = itemsNotInCart.filter(p => !similar.some(s => s.id === p.id));
      similar = [...similar, ...remaining];
    }
    
    return similar.slice(0, 6);
  }, [items, cartEntries]);

  const handleSaveAddress = async () => {
    if (!cartAddrLine1.trim()) {
      setAddressError("Address Line 1 is mandatory.");
      return;
    }
    if (!cartAddrCity.trim()) {
      setAddressError("City is mandatory.");
      return;
    }
    if (!cartAddrPincode.trim()) {
      setAddressError("Pincode is mandatory.");
      return;
    }
    if (!/^\d{6}$/.test(cartAddrPincode.trim())) {
      setAddressError("Please enter a valid 6-digit Pincode.");
      return;
    }
    setSavingAddress(true);
    setAddressError("");

    const formattedAddr = formatDetailedAddress({
      line1: cartAddrLine1.trim(),
      line2: cartAddrLine2.trim(),
      landmark: cartAddrLandmark.trim(),
      city: cartAddrCity.trim(),
      state: cartAddrState.trim(),
      pincode: cartAddrPincode.trim()
    });

    try {
      await supabase(`retailers?id=eq.${account.id}`, "PATCH", {
        address: formattedAddr
      });
      const updated = { ...account, address: formattedAddr };
      if (onAccountUpdated) onAccountUpdated(updated);
      setIsEditingAddress(false);
      setIsAddressConfirmed(true);
    } catch (e) {
      console.error("Error saving address:", e);
      const updated = { ...account, address: formattedAddr };
      if (onAccountUpdated) onAccountUpdated(updated);
      setIsEditingAddress(false);
      setIsAddressConfirmed(true);
    } finally {
      setSavingAddress(false);
    }
  };

  const handleCopyBankDetails = () => {
    const details = `Bank: HDFC Bank\nAccount Name: Deetya Weaves Wholesale\nAccount No: 50200084719273\nIFSC Code: HDFC0000125\nUPI ID: deetyaweaves@upi`;
    try {
      navigator.clipboard.writeText(details);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Render Section — EMPTY CART
  if (cartEntries.length === 0) {
    return (
      <div style={{ padding: "8px 0" }}>
        {/* Header navigation */}
        <button
          onClick={onBack}
          style={{
            color: COLORS.indigo,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 20,
            fontFamily: "var(--sans)",
            padding: "8px 14px",
            borderRadius: 8,
            background: COLORS.cream,
            border: `1.5px solid ${COLORS.charcoalSoft}15`
          }}
        >
          <ChevronLeft size={15} /> Continue Shopping
        </button>

        {/* Empty state visual block */}
        <div style={{
          textAlign: "center",
          padding: "48px 24px",
          background: COLORS.cream,
          borderRadius: 16,
          border: `2px dashed ${COLORS.charcoalSoft}22`,
          marginBottom: 32
        }}>
          <div style={{ display: "inline-flex", padding: 16, borderRadius: "50%", background: `${COLORS.indigo}10`, color: COLORS.indigo, marginBottom: 16 }}>
            <ShoppingBag size={32} />
          </div>
          <h2 style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 22, color: COLORS.indigo, margin: "0 0 8px 0", fontWeight: 700 }}>No items added in your cart</h2>
          <p style={{ fontSize: 14, color: COLORS.charcoalSoft, maxWidth: 440, margin: "0 auto 20px auto", lineHeight: 1.5 }}>
            Look around our wholesale handlooms, towel series, and cotton fabrics to load your cargo!
          </p>
          <button
            onClick={onBack}
            style={{
              background: COLORS.indigo,
              color: COLORS.cream,
              border: "none",
              padding: "10px 20px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--sans)"
            }}
          >
            Browse Wholesale Catalog
          </button>
        </div>

        {/* recommendation grid: Smart suggestions based on history */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Sparkles size={18} color={COLORS.turmeric} />
            <h3 style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 18, color: COLORS.indigo, margin: 0, fontWeight: 700 }}>
              {previouslyOrderedItemNames.length > 0 ? "Based on Your Previous Orders" : "Suggested Wholesale Additions"}
            </h3>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            {suggestedBasedOnHistory.map((p) => {
              const defaultVariant = p.variants[0];
              const minPrice = defaultVariant?.priceW || 0;
              return (
                <div key={p.id} style={{ background: COLORS.cream, border: `1.5px solid ${COLORS.charcoalSoft}15`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 12 }} className="product-card">
                  <div>
                    <div style={{ height: 110, borderRadius: 8, overflow: "hidden", background: COLORS.ivoryDeep, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                      <ImageWithFallback src={p.photo} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" iconSize={22} />
                    </div>
                    <span style={{ fontSize: 9.5, background: `${COLORS.indigo}15`, color: COLORS.indigo, padding: "2px 6px", borderRadius: 4, fontWeight: 600, textTransform: "uppercase" }}>
                      {p.category}
                    </span>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: COLORS.charcoal, marginTop: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", height: 38 }} title={p.name}>
                      {p.name}
                    </h4>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.indigo, marginTop: 4 }}>
                      ₹{minPrice.toLocaleString("en-IN")} <span style={{ fontSize: 10, fontWeight: 400, color: COLORS.charcoalSoft }}>/ pc</span>
                    </p>
                    <p style={{ fontSize: 10, color: COLORS.charcoalSoft, marginTop: 2 }}>
                      Min MOQ: {defaultVariant?.moq || 12} pcs
                    </p>
                  </div>

                  <button
                    onClick={() => defaultVariant && setQty(p, defaultVariant, 1)}
                    style={{
                      width: "100%",
                      background: COLORS.indigo,
                      color: COLORS.cream,
                      border: "none",
                      padding: "8px",
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "var(--sans)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4
                    }}
                  >
                    + Add to Cart
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* recommendation grid: Bestsellers */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 14 }}>⭐</span>
            <h3 style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 18, color: COLORS.indigo, margin: 0, fontWeight: 700 }}>
              Featured Bestsellers
            </h3>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            {bestsellerSuggestions.map((p) => {
              const defaultVariant = p.variants[0];
              const minPrice = defaultVariant?.priceW || 0;
              return (
                <div key={p.id} style={{ background: COLORS.cream, border: `1.5px solid ${COLORS.charcoalSoft}15`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 12 }} className="product-card">
                  <div>
                    <div style={{ height: 110, borderRadius: 8, overflow: "hidden", background: COLORS.ivoryDeep, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                      <ImageWithFallback src={p.photo} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" iconSize={22} />
                    </div>
                    <span style={{ fontSize: 9.5, background: `${COLORS.turmeric}15`, color: COLORS.turmeric, padding: "2px 6px", borderRadius: 4, fontWeight: 600, textTransform: "uppercase" }}>
                      BESTSELLER
                    </span>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: COLORS.charcoal, marginTop: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", height: 38 }} title={p.name}>
                      {p.name}
                    </h4>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.indigo, marginTop: 4 }}>
                      ₹{minPrice.toLocaleString("en-IN")} <span style={{ fontSize: 10, fontWeight: 400, color: COLORS.charcoalSoft }}>/ pc</span>
                    </p>
                    <p style={{ fontSize: 10, color: COLORS.charcoalSoft, marginTop: 2 }}>
                      Min MOQ: {defaultVariant?.moq || 12} pcs
                    </p>
                  </div>

                  <button
                    onClick={() => defaultVariant && setQty(p, defaultVariant, 1)}
                    style={{
                      width: "100%",
                      background: COLORS.indigo,
                      color: COLORS.cream,
                      border: "none",
                      padding: "8px",
                      borderRadius: 6,
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "var(--sans)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4
                    }}
                  >
                    + Add to Cart
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Render Section — STEP 1: SHOPPING CART REVIEW
  if (checkoutStep === 1) {
    return (
      <div style={{ padding: "8px 0" }}>
        {/* Header navigation bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <button
            onClick={onBack}
            style={{
              color: COLORS.indigo,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--sans)",
              padding: "8px 14px",
              borderRadius: 8,
              background: COLORS.cream,
              border: `1.5px solid ${COLORS.charcoalSoft}15`
            }}
          >
            <ChevronLeft size={15} /> Continue Shopping
          </button>

          <span style={{ fontSize: 12, color: COLORS.charcoalSoft, fontWeight: 500, fontFamily: "var(--sans)" }}>
            Step 1 of 2: Cart Items
          </span>
        </div>

        <h2 style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 24, color: COLORS.indigo, marginBottom: 20, fontWeight: 700 }}>
          Your Shopping Cart
        </h2>

        {/* Selected Items details box */}
        <div style={{ background: COLORS.cream, borderRadius: 12, border: `1.5px solid ${COLORS.charcoalSoft}18`, padding: "18px", marginBottom: 24 }}>
          <h3 style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 17, color: COLORS.indigo, marginBottom: 16, display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
            <ShoppingBag size={17} color={COLORS.indigo} /> Selected Items ({cartEntries.length})
          </h3>
          
          <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: "12px", scrollbarWidth: "thin" }}>
            {cartEntries.map(([key, qty]) => {
              const [productId, variantId] = key.split("__");
              const product = items.find(p => p.id === productId);
              const variant = product?.variants.find(v => v.id === variantId);
              if (!product || !variant) return null;

              const itemTotal = variant.priceW * qty;

              return (
                <div key={key} className="product-card" style={{
                  background: COLORS.cream,
                  border: `1px solid ${product.isBestseller ? COLORS.turmeric + "44" : `${COLORS.charcoalSoft}18`}`,
                  borderRadius: 16,
                  padding: 16,
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  width: 250,
                  minWidth: 250,
                  flexShrink: 0
                }}>
                  <div>
                    {product.isBestseller && (
                      <div style={{ position: "absolute", top: 12, left: 12, background: COLORS.turmeric, color: COLORS.cream, fontSize: 10, fontFamily: "var(--sans)", padding: "4px 10px", borderRadius: 20, fontWeight: 600, letterSpacing: 0.5, zIndex: 1, boxShadow: "0 2px 8px rgba(200, 147, 46, 0.2)" }}>⭐ BESTSELLER</div>
                    )}
                    <div className="image-zoom-container" style={{ width: "100%", aspectRatio: "4/3", borderRadius: 12, background: COLORS.ivoryDeep, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 12 }}>
                      <ImageWithFallback src={product.photo} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" iconSize={22} />
                    </div>
                    <div className="product-card-title" style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 15.5, color: COLORS.charcoal, fontWeight: 600, lineHeight: 1.35, minHeight: 42, display: "flex", alignItems: "flex-start" }}>{product.name}</div>
                    <div className="product-card-category" style={{ fontSize: 11.5, color: COLORS.charcoalSoft, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 500 }}>
                      {product.category}
                    </div>
                    <div style={{ fontSize: 11.5, color: COLORS.indigo, fontWeight: 600, marginTop: 8, background: `${COLORS.indigo}11`, padding: "4px 8px", borderRadius: 20, width: "fit-content" }}>
                      Variant: {variant.label}
                    </div>
                  </div>

                  <div style={{ borderTop: `1px solid ${COLORS.charcoalSoft}15`, marginTop: 12, paddingTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontFamily: "var(--sans)", fontSize: 17, color: COLORS.madder, fontWeight: 700 }}>₹{variant.priceW}</div>
                      <div style={{ fontSize: 11.5, color: COLORS.charcoalSoft }}>
                        Subtotal: <strong style={{ color: COLORS.indigo }}>₹{itemTotal.toLocaleString("en-IN")}</strong>
                      </div>
                    </div>
                    <div style={{ fontSize: 10.5, color: COLORS.charcoalSoft, marginTop: 4, marginBottom: 8 }}>
                      MOQ {variant.moq} pcs {variant.size ? `· ${variant.size} cm` : ""}{variant.weight ? `· ${variant.weight} g` : ""}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.ivoryDeep, borderRadius: 8, padding: "6px 8px", flex: 1 }}>
                        <button onClick={() => setQty(product, variant, -1)} style={{ border: "none", background: "transparent", cursor: "pointer", color: COLORS.indigo, display: "flex" }}><Minus size={15} /></button>
                        <span style={{ fontSize: 13.5, color: COLORS.charcoal, minWidth: 30, textAlign: "center", fontWeight: 600 }}>{qty}</span>
                        <button onClick={() => setQty(product, variant, 1)} style={{ border: "none", background: "transparent", cursor: "pointer", color: COLORS.indigo, display: "flex" }}><Plus size={15} /></button>
                      </div>
                      <button
                        onClick={() => setQty(product, variant, -qty / variant.moq)}
                        style={{
                          background: "transparent",
                          border: `1.5px solid ${COLORS.madder}33`,
                          color: COLORS.madder,
                          borderRadius: 8,
                          width: 36,
                          height: 36,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          transition: "all 0.15s ease"
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Suggested Items section */}
        {suggestedItemsForCart.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={16} color={COLORS.turmeric} />
                <h3 style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 16, color: COLORS.indigo, margin: 0, fontWeight: 700 }}>
                  Suggested Items
                </h3>
              </div>
              <span style={{ fontSize: 11, color: COLORS.charcoalSoft, fontWeight: 500 }}>
                Wholesale picks curated for you
              </span>
            </div>

            <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 10, scrollbarWidth: "thin" }}>
              {suggestedItemsForCart.map((p) => {
                const defaultVariant = p.variants[0];
                const minPrice = defaultVariant?.priceW || 0;
                return (
                  <div
                    key={p.id}
                    style={{
                      width: 170,
                      minWidth: 170,
                      background: COLORS.cream,
                      border: `1.5px solid ${COLORS.charcoalSoft}15`,
                      borderRadius: 12,
                      padding: 10,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 10,
                      flexShrink: 0
                    }}
                    className="product-card"
                  >
                    <div>
                      <div style={{ height: 95, borderRadius: 8, overflow: "hidden", background: COLORS.ivoryDeep, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                        <ImageWithFallback src={p.photo} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" iconSize={20} />
                      </div>
                      <span style={{ fontSize: 9, background: `${COLORS.indigo}12`, color: COLORS.indigo, padding: "1.5px 5px", borderRadius: 4, fontWeight: 600, textTransform: "uppercase", display: "inline-block" }}>
                        {p.category}
                      </span>
                      <h4 style={{ fontSize: 12, fontWeight: 600, color: COLORS.charcoal, marginTop: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", height: 32, lineHeight: 1.3 }} title={p.name}>
                        {p.name}
                      </h4>
                      <p style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.indigo, marginTop: 4, marginBottom: 0 }}>
                        ₹{minPrice.toLocaleString("en-IN")} <span style={{ fontSize: 9, fontWeight: 400, color: COLORS.charcoalSoft }}>/ pc</span>
                      </p>
                      <p style={{ fontSize: 9.5, color: COLORS.charcoalSoft, marginTop: 2, marginBottom: 0 }}>
                        Min MOQ: {defaultVariant?.moq || 12} pcs
                      </p>
                    </div>

                    <button
                      onClick={() => defaultVariant && setQty(p, defaultVariant, 1)}
                      style={{
                        width: "100%",
                        background: COLORS.indigo,
                        color: COLORS.cream,
                        border: "none",
                        padding: "6px 8px",
                        borderRadius: 6,
                        fontSize: 10.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "var(--sans)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4
                      }}
                    >
                      <Plus size={12} /> Add to Cart
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Similar Items section */}
        {similarItemsForCart.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShoppingBag size={16} color={COLORS.indigo} />
                <h3 style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 16, color: COLORS.indigo, margin: 0, fontWeight: 700 }}>
                  Similar Items
                </h3>
              </div>
              <span style={{ fontSize: 11, color: COLORS.charcoalSoft, fontWeight: 500 }}>
                From matching wholesale lines
              </span>
            </div>

            <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 10, scrollbarWidth: "thin" }}>
              {similarItemsForCart.map((p) => {
                const defaultVariant = p.variants[0];
                const minPrice = defaultVariant?.priceW || 0;
                return (
                  <div
                    key={p.id}
                    style={{
                      width: 170,
                      minWidth: 170,
                      background: COLORS.cream,
                      border: `1.5px solid ${COLORS.charcoalSoft}15`,
                      borderRadius: 12,
                      padding: 10,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 10,
                      flexShrink: 0
                    }}
                    className="product-card"
                  >
                    <div>
                      <div style={{ height: 95, borderRadius: 8, overflow: "hidden", background: COLORS.ivoryDeep, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                        <ImageWithFallback src={p.photo} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" iconSize={20} />
                      </div>
                      <span style={{ fontSize: 9, background: `${COLORS.indigo}12`, color: COLORS.indigo, padding: "1.5px 5px", borderRadius: 4, fontWeight: 600, textTransform: "uppercase", display: "inline-block" }}>
                        {p.category}
                      </span>
                      <h4 style={{ fontSize: 12, fontWeight: 600, color: COLORS.charcoal, marginTop: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", height: 32, lineHeight: 1.3 }} title={p.name}>
                        {p.name}
                      </h4>
                      <p style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.indigo, marginTop: 4, marginBottom: 0 }}>
                        ₹{minPrice.toLocaleString("en-IN")} <span style={{ fontSize: 9, fontWeight: 400, color: COLORS.charcoalSoft }}>/ pc</span>
                      </p>
                      <p style={{ fontSize: 9.5, color: COLORS.charcoalSoft, marginTop: 2, marginBottom: 0 }}>
                        Min MOQ: {defaultVariant?.moq || 12} pcs
                      </p>
                    </div>

                    <button
                      onClick={() => defaultVariant && setQty(p, defaultVariant, 1)}
                      style={{
                        width: "100%",
                        background: COLORS.indigo,
                        color: COLORS.cream,
                        border: "none",
                        padding: "6px 8px",
                        borderRadius: 6,
                        fontSize: 10.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "var(--sans)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4
                      }}
                    >
                      <Plus size={12} /> Add to Cart
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Subtotal summary and proceed button */}
        <div style={{ background: COLORS.ivoryDeep, borderRadius: 12, padding: "18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: COLORS.charcoalSoft }}>Cart Subtotal:</div>
            <strong style={{ fontSize: 18, color: COLORS.indigo }}>₹{subtotal.toLocaleString("en-IN")}</strong>
          </div>
          
          <button
            onClick={() => setCheckoutStep(2)}
            style={{
              background: COLORS.indigo,
              color: COLORS.cream,
              border: "none",
              padding: "12px 24px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--sans)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 12px rgba(43, 58, 85, 0.15)"
            }}
          >
            Proceed to Delivery & Payment <ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  // Render Section — STEP 2: SHIPPING, PAYMENT, ORDER SUMMARY & CONFIRM (NEW PAGE)
  return (
    <div style={{ padding: "8px 0" }}>
      {/* Step Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button
          onClick={() => setCheckoutStep(1)}
          style={{
            color: COLORS.indigo,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "var(--sans)",
            padding: "8px 14px",
            borderRadius: 8,
            background: COLORS.cream,
            border: `1.5px solid ${COLORS.charcoalSoft}15`
          }}
        >
          <ChevronLeft size={15} /> Back to Cart Items
        </button>

        <span style={{ fontSize: 12, color: COLORS.charcoalSoft, fontWeight: 500, fontFamily: "var(--sans)" }}>
          Step 2 of 2: Shipping & Payment Summary
        </span>
      </div>

      <h2 style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 24, color: COLORS.indigo, marginBottom: 20, fontWeight: 700 }}>
        Checkout details
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }} className="md:grid-cols-3">
        {/* Left Column (Address, Payment) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="md:col-span-2">
          
          {/* Delivery Address Section */}
          <div style={{ background: COLORS.cream, borderRadius: 12, border: `1.5px solid ${COLORS.charcoalSoft}18`, padding: "18px" }}>
            <h3 style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 17, color: COLORS.indigo, marginBottom: 12, display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
              <MapPin size={17} color={COLORS.indigo} /> Delivery Address
            </h3>

            {isEditingAddress ? (
              <div>
                <div style={{ background: "rgba(0,0,0,0.015)", padding: "12px", borderRadius: 8, border: `1px solid ${COLORS.charcoalSoft}15`, marginBottom: 12 }}>
                  <p style={{ fontSize: 11.5, color: COLORS.charcoalSoft, marginBottom: 10 }}>
                    Please confirm your detailed shipping address details for precise shipping and logistics calculations.
                  </p>

                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: COLORS.charcoalSoft, display: "block", marginBottom: 4, fontWeight: 500 }}>Address Line 1 (Street, Shop No.) *</label>
                    <input value={cartAddrLine1} onChange={e => setCartAddrLine1(e.target.value)} placeholder="e.g. Shop No. 24, Handloom Market" style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${COLORS.charcoalSoft}33`, background: COLORS.cream, fontFamily: "var(--sans)", fontSize: 12.5, color: COLORS.charcoal }} />
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: COLORS.charcoalSoft, display: "block", marginBottom: 4, fontWeight: 500 }}>Address Line 2 (Area, Sector) (Optional)</label>
                    <input value={cartAddrLine2} onChange={e => setCartAddrLine2(e.target.value)} placeholder="e.g. Kota" style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${COLORS.charcoalSoft}33`, background: COLORS.cream, fontFamily: "var(--sans)", fontSize: 12.5, color: COLORS.charcoal }} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.charcoalSoft, display: "block", marginBottom: 4, fontWeight: 500 }}>Landmark (Optional)</label>
                      <input value={cartAddrLandmark} onChange={e => setCartAddrLandmark(e.target.value)} placeholder="e.g. Near Post Office" style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${COLORS.charcoalSoft}33`, background: COLORS.cream, fontFamily: "var(--sans)", fontSize: 12.5, color: COLORS.charcoal }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.charcoalSoft, display: "block", marginBottom: 4, fontWeight: 500 }}>Pincode *</label>
                      <input value={cartAddrPincode} onChange={e => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setCartAddrPincode(val);
                        if (val.length === 6) {
                          setCartAddrState(getStateFromPincode(val));
                        }
                      }} placeholder="e.g. 302029" style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${COLORS.charcoalSoft}33`, background: COLORS.cream, fontFamily: "var(--sans)", fontSize: 12.5, color: COLORS.charcoal }} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.charcoalSoft, display: "block", marginBottom: 4, fontWeight: 500 }}>City *</label>
                      <input value={cartAddrCity} onChange={e => setCartAddrCity(e.target.value)} placeholder="e.g. Kota" style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${COLORS.charcoalSoft}33`, background: COLORS.cream, fontFamily: "var(--sans)", fontSize: 12.5, color: COLORS.charcoal }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: COLORS.charcoalSoft, display: "block", marginBottom: 4, fontWeight: 500 }}>State (Auto-populated)</label>
                      <input readOnly disabled value={cartAddrState} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${COLORS.charcoalSoft}33`, background: COLORS.ivoryDeep, fontFamily: "var(--sans)", fontSize: 12.5, color: COLORS.charcoalSoft, cursor: "not-allowed" }} />
                    </div>
                  </div>
                </div>
                {addressError && <div style={{ color: COLORS.madder, fontSize: 11.5, marginTop: 4, marginBottom: 8 }}>{addressError}</div>}
                
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    onClick={handleSaveAddress}
                    disabled={savingAddress}
                    style={{
                      background: COLORS.indigo,
                      color: COLORS.cream,
                      border: "none",
                      padding: "8px 14px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "var(--sans)"
                    }}
                  >
                    {savingAddress ? "Saving..." : "Save & Confirm Address"}
                  </button>
                  {account?.address && (
                    <button
                      onClick={() => {
                        const parsed = parseDetailedAddress(account.address);
                        setCartAddrLine1(parsed.line1 || "");
                        setCartAddrLine2(parsed.line2 || "");
                        setCartAddrLandmark(parsed.landmark || "");
                        setCartAddrPincode(parsed.pincode || "");
                        setCartAddrCity(parsed.city || "");
                        setCartAddrState(parsed.state || "Rajasthan");
                        setIsEditingAddress(false);
                        setIsAddressConfirmed(true);
                      }}
                      style={{
                        background: "transparent",
                        border: `1px solid ${COLORS.charcoalSoft}33`,
                        color: COLORS.charcoalSoft,
                        padding: "8px 12px",
                        borderRadius: 6,
                        fontSize: 12,
                        cursor: "pointer",
                        fontFamily: "var(--sans)"
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ background: `${COLORS.indigo}03`, border: `1px solid ${COLORS.indigo}15`, borderRadius: 8, padding: "14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.sage, fontSize: 12.5, fontWeight: 700, marginBottom: 5 }}>
                      <CheckCircle2 size={14} /> DELIVERY ADDRESS CONFIRMED
                    </div>
                    <p style={{ fontSize: 13.5, color: COLORS.charcoal, fontWeight: 600, margin: 0 }}>{account?.shop_name}</p>
                    <p style={{ fontSize: 12.5, color: COLORS.charcoalSoft, marginTop: 3, fontStyle: "italic", lineHeight: 1.4 }}>
                      {getHumanReadableAddress(account?.address)}
                    </p>
                    <p style={{ fontSize: 11.5, color: COLORS.charcoalSoft, marginTop: 3 }}>
                      Contact: +91 {account?.phone} ({account?.owner_name})
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setIsEditingAddress(true);
                      setIsAddressConfirmed(false);
                    }}
                    style={{
                      background: COLORS.cream,
                      border: `1px solid ${COLORS.indigo}33`,
                      color: COLORS.indigo,
                      padding: "5px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "var(--sans)"
                    }}
                  >
                    ✏️ Update Address
                  </button>
                </div>

                {/* Logistics & Delivery Radius Section */}
                <div style={{ background: COLORS.ivoryDeep, border: `1px solid ${COLORS.charcoalSoft}18`, borderRadius: 10, padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                    <Truck size={16} color={COLORS.indigo} />
                    <strong style={{ fontSize: 13.5, color: COLORS.indigo, fontFamily: "var(--sans)" }}>Logistics & Shipping Radius</strong>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <p style={{ fontSize: 12, color: COLORS.charcoalSoft, margin: 0, lineHeight: 1.4 }}>
                      We calculate the delivery fee based on your distance from our active dispatch origin (<strong>{dispatchLocation.address}</strong>). We offer <strong>FREE delivery within 7 km</strong>, and standard ₹30 beyond.
                    </p>

                    {/* Auto Detect Button */}
                    <button
                      onClick={() => {
                        if (!navigator.geolocation) {
                          setLocationMsg("Geolocation is not supported by your browser. Please select your zone manually.");
                          return;
                        }
                        setDetectingLocation(true);
                        setLocationMsg("");
                        navigator.geolocation.getCurrentPosition(
                          (position) => {
                            const dist = calculateDistance(dispatchLocation.lat, dispatchLocation.lng, position.coords.latitude, position.coords.longitude);
                            setRetailerLocation({
                              lat: position.coords.latitude,
                              lng: position.coords.longitude,
                              detected: true,
                              distanceKm: dist,
                              isManual: false
                            });
                            setDetectingLocation(false);
                            if (dist <= 7) {
                              setLocationMsg("📍 Success! You are within 7km. FREE Delivery has been applied.");
                            } else {
                              setLocationMsg(`📍 Success! You are ${dist.toFixed(1)} km away. ₹30 delivery fee has been applied.`);
                            }
                          },
                          (err) => {
                            setDetectingLocation(false);
                            setLocationMsg(`Could not auto-detect location ("${err.message}"). Please use manual backup buttons below:`);
                          }
                        );
                      }}
                      disabled={detectingLocation}
                      style={{
                        background: COLORS.indigo,
                        color: COLORS.cream,
                        border: "none",
                        padding: "10px 14px",
                        borderRadius: 8,
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "var(--sans)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                      }}
                    >
                      📍 {detectingLocation ? "Requesting Permission & Detecting..." : "Auto-Detect Delivery Zone (Request GPS)"}
                    </button>

                    {locationMsg && (
                      <div style={{ fontSize: 12, color: locationMsg.includes("Success") ? COLORS.sage : COLORS.madder, fontWeight: 500, background: "rgba(0,0,0,0.02)", padding: "8px 10px", borderRadius: 6, border: `1px solid ${locationMsg.includes("Success") ? COLORS.sage : COLORS.madder}22` }}>
                        {locationMsg}
                      </div>
                    )}

                    {/* Fallback Selector */}
                    <div style={{ borderTop: `1px dashed ${COLORS.charcoalSoft}18`, paddingTop: 10, marginTop: 4 }}>
                      <div style={{ fontSize: 11, color: COLORS.charcoalSoft, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Or Select Zone Manually (Fallback)
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                          onClick={() => {
                            setRetailerLocation({ lat: null, lng: null, detected: false, distanceKm: 4.5, isManual: true });
                            setLocationMsg("Manual Selection: Within 7 km (FREE Delivery applied)");
                          }}
                          style={{
                            background: retailerLocation.isManual && retailerLocation.distanceKm <= 7 ? COLORS.sage : "transparent",
                            color: retailerLocation.isManual && retailerLocation.distanceKm <= 7 ? COLORS.cream : COLORS.charcoal,
                            border: `1.5px solid ${COLORS.sage}55`,
                            padding: "6px 12px",
                            borderRadius: 6,
                            fontSize: 11.5,
                            cursor: "pointer",
                            fontWeight: 500,
                            fontFamily: "var(--sans)"
                          }}
                        >
                          Within 7 km (FREE)
                        </button>
                        <button
                          onClick={() => {
                            setRetailerLocation({ lat: null, lng: null, detected: false, distanceKm: 12.0, isManual: true });
                            setLocationMsg("Manual Selection: Outside 7 km (₹30 Fee applied)");
                          }}
                          style={{
                            background: retailerLocation.isManual && retailerLocation.distanceKm > 7 ? COLORS.indigo : "transparent",
                            color: retailerLocation.isManual && retailerLocation.distanceKm > 7 ? COLORS.cream : COLORS.charcoal,
                            border: `1.5px solid ${COLORS.indigo}33`,
                            padding: "6px 12px",
                            borderRadius: 6,
                            fontSize: 11.5,
                            cursor: "pointer",
                            fontWeight: 500,
                            fontFamily: "var(--sans)"
                          }}
                        >
                          Beyond 7 km (₹30)
                        </button>
                      </div>
                    </div>

                    {/* Status Info */}
                    <div style={{ marginTop: 6, padding: "10px 12px", background: `${COLORS.indigo}06`, borderRadius: 6, display: "flex", flexDirection: "column", gap: 4, borderLeft: `3px solid ${COLORS.indigo}` }}>
                      <div style={{ fontSize: 12, color: COLORS.charcoal }}>
                        Origin: <strong>{dispatchLocation.address}</strong>
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.charcoal, display: "flex", justifyContent: "space-between" }}>
                        <span>Distance:</span>
                        <strong>{activeDistance.toFixed(1)} km</strong>
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.charcoal, display: "flex", justifyContent: "space-between", borderTop: `1px dashed ${COLORS.charcoalSoft}22`, paddingTop: 4, marginTop: 4 }}>
                        <span>Delivery Fee:</span>
                        <strong style={{ color: deliveryFee > 0 ? COLORS.madder : COLORS.sage }}>
                          {deliveryFee > 0 ? `₹${deliveryFee}` : "FREE DELIVERY"}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payment Method Section */}
          <div style={{ background: COLORS.cream, borderRadius: 12, border: `1.5px solid ${COLORS.charcoalSoft}18`, padding: "18px" }}>
            <h3 style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 17, color: COLORS.indigo, marginBottom: 12, display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
              <Wallet size={17} color={COLORS.indigo} /> Wholesale Payment Method
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }} className="sm:grid-cols-2">
              {/* COD Option */}
              <div
                onClick={() => setPaymentType("COD")}
                style={{
                  background: paymentType === "COD" ? `${COLORS.indigo}04` : COLORS.cream,
                  border: `2px solid ${paymentType === "COD" ? COLORS.indigo : `${COLORS.charcoalSoft}22`}`,
                  borderRadius: 8,
                  padding: "14px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start"
                }}
              >
                <div style={{ marginTop: 2 }}>
                  <input
                    type="radio"
                    name="paymentType"
                    checked={paymentType === "COD"}
                    onChange={() => setPaymentType("COD")}
                    style={{ accentColor: COLORS.indigo, cursor: "pointer" }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.indigo, display: "flex", alignItems: "center", gap: 4 }}>
                    <Truck size={14} /> Cash on Delivery (COD)
                  </div>
                  <p style={{ fontSize: 11.5, color: COLORS.charcoalSoft, marginTop: 3, lineHeight: 1.35 }}>
                    Pay with cash or UPI scan at your shop door upon delivery.
                  </p>
                </div>
              </div>

              {/* QR Option */}
              <div
                onClick={() => setPaymentType("BANK_QR")}
                style={{
                  background: paymentType === "BANK_QR" ? `${COLORS.indigo}04` : COLORS.cream,
                  border: `2px solid ${paymentType === "BANK_QR" ? COLORS.indigo : `${COLORS.charcoalSoft}22`}`,
                  borderRadius: 8,
                  padding: "14px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start"
                }}
              >
                <div style={{ marginTop: 2 }}>
                  <input
                    type="radio"
                    name="paymentType"
                    checked={paymentType === "BANK_QR"}
                    onChange={() => setPaymentType("BANK_QR")}
                    style={{ accentColor: COLORS.indigo, cursor: "pointer" }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.indigo, display: "flex", alignItems: "center", gap: 4 }}>
                    <CreditCard size={14} /> Bank Account & UPI QR
                  </div>
                  <p style={{ fontSize: 11.5, color: COLORS.charcoalSoft, marginTop: 3, lineHeight: 1.35 }}>
                    Pay upfront via high-limit IMPS/NEFT/UPI transfer with official invoice reference.
                  </p>
                </div>
              </div>
            </div>

            {/* Bank details expansion */}
            {paymentType === "BANK_QR" && (
              <div style={{ marginTop: 14, background: COLORS.ivoryDeep, border: `1px dashed ${COLORS.charcoalSoft}33`, borderRadius: 8, padding: "14px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }} className="sm:grid-cols-3">
                  <div style={{ gridColumn: "span 2" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <strong style={{ fontSize: 12, color: COLORS.indigo, textTransform: "uppercase" }}>🏦 Beneficiary Account</strong>
                      <button
                        onClick={handleCopyBankDetails}
                        style={{
                          background: "none",
                          border: "none",
                          color: COLORS.indigo,
                          fontSize: 11,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                          fontWeight: 600,
                          textDecoration: "underline"
                        }}
                      >
                        <Copy size={11} /> {copied ? "Copied!" : "Copy"}
                      </button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, color: COLORS.charcoal }}>
                      <div style={{ display: "grid", gridTemplateColumns: "100px 1fr" }}>
                        <span style={{ color: COLORS.charcoalSoft }}>Name:</span>
                        <strong style={{ fontWeight: 600 }}>Deetya Weaves Wholesale</strong>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "100px 1fr" }}>
                        <span style={{ color: COLORS.charcoalSoft }}>Bank Name:</span>
                        <span>HDFC Bank Ltd</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "100px 1fr" }}>
                        <span style={{ color: COLORS.charcoalSoft }}>Account No:</span>
                        <strong style={{ fontFamily: "monospace", fontSize: 13 }}>50200084719273</strong>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "100px 1fr" }}>
                        <span style={{ color: COLORS.charcoalSoft }}>IFSC Code:</span>
                        <strong style={{ fontFamily: "monospace" }}>HDFC0000125</strong>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "100px 1fr" }}>
                        <span style={{ color: COLORS.charcoalSoft }}>UPI ID:</span>
                        <span style={{ color: COLORS.madder, fontWeight: 500 }}>deetyaweaves@upi</span>
                      </div>
                    </div>
                  </div>

                  {/* QR Graphic */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ background: "#fff", padding: 8, borderRadius: 6, border: `1px solid ${COLORS.charcoalSoft}22` }}>
                      <svg width="80" height="80" viewBox="0 0 100 100" style={{ display: "block" }}>
                        <rect x="2" y="2" width="22" height="22" fill={COLORS.indigo} />
                        <rect x="5" y="5" width="16" height="16" fill="#fff" />
                        <rect x="8" y="8" width="10" height="10" fill={COLORS.indigo} />
                        <rect x="76" y="2" width="22" height="22" fill={COLORS.indigo} />
                        <rect x="79" y="5" width="16" height="16" fill="#fff" />
                        <rect x="82" y="8" width="10" height="10" fill={COLORS.indigo} />
                        <rect x="2" y="76" width="22" height="22" fill={COLORS.indigo} />
                        <rect x="5" y="79" width="16" height="16" fill="#fff" />
                        <rect x="8" y="82" width="10" height="10" fill={COLORS.indigo} />
                        <rect x="30" y="4" width="4" height="8" fill={COLORS.charcoal} />
                        <rect x="38" y="2" width="8" height="4" fill={COLORS.charcoal} />
                        <rect x="50" y="6" width="12" height="4" fill={COLORS.charcoal} />
                        <rect x="66" y="4" width="6" height="12" fill={COLORS.charcoal} />
                        <rect x="4" y="30" width="8" height="4" fill={COLORS.charcoal} />
                        <rect x="2" y="38" width="4" height="12" fill={COLORS.charcoal} />
                        <rect x="8" y="54" width="12" height="6" fill={COLORS.charcoal} />
                        <rect x="30" y="30" width="14" height="14" fill={COLORS.indigo} />
                        <rect x="33" y="33" width="8" height="8" fill="#fff" />
                        <rect x="36" y="36" width="2" height="2" fill={COLORS.madder} />
                        <rect x="48" y="28" width="10" height="4" fill={COLORS.charcoal} />
                        <rect x="62" y="32" width="4" height="12" fill={COLORS.charcoal} />
                        <rect x="54" y="48" width="8" height="8" fill={COLORS.charcoal} />
                        <rect x="76" y="30" width="8" height="6" fill={COLORS.charcoal} />
                        <rect x="88" y="38" width="10" height="10" fill={COLORS.charcoal} />
                        <rect x="80" y="52" width="16" height="4" fill={COLORS.charcoal} />
                        <rect x="28" y="52" width="10" height="10" fill={COLORS.charcoal} />
                        <rect x="42" y="60" width="6" height="12" fill={COLORS.charcoal} />
                        <rect x="32" y="76" width="14" height="8" fill={COLORS.charcoal} />
                        <rect x="30" y="88" width="8" height="10" fill={COLORS.charcoal} />
                        <rect x="42" y="84" width="10" height="4" fill={COLORS.charcoal} />
                        <rect x="58" y="64" width="16" height="16" fill={COLORS.charcoal} />
                        <rect x="62" y="68" width="8" height="8" fill="#fff" />
                        <rect x="78" y="68" width="6" height="6" fill={COLORS.charcoal} />
                        <rect x="88" y="78" width="8" height="6" fill={COLORS.charcoal} />
                        <rect x="78" y="88" width="12" height="10" fill={COLORS.charcoal} />
                        <rect x="54" y="88" width="10" height="4" fill={COLORS.charcoal} />
                      </svg>
                    </div>
                    <span style={{ fontSize: 9, color: COLORS.charcoalSoft, marginTop: 4, fontWeight: 500 }}>Scan QR to Pay</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Order Summary & Coupon Codes */}
        <div>
          <div style={{ background: COLORS.indigo, borderRadius: 12, padding: "18px", color: COLORS.cream, position: "sticky", top: 20 }}>
            <h3 style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 17, color: COLORS.cream, marginBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: 8, fontWeight: 600 }}>
              Order Summary
            </h3>

            {/* Coupon row */}
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                value={couponCode} onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponResult(null); }}
                placeholder="PROMO CODE"
                style={{ flex: 1, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 7, padding: "8px 10px", fontSize: 12, color: COLORS.cream, fontFamily: "var(--sans)", outline: "none" }}
              />
              <button onClick={applyCoupon} disabled={applyingCoupon || !couponCode.trim()}
                style={{ background: "rgba(255,255,255,0.18)", color: COLORS.cream, border: "1px solid rgba(255,255,255,0.3)", padding: "8px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer", fontFamily: "var(--sans)", whiteSpace: "nowrap" }}>
                {applyingCoupon ? "…" : "Apply"}
              </button>
            </div>
            {couponResult && (
              <div style={{ fontSize: 11.5, marginBottom: 12, color: couponResult.valid ? "#A8DDB5" : "#FFB4A2", display: "flex", alignItems: "center", gap: 5 }}>
                {couponResult.valid ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />} {couponResult.message}
              </div>
            )}

            {/* Promo suggestions */}
            {suggestedPromoCodes.length > 0 && (
              <div style={{ marginTop: 14, marginBottom: 14, borderTop: "1px dashed rgba(255,255,255,0.2)", paddingTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "rgba(255,255,255,0.95)", fontWeight: "600", marginBottom: 8 }}>
                  <Sparkles size={11} color={COLORS.turmeric} /> Suggested Promo Codes
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 150, overflowY: "auto", paddingRight: 4 }}>
                  {suggestedPromoCodes.map((code) => {
                    const difference = code.min_order_value - subtotal;
                    const isUnlocked = difference <= 0;
                    const isCurrentlySelected = couponResult?.valid && couponResult.code === code.code;
                    
                    return (
                      <div
                        key={code.id}
                        onClick={() => {
                          if (isUnlocked) {
                            setCouponCode(code.code);
                            applyCoupon(code.code);
                          }
                        }}
                        style={{
                          background: isCurrentlySelected
                            ? "rgba(168,221,181,0.15)"
                            : isUnlocked 
                              ? "rgba(255,255,255,0.06)" 
                              : "rgba(255,255,255,0.02)",
                          border: isCurrentlySelected
                            ? "1px solid #A8DDB5"
                            : isUnlocked
                              ? "1px solid rgba(255,255,255,0.15)"
                              : "1px dashed rgba(255,255,255,0.08)",
                          borderRadius: 6,
                          padding: "8px 10px",
                          cursor: isUnlocked ? "pointer" : "not-allowed",
                          transition: "all 0.2s ease"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: "700", color: isCurrentlySelected ? "#A8DDB5" : COLORS.cream, fontFamily: "var(--sans)", letterSpacing: 0.3 }}>
                            {code.code}
                          </span>
                          <span style={{ fontSize: 9.5, fontWeight: "600", color: isUnlocked ? "#A8DDB5" : "#FFB4A2" }}>
                            {isUnlocked ? "Ready to apply" : `Need ₹${difference.toLocaleString("en-IN")} more`}
                          </span>
                        </div>
                        <p style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 3, margin: 0, lineHeight: 1.3 }}>
                          {code.description || `Get ${code.discount_type === "percentage" ? `${code.discount_value}%` : `₹${code.discount_value}`} off on order above ₹${code.min_order_value}`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Calculations and line summaries */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Subtotal ({cartEntries.length} items)</span>
                <span style={{ color: COLORS.cream }}>₹{subtotal.toLocaleString("en-IN")}</span>
              </div>
              {discountAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "#A8DDB5" }}>
                  <span>Discount ({couponResult?.code})</span>
                  <span>− ₹{discountAmount.toLocaleString("en-IN")}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Includes GST</span>
                <span style={{ color: "rgba(255,255,255,0.55)" }}>₹{gstAmount.toLocaleString("en-IN")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Standard Delivery Fee</span>
                <span style={{ color: deliveryFee > 0 ? COLORS.cream : "#A8DDB5", fontWeight: 600 }}>
                  {deliveryFee > 0 ? `+ ₹${deliveryFee}` : "FREE DISPATCH"}
                </span>
              </div>
              
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.2)", marginTop: 8, paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: COLORS.cream }}>
                <span>Total Wholesale Order</span>
                <span>₹{cartTotal.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.35, marginBottom: 14 }}>
              Dispatch usually takes 3-5 days. Official tax invoice with GST breakdown will be provided at delivery.
            </p>

            <button
              onClick={() => {
                if (!isAddressConfirmed) {
                  setAddressError("Please save and confirm your delivery address to proceed.");
                  return;
                }
                placeOrder();
              }}
              disabled={placing}
              style={{
                width: "100%",
                background: COLORS.madder,
                color: COLORS.cream,
                border: "none",
                padding: "11px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: placing || !isAddressConfirmed ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                fontFamily: "var(--sans)",
                opacity: !isAddressConfirmed ? 0.75 : 1
              }}
            >
              {placing ? "Placing Order…" : "Confirm & Place Order"}
            </button>
            
            {error && <div style={{ color: "#FFB4A2", fontSize: 11.5, marginTop: 8, textAlign: "center" }}>{error}</div>}
            
            {!isAddressConfirmed && (
              <div style={{ color: "#FFB4A2", fontSize: 11, marginTop: 8, textAlign: "center", background: "rgba(0,0,0,0.15)", padding: "6px", borderRadius: 6 }}>
                ⚠️ Save your Delivery Address above to confirm checkout.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
