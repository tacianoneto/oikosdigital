import "./env";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey || supabaseSecretKey === "COLE_A_SECRET_KEY_AQUI") {
  throw new Error("SUPABASE_URL e SUPABASE_SECRET_KEY precisam estar configurados no server.");
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function getUserIdFromAccessToken(accessToken: string): Promise<string> {
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    throw error ?? new Error("Usuario Supabase nao encontrado.");
  }

  return data.user.id;
}
