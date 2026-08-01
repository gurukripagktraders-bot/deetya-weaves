import { useState, useEffect, useCallback } from "react";
import { parseSheet } from "../lib/sheet.js";
import { SAMPLE_CSV, DEFAULT_CSV_URL, SYNC_INTERVAL_MS } from "../lib/config.js";
import { fetchStockMap, mergeStock } from "../lib/stock.js";
import { supabaseClient } from "../lib/supabaseClient.js";

export function useSheetData() {
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
      const stockMap = await fetchStockMap();
      setItems(mergeStock(parsed, stockMap)); setUsingSample(false); setLastSynced(new Date());
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { sync(); const t = setInterval(sync, SYNC_INTERVAL_MS); return () => clearInterval(t); }, [sync]);

  // Live stock updates: as soon as an order is placed (anywhere, by any
  // shopper) and place_order() decrements product_stock, this pushes the
  // new number to every open tab instantly — no waiting for the next sync.
  useEffect(() => {
    const channel = supabaseClient
      .channel("product_stock_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "product_stock" }, (payload) => {
        const row = payload.new;
        if (!row || !row.variant_key) return;
        setItems((prev) => prev.map((product) => ({
          ...product,
          variants: product.variants.map((v) => (v.id === row.variant_key ? { ...v, stock: row.stock } : v)),
        })));
      })
      .subscribe();
    return () => { supabaseClient.removeChannel(channel); };
  }, []);

  return { items, usingSample, lastSynced, loading, error, sync };
}

// =============================================
