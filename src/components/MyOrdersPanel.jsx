import React, { useState, useMemo } from "react";
import {
  ChevronLeft, Package, Clock, Truck, CheckCircle2, AlertTriangle, Sparkles,
  Image as ImageIcon, ShoppingBag, Plus, Minus, ArrowRight, Clipboard, Copy,
  Search, ExternalLink, RefreshCw, Star, ArrowUpRight, HelpCircle, FileText
} from "lucide-react";

import { COLORS } from "../lib/config.js";

export default function MyOrdersPanel({
  account,
  orders,
  items,
  onClose,
  supabase,
  setCart
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [orderItems, setOrderItems] = useState({});
  const [loadingItems, setLoadingItems] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [reorderStatus, setReorderStatus] = useState(null); // { message, isError }

  // Fetch items for expanded order
  const loadOrderItems = async (orderId) => {
    if (orderItems[orderId]) {
      setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
      return;
    }
    setLoadingItems(prev => ({ ...prev, [orderId]: true }));
    try {
      const data = await supabase(`order_items?order_id=eq.${orderId}&select=*`);
      setOrderItems(prev => ({ ...prev, [orderId]: data || [] }));
      setExpandedOrderId(orderId);
    } catch (e) {
      console.error("Error loading order items:", e);
    } finally {
      setLoadingItems(prev => ({ ...prev, [orderId]: false }));
    }
  };

  // Filter orders based on status tab and search query
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // Status filter
      if (statusFilter !== "All") {
        if (statusFilter === "Pending" && o.stage !== "Pending") return false;
        if (statusFilter === "In Transit" && o.stage !== "Packed" && o.stage !== "Out for delivery") return false;
        if (statusFilter === "Delivered" && o.stage !== "Delivered") return false;
        if (statusFilter === "Cancelled" && o.stage !== "Cancelled") return false;
      }
      // Search filter (order number, notes, payment type)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesOrderNum = o.order_number?.toString().includes(query);
        const matchesNotes = o.notes?.toLowerCase().includes(query);
        const matchesPayment = o.payment_type?.toLowerCase().includes(query);
        const matchesStage = o.stage?.toLowerCase().includes(query);
        return matchesOrderNum || matchesNotes || matchesPayment || matchesStage;
      }
      return true;
    });
  }, [orders, statusFilter, searchQuery]);

  const handleCopyTracking = (trackingNo) => {
    navigator.clipboard.writeText(trackingNo);
    setCopiedId(trackingNo);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to generate deterministic tracking details based on Order ID
  const getTrackingInfo = (order) => {
    const orderIdNum = parseInt(String(order.id).replace(/\D/g, "").slice(-4) || "1024", 10);
    const courierOptions = ["Delhivery B2B", "Blue Dart Apex", "Safexpress Handloom", "Deetya Logistics"];
    const courier = courierOptions[orderIdNum % courierOptions.length];
    const waybill = `DWT${1000000000 + orderIdNum}`;
    
    // Dates calculation
    const orderDate = new Date(order.created_at);
    
    // Milestones construction
    const milestones = [
      { title: "Order Logged & Loom Slot Allotted", desc: "Consignment allocated at weaving factory", time: "10:15 AM", done: true },
      { title: "Weft-Warp Yarn Quality Audited", desc: "Fabric strength and design template verification passed", time: "02:30 PM", done: order.stage !== "Pending" },
      { title: "Consignment Packed & Sealed", desc: "Wholesale bales packed with safety moisture wraps", time: "11:00 AM", done: ["Packed", "Out for delivery", "Delivered"].includes(order.stage) },
      { title: "Handed over to Courier Hub", desc: `In transit via ${courier} (Waybill: ${waybill})`, time: "04:30 PM", done: ["Out for delivery", "Delivered"].includes(order.stage) },
      { title: "Delivered to Retailer Shop", desc: "Secure digital OTP signoff received", time: "12:15 PM", done: order.stage === "Delivered" }
    ];

    return {
      courier,
      waybill,
      estimatedDays: 7,
      milestones
    };
  };

  // Quick Action: Add single item back to cart
  const handleAddSingleToCart = (item) => {
    // Find matching catalog product and variant
    const matchedProduct = items.find(p => p.name.toLowerCase() === item.item_name.toLowerCase() || p.variants.some(v => v.label.toLowerCase() === item.item_name.toLowerCase()));
    
    if (!matchedProduct) {
      setReorderStatus({ message: `"${item.item_name}" is currently not in the live catalog catalog.`, isError: true });
      setTimeout(() => setReorderStatus(null), 4000);
      return;
    }

    // Try to find the exact variant used
    const matchedVariant = matchedProduct.variants.find(v => v.label.toLowerCase() === item.item_name.toLowerCase()) || matchedProduct.variants[0];
    
    if (!matchedVariant) {
      setReorderStatus({ message: "Product exists but variant is unavailable.", isError: true });
      setTimeout(() => setReorderStatus(null), 4000);
      return;
    }

    const key = matchedProduct.id + "__" + matchedVariant.id;
    setCart(prev => {
      const current = prev[key] || 0;
      const next = current + item.quantity;
      return { ...prev, [key]: next };
    });

    setReorderStatus({ message: `Added ${item.quantity} pcs of "${item.item_name}" to your cart!`, isError: false });
    setTimeout(() => setReorderStatus(null), 4000);
  };

  // Quick Action: Reorder entire order items back to cart
  const handleAddAllToCart = (itemsList) => {
    let addedCount = 0;
    let missingCount = 0;

    setCart(prev => {
      const updated = { ...prev };
      
      itemsList.forEach(item => {
        const matchedProduct = items.find(p => p.name.toLowerCase() === item.item_name.toLowerCase() || p.variants.some(v => v.label.toLowerCase() === item.item_name.toLowerCase()));
        
        if (matchedProduct) {
          const matchedVariant = matchedProduct.variants.find(v => v.label.toLowerCase() === item.item_name.toLowerCase()) || matchedProduct.variants[0];
          if (matchedVariant) {
            const key = matchedProduct.id + "__" + matchedVariant.id;
            const current = updated[key] || 0;
            updated[key] = current + item.quantity;
            addedCount++;
          } else {
            missingCount++;
          }
        } else {
          missingCount++;
        }
      });

      return updated;
    });

    if (addedCount > 0) {
      setReorderStatus({
        message: `Successfully restocked ${addedCount} items into your cart!${missingCount > 0 ? ` (${missingCount} not available)` : ""}`,
        isError: false
      });
    } else {
      setReorderStatus({ message: "None of the items in this order are currently available in the catalog.", isError: true });
    }
    setTimeout(() => setReorderStatus(null), 4000);
  };

  return (
    <div style={{ background: COLORS.cream, border: `1px solid ${COLORS.charcoalSoft}22`, borderRadius: 14, padding: "24px", marginBottom: 20, boxShadow: "0 4px 20px rgba(42,36,29,0.04)" }}>
      {/* Panel Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: `1px solid ${COLORS.charcoalSoft}15`, paddingBottom: 14, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ background: `${COLORS.indigo}15`, padding: 8, borderRadius: 8 }}>
            <ShoppingBag size={20} color={COLORS.indigo} />
          </div>
          <div>
            <h2 style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 19, color: COLORS.indigo, margin: 0 }}>My Wholesale Orders</h2>
            <p style={{ fontSize: 11.5, color: COLORS.charcoalSoft, margin: "2px 0 0 0" }}>Track status, courier dispatches, and restock order items</p>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: `1.5px solid ${COLORS.charcoalSoft}30`, borderRadius: 8, color: COLORS.charcoal, fontSize: 12, padding: "6px 12px", cursor: "pointer", fontWeight: 600, fontFamily: "var(--sans)", display: "flex", alignItems: "center", gap: 6 }}>
          <ChevronLeft size={14} /> Back to Catalog
        </button>
      </div>

      {/* Alert status notification */}
      {reorderStatus && (
        <div style={{
          background: reorderStatus.isError ? `${COLORS.madder}12` : `${COLORS.sage}12`,
          border: `1.5px solid ${reorderStatus.isError ? COLORS.madder : COLORS.sage}30`,
          color: reorderStatus.isError ? COLORS.madder : COLORS.sage,
          padding: "10px 14px",
          borderRadius: 8,
          fontSize: 12.5,
          fontWeight: 600,
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 8
        }}>
          {reorderStatus.isError ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          <span>{reorderStatus.message}</span>
        </div>
      )}

      {/* Navigation Filter Tabs and Search Bar */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        {/* Status Tabs */}
        <div style={{ display: "flex", background: `${COLORS.charcoalSoft}08`, borderRadius: 10, padding: 4, gap: 4 }}>
          {["All", "Pending", "In Transit", "Delivered", "Cancelled"].map(tabName => {
            const isActive = statusFilter === tabName;
            return (
              <button
                key={tabName}
                onClick={() => setStatusFilter(tabName)}
                style={{
                  border: "none",
                  background: isActive ? COLORS.indigo : "transparent",
                  color: isActive ? COLORS.cream : COLORS.charcoalSoft,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "6px 14px",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                {tabName}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div style={{ position: "relative", minWidth: 260, flex: "1 0 auto", maxWidth: 400 }}>
          <Search size={14} color={COLORS.charcoalSoft} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by order ID, notes, payment..."
            style={{
              width: "100%",
              padding: "8px 12px 8px 34px",
              fontSize: 12.5,
              borderRadius: 8,
              border: `1.5px solid ${COLORS.charcoalSoft}25`,
              background: "#FFF",
              fontFamily: "var(--sans)",
              color: COLORS.charcoal
            }}
          />
        </div>
      </div>

      {/* Orders List Container */}
      {filteredOrders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", background: "#FFF", borderRadius: 12, border: `1.5px solid ${COLORS.charcoalSoft}10` }}>
          <Clipboard size={32} color={COLORS.charcoalSoft} opacity="0.5" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 16, color: COLORS.indigo, margin: "0 0 4px 0" }}>No matching orders</h3>
          <p style={{ fontSize: 12.5, color: COLORS.charcoalSoft, margin: 0 }}>
            {orders.length === 0 ? "You have not placed any wholesale orders yet." : "No orders match your filter criteria."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {filteredOrders.map(o => {
            const isExpanded = expandedOrderId === o.id;
            const tracking = getTrackingInfo(o);
            const formattedDate = new Date(o.created_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric"
            });

            // Status stage badge colors
            let stageColor = COLORS.turmeric;
            if (o.stage === "Delivered") stageColor = COLORS.sage;
            else if (o.stage === "Cancelled") stageColor = COLORS.madder;
            else if (o.stage === "Packed" || o.stage === "Out for delivery") stageColor = COLORS.indigo;

            return (
              <div
                key={o.id}
                style={{
                  background: "#FFF",
                  borderRadius: 12,
                  border: isExpanded ? `1.5px solid ${COLORS.indigo}` : `1.5px solid ${COLORS.charcoalSoft}18`,
                  overflow: "hidden",
                  transition: "all 0.25s",
                  boxShadow: isExpanded ? "0 4px 16px rgba(43,58,85,0.08)" : "none"
                }}
              >
                {/* Order Summary Header Card */}
                <div
                  onClick={() => loadOrderItems(o.id)}
                  style={{
                    padding: "16px 20px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    background: isExpanded ? `${COLORS.indigo}03` : "#FFF",
                    flexWrap: "wrap",
                    gap: 16,
                    borderBottom: isExpanded ? `1px solid ${COLORS.charcoalSoft}10` : "none"
                  }}
                >
                  <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                    <div style={{ background: `${stageColor}12`, padding: 10, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Package size={18} color={stageColor} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14.5, fontWeight: 700, color: COLORS.indigo }}>Order #{o.order_number}</span>
                        <span style={{ fontSize: 12, color: COLORS.charcoalSoft }}>· {formattedDate}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: COLORS.charcoalSoft, marginTop: 4 }}>
                        Value: <strong style={{ color: COLORS.charcoal }}>₹{o.total?.toLocaleString("en-IN")}</strong> · Items count: <span style={{ fontWeight: 600 }}>{o.subtotal ? Math.round(o.subtotal / 100) : "Multiple"} pcs</span> · Terms: <span style={{ textTransform: "capitalize", fontWeight: 500 }}>{o.payment_type}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ textAlign: "right", display: "none", md: "block" }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#FFF",
                        background: stageColor,
                        padding: "3px 9px",
                        borderRadius: 12,
                        textTransform: "uppercase",
                        letterSpacing: 0.5
                      }}>
                        {o.stage}
                      </span>
                    </div>
                    {/* Small layout status badge */}
                    <span style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: "#FFF",
                      background: stageColor,
                      padding: "2px 8px",
                      borderRadius: 10,
                      textTransform: "uppercase"
                    }} className="visible-xs">
                      {o.stage}
                    </span>
                    <div style={{ fontSize: 12, color: COLORS.indigo, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                      {isExpanded ? "Hide Detail ▲" : "View Detail ▼"}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div style={{ padding: "20px" }}>
                    {/* Visual Progress Timeline (Order Tracking Section) */}
                    {o.stage !== "Cancelled" && (
                      <div style={{ marginBottom: 24, padding: "16px 20px", background: COLORS.cream, borderRadius: 10, border: `1px solid ${COLORS.charcoalSoft}10` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                          <Clock size={15} color={COLORS.indigo} />
                          <h4 style={{ fontSize: 13, fontWeight: 700, color: COLORS.indigo, margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>Order Journey Tracker</h4>
                        </div>

                        {/* Step progress bar container */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative", flexWrap: "wrap", gap: 12 }} className="timeline-container">
                          {/* Horizontal line background */}
                          <div style={{
                            position: "absolute",
                            left: "8%",
                            right: "8%",
                            top: 14,
                            height: 2.5,
                            background: COLORS.ivoryDeep,
                            zIndex: 1,
                            display: "none",
                            md: "block"
                          }} />

                          {tracking.milestones.map((milestone, idx) => {
                            const isCurrent = (o.stage === "Pending" && idx === 0) ||
                                              (o.stage === "Confirmed" && idx === 1) ||
                                              (o.stage === "Packed" && idx === 2) ||
                                              (o.stage === "Out for delivery" && idx === 3) ||
                                              (o.stage === "Delivered" && idx === 4);
                            
                            const isPast = (o.stage === "Pending" && idx === 0) ||
                                           (o.stage === "Confirmed" && idx <= 1) ||
                                           (o.stage === "Packed" && idx <= 2) ||
                                           (o.stage === "Out for delivery" && idx <= 3) ||
                                           (o.stage === "Delivered");

                            return (
                              <div
                                key={idx}
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  zIndex: 2,
                                  width: "18%",
                                  minWidth: 100,
                                  textAlign: "center"
                                }}
                              >
                                {/* Circle icon indicator */}
                                <div style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: "50%",
                                  background: isCurrent ? COLORS.indigo : isPast ? COLORS.sage : "#FFF",
                                  border: `2px solid ${isCurrent ? COLORS.indigo : isPast ? COLORS.sage : COLORS.charcoalSoft + "25"}`,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: isPast ? COLORS.cream : COLORS.charcoalSoft,
                                  fontWeight: "bold",
                                  fontSize: 12,
                                  marginBottom: 6,
                                  boxShadow: isCurrent ? `0 0 0 4px ${COLORS.indigo}25` : "none"
                                }}>
                                  {isPast ? "✓" : idx + 1}
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700, color: isCurrent ? COLORS.indigo : isPast ? COLORS.charcoal : COLORS.charcoalSoft, display: "block" }}>
                                  {milestone.title}
                                </span>
                                <span style={{ fontSize: 9.5, color: COLORS.charcoalSoft, display: "block", marginTop: 2, lineHeight: 1.2 }}>
                                  {milestone.desc}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Cancellation message */}
                    {o.stage === "Cancelled" && (
                      <div style={{
                        background: `${COLORS.madder}08`,
                        border: `1px solid ${COLORS.madder}20`,
                        borderRadius: 10,
                        padding: "14px 18px",
                        marginBottom: 20,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        color: COLORS.madder
                      }}>
                        <AlertTriangle size={18} />
                        <div>
                          <strong style={{ fontSize: 13, display: "block" }}>Order Cancelled</strong>
                          <span style={{ fontSize: 12, color: COLORS.charcoalSoft }}>This consignment was cancelled. Please contact the help desk for the reason.</span>
                        </div>
                      </div>
                    )}

                    {/* Dispatch Tracking and Shipping Service Details */}
                    {o.stage !== "Cancelled" && (
                      <div style={{
                        background: "#FFF",
                        border: `1.5px solid ${COLORS.charcoalSoft}12`,
                        borderRadius: 10,
                        padding: "16px",
                        marginBottom: 20,
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 16
                      }}>
                        <div>
                          <span style={{ fontSize: 11, color: COLORS.charcoalSoft, textTransform: "uppercase", letterSpacing: 0.5, display: "block" }}>Shipping Partner</span>
                          <strong style={{ fontSize: 13.5, color: COLORS.indigo, marginTop: 2, display: "block", fontFamily: "'DM Sans', system-ui, sans-serif" }}>{tracking.courier}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: 11, color: COLORS.charcoalSoft, textTransform: "uppercase", letterSpacing: 0.5, display: "block" }}>Waybill / Airway Bill</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                            <strong style={{ fontSize: 13, color: COLORS.charcoal, fontFamily: "var(--sans)" }}>{tracking.waybill}</strong>
                            <button
                              onClick={() => handleCopyTracking(tracking.waybill)}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 2,
                                display: "flex",
                                alignItems: "center",
                                color: COLORS.indigo
                              }}
                              title="Copy Waybill"
                            >
                              <Copy size={13} />
                            </button>
                            {copiedId === tracking.waybill && (
                              <span style={{ fontSize: 10, color: COLORS.sage, fontWeight: 600 }}>Copied!</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: 11, color: COLORS.charcoalSoft, textTransform: "uppercase", letterSpacing: 0.5, display: "block" }}>Estimated Transit</span>
                          <strong style={{ fontSize: 13, color: COLORS.charcoal, marginTop: 2, display: "block" }}>
                            {o.stage === "Delivered" ? "Delivered successfully" : `5 - ${tracking.estimatedDays} Working Days`}
                          </strong>
                        </div>
                        <div>
                          <span style={{ fontSize: 11, color: COLORS.charcoalSoft, textTransform: "uppercase", letterSpacing: 0.5, display: "block" }}>Delivery Shop Details</span>
                          <span style={{ fontSize: 12, color: COLORS.charcoalSoft, marginTop: 2, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={account?.address}>
                            {account?.shop_name} · {account?.address}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Items Table Section */}
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <FileText size={14} color={COLORS.indigo} />
                          <h4 style={{ fontSize: 13, fontWeight: 700, color: COLORS.indigo, margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>Purchased wholesale items</h4>
                        </div>
                        {orderItems[o.id] && (
                          <button
                            onClick={() => handleAddAllToCart(orderItems[o.id])}
                            style={{
                              background: COLORS.indigo,
                              color: COLORS.cream,
                              border: "none",
                              borderRadius: 6,
                              padding: "5px 10px",
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              fontFamily: "var(--sans)"
                            }}
                          >
                            <RefreshCw size={11} /> Reorder All Items
                          </button>
                        )}
                      </div>

                      {loadingItems[o.id] ? (
                        <div style={{ padding: "20px 0", textAlign: "center", fontSize: 12.5, color: COLORS.charcoalSoft }}>
                          <RefreshCw size={16} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                          Fetching item details from weaver ledger…
                        </div>
                      ) : orderItems[o.id] ? (
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, fontFamily: "var(--sans)", minWidth: 500 }}>
                            <thead>
                              <tr style={{ borderBottom: `1.5px solid ${COLORS.charcoalSoft}22`, background: COLORS.cream }}>
                                <th style={{ padding: "10px", color: COLORS.charcoal, fontWeight: 700, textAlign: "left" }}>Product Specification</th>
                                <th style={{ padding: "10px", color: COLORS.charcoal, fontWeight: 700, textAlign: "center" }}>Category</th>
                                <th style={{ padding: "10px", color: COLORS.charcoal, fontWeight: 700, textAlign: "center" }}>Quantity</th>
                                <th style={{ padding: "10px", color: COLORS.charcoal, fontWeight: 700, textAlign: "right" }}>Wholesale Price</th>
                                <th style={{ padding: "10px", color: COLORS.charcoal, fontWeight: 700, textAlign: "right" }}>Total Cost</th>
                                <th style={{ padding: "10px", color: COLORS.charcoal, fontWeight: 700, textAlign: "center" }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {orderItems[o.id].map((item, index) => {
                                return (
                                  <tr key={index} style={{ borderBottom: `1px solid ${COLORS.charcoalSoft}12` }}>
                                    <td style={{ padding: "10px", color: COLORS.charcoal, fontWeight: 600 }}>
                                      {item.item_name}
                                    </td>
                                    <td style={{ padding: "10px", color: COLORS.charcoalSoft, textAlign: "center", textTransform: "capitalize" }}>
                                      {item.category || "Handloom"}
                                    </td>
                                    <td style={{ padding: "10px", color: COLORS.charcoal, fontWeight: 700, textAlign: "center" }}>
                                      {item.quantity} pcs
                                    </td>
                                    <td style={{ padding: "10px", color: COLORS.charcoalSoft, textAlign: "right", fontFamily: "var(--sans)" }}>
                                      ₹{item.price_w?.toLocaleString("en-IN")}
                                    </td>
                                    <td style={{ padding: "10px", color: COLORS.indigo, fontWeight: 700, textAlign: "right", fontFamily: "var(--sans)" }}>
                                      ₹{(item.price_w * item.quantity).toLocaleString("en-IN")}
                                    </td>
                                    <td style={{ padding: "10px", textAlign: "center" }}>
                                      <button
                                        onClick={() => handleAddSingleToCart(item)}
                                        style={{
                                          background: "transparent",
                                          border: `1px solid ${COLORS.indigo}40`,
                                          color: COLORS.indigo,
                                          borderRadius: 4,
                                          padding: "3px 8px",
                                          fontSize: 10.5,
                                          fontWeight: 600,
                                          cursor: "pointer",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 2
                                        }}
                                        title="Buy this item again"
                                      >
                                        <Plus size={11} /> Buy Again
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div style={{ textAlign: "center", padding: "10px", color: COLORS.charcoalSoft, fontSize: 12 }}>
                          <button
                            onClick={() => loadOrderItems(o.id)}
                            style={{
                              background: "none",
                              border: "none",
                              color: COLORS.indigo,
                              textDecoration: "underline",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 600
                            }}
                          >
                            Click here to load purchase list
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Order Memo Billing Calculation Block */}
                    <div style={{
                      background: COLORS.cream,
                      borderRadius: 10,
                      padding: "16px",
                      border: `1px solid ${COLORS.charcoalSoft}10`,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      alignItems: "flex-end"
                    }}>
                      <div style={{ width: "100%", maxWidth: 360, fontSize: 12.5, color: COLORS.charcoalSoft }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span>Subtotal Base Amount:</span>
                          <span style={{ fontWeight: 600, color: COLORS.charcoal }}>₹{o.subtotal?.toLocaleString("en-IN")}</span>
                        </div>
                        
                        {o.discount_amount > 0 && (
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, color: COLORS.madder }}>
                            <span>Discount ({o.coupon_code || "Promo"}):</span>
                            <span>−₹{o.discount_amount?.toLocaleString("en-IN")}</span>
                          </div>
                        )}

                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span>GST Tax ({o.gst_rate || 5}%):</span>
                          <span style={{ fontWeight: 600, color: COLORS.charcoal }}>₹{o.gst_amount?.toLocaleString("en-IN")}</span>
                        </div>

                        {o.notes && o.notes.includes("Shipping charge applied:") && (
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span>Shipping Delivery Fee:</span>
                            <span style={{ fontWeight: 600, color: COLORS.charcoal }}>
                              ₹{parseFloat(o.notes.split("Shipping charge applied: ₹")[1]) || 0}
                            </span>
                          </div>
                        )}

                        <div style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginTop: 8,
                          paddingTop: 8,
                          borderTop: `1.5px dashed ${COLORS.charcoalSoft}20`,
                          fontSize: 14,
                          fontWeight: 700,
                          color: COLORS.indigo
                        }}>
                          <span>Total Settlement Value:</span>
                          <span style={{ fontFamily: "var(--sans)", color: COLORS.madder }}>₹{o.total?.toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
