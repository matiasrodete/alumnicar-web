// AlumniCar · Supabase Edge Function "comparar-precio"
// Compara el precio de un vendedor contra anuncios de Mercado Libre México (vía Apify).
//
// El token de Apify se lee de la variable de entorno APIFY_TOKEN (secreto de Supabase):
//   supabase secrets set APIFY_TOKEN=...      (o en el panel: Edge Functions → Secrets)
// Nunca se escribe en el código.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { crearManejador } from "./manejador.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// ¿La sesión que llama pertenece a un administrador? Usa la función is_admin() del esquema.
async function esAdmin(authHeader: string): Promise<boolean> {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await sb.rpc("is_admin");
  return !error && data === true;
}

Deno.serve(crearManejador({ token: Deno.env.get("APIFY_TOKEN"), esAdmin }));
