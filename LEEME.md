# AlumniCar · cómo publicar la web en tu dominio

La web es un solo archivo (`index.html`) más `config.js`. El inventario, el inicio de sesión de administradores, las fotos y las solicitudes del formulario viven en **Supabase**. La página se publica en **Vercel**.

Tiempo estimado: 30–45 minutos la primera vez.

---

## 1. Crear el proyecto de Supabase

1. Entra a <https://supabase.com> y crea una cuenta.
2. **New project** → nombre `alumnicar`, región **East US (North Virginia)** o la más cercana a México, y guarda la contraseña de la base de datos en un lugar seguro.
3. Espera 1–2 minutos a que termine de crearse.

## 2. Crear las tablas y reglas

1. En el menú izquierdo: **SQL Editor → New query**.
2. Abre `supabase/01_esquema.sql`, copia todo, pégalo y da **Run**. Debe decir *Success*.
3. (Opcional) Para ver la página con los 24 coches de ejemplo, repite con `supabase/02_coches_de_muestra.sql`.
   Para borrarlos después: `delete from public.cars where demo = true;`

## 3. Crear tu usuario de administrador

1. **Authentication → Users → Add user → Create new user**.
2. Escribe tu correo y una contraseña segura, y activa **Auto Confirm User**.
3. Abre `supabase/03_agregar_admin.sql`, cambia `CAMBIA-ESTE-CORREO@ejemplo.com` por ese correo, pégalo en el SQL Editor y da **Run**.

Repite el paso 3 para cada persona del equipo que deba administrar. Nadie más puede publicar, editar ni ver las solicitudes, aunque tenga una cuenta.

## 4. Conectar la página con Supabase

1. En Supabase: **Project Settings → API**.
2. Copia **Project URL** y la llave **anon public**.
3. Abre `config.js` y pégalas en `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
4. Cambia `WHATSAPP` por el número real (52 + 10 dígitos, sin espacios).
5. Cuando cargues el inventario real, cambia `DEMO: true` por `DEMO: false`.

> La llave **anon** es pública por diseño; lo que protege los datos son las reglas del paso 2.
> **Nunca** pongas la llave `service_role` en `config.js`.

## 5. Publicar en Vercel

Vercel no acepta arrastrar carpetas; se publica con un comando desde la Terminal (no necesitas saber programar).

1. Crea tu cuenta en <https://vercel.com> (puedes entrar con tu correo o con GitHub).
2. Abre la Terminal y entra a esta carpeta:
   ```bash
   cd ~/Documents/Claude/Projects/alumnicar-web
   ```
3. Inicia sesión (se abre el navegador para confirmar):
   ```bash
   npx vercel login
   ```
4. Publica:
   ```bash
   npx vercel --prod
   ```
   Contesta las preguntas: *Set up and deploy?* → **Y** · *Which scope?* → tu cuenta · *Link to existing project?* → **N** · nombre → **alumnicar** · directorio → **./** (Enter) · *Modify settings?* → **N**.
5. Al final te da una dirección tipo `https://alumnicar.vercel.app`. Abre `…/#admin` para entrar al panel.

Cada vez que cambies algo (por ejemplo `config.js`), vuelve a correr `npx vercel --prod` desde esta carpeta.
La carpeta `supabase/` y este LEEME no se publican (lo indica el archivo `.vercelignore`).

## 6. Conectar tu dominio

1. En Vercel: **Project → Settings → Domains → Add** → `alumnicar.com` (y `www.alumnicar.com`).
2. Vercel te muestra los registros DNS que tienes que copiar en donde compraste el dominio.
3. En Supabase: **Authentication → URL Configuration**:
   - **Site URL**: `https://alumnicar.com`
   - **Redirect URLs**: agrega `https://alumnicar.com/**` y `https://alumnicar.vercel.app/**`
   (Esto hace que funcione el correo de "¿Olvidaste tu contraseña?").

---

## Uso diario del panel (`tudominio.com/#admin`, o el botón **Admin** del pie de página)

- **+ Nueva publicación**: llena los datos, agrega fotos (la primera es la portada) y da **Publicar coche**. La referencia (AC-0125…) se asigna sola.
- **Estado**: cambia entre Disponible, Apartado y Vendido. Un coche vendido desaparece de la página pero queda guardado en la pestaña **Vendidos**.
- **Editar / Eliminar**: eliminar borra el coche y sus fotos para siempre.
- **Solicitudes nuevas**: aquí llegan los mensajes del formulario de contacto. Márcalas como atendidas cuando respondas.

## Cosas a tener en cuenta

- **Tapa las placas** en las fotos antes de subirlas.
- El plan gratuito de Supabase **pausa el proyecto tras una semana sin visitas**; con tráfico normal no pasa. Revisa los límites y precios actuales en su página.
- Al quitar una foto de una publicación (sin borrar el coche), el archivo sigue guardado en Storage. Si llegas al límite de espacio, bórralos en **Storage → car-photos**.
- El formulario tiene una protección simple contra spam. Si empiezan a llegar mensajes basura, se puede agregar un captcha.
