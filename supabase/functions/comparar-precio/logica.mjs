// AlumniCar · Comparador de precio contra Mercado Libre
// Lógica pura (sin red): validar entrada, extraer precios, mediana y veredicto.
// La usa index.ts (Supabase Edge Function) y la prueban los tests con Node.

export const ACTOR_APIFY = "sourabhbgp~mercadolibre-scraper";
export const CATEGORIA_AUTOS_MX = "MLM1744"; // Mercado Libre México › Autos y Camionetas
export const MIN_ANUNCIOS = 3;
export const PRECIO_MINIMO_ANUNCIO = 10000; // descarta refacciones/accesorios que se cuelan en la búsqueda

export const MENSAJES = {
  precio_invalido: "Revisa el precio del vendedor: escribe solo números mayores a cero, por ejemplo 350000.",
  datos_invalidos: "Revisa marca, modelo, año y kilometraje.",
  pocos_datos: "Pocos datos para comparar",
  sin_respuesta: "No se pudo consultar el precio, intenta más tarde",
  arriba: "Por encima del mercado",
  en_linea: "En línea con el mercado",
  abajo: "Por debajo del mercado",
};

// Precio del vendedor en MXN. Acepta "350000", "350,000", "$350,000" o "350000.50".
// Vacío, cero, negativo o con letras → null (hay que pedir que se corrija).
export function validarPrecio(entrada) {
  if (entrada === null || entrada === undefined) return null;
  if (typeof entrada === "number") return Number.isFinite(entrada) && entrada > 0 ? entrada : null;
  const limpio = String(entrada).trim().replace(/^\$\s*/, "").replace(/[\s,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  const n = Number(limpio);
  return n > 0 ? n : null;
}

export function validarDatos({ marca, modelo, anio, kilometraje }) {
  const m = String(marca ?? "").trim(), mo = String(modelo ?? "").trim();
  const a = Number(String(anio ?? "").trim());
  const kmTxt = String(kilometraje ?? "").trim().replace(/[\s,]/g, "");
  const ok = m.length > 0 && m.length <= 60 && mo.length > 0 && mo.length <= 60
    && Number.isInteger(a) && a >= 1950 && a <= new Date().getFullYear() + 1
    && /^\d+$/.test(kmTxt);
  return ok ? { marca: m, modelo: mo, anio: a, kilometraje: Number(kmTxt) } : null;
}

// Entrada del actor de Apify para buscar autos usados en Mercado Libre México
export function entradaApify({ marca, modelo, anio }) {
  return {
    mode: "search",
    country: "MX",
    searchQuery: `${marca} ${modelo} ${anio}`,
    categoryId: CATEGORIA_AUTOS_MX,
    condition: "any",
    maxItems: 40,
    scrapeProductDetails: false,
    includeSponsored: false,
  };
}

// De los anuncios que regresa Apify, toma el precio de cada uno que sea del año pedido.
// Si el título trae otro año (p. ej. "Mazda 3 2019" cuando se busca 2021) se descarta.
export function extraerPrecios(anuncios, anio) {
  if (!Array.isArray(anuncios)) return [];
  const vistos = new Set();
  const precios = [];
  for (const a of anuncios) {
    if (!a || typeof a !== "object") continue;
    const precio = typeof a.price === "number" ? a.price : validarPrecio(a.price);
    if (!precio || precio < PRECIO_MINIMO_ANUNCIO) continue;
    if (a.currency && a.currency !== "MXN") continue;
    const anios = String(a.title ?? "").match(/\b(19[5-9]\d|20\d\d)\b/g) || [];
    if (anios.length && !anios.includes(String(anio))) continue;
    const id = a.itemId || a.url || null; // evita contar dos veces el mismo anuncio
    if (id) { if (vistos.has(id)) continue; vistos.add(id); }
    precios.push(precio);
  }
  return precios;
}

export function mediana(valores) {
  const v = [...valores].sort((x, y) => x - y);
  const n = v.length;
  if (!n) return null;
  return n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
}

// Compara en centavos y con enteros para que "exactamente 10%" no falle por redondeo.
export function veredicto(precioVendedor, referencia) {
  const p = Math.round(precioVendedor * 100);
  const r = Math.round(referencia * 100);
  const diferencia = Math.abs(p - r) / 100;
  if ((p - r) * 10 > r) return { estado: "arriba", mensaje: MENSAJES.arriba, diferencia };
  if ((r - p) * 10 > r) return { estado: "abajo", mensaje: MENSAJES.abajo, diferencia };
  return { estado: "en_linea", mensaje: MENSAJES.en_linea, diferencia };
}

// Orquesta todo. `consultarApify(input)` regresa el arreglo de anuncios o lanza un error.
export async function compararPrecio(body, consultarApify) {
  const precio = validarPrecio(body?.precio_vendedor);
  if (precio === null) return { estado: "precio_invalido", mensaje: MENSAJES.precio_invalido };
  const datos = validarDatos(body ?? {});
  if (!datos) return { estado: "datos_invalidos", mensaje: MENSAJES.datos_invalidos };

  let anuncios;
  try {
    anuncios = await consultarApify(entradaApify(datos));
  } catch {
    return { estado: "sin_respuesta", mensaje: MENSAJES.sin_respuesta };
  }
  if (!Array.isArray(anuncios)) return { estado: "sin_respuesta", mensaje: MENSAJES.sin_respuesta };

  const precios = extraerPrecios(anuncios, datos.anio);
  if (precios.length < MIN_ANUNCIOS) {
    return { estado: "pocos_datos", mensaje: MENSAJES.pocos_datos, anuncios: precios.length };
  }
  const referencia = mediana(precios);
  return { ...veredicto(precio, referencia), precio_vendedor: precio, referencia, anuncios: precios.length };
}
