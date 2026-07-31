import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/db.js";

// FILTER SETTINGS HOOK
// =============================================
export function useFilterSettings() {
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
  const [saveError, setSaveError] = useState(null);

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
    } catch (e) { setSaveError(e.message); }
    finally { setSaving(false); }
  };

  return { settings: cleanSettings, rawSettings: settings, setSettings, save, saving, saveError };
}

