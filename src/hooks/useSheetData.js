import { useState, useEffect, useCallback } from "react";
import { parseSheet } from "../lib/sheet.js";
import { SAMPLE_CSV, DEFAULT_CSV_URL, SYNC_INTERVAL_MS } from "../lib/config.js";

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
      setItems(parsed); setUsingSample(false); setLastSynced(new Date());
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { sync(); const t = setInterval(sync, SYNC_INTERVAL_MS); return () => clearInterval(t); }, [sync]);
  return { items, usingSample, lastSynced, loading, error, sync };
}

// =============================================
