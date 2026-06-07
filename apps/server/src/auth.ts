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

// Supabase rejects with plain objects (PostgrestError / AuthError), not Error
// instances. Wrap them so callers and the socket reply layer always see a real
// Error with a readable message instead of "Erro desconhecido".
function toError(value: unknown, fallback: string): Error {
  if (value instanceof Error) {
    return value;
  }
  if (value && typeof value === "object" && "message" in value && typeof (value as { message?: unknown }).message === "string") {
    return new Error((value as { message: string }).message);
  }
  return new Error(fallback);
}

export async function getUserIdFromAccessToken(accessToken: string): Promise<string> {
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    throw toError(error, "Usuario Supabase nao encontrado.");
  }

  return data.user.id;
}

export async function getUserEntitlements(userId: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase.from("entitlements").select("*").eq("user_id", userId);

  if (error) {
    throw toError(error, "Falha ao consultar liberacoes de especie.");
  }

  return data ?? [];
}
