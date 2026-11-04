// Pruebas del comparador de precio. Correr con:  node --test supabase/functions/comparar-precio/
import { test } from "node:test";
import assert from "node:assert/strict";
import { validarPrecio, extraerPrecios, mediana, veredicto, compararPrecio, MENSAJES, entradaApify } from "./logica.mjs";
import { crearManejador } from "./manejador.mjs";

const base = { marca: "Mazda", modelo: "3", anio: "2021", kilometraje: "52000" };
const anuncio = (price, extra = {}) => ({ title: "Mazda 3 2021 I Grand Touring", price, currency: "MXN", itemId: "MLM" + Math.random(), ...extra });
const apifyCon = (precios) => async () => precios.map(p => anuncio(p));

// --- validación del precio ---
test("precio vacío, cero, negativo o con letras → inválido", () => {
  for (const v of ["", "   ", null, undefined, "0", 0, "0.00", "-5", "abc", "350mil", "35O000", "1e5", "$", "350 000 pesos"]) {
    assert.equal(validarPrecio(v), null, `debería rechazar ${JSON.stringify(v)}`);
  }
});
test("precio con formatos válidos", () => {
  assert.equal(validarPrecio("350000"), 350000);
  assert.equal(validarPrecio("350,000"), 350000);
  assert.equal(validarPrecio("$350,000"), 350000);
  assert.equal(validarPrecio(" 350000.50 "), 350000.5);
  assert.equal(validarPrecio(350000), 350000);
});
test("precio inválido no consulta Apify", async () => {
  let llamado = false;
  for (const p of ["", "0", "abc"]) {
    const r = await compararPrecio({ ...base, precio_vendedor: p }, async () => { llamado = true; return []; });
    assert.equal(r.estado, "precio_invalido");
    assert.equal(r.mensaje, MENSAJES.precio_invalido);
  }
  assert.equal(llamado, false);
});

// --- mediana ---
test("mediana con número impar y par de precios", () => {
  assert.equal(mediana([300, 100, 200]), 200);
  assert.equal(mediana([400, 100, 300, 200]), 250);
});

// --- reglas de comparación (referencia = 400,000) ---
test("más de 10% arriba → Por encima del mercado + diferencia", () => {
  assert.deepEqual(veredicto(440001, 400000), { estado: "arriba", mensaje: "Por encima del mercado", diferencia: 40001 });
});
test("exactamente +10% → En línea con el mercado", () => {
  assert.equal(veredicto(440000, 400000).estado, "en_linea");
});
test("exactamente -10% → En línea con el mercado", () => {
  assert.equal(veredicto(360000, 400000).estado, "en_linea");
});
test("más de 10% abajo → Por debajo del mercado + diferencia", () => {
  assert.deepEqual(veredicto(359999, 400000), { estado: "abajo", mensaje: "Por debajo del mercado", diferencia: 40001 });
});
test("10% exacto con decimales no falla por redondeo", () => {
  assert.equal(veredicto(366666.3, 333333).estado, "en_linea");     // +10% exacto
  assert.equal(veredicto(366666.31, 333333).estado, "arriba");
});

// --- flujo completo ---
test("menos de 3 anuncios → Pocos datos para comparar (no compara)", async () => {
  const r = await compararPrecio({ ...base, precio_vendedor: "400000" }, apifyCon([380000, 420000]));
  assert.equal(r.estado, "pocos_datos");
  assert.equal(r.mensaje, "Pocos datos para comparar");
  assert.equal(r.referencia, undefined);
});
test("3 anuncios ya alcanzan; la referencia es la mediana", async () => {
  const r = await compararPrecio({ ...base, precio_vendedor: "500000" }, apifyCon([380000, 400000, 900000]));
  assert.equal(r.referencia, 400000);
  assert.equal(r.estado, "arriba");
  assert.equal(r.diferencia, 100000);
  assert.equal(r.anuncios, 3);
});
test("Apify no responde (error o timeout) → mensaje de intentar más tarde", async () => {
  const r = await compararPrecio({ ...base, precio_vendedor: "400000" }, async () => { throw new Error("timeout"); });
  assert.equal(r.mensaje, "No se pudo consultar el precio, intenta más tarde");
});
test("se descartan anuncios de otro año, otra moneda, repetidos o con precio de refacción", () => {
  const precios = extraerPrecios([
    anuncio(400000),
    anuncio(380000, { title: "Mazda 3 2019 Touring" }),   // otro año
    anuncio(20000, { currency: "USD" }),                  // otra moneda
    anuncio(1500, { title: "Tapete Mazda 3" }),           // refacción
    anuncio(410000, { itemId: "X" }), anuncio(410000, { itemId: "X" }), // repetido
    anuncio(395000, { title: "Mazda 3 Sedán i Sport" }),  // sin año en título: se conserva
  ], 2021);
  assert.deepEqual(precios, [400000, 410000, 395000]);
});
test("la búsqueda en Apify usa México, la categoría de autos y marca+modelo+año", () => {
  const e = entradaApify({ marca: "Mazda", modelo: "3", anio: 2021 });
  assert.equal(e.country, "MX");
  assert.equal(e.categoryId, "MLM1744");
  assert.equal(e.searchQuery, "Mazda 3 2021");
});

// --- manejador HTTP ---
const pedir = (body, auth = "Bearer x") =>
  new Request("http://x/comparar-precio", { method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("sin sesión de administrador → 401 y no consulta Apify", async () => {
  let llamado = false;
  const h = crearManejador({ token: "t", esAdmin: async () => false, fetchFn: async () => { llamado = true; } });
  const r = await h(pedir({ ...base, precio_vendedor: "400000" }));
  assert.equal(r.status, 401);
  assert.equal(llamado, false);
});
test("sin APIFY_TOKEN → No se pudo consultar el precio", async () => {
  const h = crearManejador({ token: undefined, esAdmin: async () => true });
  const r = await (await h(pedir({ ...base, precio_vendedor: "400000" }))).json();
  assert.equal(r.mensaje, "No se pudo consultar el precio, intenta más tarde");
});
test("Apify responde error HTTP → No se pudo consultar el precio", async () => {
  const h = crearManejador({ token: "t", esAdmin: async () => true, fetchFn: async () => new Response("x", { status: 502 }) });
  const r = await (await h(pedir({ ...base, precio_vendedor: "400000" }))).json();
  assert.equal(r.estado, "sin_respuesta");
});
test("el token va en el encabezado Authorization, no en la URL", async () => {
  let visto;
  const h = crearManejador({ token: "SECRETO", esAdmin: async () => true, fetchFn: async (url, opt) => {
    visto = { url, auth: opt.headers.Authorization, body: JSON.parse(opt.body) };
    return Response.json([anuncio(390000), anuncio(400000), anuncio(410000)]);
  } });
  const r = await (await h(pedir({ ...base, precio_vendedor: "400000" }))).json();
  assert.equal(r.estado, "en_linea");
  assert.ok(!visto.url.includes("SECRETO"));
  assert.equal(visto.auth, "Bearer SECRETO");
  assert.ok(visto.url.includes("sourabhbgp~mercadolibre-scraper"));
  assert.equal(visto.body.searchQuery, "Mazda 3 2021");
});
