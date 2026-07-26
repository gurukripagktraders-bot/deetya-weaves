import Papa from "papaparse";

// SHEET PARSING
// =============================================
export function driveDirectLink(url) {
  if (!url) return null;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  return url;
}

export function parsePhotos(rawString) {
  if (!rawString) return [];
  // Split by comma or semicolon or whitespace, ignoring multiple spaces
  const parts = rawString.split(/[\s,;\n]+/).filter(Boolean);
  return parts.map(part => {
    // Strip any enclosing quotes (which can occur in CSV fields with commas)
    const trimmed = part.replace(/^["']|["']$/g, '').trim();
    if (!trimmed) return null;
    return driveDirectLink(trimmed);
  }).filter(url => url && (url.startsWith("http://") || url.startsWith("https://")));
}

// Flexible column finder — handles extra spaces, different cases, aliases
export function col(row, ...names) {
  for (const name of names) {
    for (const key of Object.keys(row)) {
      if (key.trim().toLowerCase() === name.trim().toLowerCase()) {
        return row[key]?.trim() || "";
      }
    }
  }
  return "";
}

export function parseSheet(csvText) {
  const result = Papa.parse(csvText.trim(), { header: true, skipEmptyLines: true });
  const rows = result.data;
  const grouped = [];
  let currentParent = null;
  let idx = 0;

  rows.forEach((row) => {
    // Skip blank/separator rows but keep currentParent intact
    if (col(row, "item") === "") return;
    const i = idx++;
    const priceW = parseFloat(col(row, "price (w)", "price(w)", "wholesale price", "w price", "price")) || 0;
    const priceR = parseFloat(col(row, "price (r)", "price(r)", "retail price", "mrp", "r price")) || 0;
    const moq = parseInt(col(row, "moq", "min order", "minimum order"), 10) || 12;
    const stockRaw = parseInt(col(row, "stock availabe", "stock available", "stock avail", "quantity", "qty", "stock", "availabe"), 10);
    const stock = Number.isFinite(stockRaw) ? stockRaw : null;
    const variantType = col(row, "variant", "type", "variant type") || "Parent";
    const name = col(row, "item", "item name", "product", "product name");
    const size = col(row, "size", "dimensions");
    const weight = col(row, "weight", "wt", "grams");
    const photos = parsePhotos(col(row, "photo link", "photo", "image", "image link", "photo url"));
    const photo = photos.length > 0 ? photos[0] : null;
    const category = col(row, "category", "cat", "main category", "main cat") || "Uncategorised";
    const subcategory = col(row, "subcategory", "sub category", "sub cat", "sub-category") || "";

    const gstPct = parseFloat(col(row, "gst %", "gst%", "gst", "tax %", "tax")) || 5;
    const isBestseller = col(row, "bestseller", "best seller", "featured").toLowerCase() === "yes";
    const isNewlyAdded = ["yes", "true", "1"].includes(col(row, "newly added", "newlyadded", "new_added", "new", "new arrival").toLowerCase());
    const description = col(row, "description", "desc", "product description");
    const variantObj = { id: "v" + i, label: name, size, weight, priceW, priceR, moq, stock, gstPct };

    if (variantType.toLowerCase() === "child" && currentParent) {
      currentParent.variants.push(variantObj);
    } else {
      const product = { id: "p" + i, name, category, subcategory, photo, photos, variants: [variantObj], gstPct, isBestseller, isNewlyAdded, description };
      grouped.push(product);
      currentParent = product;
    }
  });

  return grouped.filter((p) => p.variants.some((v) => v.priceW > 0));
}

// =============================================
