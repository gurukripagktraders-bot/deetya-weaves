import React, { useState, useEffect, useRef } from "react";
import { Image as ImageIcon } from "lucide-react";
import { COLORS } from "../lib/config.js";
import { calcGST } from "../lib/helpers.js";

// PRODUCT DETAIL SIDE PANEL
// =============================================
export default function ProductPanel({ product, variant, onClose, onAddToCart, cart, account, onShowLogin }) {
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
                <button onClick={() => onAddToCart(product, selVariant, 1)} disabled={selVariant?.stock !== null && selVariant?.stock !== undefined && qty >= selVariant.stock}
                  title={selVariant?.stock !== null && selVariant?.stock !== undefined && qty >= selVariant.stock ? "No more stock available" : undefined}
                  style={{ border:"none", background:"transparent", width:40, height:44, cursor: (selVariant?.stock !== null && selVariant?.stock !== undefined && qty >= selVariant.stock) ? "default" : "pointer", color: (selVariant?.stock !== null && selVariant?.stock !== undefined && qty >= selVariant.stock) ? COLORS.charcoalSoft+"55" : COLORS.indigo, fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
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
