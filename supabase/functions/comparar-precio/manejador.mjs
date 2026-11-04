// AlumniCar · manejo de la petición HTTP del comparador (sin dependencias de Deno,
// para poder probarlo con Node). index.ts solo conecta esto con Deno y Supabase.
import { ACTOR_APIFY, MENSAJES, compararPrecio } from "./logica.mjs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Llama al actor de Apify y regresa los anuncios. Lanza error si Apify no responde bien.
export function consultarApifyCon(token, fetchFn = fetch, timeoutMs = 110000) {
  return async (input) => {
    const url = `https://api.apify.com/v2/acts/${ACTOR_APIFY}/run-sync-get-dataset-items?timeout=100&format=json`;
    const r = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) throw new Error(`Apify respondió ${r.status}`);
    return await r.json();
  };
}

// deps: { token: string|undefined, esAdmin(authHeader) => Promise<boolean>, fetchFn? }
export function crearManejador({ token, esAdmin, fetchFn = fetch }) {
  return async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (req.method !== "POST") return json({ estado: "error", mensaje: "Método no permitido" }, 405);

    // Solo administradores: cada consulta a Apify cuesta créditos
    const auth = req.headers.get("Authorization") || "";
    if (!auth || !(await esAdmin(auth).catch(() => false))) {
      return json({ estado: "no_autorizado", mensaje: "Solo los administradores pueden comparar precios." }, 401);
    }

    let body;
    try { body = await req.json(); } catch { body = {}; }

    // Sin token configurado no se puede consultar: mismo mensaje que si Apify no respondiera
    const consultar = token ? consultarApifyCon(token, fetchFn) : async () => { throw new Error("Falta APIFY_TOKEN"); };
    const resultado = await compararPrecio(body, consultar);
    return json(resultado);
  };
}

export { MENSAJES };
