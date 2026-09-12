import React, { useState, useEffect, useMemo } from "react";
import { TrendingUp, Users, Package, Tag, RefreshCw } from "lucide-react";
import { COLORS } from "../lib/config.js";
import { supabase } from "../lib/db.js";
import { StatCard, ThreadDivider } from "./ui/atoms.jsx";

const PERIODS = [
  { id: 30, label: "Last 30 days" },
  { id: 90, label: "Last 90 days" },
  { id: 365, label: "Last 12 months" },
  { id: null, label: "All time" },
];

export default function AnalyticsPanel() {
  const [orders, setOrders] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [discountCodes, setDiscountCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [periodDays, setPeriodDays] = useState(90);

  const loadData = async () => {
    setLoading(true); setError("");
    try {
      const [ordersData, itemsData, codesData] = await Promise.all([
        supabase("orders?select=id,total,gst_amount,discount_amount,coupon_code,retailer_id,retailer_name,stage,payment_type,created_at&order=created_at.desc&limit=5000"),
        supabase("order_items?select=item_name,category,quantity,price_w,order_id&limit=20000"),
        supabase("discount_codes?select=code,times_used,discount_type,discount_value,is_active"),
      ]);
      setOrders(ordersData || []);
      setOrderItems(itemsData || []);
      setDiscountCodes(codesData || []);
    } catch (e) {
      setError("Could not load analytics data: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Filter to the selected period, and build a lookup of orderId -> order
  // (used to join order_items back to their parent order's date/status).
  const { periodOrders, orderById } = useMemo(() => {
    const cutoff = periodDays ? Date.now() - periodDays * 24 * 60 * 60 * 1000 : 0;
    const filtered = orders.filter((o) => new Date(o.created_at).getTime() >= cutoff);
    const byId = {};
    orders.forEach((o) => { byId[o.id] = o; });
    return { periodOrders: filtered, orderById: byId };
  }, [orders, periodDays]);

  const nonCancelled = useMemo(() => periodOrders.filter((o) => o.stage !== "Cancelled"), [periodOrders]);

  const kpis = useMemo(() => {
    const revenue = nonCancelled.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalOrders = nonCancelled.length;
    const avgOrderValue = totalOrders > 0 ? revenue / totalOrders : 0;
    const distinctRetailers = new Set(nonCancelled.map((o) => o.retailer_id)).size;
    return { revenue, totalOrders, avgOrderValue, distinctRetailers };
  }, [nonCancelled]);

  // Revenue bucketed into weeks, for a simple bar visualization.
  const weeklyRevenue = useMemo(() => {
    const buckets = {};
    nonCancelled.forEach((o) => {
      const d = new Date(o.created_at);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      buckets[key] = (buckets[key] || 0) + (o.total || 0);
    });
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([week, total]) => ({ week, total }));
  }, [nonCancelled]);

  // Only count line items belonging to non-cancelled orders within the period.
  const periodOrderIdSet = useMemo(() => new Set(nonCancelled.map((o) => o.id)), [nonCancelled]);
  const relevantItems = useMemo(() => orderItems.filter((i) => periodOrderIdSet.has(i.order_id)), [orderItems, periodOrderIdSet]);

  const topProducts = useMemo(() => {
    const byName = {};
    relevantItems.forEach((i) => {
      if (!byName[i.item_name]) byName[i.item_name] = { name: i.item_name, quantity: 0, revenue: 0 };
      byName[i.item_name].quantity += i.quantity || 0;
      byName[i.item_name].revenue += (i.price_w || 0) * (i.quantity || 0);
    });
    return Object.values(byName).sort((a, b) => b.quantity - a.quantity).slice(0, 10);
  }, [relevantItems]);

  const topCategories = useMemo(() => {
    const byCat = {};
    relevantItems.forEach((i) => {
      const cat = i.category || "Uncategorised";
      byCat[cat] = (byCat[cat] || 0) + (i.price_w || 0) * (i.quantity || 0);
    });
    return Object.entries(byCat).sort(([, a], [, b]) => b - a).slice(0, 8).map(([category, revenue]) => ({ category, revenue }));
  }, [relevantItems]);

  const retailerBreakdown = useMemo(() => {
    const byRetailer = {};
    nonCancelled.forEach((o) => {
      const key = o.retailer_id || o.retailer_name;
      if (!byRetailer[key]) byRetailer[key] = { name: o.retailer_name, orders: 0, spend: 0 };
      byRetailer[key].orders += 1;
      byRetailer[key].spend += o.total || 0;
    });
    const list = Object.values(byRetailer).sort((a, b) => b.spend - a.spend);
    const repeatCount = list.filter((r) => r.orders > 1).length;
    const repeatRate = list.length > 0 ? Math.round((repeatCount / list.length) * 100) : 0;
    return { top: list.slice(0, 10), repeatRate, totalRetailers: list.length };
  }, [nonCancelled]);

  const codePerformance = useMemo(() => {
    return discountCodes.map((c) => {
      const codeOrders = nonCancelled.filter((o) => o.coupon_code === c.code);
      const discountGiven = codeOrders.reduce((sum, o) => sum + (o.discount_amount || 0), 0);
      const revenueInfluenced = codeOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      return { ...c, ordersInPeriod: codeOrders.length, discountGiven, revenueInfluenced };
    }).sort((a, b) => b.ordersInPeriod - a.ordersInPeriod);
  }, [discountCodes, nonCancelled]);

  const maxWeekRevenue = Math.max(1, ...weeklyRevenue.map((w) => w.total));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <div>
          <h3 style={{ fontFamily: "var(--serif)", fontSize: 19, color: COLORS.indigo, margin: 0 }}>Analytics & Insights</h3>
          <p style={{ color: COLORS.charcoalSoft, fontSize: 12.5, marginTop: 4 }}>Built entirely from your existing order data — nothing external, nothing tracked.</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4, background: COLORS.ivoryDeep + "55", padding: 4, borderRadius: 8 }}>
            {PERIODS.map((p) => (
              <button key={p.id ?? "all"} onClick={() => setPeriodDays(p.id)}
                style={{
                  fontSize: 11.5, padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "var(--sans)",
                  background: periodDays === p.id ? COLORS.indigo : "transparent",
                  color: periodDays === p.id ? COLORS.cream : COLORS.charcoalSoft,
                }}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={loadData} disabled={loading} title="Refresh"
            style={{ background: "transparent", border: `1px solid ${COLORS.charcoalSoft}44`, borderRadius: 7, padding: "6px 8px", cursor: "pointer", display: "flex" }}>
            <RefreshCw size={13} color={COLORS.charcoalSoft} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
          </button>
        </div>
      </div>

      {error && <div style={{ color: COLORS.madder, fontSize: 12.5, marginBottom: 14 }}>{error}</div>}

      {loading ? (
        <div style={{ color: COLORS.charcoalSoft, fontSize: 13 }}>Loading analytics…</div>
      ) : nonCancelled.length === 0 ? (
        <div style={{ color: COLORS.charcoalSoft, fontSize: 13, padding: "20px 0" }}>No orders in this period yet.</div>
      ) : (
        <>
          {/* KPI row */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
            <StatCard label="Revenue" value={`₹${Math.round(kpis.revenue).toLocaleString("en-IN")}`} accent={COLORS.sage} />
            <StatCard label="Orders" value={kpis.totalOrders} />
            <StatCard label="Avg. order value" value={`₹${Math.round(kpis.avgOrderValue).toLocaleString("en-IN")}`} />
            <StatCard label="Active retailers" value={kpis.distinctRetailers} sub={`${retailerBreakdown.repeatRate}% ordered more than once`} />
          </div>

          {/* Revenue over time */}
          <ThreadDivider />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <TrendingUp size={16} color={COLORS.indigo} />
            <h4 style={{ fontFamily: "var(--serif)", fontSize: 15.5, color: COLORS.charcoal, margin: 0 }}>Revenue by week</h4>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100, marginBottom: 8, padding: "0 4px" }}>
            {weeklyRevenue.map((w) => (
              <div key={w.week} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }} title={`₹${Math.round(w.total).toLocaleString("en-IN")}`}>
                <div style={{
                  width: "100%", maxWidth: 28, borderRadius: "4px 4px 0 0",
                  background: COLORS.indigo, opacity: 0.85,
                  height: `${Math.max(4, (w.total / maxWeekRevenue) * 80)}px`,
                }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, padding: "0 4px", marginBottom: 24 }}>
            {weeklyRevenue.map((w) => (
              <div key={w.week} style={{ flex: 1, fontSize: 8.5, color: COLORS.charcoalSoft, textAlign: "center", maxWidth: 28 }}>
                {new Date(w.week).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </div>
            ))}
          </div>

          {/* Two-column: top products / top categories */}
          <ThreadDivider />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, marginBottom: 24 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Package size={16} color={COLORS.indigo} />
                <h4 style={{ fontFamily: "var(--serif)", fontSize: 15.5, color: COLORS.charcoal, margin: 0 }}>Top-selling products</h4>
              </div>
              {topProducts.length === 0 ? (
                <div style={{ fontSize: 12, color: COLORS.charcoalSoft }}>No sales data yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {topProducts.map((p, i) => (
                    <div key={p.name + i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "8px 10px", background: COLORS.ivoryDeep + "44", borderRadius: 7 }}>
                      <span style={{ color: COLORS.charcoal }}>{i + 1}. {p.name}</span>
                      <span style={{ color: COLORS.charcoalSoft, whiteSpace: "nowrap", marginLeft: 8 }}>{p.quantity} pcs · ₹{Math.round(p.revenue).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Tag size={16} color={COLORS.indigo} />
                <h4 style={{ fontFamily: "var(--serif)", fontSize: 15.5, color: COLORS.charcoal, margin: 0 }}>Top categories by revenue</h4>
              </div>
              {topCategories.length === 0 ? (
                <div style={{ fontSize: 12, color: COLORS.charcoalSoft }}>No sales data yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {topCategories.map((c, i) => {
                    const maxRev = topCategories[0].revenue || 1;
                    return (
                      <div key={c.category} style={{ fontSize: 12.5 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ color: COLORS.charcoal }}>{c.category}</span>
                          <span style={{ color: COLORS.charcoalSoft }}>₹{Math.round(c.revenue).toLocaleString("en-IN")}</span>
                        </div>
                        <div style={{ background: COLORS.ivoryDeep, borderRadius: 4, height: 6, overflow: "hidden" }}>
                          <div style={{ width: `${(c.revenue / maxRev) * 100}%`, height: "100%", background: COLORS.turmeric, borderRadius: 4 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Retailer breakdown */}
          <ThreadDivider />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Users size={16} color={COLORS.indigo} />
            <h4 style={{ fontFamily: "var(--serif)", fontSize: 15.5, color: COLORS.charcoal, margin: 0 }}>Top retailers by spend</h4>
          </div>
          <div style={{ overflowX: "auto", marginBottom: 24 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: `1.5px solid ${COLORS.ivoryDeep}` }}>
                  {["Retailer", "Orders", "Total spend"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: COLORS.charcoalSoft, fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {retailerBreakdown.top.map((r, i) => (
                  <tr key={r.name + i} style={{ borderBottom: `1px solid ${COLORS.ivoryDeep}66` }}>
                    <td style={{ padding: "8px 10px", color: COLORS.charcoal }}>{r.name}</td>
                    <td style={{ padding: "8px 10px", color: COLORS.charcoalSoft }}>{r.orders}{r.orders > 1 ? " (repeat)" : ""}</td>
                    <td style={{ padding: "8px 10px", color: COLORS.charcoal, fontWeight: 500 }}>₹{Math.round(r.spend).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Discount code performance */}
          {codePerformance.length > 0 && (
            <>
              <ThreadDivider />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Tag size={16} color={COLORS.indigo} />
                <h4 style={{ fontFamily: "var(--serif)", fontSize: 15.5, color: COLORS.charcoal, margin: 0 }}>Discount code performance (this period)</h4>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ borderBottom: `1.5px solid ${COLORS.ivoryDeep}` }}>
                      {["Code", "Status", "Orders in period", "Discount given", "Revenue influenced"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: COLORS.charcoalSoft, fontWeight: 600, fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {codePerformance.map((c) => (
                      <tr key={c.code} style={{ borderBottom: `1px solid ${COLORS.ivoryDeep}66` }}>
                        <td style={{ padding: "8px 10px", color: COLORS.charcoal, fontWeight: 600 }}>{c.code}</td>
                        <td style={{ padding: "8px 10px" }}>
                          <span style={{ fontSize: 11, color: c.is_active ? COLORS.sage : COLORS.charcoalSoft }}>{c.is_active ? "Active" : "Inactive"}</span>
                        </td>
                        <td style={{ padding: "8px 10px", color: COLORS.charcoalSoft }}>{c.ordersInPeriod}</td>
                        <td style={{ padding: "8px 10px", color: COLORS.charcoalSoft }}>₹{Math.round(c.discountGiven).toLocaleString("en-IN")}</td>
                        <td style={{ padding: "8px 10px", color: COLORS.charcoal }}>₹{Math.round(c.revenueInfluenced).toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
