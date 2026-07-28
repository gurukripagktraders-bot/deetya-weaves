import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

// This is the official Supabase SDK client, used ONLY for authentication
// (Google sign-in, session handling). Regular data reads/writes still go
// through the lightweight fetch-based helper in db.js — this client is not
// a replacement for that, just the auth layer sitting alongside it.
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
