# Configurar Supabase para Saria

Guía paso a paso (Fase 0). La migración no se ejecuta sola: la aplicas tú en el SQL Editor.

Tu URL de producción de Vercel aparece abajo como `https://<tu-app>.vercel.app`. Reemplázala por la real.

## 1. Crear el proyecto

1. Entra a <https://supabase.com> e inicia sesión.
2. Crea un proyecto nuevo (nombre sugerido: `saria`). Elige la región más cercana (por ejemplo, East US) y guarda la contraseña de la base de datos.
3. Espera a que termine de aprovisionarse.

## 2. Aplicar la migración

1. En el panel, abre **SQL Editor** y crea una consulta nueva.
2. Copia todo el contenido de `supabase/migrations/0001_init.sql` y pégalo.
3. Presiona **Run**. Debe terminar sin errores.
4. En **Table Editor** verifica que existen 8 tablas: `accounts`, `categories`, `transactions`, `transfers`, `recurring_payments`, `reminders`, `installment_plans` y `settings`, y ninguna muestra la etiqueta **Unrestricted** (si alguna la muestra, RLS no quedó activo: revisa que la migración se ejecutó completa).

Alternativa con la CLI: `supabase link` y luego `supabase db push`.

### Aplicar 0002 (Fase 4)

Antes de publicar la Fase 4, aplica la segunda migración (agrega la categoría a las compras a meses):

1. En **SQL Editor**, crea una consulta nueva.
2. Copia todo el contenido de `supabase/migrations/0002_installment_category.sql` y pégalo.
3. Presiona **Run**. Debe terminar sin errores.
4. En **Table Editor**, `installment_plans` debe mostrar la columna `category_id`.

## 3. Desactivar el registro de usuarios

1. Ve a **Authentication → Providers → Email**.
2. Desactiva **Allow new users to sign up**.
3. Guarda.

Así nadie más puede crear una cuenta; la app tampoco ofrece esa opción.

## 4. Crear tu usuario a mano

1. Ve a **Authentication → Users → Add user → Create new user**.
2. Escribe tu email y una contraseña. Marca **Auto Confirm User**.
3. Crea el usuario.

## 5. Site URL y redirección

1. Ve a **Authentication → URL Configuration**.
2. **Site URL**: `https://<tu-app>.vercel.app`
3. En **Redirect URLs** agrega: `https://<tu-app>.vercel.app/restablecer`
4. (Opcional, para desarrollo) agrega también `http://localhost:5173/restablecer`.
5. Guarda.

## 6. Copiar las claves

1. Ve a **Project Settings → API Keys** (en paneles anteriores: **Project Settings → API**). El **Project URL** aparece en **Project Settings → Data API** o en la parte superior de esa misma pantalla.
2. Copia el **Project URL** y la clave de cliente: la **Publishable key** (`sb_publishable_…`) o, si tu panel aún la muestra, la clave **anon public** (pestaña **Legacy API keys**). Cualquiera de las dos sirve en la variable `VITE_SUPABASE_ANON_KEY`.
3. En la raíz del repo crea `.env.local` (no se versiona):

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-publishable-o-anon
   ```

4. En Vercel: proyecto → **Settings → Environment Variables**, agrega las mismas dos variables (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`) y vuelve a desplegar.

**Nunca** uses ni pegues la clave `service_role` ni la **Secret key** (`sb_secret_…`) en la app, en `.env.local` ni en Vercel: saltan la seguridad por fila.

## 7. Punto de control

1. **Iniciar sesión:** abre la app (local o `https://<tu-app>.vercel.app`) y entra con el usuario del paso 4. Debes llegar a Inicio.
2. **Restablecer contraseña:** cierra sesión, usa "¿Olvidaste tu contraseña?", revisa tu correo y abre el enlace. Debe llevarte a `https://<tu-app>.vercel.app/restablecer`, donde fijas una contraseña nueva. Inicia sesión con ella.
3. **Prueba de RLS sin sesión:** con solo la clave de cliente (Publishable o anon) y sin token de usuario, una consulta debe regresar vacío. En PowerShell o CMD (usa `curl.exe`, no `curl`, y todo en una sola línea):

   ```
   curl.exe "<SUPABASE_URL>/rest/v1/accounts?select=*" -H "apikey: <CLAVE>"
   ```

   Resultado esperado: `[]`. Si ves filas o un error de permisos distinto, revisa que la migración se aplicó completa y que RLS está activo en la tabla.

4. **Borrado físico bloqueado (opcional):** un `DELETE` con la clave de cliente, por ejemplo `curl.exe -X DELETE "<SUPABASE_URL>/rest/v1/accounts?id=eq.<uuid>" -H "apikey: <CLAVE>"` (una sola línea; funciona en PowerShell y CMD), debe fallar o no afectar filas; la app solo hace borrado lógico (`deleted_at`).

## Aviso: límite de correos

El envío de correos integrado de Supabase tiene un límite bajo (unos pocos correos por hora). Si pruebas varias veces "¿Olvidaste tu contraseña?" seguidas puedes toparte con ese límite: espera un rato y vuelve a intentar, o más adelante configura tu propio servidor SMTP en **Authentication → Emails → SMTP Settings**.

## Nota para Fase 2

El trigger `set_updated_at` fija `updated_at` con la hora del servidor tanto en insert como en update (así una fila creada sin conexión y subida después aparece en el pull incremental de otros dispositivos). El motor de sync debe usar esa hora para el pull incremental y tenerlo en cuenta al decidir "el último cambio gana".
