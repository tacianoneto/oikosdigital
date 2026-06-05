import { createClient } from "@supabase/supabase-js";

const fallbackSupabaseUrl = "https://ysqpiutokbxpcwlieqax.supabase.co";
const fallbackSupabasePublishableKey = "sb_publishable_T7q_lGCQkA2P2IvSh03geA_6PEgjUCW";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? fallbackSupabaseUrl;
const supabasePublishableKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? fallbackSupabasePublishableKey;

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
