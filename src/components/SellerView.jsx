import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search, CheckCircle2, ShoppingBag, Truck, Package, Wallet, Phone,
  ShieldCheck, User, Bell, ChevronDown, MapPin, FileText,
} from "lucide-react";
import { COLORS, STAGES } from "../lib/config.js";
import { supabase } from "../lib/db.js";
import { StatCard, ThreadDivider, WeavingProgress, Toast } from "./ui/atoms.jsx";

// SELLER DASHBOARD
// =============================================
export default function SellerView({
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

  // Toast notifications (replaces native alert() popups)
  const [toast, setToast] = useState(null); // { message, type }
  const showToast = (message, type = "success") => setToast({ message, type });
  
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
    } catch (e) { showToast("Could not update: " + e.message, "error"); }
    finally { setUpdatingId(null); }
  };

  const updateRetailerStatus = async (id, newStatus) => {
    setApprovingId(id);
    try {
      await supabase(`retailers?id=eq.${id}`, "PATCH", { status: newStatus });
      setAllRetailers(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    } catch (e) { showToast("Could not update status: " + e.message, "error"); }
    finally { setApprovingId(null); }
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
    } catch (e) { showToast("Could not save code: " + e.message, "error"); }
    finally { setSavingCode(false); }
  };

  const toggleCode = async (id, current) => {
    try {
      await supabase(`discount_codes?id=eq.${id}`, "PATCH", { is_active: !current });
      fetchDiscountCodes();
    } catch (e) { showToast("Could not update code.", "error"); }
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
      <div style={{ display:"flex", gap:8, borderBottom:`1.5px solid ${COLORS.ivoryDeep}`, paddingBottom:0, marginTop:18, marginBottom:18, flexWrap:"wrap" }}>
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
                          <span style={{ display:"flex", alignItems:"center", gap:3, color: o.payment_type==="COD" ? COLORS.turmeric : COLORS.sage }}>
                            <Wallet size={11}/>{o.payment_type==="COD" ? "Cash on delivery" : "Paid via bank/QR"}
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

                    {/* Orders Summary card */}
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:16 }}>
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
                                        {new Date(o.created_at).toLocaleDateString("en-IN")} · Total: ₹{o.total?.toLocaleString("en-IN")} · {o.payment_type === "COD" ? "Cash on delivery" : "Bank/QR"}
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
                      showToast("Dispatch location updated to your current GPS coordinates.");
                    },
                    (error) => {
                      showToast("Could not detect location automatically: " + error.message + ". Please enter coordinates manually.", "error");
                    }
                  );
                } else {
                  showToast("Geolocation is not supported by your browser.", "error");
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
                  showToast("Error saving: " + e.message, "error");
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

      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}

// =============================================
