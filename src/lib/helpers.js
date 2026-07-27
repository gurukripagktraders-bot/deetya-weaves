// GST & DISTANCE HELPERS
// =============================================
// Sheet prices are GST-INCLUSIVE (the final selling price already has GST
// baked in), so this extracts the tax portion for invoice display — it does
// NOT add anything on top of the price the retailer is shown.
export function calcGST(inclusivePrice, gstPct) {
  const base = inclusivePrice / (1 + gstPct / 100);
  const gst = inclusivePrice - base;
  return { base: Math.round(base * 100) / 100, gst: Math.round(gst * 100) / 100, total: Math.round(inclusivePrice * 100) / 100 };
}

export function calculateDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return 8.5;
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c * 100) / 100; // distance in km
}

// =============================================
