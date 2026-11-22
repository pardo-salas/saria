# Saria — Fase 0: Fundaciones (diseño)

Fecha: 2026-11-22 · Autor del diseño: Brian Roberto Salas Pardo (con Claude) · Referencia: `docs/ROADMAP.md`

## 1. Intención

Saria es una PWA personal de finanzas en español (México, MXN) que reemplaza la app Money Manager y el Excel "Gastos Personales". La usa **una sola persona** (Brian), principalmente en el teléfono con una mano y también en la computadora, con o sin internet. Sirve para dos cosas por igual: **ver cómo va el mes** y **anotar gastos rápido** (máximo 2 toques).

La Fase 0 no entrega funciones de finanzas todavía: entrega la base sobre la que las Fases 1–5 se construyen sin rehacer nada. Lo que se construya aquí (esquema, tokens visuales, componentes, autenticación, PWA) se reutiliza tal cual después.

**Criterio de terminado (del ROADMAP):** la PWA se instala en el teléfono y la computadora y abre en modo avión; la migración de Supabase está lista para aplicarse con RLS (Brian la aplica siguiendo los pasos); el login funciona.

## 2. Objetivos, no-objetivos y anti-objetivos

**Objetivos**
- Proyecto Vite + React + TypeScript con Tailwind, ESLint, Prettier, Vitest y Playwright configurados y en verde.
- PWA instalable (manifest, iconos, service worker); la app abre sin conexión.
- Identidad visual "Laguna oscuro" (sección 5) implementada como tokens + componentes base.
- Esquema Dexie de las 8 tablas del ROADMAP + `outbox` + `sync_state`.
- Migración SQL de Supabase equivalente, con RLS, índices y trigger de `updated_at`, más los pasos escritos para aplicarla.
- Inicio de sesión con email + contraseña y esqueleto de navegación de 5 pestañas.

**No-objetivos (llegan en fases posteriores)**
- CRUD de cuentas, categorías, movimientos o transferencias (Fase 1).
- Motor de sincronización: subir la outbox o bajar cambios (Fase 2). En Fase 0 solo existen las tablas y el helper de escritura local que encola en la outbox.
- Importadores, gráficas con datos, pagos habituales, tarjetas, MSI (Fases 2–4).
- (El despliegue en Vercel se adelanta a la Fase 0; ver 6.11.)

**Anti-objetivos (sería un fracaso aunque "funcione")**
- Que cualquiera con la URL pueda ver o escribir datos: sin sesión no se entra; RLS bloquea todo lo que no sea del usuario autenticado.
- Que la `service_role` key aparezca en el cliente, o que `data/` o `.env*` lleguen a git.
- Una interfaz con aspecto de plantilla genérica.
- Montos en punto flotante en cualquier parte del dominio.
- Que la UI llame a Supabase directamente.

## 3. Restricciones

- Stack fijo (ROADMAP): React + TS + Vite, vite-plugin-pwa, Dexie (+ dexie-react-hooks), Supabase (Postgres + Auth + RLS), Tailwind, Recharts, date-fns (locale `es`), Vitest + Testing Library + Playwright. No se cambia sin preguntar.
- Montos siempre en centavos (enteros). Saldos calculados, nunca guardados como dato editable.
- IDs UUID generados en el cliente (`crypto.randomUUID()`).
- Todas las tablas sincronizables llevan `id`, `user_id`, `created_at`, `updated_at`, `deleted_at`.
- Variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env.local` (las da Brian). Se versiona un `.env.example` sin valores.
- `.gitignore` ya excluye `data/`, `.env*` (excepto `.env.example`) y `.superpowers/`. Verificar antes del primer commit.
- Trabajo en una rama/worktree `fase-0`; `main` no se toca salvo para fusionar al final.
- TDD para toda la lógica de dominio de esta fase (sección 8).

## 4. Enfoques considerados para el esquema compartido

| Enfoque | Qué es | Ventajas | Desventajas |
| --- | --- | --- | --- |
| **A. Tipos TS + SQL a mano + prueba de paridad (elegido)** | `src/db/schema.ts` define tablas y columnas; Dexie se configura desde ahí; la migración SQL se escribe a mano; una prueba Vitest parsea el `.sql` y falla si tablas o columnas difieren | SQL legible y aplicable desde el panel de Supabase; validación sin servicios externos | Cada cambio de esquema se toca en dos lugares (la prueba lo detecta) |
| B. Generar tipos con `supabase gen types` | Tipos derivados de la base real | Nunca se desvían de Postgres | Requiere CLI vinculada y migración aplicada; Dexie igual necesita su definición |
| C. Definición única que genera Dexie y SQL | Un generador propio | Un solo lugar para cambios | Mucha maquinaria para 8 tablas que cambian poco |

Brian eligió **A** por simplicidad; la prueba atrapa justo el error que importa para la Fase 2 (un campo que existe en un lado y no en el otro).

## 5. Dirección visual (decidida por Brian)

Elegida en mockups: **"Laguna" con la paleta Cobalto oscura y Bricolage Grotesque, modo oscuro**.

**Lo que decidió Brian**
- Elemento distintivo: en Inicio, la tarjeta principal muestra **lo que te queda del mes como un nivel de agua** que baja conforme gastas; la superficie del agua tiene una línea verde agua.
- Paleta (oscuro, principal):

| Token | Hex | Uso |
| --- | --- | --- |
| `fondo` | `#070F22` | Fondo de la app |
| `superficie` | `#0E1A33` | Tarjetas, tarjeta del nivel de agua |
| `superficie-2` | `#16264A` | Iconos de lista, bordes sutiles, barra de navegación |
| `cobalto` | `#2F5BE0` | Agua, pestaña activa, acciones primarias secundarias |
| `agua` | `#5FE0C2` | Acento: botón +, superficie del agua, ingresos |
| `texto` | `#E6ECF8` | Texto principal |
| `gasto` | `#FF8A7A` | Montos de gasto, errores |

- Tipografía: **Bricolage Grotesque** (una sola familia para toda la app).

**Lo que propuso Claude y Brian aceptó**
- Números con cifras tabulares (`font-variant-numeric: tabular-nums`) para que los montos se alineen.
- Tema: sigue al sistema por defecto; en *Más* se puede fijar Claro u Oscuro (se guarda en `settings.theme`; antes de iniciar sesión se usa el del sistema).
- Modo claro: fondo `#EEF2FA`, texto `#0E1A33`, agua `#3B6CF6`→`#2447B8`, gasto `#C9473A`; la tarjeta del nivel de agua **se queda oscura** en ambos temas.
- El nivel de agua es lo único llamativo; el resto de la interfaz es sobrio.
- Movimiento: el agua sube a su nivel una sola vez al abrir Inicio; sin animación si `prefers-reduced-motion`.
- Botón + flotante verde agua abajo a la derecha (zona del pulgar).
- Barra inferior con 5 pestañas: Inicio, Movimientos, Cuentas, Gráficas, Más.
- Ícono de la app: gota o círculo con nivel de agua en cobalto y verde agua sobre `#070F22` (se diseña en la fase y se le muestra a Brian).
- Saludo "Hola, Brian" en Inicio.
- En Fase 0 las pantallas muestran estados vacíos ("Aún no hay movimientos este mes"); la tarjeta del agua sin datos muestra el estado vacío con una invitación a registrar el primer gasto.

Toda la interfaz se construye con la skill `frontend-design:frontend-design`. Mockups de referencia: `.superpowers/brainstorm/*/content/estilo-visual-v2.html` (local, no versionado).

## 6. Diseño técnico

### 6.1 Estructura del proyecto

```
src/
  app/            # App, router, layout con barra inferior, providers (tema, sesión)
  screens/        # Inicio, Movimientos, Cuentas, Graficas, Mas, Login, Restablecer
  ui/             # Componentes base y tokens (Button, AmountInput, List, Card, BottomNav, Fab, WaterLevelCard)
  domain/         # Lógica pura con TDD: money.ts (centavos), etc.
  db/             # schema.ts (tipos + definición), dexie.ts (instancia), repo.ts (escrituras + outbox)
  auth/           # cliente supabase-js y lógica de sesión
  sync/           # vacío en Fase 0 salvo el cliente compartido; motor en Fase 2
supabase/migrations/  # 0001_init.sql
docs/supabase.md      # pasos para crear el proyecto y aplicar la migración
e2e/                  # pruebas Playwright
```

Regla: solo `src/auth/` y `src/sync/` importan `@supabase/supabase-js`. Una regla de ESLint (`no-restricted-imports`) lo impone en el resto.

### 6.2 Esquema (fuente: `src/db/schema.ts`)

Columnas comunes en las 8 tablas: `id` (uuid), `user_id` (uuid), `created_at`, `updated_at`, `deleted_at` (timestamps ISO 8601 en UTC en el cliente; `timestamptz` en Postgres; `deleted_at` nulo si está vivo).

Columnas propias exactamente como en el ROADMAP:

| Tabla | Columnas |
| --- | --- |
| `accounts` | name, type (`cash`/`debit`/`credit`/`investment`), institution, color, icon, initial_balance_cents, include_in_total, archived, position, credit_limit_cents, statement_day, due_day, yield_rate, yield_cap_cents, yield_rate_over_cap |
| `categories` | name, kind (`income`/`expense`), icon, color, monthly_limit_cents, archived, position |
| `transactions` | kind (`income`/`expense`), amount_cents, date, account_id, category_id, note, recurring_id, installment_plan_id, legacy_id |
| `transfers` | from_account_id, to_account_id, amount_cents, date, note, legacy_id |
| `recurring_payments` | name, kind, amount_cents, account_id, category_id, frequency (`daily`/`weekly`/`biweekly`/`monthly`/`yearly`/`custom`), day_of_month, start_date, end_date, next_due_date, auto_create, active |
| `reminders` | title, text, time, frequency, start_date, enabled, recurring_id |
| `installment_plans` | concept, account_id, purchase_date, total_cents, months, monthly_cents, paid_months, active |
| `settings` | monthly_income_cents, pay_frequency, currency (`MXN`), theme (`system`/`light`/`dark`) |

Valores y nulabilidad (decisión de Claude, tras la revisión):
- `recurring_payments.frequency` y `reminders.frequency`: `daily`, `weekly`, `biweekly` (cada 2 semanas, cada 14 días), `semimonthly` (quincenal: dos días fijos del mes), `monthly`, `yearly`, `custom`. Para `semimonthly` se agrega `second_day_of_month`; para `custom` se agrega `interval_days`. Ambos nulos si no aplican.
- `recurring_payments.kind`: `income`/`expense`. `settings.pay_frequency`: `monthly`/`semimonthly`/`biweekly`.
- Obligatorios (`not null`): columnas comunes salvo `deleted_at`, `name`/`concept`/`title`, `type`/`kind`, montos de movimientos, transferencias y compras a meses, `date`, `account_id` (transactions), `from_account_id`/`to_account_id`, booleanos (con valor por defecto) y `position`. Todo lo demás es nulo permitido (`category_id`, `institution`, `note`, `color`, `icon`, `legacy_id`, campos de tarjeta y rendimiento, etc.).
- El esquema no queda congelado para siempre: si una fase posterior necesita columnas, agrega una migración nueva (`0002_…`) y sube la versión de Dexie; la prueba de paridad lee todas las migraciones en orden.

Decisiones de tipos (de Claude):
- Montos `*_cents`: `number` entero en TS (validado con `Number.isSafeInteger`), `bigint` en Postgres. `amount_cents` de movimientos/transferencias es positivo; el signo lo da `kind`. `initial_balance_cents` puede ser negativo (deuda de tarjeta).
- Fechas de calendario (`date`, `start_date`, `end_date`, `next_due_date`, `purchase_date`): cadena `YYYY-MM-DD` en la zona horaria local de Brian (America/Mexico_City); `date` en Postgres. Orden dentro de un día: `created_at`.
- `time`: `HH:mm`; `time` en Postgres.
- Tasas (`yield_rate`, `yield_rate_over_cap`): porcentaje anual como `numeric(7,4)` en Postgres y `number` en TS (no son dinero).
- `legacy_id`: texto nullable (uid de Money Manager).
- `settings`: una fila por usuario con **`id = user_id`** (determinista), para que el teléfono y la computadora escriban la misma fila y el sync no choque con `unique(user_id)`. `repo.put` respeta un `id` dado.

**Tablas locales (solo Dexie):**
- `outbox`: `seq` (autoincremental, clave), `table`, `row_id`, `op` (`upsert`/`delete`), `payload` (fila completa), `created_at`, `attempts`. Conserva el orden causal de las escrituras.
- `sync_state`: `table` (clave), `last_pulled_at` (ISO o nulo).

**Índices Dexie:** `id` como clave primaria; `updated_at` en todas; además `[account_id+date]` y `date` en `transactions`; `from_account_id`, `to_account_id`, `date` en `transfers`; `legacy_id` en `transactions` y `transfers`. Versión de esquema Dexie = 1.

### 6.3 Escritura local (`src/db/repo.ts`)

Un solo camino para escribir, con TDD:
- `put(table, row)`: en **una transacción Dexie** asigna `id` si falta, `user_id` de la sesión, `created_at` si es nuevo, `updated_at = ahora`, guarda la fila y agrega una entrada `upsert` a `outbox`.
- `softDelete(table, id)`: pone `deleted_at = updated_at = ahora` y encola `delete` en la misma transacción.
- Las lecturas de la UI filtran `deleted_at` nulo.
- Si la transacción falla, ni la fila ni la outbox cambian (prueba explícita).

### 6.4 Dinero (`src/domain/money.ts`, TDD)

- `formatCents(cents)` → `"$1,234.56"` (es-MX, MXN, siempre 2 decimales; negativo como `−$1,234.56` con signo menos tipográfico).
- `parseToCents(text)` → entero o error: acepta `1234`, `1,234.5`, `1234.56`, `$1,234.56`; rechaza más de 2 decimales, letras y vacío. Sin aritmética de punto flotante (se parsea como texto).
- Pruebas de límites: 0, 0.01, 999,999,999.99, entradas inválidas.

### 6.5 Supabase: migración `supabase/migrations/0001_init.sql`

- Las 8 tablas con las columnas de 6.2; `id uuid primary key`, `user_id uuid not null default auth.uid() references auth.users(id) on delete cascade`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`, `deleted_at timestamptz`.
- `check` para los enums (`type`, `kind`, `frequency`, `theme`), para días (1–31) y para montos positivos donde aplica.
- Llaves foráneas entre tablas (`account_id → accounts`, etc.) declaradas `deferrable initially deferred`, para que un lote de sync con hijos antes que padres no falle.
- Trigger `set_updated_at()` (`before update`) en cada tabla: `updated_at = now()`.
- RLS habilitado en todas; políticas `select`, `insert`, `update` con `user_id = auth.uid()` (`using` y `with check`). **Sin política `delete`**: el borrado es lógico, así que el borrado físico queda bloqueado desde el cliente.
- Índices: `(user_id, updated_at)` en todas; `(user_id, date)` en `transactions` y `transfers`; `account_id` y `category_id` en `transactions`; `from_account_id`, `to_account_id` en `transfers`; único parcial `(user_id, legacy_id) where legacy_id is not null` en `transactions` y `transfers`.
- No se ejecuta en esta fase. `docs/supabase.md` explica: crear el proyecto; aplicar el SQL desde el SQL Editor (o `supabase db push` con la CLI); en Authentication → Providers → Email, **desactivar "Allow new users to sign up"**; crear el usuario de Brian a mano en Authentication → Users; configurar Site URL y la URL de redirección para restablecer contraseña; copiar URL y clave `anon` a `.env.local`; nunca usar la `service_role` en el cliente.
- Nota para Fase 2: el trigger fija `updated_at` con la hora del servidor; el motor de sync debe usar esa hora para el pull incremental y decidir "último cambio gana" sabiéndolo.

### 6.6 Autenticación (decidida por Brian: email + contraseña)

- `supabase-js` con `persistSession: true`, `autoRefreshToken: true`, almacenamiento en `localStorage`.
- **Puerta:** si hay una sesión guardada, la app abre directo en Inicio, **también sin conexión y aunque el token haya vencido** (se renueva al volver la red). Sin sesión guardada se muestra la pantalla de inicio de sesión.
- Pantalla de inicio de sesión: email, contraseña, botón "Iniciar sesión", enlace "¿Olvidaste tu contraseña?". **No hay opción de crear cuenta.**
- Errores en lenguaje claro: credenciales incorrectas; sin conexión ("Necesitas internet para iniciar sesión la primera vez en este dispositivo"); configuración faltante si no existen las variables `VITE_*`.
- "¿Olvidaste tu contraseña?" → `resetPasswordForEmail` con redirección a `/restablecer`, donde se fija la nueva contraseña.
- *Más* → "Cerrar sesión" con confirmación. En Fase 0 cerrar sesión solo borra la sesión; qué pasa con los datos locales al cerrar sesión se decide en Fase 2 junto con el sync.

### 6.7 Navegación y pantallas

- React Router. Rutas: `/` (Inicio), `/movimientos`, `/cuentas`, `/graficas`, `/mas`, `/iniciar-sesion`, `/restablecer`. Las 5 primeras van dentro del layout con barra inferior y requieren sesión.
- Móvil (principal): una columna, barra inferior fija con área segura (`env(safe-area-inset-bottom)`), objetivos táctiles ≥ 44 px, botón + flotante sobre la barra.
- Escritorio (≥ 1024 px): la barra inferior se convierte en un riel lateral izquierdo y el contenido se centra con ancho máximo legible.
- Inicio: saludo, tarjeta del nivel de agua (estado vacío), lista "Hoy" vacía. Las otras 4 pestañas: título y estado vacío que dice qué llegará ahí.
- Botón +: en Fase 0 abre una hoja inferior que dice que el registro de gastos llega en la Fase 1 (sin flujo falso).
- *Más*: Tema (Sistema/Claro/Oscuro), Cerrar sesión, versión de la app.

### 6.8 Componentes base (`src/ui/`)

- `Button`: variantes primaria (agua), secundaria (cobalto), fantasma y peligro; estados deshabilitado y cargando; foco visible.
- `AmountInput`: muestra `$` y formato es-MX mientras se escribe; `inputMode="decimal"`; su valor es un entero en centavos (usa `money.ts`); rechaza negativos; tamaño grande para el pulgar.
- `List` / `ListItem`: icono con color, título, subtítulo, monto a la derecha (coral si gasto, agua si ingreso).
- `Card`, `BottomNav` (y riel en escritorio), `Fab`, `WaterLevelCard` (porcentaje 0–100 como prop, estado vacío, animación única que respeta `prefers-reduced-motion`), `EmptyState`, `Sheet` (hoja inferior accesible).
- Tokens como variables CSS por tema, expuestos a Tailwind (v4, `@theme`). Fuente **auto-alojada** (`@fontsource-variable/bricolage-grotesque`) para que funcione sin conexión.
- Una ruta `/componentes` solo en modo desarrollo para revisar todos los componentes en ambos temas.

### 6.9 PWA

- `vite-plugin-pwa` con `generateSW`; precache de todo el build (JS, CSS, fuente, iconos) y fallback de navegación a `index.html` para que cualquier ruta abra offline.
- `registerType: 'prompt'`: cuando hay versión nueva aparece "Hay una versión nueva · Actualizar"; nunca se recarga sola mientras escribes.
- Manifest: `name` y `short_name` "Saria", `lang: es-MX`, `display: standalone`, `start_url: /`, `theme_color` y `background_color` `#070F22`, iconos 192 y 512, 512 maskable; `apple-touch-icon` 180 y metaetiquetas de iOS.
- Iconos PNG generados desde un SVG fuente con `@vite-pwa/assets-generator`.

### 6.10 Herramientas

- ESLint (flat config) con `typescript-eslint`, `react-hooks`, `jsx-a11y` y la regla de importaciones de 6.1; Prettier con `prettier-plugin-tailwindcss`.
- Scripts npm: `dev`, `build`, `preview`, `typecheck`, `lint`, `format`, `test`, `test:e2e`.
- TypeScript estricto.

### 6.11 Despliegue (decidido por Brian: Vercel, teléfono Android)

- Se adelanta de la Fase 1: la app se despliega en **Vercel** desde GitHub para tener una URL fija con HTTPS desde la que se instala la PWA. Brian conecta el repo y pone `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en las variables del proyecto en Vercel; Claude deja `vercel.json` (reescritura de rutas a `index.html` para el router y cabeceras para que `sw.js` no se cachee) y los pasos en `docs/despliegue.md`.
- La URL de producción de Vercel es la Site URL y la URL de redirección de restablecer contraseña en Supabase (`docs/supabase.md`).
- Teléfono **Android** (Chrome): instalación con el aviso de instalación de Chrome o menú → "Instalar app". Se verifica que el manifest cumpla los requisitos de instalación de Chrome. iPhone no es objetivo de prueba.
- Computadora: instalación desde Chrome/Edge (ícono de instalar en la barra de direcciones).

## 7. Seguridad

- RLS en todas las tablas; registro de usuarios desactivado en Supabase; sin opción de crear cuenta en la app.
- Solo la clave `anon` en el cliente; `.env.local` ignorado por git; `.env.example` sin valores.
- Antes del primer commit: `git status --ignored` debe mostrar `data/` y `.env*` como ignorados.

## 8. Pruebas y verificación

TDD (prueba primero) para:
- `money.ts` (formato y parseo).
- `repo.ts` (fila + outbox en la misma transacción; rollback; soft delete; `updated_at`), con `fake-indexeddb`.
- Paridad de esquema: la prueba lee `0001_init.sql` y compara tablas y columnas con `schema.ts`.
- Lógica de la puerta de sesión (con sesión guardada → Inicio aunque no haya red; sin sesión → inicio de sesión).

Testing Library: `AmountInput`, `BottomNav`, formulario de inicio de sesión (errores), selector de tema.

Playwright (sobre `vite preview`, perfiles móvil y escritorio):
- Sin sesión se ve la pantalla de inicio de sesión.
- Con sesión simulada se navega por las 5 pestañas.
- Tras la primera carga, con la red cortada, la app recarga y abre.
- Supabase se simula en E2E (interceptando red o sembrando la sesión); las pruebas no tocan el proyecto real.

Punto de control manual con Supabase real (cuando Brian dé las credenciales y aplique la migración siguiendo `docs/supabase.md`): iniciar sesión de verdad, probar "¿Olvidaste tu contraseña?" y una prueba rápida de RLS (otra sesión sin token no lee nada). La fase no se da por terminada sin este punto.

Antes de declarar la fase terminada: `npm run typecheck`, `lint`, `test`, `build` y `test:e2e` en verde, con la salida mostrada a Brian. Prueba manual: instalar en teléfono y computadora y abrir en modo avión.

## 9. Lo que queda al constructor

- Nombres de archivos y componentes internos, organización de los tokens, detalles de animación.
- Cómo simular Supabase en E2E.
- Diseño exacto del ícono (se muestra a Brian antes de cerrar la fase).
- Versiones exactas de dependencias (actuales y estables).

## 10. Abierto

- Fecha en que Brian entrega las credenciales de Supabase y aplica la migración; el punto de control manual de la sección 8 depende de eso. Todo lo demás se construye sin ellas.
