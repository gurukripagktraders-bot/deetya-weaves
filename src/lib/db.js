import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

// SUPABASE HELPER WITH LOCAL STORAGE FALLBACK
// =============================================
export function getLocalCollection(name) {
  try {
    const raw = localStorage.getItem(`deetya_db_${name}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Local storage read error", e);
  }

  // Seed data if empty
  if (name === "filter_settings") {
    const defaultSettings = [
      {
        id: "main",
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
      }
    ];
    saveLocalCollection(name, defaultSettings);
    return defaultSettings;
  }

  if (name === "discount_codes") {
    const defaultCodes = [
      { id: "d1", code: "WELCOME10", discount_type: "percentage", discount_value: 10, min_order_value: 0, times_used: 0, max_uses: 100, is_active: true, created_at: new Date().toISOString() },
      { id: "d2", code: "DEETYA50", discount_type: "flat", discount_value: 50, min_order_value: 500, times_used: 0, max_uses: 100, is_active: true, created_at: new Date().toISOString() },
    ];
    saveLocalCollection(name, defaultCodes);
    return defaultCodes;
  }

  if (name === "retailers") {
    const defaultRetailers = [
      {
        id: "r_admin",
        phone: "9999999999",
        shop_name: "Deetya Weaves Admin",
        owner_name: "Admin",
        status: "approved",
        phone_verified: true,
        email_verified: true,
        email: "admin@deetyaweaves.com",
        is_admin: true,
        created_at: new Date().toISOString()
      }
    ];
    saveLocalCollection(name, defaultRetailers);
    return defaultRetailers;
  }

  return [];
}

export function saveLocalCollection(name, data) {
  try {
    localStorage.setItem(`deetya_db_${name}`, JSON.stringify(data));
  } catch (e) {
    console.error("Local storage write error", e);
  }
}

export function runLocalDb(table, method = "GET", body = null, extra = "") {
  const [tableName, queryStr] = table.split("?");
  let data = getLocalCollection(tableName);

  // Parse filters
  const filters = {};
  if (queryStr) {
    const parts = queryStr.split("&");
    parts.forEach(p => {
      const [key, val] = p.split("=");
      if (key && val && val.startsWith("eq.")) {
        let actualVal = val.slice(3);
        if (actualVal === "true") actualVal = true;
        if (actualVal === "false") actualVal = false;
        filters[key] = decodeURIComponent(actualVal);
      }
    });
  }

  if (method === "GET") {
    let result = data.filter(item => {
      for (const [key, val] of Object.entries(filters)) {
        if (String(item[key]) !== String(val)) {
          return false;
        }
      }
      return true;
    });

    if (queryStr && queryStr.includes("order=created_at.desc")) {
      result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    const limitMatch = queryStr && queryStr.match(/limit=(\d+)/);
    if (limitMatch) {
      const limit = parseInt(limitMatch[1], 10);
      result = result.slice(0, limit);
    }

    return result;
  }

  if (method === "POST") {
    const makeItem = (b) => ({
      id: b.id || (tableName.slice(0, 2) + "_" + Math.random().toString(36).slice(2, 9)),
      created_at: new Date().toISOString(),
      ...b
    });

    if (Array.isArray(body)) {
      const insertedList = body.map(makeItem);
      data.push(...insertedList);
      saveLocalCollection(tableName, data);
      return insertedList;
    } else {
      const newItem = makeItem(body);
      data.push(newItem);
      saveLocalCollection(tableName, data);
      return [newItem];
    }
  }

  if (method === "PATCH") {
    const updatedList = [];
    data = data.map(item => {
      let matches = true;
      for (const [key, val] of Object.entries(filters)) {
        if (String(item[key]) !== String(val)) {
          matches = false;
          break;
        }
      }
      if (matches) {
        const updatedItem = { ...item, ...body, updated_at: new Date().toISOString() };
        updatedList.push(updatedItem);
        return updatedItem;
      }
      return item;
    });

    saveLocalCollection(tableName, data);
    return updatedList;
  }

  if (method === "DELETE") {
    data = data.filter(item => {
      let matches = true;
      for (const [key, val] of Object.entries(filters)) {
        if (String(item[key]) !== String(val)) {
          matches = false;
          break;
        }
      }
      return !matches;
    });
    saveLocalCollection(tableName, data);
    return null;
  }

  return [];
}

export async function supabase(table, method = "GET", body = null, extra = "") {
  try {
    const headers = {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    };
    if (method === "POST") headers["Prefer"] = "return=representation";
    if (method === "PATCH") headers["Prefer"] = "return=representation";

    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${extra}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      let errMsg = `Supabase error ${res.status}`;
      try { errMsg = JSON.parse(errText).message || errMsg; } catch {}
      throw new Error(errMsg);
    }
    if (method === "DELETE") return null;
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  } catch (error) {
    console.warn("Supabase network error, falling back on Local Storage Database:", error);
    return runLocalDb(table, method, body, extra);
  }
}

