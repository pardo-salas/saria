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
4. En **Table Editor** verifica que existen 8 tablas: `accounts`, `categories`, `transactions`, `transfers`, `recurring_payments`, `reminders`, `installment_plans` y `settings`, todas con el candado de RLS activo.

Alternativa con la CLI: `supabase link` y luego `supabase db push`.

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

1. Ve a **Project Settings → API**.
2. Copia **Project URL** y la clave **anon public**.
3. En la raíz del repo crea `.env.local` (no se versiona):

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-anon
   ```

4. En Vercel: proyecto → **Settings → Environment Variables**, agrega las mismas dos variables (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`) y vuelve a desplegar.

**Nunca** uses ni pegues la clave `service_role` en la app, en `.env.local` ni en Vercel: salta la seguridad por fila.

## 7. Punto de control

1. **Iniciar sesión:** abre la app (local o `https://<tu-app>.vercel.app`) y entra con el usuario del paso 4. Debes llegar a Inicio.
2. **Restablecer contraseña:** cierra sesión, usa "¿Olvidaste tu contraseña?", revisa tu correo y abre el enlace. Debe llevarte a `https://<tu-app>.vercel.app/restablecer`, donde fijas una contraseña nueva. Inicia sesión con ella.
3. **Prueba de RLS sin sesión:** con solo la clave `anon` y sin token de usuario, una consulta debe regresar vacío. En una terminal:

   ```
   curl "<SUPABASE_URL>/rest/v1/accounts?select=*" \
     -H "apikey: <ANON_KEY>"
   ```

   Resultado esperado: `[]`. Si ves filas o un error de permisos distinto, revisa que la migración se aplicó completa y que RLS está activo en la tabla.

4. **Borrado físico bloqueado (opcional):** un `DELETE` con la clave `anon` a `<SUPABASE_URL>/rest/v1/accounts?id=eq.<uuid>` debe fallar o no afectar filas; la app solo hace borrado lógico (`deleted_at`).

## Nota para Fase 2

El trigger `set_updated_at` fija `updated_at` con la hora del servidor. El motor de sync debe usar esa hora para el pull incremental y tenerlo en cuenta al decidir "el último cambio gana".
