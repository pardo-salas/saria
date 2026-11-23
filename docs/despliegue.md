# Desplegar Saria en Vercel

Guía paso a paso (Fase 0). Nada se despliega solo: lo haces tú. Antes de empezar, ten lista la configuración de Supabase (ver [supabase.md](./supabase.md)).

## 1. Antes de subir el código

En la terminal, dentro de la carpeta del proyecto:

```
git status --ignored
```

Confirma que en la lista de "Ignored files" aparecen `data/` y tus archivos `.env*` (por ejemplo `.env.local`). Si no aparecen, **no subas nada** y revisa el `.gitignore`.

Nunca subas `.env.local` ni nada de `data/`: contienen tus claves y tus datos financieros reales.

## 2. Crear el repositorio en GitHub

1. Entra a <https://github.com/new>.
2. Ponle un nombre (por ejemplo `saria`) y elige **Private** (privado). No agregues README ni .gitignore desde GitHub.
3. Sube la rama `main`. **Hazlo solo después de que la rama de la Fase 0 esté fusionada en `main`**; si no, Vercel desplegará una app vacía.

   ```
   git remote add origin https://github.com/<tu-usuario>/saria.git
   git push -u origin main
   ```

## 3. Importar en Vercel

1. Entra a <https://vercel.com>, inicia sesión (puedes usar tu cuenta de GitHub) y presiona **Add New → Project**.
2. Elige el repositorio `saria` e **Import**.
3. Revisa la configuración:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Node.js Version:** 20.x o superior (el proyecto se probó con Node 24).
4. Todavía no presiones **Deploy**: primero agrega las variables (paso 4).

## 4. Variables de entorno

En la misma pantalla (sección **Environment Variables**), o después en **Settings → Environment Variables**, agrega estas dos, marcadas para **Production** y **Preview**:

| Nombre                   | Valor                                                    |
| ------------------------ | -------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | El **Project URL** de Supabase (`https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | La clave **anon public** de Supabase                     |

Los dos valores están en Supabase: **Project Settings → API**.

- **Nunca** agregues la clave `service_role`: salta la seguridad por fila y daría acceso total a tus datos.
- Las variables `VITE_` se incrustan en la app **al construirla**. Si las cambias después, hay que volver a desplegar (**Deployments → ⋯ → Redeploy**) para que surtan efecto.

Ahora sí, presiona **Deploy**. Al terminar, Vercel te da una URL parecida a `https://saria-xxxx.vercel.app`.

## 5. Decirle a Supabase cuál es tu URL

Copia la URL de producción y úsala en Supabase como **Site URL** y como redirección `/restablecer`. Los pasos exactos están en [supabase.md, sección 5](./supabase.md#5-site-url-y-redirección). Sin esto, el correo de "¿Olvidaste tu contraseña?" te llevará a una dirección equivocada.

## 6. Instalar la app

**Android (Chrome):**

1. Abre tu URL de Vercel en Chrome.
2. Toca el menú ⋮ y elige **Instalar app** (o toca el aviso de instalación si aparece).
3. Confirma. Saria queda como un ícono en tu pantalla de inicio.

**Windows (Chrome o Edge):**

1. Abre tu URL de Vercel.
2. En la barra de direcciones, a la derecha, toca el ícono de instalar y confirma.

## 7. Prueba en modo avión

1. Abre la app instalada **una vez con internet** y espera unos segundos.
2. Activa el modo avión.
3. Cierra la app por completo y vuelve a abrirla.
4. Navega por las 5 pestañas. Debe abrir y funcionar sin conexión.

## 8. Actualizaciones

Cada vez que hagas push a `main`, Vercel despliega solo. La próxima vez que abras la app con internet verás el aviso **Hay una versión nueva**; toca **Actualizar** para cargarla.

## Si algo falla

- **Pantalla en blanco o mensaje "Falta configurar la conexión con Supabase":** faltan las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Vercel (o están mal escritas). Corrígelas y haz **Redeploy**.
- **La app no ofrece instalarse:** necesita HTTPS (la URL de Vercel ya lo es) y haberla visitado al menos una vez. Recarga la página y espera unos segundos.
- **El enlace del correo de restablecer contraseña va a una URL equivocada:** corrige **Site URL** y **Redirect URLs** en Supabase (ver [supabase.md](./supabase.md#5-site-url-y-redirección)).
- **No aparece la versión nueva:** cierra la app por completo y vuelve a abrirla con internet.
