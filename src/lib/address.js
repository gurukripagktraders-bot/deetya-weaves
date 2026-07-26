// DETAILED ADDRESS HELPERS
// =============================================
export function getStateFromPincode(pincode) {
  const pin = pincode.trim().slice(0, 2);
  if (!pin) return "Rajasthan";
  const code = parseInt(pin, 10);
  if (code >= 30 && code <= 34) return "Rajasthan";
  if (code === 11) return "Delhi";
  if (code >= 12 && code <= 13) return "Haryana";
  if (code >= 14 && code <= 16) return "Punjab";
  if (code >= 20 && code <= 28) return "Uttar Pradesh";
  if (code >= 36 && code <= 39) return "Gujarat";
  if (code >= 40 && code <= 44) return "Maharashtra";
  if (code >= 45 && code <= 48) return "Madhya Pradesh";
  if (code >= 50 && code <= 53) return "Andhra Pradesh";
  if (code >= 56 && code <= 59) return "Karnataka";
  if (code >= 60 && code <= 64) return "Tamil Nadu";
  if (code >= 67 && code <= 69) return "Kerala";
  if (code >= 70 && code <= 74) return "West Bengal";
  if (code >= 80 && code <= 85) return "Bihar";
  return "Rajasthan";
}

export function parseDetailedAddress(addressStr) {
  const defaultObj = { line1: "", line2: "", landmark: "", pincode: "", city: "", state: "Rajasthan" };
  if (!addressStr) return defaultObj;
  
  if (addressStr.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(addressStr);
      return {
        line1: parsed.line1 || "",
        line2: parsed.line2 || "",
        landmark: parsed.landmark || "",
        pincode: parsed.pincode || "",
        city: parsed.city || "",
        state: parsed.state || "Rajasthan"
      };
    } catch (e) {}
  }
  
  if (addressStr.includes("Line 1:")) {
    const parts = addressStr.split(" | ");
    const obj = { ...defaultObj };
    parts.forEach(part => {
      const partsOfPart = part.split(": ");
      const key = partsOfPart[0];
      const val = partsOfPart.slice(1).join(": ").trim();
      if (key === "Line 1") obj.line1 = val;
      else if (key === "Line 2") obj.line2 = val;
      else if (key === "Landmark") obj.landmark = val;
      else if (key === "City") obj.city = val;
      else if (key === "State") obj.state = val;
      else if (key === "Pincode") obj.pincode = val;
    });
    return obj;
  }
  
  // Try to extract pincode if present (6 digits)
  const pinMatch = addressStr.match(/\b\d{6}\b/);
  const pin = pinMatch ? pinMatch[0] : "";
  
  return { ...defaultObj, line1: addressStr, pincode: pin, state: pin ? getStateFromPincode(pin) : "Rajasthan" };
}

export function formatDetailedAddress(obj) {
  return `Line 1: ${obj.line1} | Line 2: ${obj.line2 || ""} | Landmark: ${obj.landmark || ""} | City: ${obj.city} | State: ${obj.state} | Pincode: ${obj.pincode}`;
}

export function getHumanReadableAddress(addressStr) {
  if (!addressStr) return "";
  const parsed = parseDetailedAddress(addressStr);
  if (!parsed.line1) return addressStr;
  const parts = [
    parsed.line1,
    parsed.line2,
    parsed.landmark,
    parsed.city,
    parsed.state ? `${parsed.state} - ${parsed.pincode}` : parsed.pincode
  ].filter(p => p && p.trim().length > 0);
  return parts.join(", ");
}

// =============================================
