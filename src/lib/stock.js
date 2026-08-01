// STOCK HELPERS
// =============================================
// Stock now lives in Supabase (product_stock table), not the sheet — these
// helpers fetch it and merge it into the catalog items parsed from the
// sheet, keyed by each variant's stable id (see the SKU column note in
// sheet.js). If a variant isn't in product_stock yet (not migrated/seeded),
// its sheet-provided stock value is kept as a fallback so nothing looks
// falsely out-of-stock during the transition.
import { supabase } from "./db.js";

export async function fetchStockMap() {
  try {
    const rows = await supabase("product_stock?select=variant_key,stock");
    const map = {};
    (rows || []).forEach((r) => { map[r.variant_key] = r.stock; });
    return map;
  } catch {
    return {};
  }
}

export function mergeStock(items, stockMap) {
  if (!stockMap || Object.keys(stockMap).length === 0) return items;
  return items.map((product) => ({
    ...product,
    variants: product.variants.map((variant) => (
      Object.prototype.hasOwnProperty.call(stockMap, variant.id)
        ? { ...variant, stock: stockMap[variant.id] }
        : variant
    )),
  }));
}
