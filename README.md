# AlumniCar

Sitio web de AlumniCar: coches seminuevos verificados para universitarios en el poniente de la CDMX.
Página estática (`index.html` + `config.js`) con Supabase como base de datos, inicio de sesión y almacenamiento de fotos.
Publicada en Cloudflare en **https://alumnicar.com**.

## Versiones

| Versión | Dónde está | Qué incluye | Estado |
|---|---|---|---|
| **v1.0** | rama `main` · etiqueta `v1.0` | Catálogo, quiz, verificación, beneficios, contacto y panel de administración | **Publicada** en alumnicar.com |
| **v1.1** | rama `comparador-precios` · etiqueta `v1.1` | Todo lo de v1.0 + **comparador de precio contra Mercado Libre** (vía Apify) en el panel de administración | En el repositorio, **todavía no publicada** |

Para ver exactamente qué cambió de una versión a otra:

```bash
git diff v1.0 v1.1
```

## Estructura

```
index.html                       Página completa (sitio + panel de administración)
config.js                        URL y llave pública (anon) de Supabase, WhatsApp, modo muestra
supabase/01_esquema.sql          Tablas, reglas de seguridad (RLS) y carpeta de fotos
supabase/02_coches_de_muestra.sql  24 coches de ejemplo (opcional)
supabase/03_agregar_admin.sql    Dar permiso de administrador a una cuenta
supabase/functions/comparar-precio/   (v1.1) Función que consulta Apify
LEEME.md                         Guía de instalación paso a paso
```

## Comparador de precio (v1.1)

En el panel de administración, pestaña **Comparar precio**: se escriben marca, modelo, año, kilometraje y precio del vendedor (MXN).

1. La página llama a la función de Supabase `comparar-precio`. Solo responde a administradores, porque cada consulta gasta créditos de Apify.
2. La función ejecuta el actor de Apify **[`sourabhbgp/mercadolibre-scraper`](https://apify.com/sourabhbgp/mercadolibre-scraper)**. Busca en Mercado Libre México (`country: MX`), en la categoría Autos y Camionetas (`MLM1744`), con la búsqueda `"<marca> <modelo> <año>"`.
3. De cada anuncio toma el precio. Descarta los de otro año, los que no están en MXN, los repetidos y los de menos de $10,000 (refacciones).
4. El precio de referencia es la **mediana**. Las reglas son:
   - **Menos de 3 anuncios:** "Pocos datos para comparar". No se compara.
   - **Más de 10 % arriba:** "Por encima del mercado", con la diferencia en pesos.
   - **Dentro de ±10 %** (exactamente 10 % cuenta como dentro): "En línea con el mercado".
   - **Más de 10 % abajo:** "Por debajo del mercado", con la diferencia en pesos.
   - **Precio vacío, en cero o con letras:** se pide corregirlo y no se compara.
   - **Si Apify no responde:** "No se pudo consultar el precio, intenta más tarde".

### Token de Apify

El token **nunca** está en el código. La función lo lee de la variable de entorno `APIFY_TOKEN`, que se guarda como secreto en Supabase:

- **Panel de Supabase:** Edge Functions → Secrets → Add new secret → `APIFY_TOKEN`
- **o con la CLI:** `supabase secrets set APIFY_TOKEN=<tu token>`

### Publicar la función en Supabase

```bash
supabase login
supabase link --project-ref dlnrnohdllbnaydiuazk
supabase functions deploy comparar-precio
```

### Pruebas

```bash
node --test supabase/functions/comparar-precio/comparar-precio.test.mjs
```

Son 18 pruebas: validación del precio, mediana, el límite exacto del 10 %, pocos datos, Apify caído, sin token, sin permisos y que el token no aparezca en la URL.
