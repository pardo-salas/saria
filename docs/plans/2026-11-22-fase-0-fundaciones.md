# Saria — Fase 0: Fundaciones — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar la base de Saria: proyecto configurado, PWA instalable y offline desplegada en Vercel, identidad visual "Laguna oscuro" con componentes base, esquema Dexie + migración Supabase con RLS, login con email + contraseña y navegación de 5 pestañas.

**Architecture:** SPA React + TS (Vite). La UI solo lee/escribe en Dexie a través de `src/db/repo.ts`, que encola cada escritura en `outbox`. Solo `src/auth/` y `src/sync/` importan `supabase-js`. Esquema definido en `src/db/schema.ts`; la migración SQL se escribe a mano y una prueba de paridad las compara.

**Tech Stack:** React 19, TypeScript estricto, Vite, vite-plugin-pwa, Dexie 4 + dexie-react-hooks, @supabase/supabase-js 2, Tailwind CSS 4 (@tailwindcss/vite), React Router 7, date-fns (locale `es`), Recharts (se instala; se usa en Fase 2), Vitest + jsdom + fake-indexeddb + Testing Library, Playwright, ESLint 9 (flat) + Prettier.

**Spec:** `docs/superpowers/specs/2026-11-22-fase-0-fundaciones-design.md` (leer junto con este plan). Contexto general: `docs/ROADMAP.md`.

## Global Constraints

- Todo el texto de la interfaz en español de México, en minúscula de oración, sin mayúsculas sostenidas en etiquetas.
- Montos siempre enteros en centavos (`Number.isSafeInteger`); nunca aritmética de punto flotante con dinero.
- IDs con `crypto.randomUUID()` en el cliente.
- Columnas comunes en las 8 tablas: `id`, `user_id`, `created_at`, `updated_at`, `deleted_at` (ISO 8601 UTC; `deleted_at` nulo = vivo).
- Fechas de calendario `YYYY-MM-DD` (America/Mexico_City); horas `HH:mm`.
- Solo `src/auth/**` y `src/sync/**` pueden importar `@supabase/supabase-js` (ESLint lo impone).
- Nunca la `service_role` key en el cliente; solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- `data/`, `.env*` (salvo `.env.example`) y `.superpowers/` nunca se versionan. No leer `data/` en esta fase.
- Paleta oscura: fondo `#070F22`, superficie `#0E1A33`, superficie-2 `#16264A`, cobalto `#2F5BE0`, agua `#5FE0C2`, texto `#E6ECF8`, gasto `#FF8A7A`. Clara: fondo `#EEF2FA`, texto `#0E1A33`, agua `#3B6CF6`→`#2447B8`, gasto `#C9473A`; la tarjeta del nivel de agua es oscura en ambos temas.
- Tipografía única: Bricolage Grotesque auto-alojada (`@fontsource-variable/bricolage-grotesque`), cifras tabulares en montos.
- Objetivos táctiles ≥ 44 px; foco visible; `prefers-reduced-motion` respetado.
- Toda la UI se construye con la skill `frontend-design:frontend-design`.
- Clave de sesión de Supabase en `localStorage`: `saria.auth`.
- Rama de trabajo `fase-0` en un worktree (crear con `superpowers:using-git-worktrees`); commits pequeños en español, terminados con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Token vencido sin conexión:** con una sesión guardada cuyo `expires_at` ya pasó y `navigator.onLine === false`, la app abre en Inicio (no en inicio de sesión). → prueba en Task 9.
2. **Coma como decimal desde el teclado Android:** `"12,5"` y `"12,50"` se interpretan como 12.50 (coma seguida de 1–2 dígitos al final y sin punto = decimal); `"1,234"` es 1234.00. → prueba en Task 2.
3. **Recargar una ruta profunda sin conexión:** abrir `/cuentas` en modo avión tras la primera visita abre la pantalla de Cuentas, no un error del navegador. → prueba en Task 12.
4. **Variables `VITE_*` ausentes en el build de Vercel:** la app muestra el mensaje de configuración faltante, no una pantalla en blanco. → prueba en Task 9.
5. **Reescribir una fila existente:** `repo.put` sobre un `id` existente conserva `created_at` y no permite que el llamador cambie `user_id`. → prueba en Task 5.

---

## Mapa de archivos

```
.gitattributes, .prettierrc.json, eslint.config.js, vite.config.ts, vitest.setup.ts,
playwright.config.ts, tsconfig*.json, index.html, .env.example, vercel.json,
pwa-assets.config.ts
public/icon.svg (+ PNG generados)
src/main.tsx
src/app/App.tsx, router.tsx, Layout.tsx, ThemeProvider.tsx, UpdatePrompt.tsx
src/screens/Inicio.tsx, Movimientos.tsx, Cuentas.tsx, Graficas.tsx, Mas.tsx,
            IniciarSesion.tsx, Restablecer.tsx, Componentes.tsx
src/ui/tokens.css, Button.tsx, Card.tsx, List.tsx, EmptyState.tsx, Sheet.tsx, Fab.tsx,
       BottomNav.tsx, AmountInput.tsx, WaterLevelCard.tsx
src/domain/money.ts, theme.ts
src/db/schema.ts, dexie.ts, repo.ts
src/auth/supabase.ts, session.ts, authService.ts, useSession.ts
supabase/migrations/0001_init.sql
docs/supabase.md, docs/despliegue.md
e2e/app.spec.ts, e2e/fixtures.ts
```
Las pruebas unitarias viven junto al archivo (`*.test.ts(x)`).

---

### Task 1: Proyecto base y herramientas

**Files:**
- Create: `package.json`, `.gitattributes` (`* text=auto eol=lf`), `.prettierrc.json`, `eslint.config.js`, `vite.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `tsconfig.json`/`tsconfig.app.json`/`tsconfig.node.json`, `index.html` (`lang="es-MX"`), `.env.example`, `src/main.tsx`, `src/app/App.tsx`
- Test: `src/app/App.test.tsx`

**Interfaces:**
- Produces: scripts npm `dev`, `build` (`tsc -b && vite build`), `preview`, `typecheck` (`tsc -b --noEmit`), `lint`, `format`, `test` (`vitest run`), `test:e2e` (`playwright test`).
- Produces: alias de import `@/` → `src/`.

- [ ] **Step 1:** Crear el proyecto con `npm create vite@latest . -- --template react-ts` (en el worktree, sin borrar `docs/` ni `.gitignore`) e instalar dependencias: `react-router`, `dexie`, `dexie-react-hooks`, `@supabase/supabase-js`, `date-fns`, `recharts`, `@fontsource-variable/bricolage-grotesque`; dev: `tailwindcss`, `@tailwindcss/vite`, `vite-plugin-pwa`, `@vite-pwa/assets-generator`, `vitest`, `jsdom`, `fake-indexeddb`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@playwright/test`, `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `prettier`, `prettier-plugin-tailwindcss`.
- [ ] **Step 2:** Configurar Vitest (`environment: 'jsdom'`, `setupFiles: ['vitest.setup.ts']` que importa `fake-indexeddb/auto` y `@testing-library/jest-dom/vitest`), Tailwind vía `@tailwindcss/vite`, ESLint flat con `no-restricted-imports` para `@supabase/supabase-js` en todo `src/**` excepto `src/auth/**` y `src/sync/**`, Playwright con proyectos `movil` (Pixel 7) y `escritorio` (Desktop Chrome) sobre `npm run build && npm run preview -- --port 4173`.
- [ ] **Step 3: Write the failing test** `App.test.tsx`: `render(<App />)` y `expect(screen.getByText('Saria')).toBeInTheDocument()`.
- [ ] **Step 4:** `npm test` → FAIL (App aún es la plantilla de Vite).
- [ ] **Step 5:** Reemplazar la plantilla por un `App` mínimo que muestra "Saria"; borrar assets de la plantilla.
- [ ] **Step 6:** `npm test` → PASS.
- [ ] **Step 7: Verificar la regla de importación:** crear `src/screens/tmp.ts` con `import '@supabase/supabase-js'`, `npm run lint` → error `no-restricted-imports`; borrar el archivo; `npm run lint` → sin errores.
- [ ] **Step 8:** `npm run typecheck && npm run lint && npm run build` → todo en verde. `git status --ignored` muestra `data/` ignorado y no hay `.env.local` rastreado.
- [ ] **Step 9: Commit** `chore: proyecto base con Vite, Tailwind, ESLint, Prettier, Vitest y Playwright`.

---

### Task 2: Dinero en centavos (TDD)

**Files:**
- Create: `src/domain/money.ts`
- Test: `src/domain/money.test.ts`

**Interfaces:**
- Produces: `formatCents(cents: number): string`
- Produces: `type ParseError = 'empty' | 'invalid' | 'too_many_decimals' | 'too_large'`; `parseToCents(text: string): { ok: true; cents: number } | { ok: false; error: ParseError }`
- Produces: `MAX_CENTS = 99_999_999_999` (999,999,999.99)

- [ ] **Step 1: Write the failing tests:**
  - `formatCents`: `0`→`"$0.00"`, `1`→`"$0.01"`, `123456`→`"$1,234.56"`, `-123456`→`"−$1,234.56"` (signo U+2212), `99999999999`→`"$999,999,999.99"`; lanza `RangeError` con `1.5`.
  - `parseToCents` válidos: `"1234"`→123400, `"1,234.5"`→123450, `"1234.56"`→123456, `"$1,234.56"`→123456, `" 0.01 "`→1, `"12,5"`→1250, `"12,50"`→1250, `"1,234"`→123400, `"0"`→0.
  - inválidos: `""`/`"  "`→`empty`, `"abc"`/`"1.2.3"`/`"-5"`→`invalid`, `"1.234"`→`too_many_decimals`, `"1000000000"`→`too_large`.
- [ ] **Step 2:** `npx vitest run src/domain/money.test.ts` → FAIL (módulo no existe).
- [ ] **Step 3:** Implementar. `formatCents` con `Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })` sobre el valor absoluto, anteponiendo `−` si es negativo. `parseToCents` trabaja sobre el texto (quitar `$` y espacios; regla de coma decimal del Review Focus 2; separar parte entera y decimal; nunca `parseFloat`).
- [ ] **Step 4:** Ejecutar → PASS.
- [ ] **Step 5: Commit** `feat(domain): formato y parseo de montos en centavos`.

---

### Task 3: Esquema y base Dexie

**Files:**
- Create: `src/db/schema.ts`, `src/db/dexie.ts`
- Test: `src/db/dexie.test.ts`

**Interfaces:**
- Produces (`schema.ts`): `type SyncedTableName = 'accounts' | 'categories' | 'transactions' | 'transfers' | 'recurring_payments' | 'reminders' | 'installment_plans' | 'settings'`; `interface SyncedRow { id: string; user_id: string; created_at: string; updated_at: string; deleted_at: string | null }`; una interfaz por tabla (`Account`, `Category`, `Transaction`, `Transfer`, `RecurringPayment`, `Reminder`, `InstallmentPlan`, `Settings`) que extiende `SyncedRow` con las columnas y uniones de valores de la spec §6.2 (incluidos `second_day_of_month` e `interval_days` en `recurring_payments` y `reminders`); `type RowOf<T extends SyncedTableName>`; `const COLUMNS: Record<SyncedTableName, readonly string[]>` (todas las columnas, comunes incluidas, en snake_case); `interface OutboxEntry { seq?: number; table: SyncedTableName; row_id: string; op: 'upsert' | 'delete'; payload: SyncedRow; created_at: string; attempts: number }`; `interface SyncState { table: SyncedTableName; last_pulled_at: string | null }`.
- Produces (`dexie.ts`): `class SariaDB extends Dexie` con una `Table` tipada por cada tabla sincronizable + `outbox: Table<OutboxEntry, number>` + `sync_state: Table<SyncState, string>`; `createDb(name = 'saria'): SariaDB`; `db = createDb()`. Versión 1 con los índices de spec §6.2 (`outbox: '++seq, table, row_id'`, `sync_state: 'table'`).

- [ ] **Step 1: Write the failing test:** con `createDb('test-' + crypto.randomUUID())`, `await db.open()`; `db.tables.map(t => t.name).sort()` es igual a las 8 tablas + `outbox` + `sync_state`; el índice compuesto `[account_id+date]` existe en `transactions` (`db.transactions.schema.idxByName`); los índices `from_account_id`, `to_account_id`, `legacy_id` existen en `transfers`.
- [ ] **Step 2:** Ejecutar → FAIL.
- [ ] **Step 3:** Implementar `schema.ts` y `dexie.ts`.
- [ ] **Step 4:** Ejecutar → PASS; `npm run typecheck` en verde.
- [ ] **Step 5: Commit** `feat(db): esquema tipado y base Dexie con outbox y sync_state`.

---

### Task 4: Migración Supabase y prueba de paridad

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `docs/supabase.md`
- Test: `src/db/schemaParity.test.ts`

**Interfaces:**
- Consumes: `COLUMNS`, `SyncedTableName` (Task 3).

- [ ] **Step 1: Write the failing test** `schemaParity.test.ts`: lee todos los `supabase/migrations/*.sql` en orden con `fs`, extrae tablas y columnas de `create table public.<t> (...)` y de `alter table public.<t> add column <c>`; para cada `SyncedTableName`, `expect(new Set(sqlColumns[t])).toEqual(new Set(COLUMNS[t]))`; además `expect(Object.keys(sqlColumns).sort()).toEqual(Object.keys(COLUMNS).sort())`. Extra en el mismo archivo: cada tabla tiene `enable row level security`, un trigger `set_updated_at`, un índice sobre `(user_id, updated_at)` y **ninguna** política `for delete` (búsqueda por regex en el SQL).
- [ ] **Step 2:** Ejecutar → FAIL (no hay migración).
- [ ] **Step 3:** Escribir `0001_init.sql` según spec §6.5 (tipos, `not null` y valores por defecto de §6.2, `check` de enums/días/montos, FKs `deferrable initially deferred`, `settings.id` = `user_id` con `check (id = user_id)` y `unique(user_id)`, función y triggers `set_updated_at`, RLS con políticas `select`/`insert`/`update` `user_id = auth.uid()`, índices y únicos parciales de `legacy_id`).
- [ ] **Step 4:** Ejecutar → PASS.
- [ ] **Step 5:** Escribir `docs/supabase.md` con los pasos de spec §6.5 (crear proyecto, aplicar SQL en SQL Editor, desactivar "Allow new users to sign up", crear usuario a mano, Site URL y redirect `https://<tu-app>.vercel.app/restablecer`, copiar URL y `anon` a `.env.local` y a Vercel, nunca `service_role`) más el punto de control: iniciar sesión, probar restablecer contraseña y una consulta sin sesión con la clave `anon` que regresa `[]`.
- [ ] **Step 6: Commit** `feat(supabase): migración inicial con RLS, índices y trigger updated_at`.

---

### Task 5: Escritura local con outbox (TDD)

**Files:**
- Create: `src/db/repo.ts`
- Test: `src/db/repo.test.ts`

**Interfaces:**
- Consumes: `SariaDB`, `RowOf`, `SyncedTableName` (Task 3).
- Produces: `class NotSignedInError extends Error`; `type NewRow<T> = Omit<RowOf<T>, keyof SyncedRow> & { id?: string }`; `createRepo(db: SariaDB, getUserId: () => string | null, now: () => string = () => new Date().toISOString())` → `{ put<T extends SyncedTableName>(table: T, row: NewRow<T>): Promise<RowOf<T>>; softDelete(table: SyncedTableName, id: string): Promise<void> }`; `repo` singleton exportado se crea en Task 9 cuando exista la sesión.

- [ ] **Step 1: Write the failing tests** (cada uno con DB nueva y `now` fijo):
  - `put` nuevo: asigna `id` UUID, `user_id` de la sesión, `created_at = updated_at = now()`, `deleted_at = null`; la tabla tiene la fila y `outbox` tiene 1 entrada `{ table, row_id, op: 'upsert', attempts: 0 }` con `payload` igual a la fila.
  - `put` existente (Review Focus 5): segundo `put` con el mismo `id` y otro `now` conserva `created_at`, actualiza `updated_at`, ignora un `user_id` distinto pasado por el llamador; `outbox` tiene 2 entradas en orden de `seq`.
  - `settings`: `put('settings', …)` sin `id` guarda `id === user_id`.
  - `softDelete`: `deleted_at = updated_at = now()`, la fila sigue existiendo, `outbox` recibe `op: 'delete'`.
  - Rollback: si `db.outbox.add` falla (espiar con `vi.spyOn` para que lance), `put` rechaza y la tabla **no** tiene la fila.
  - Sin sesión: `getUserId` → `null` hace que `put` rechace con `NotSignedInError`.
- [ ] **Step 2:** Ejecutar → FAIL.
- [ ] **Step 3:** Implementar con `db.transaction('rw', db.table(table), db.outbox, …)`.
- [ ] **Step 4:** Ejecutar → PASS.
- [ ] **Step 5: Commit** `feat(db): escrituras locales con outbox en la misma transacción`.

---

### Task 6: Tokens visuales y tema

**Files:**
- Create: `src/ui/tokens.css`, `src/domain/theme.ts`, `src/app/ThemeProvider.tsx`
- Modify: `src/main.tsx` (importar fuente y `tokens.css`), `index.html` (`<meta name="theme-color" content="#070F22">`, script inline que aplica `data-theme` antes del primer pintado)
- Test: `src/domain/theme.test.ts`, `src/app/ThemeProvider.test.tsx`

**Interfaces:**
- Produces: `type ThemePref = 'system' | 'light' | 'dark'`; `resolveTheme(pref: ThemePref, systemDark: boolean): 'light' | 'dark'`; `THEME_STORAGE_KEY = 'saria.theme'`.
- Produces: `<ThemeProvider>` y `useTheme(): { pref: ThemePref; resolved: 'light' | 'dark'; setPref(p: ThemePref): void }`; pone `document.documentElement.dataset.theme`; guarda `pref` en `localStorage`. (Escribir también `settings.theme` vía repo se conecta en Task 10, cuando hay sesión.)
- Produces: utilidades Tailwind `bg-fondo`, `bg-superficie`, `bg-superficie-2`, `text-texto`, `text-agua`, `text-gasto`, `bg-cobalto`, `font-sans` = Bricolage Grotesque, y clase `.cifras` (`font-variant-numeric: tabular-nums`).

- [ ] **Step 1: Write the failing tests:** `resolveTheme('system', true)`→`'dark'`, `('system', false)`→`'light'`, `('light', true)`→`'light'`, `('dark', false)`→`'dark'`. `ThemeProvider`: con `matchMedia` simulado en oscuro y sin preferencia guardada, `document.documentElement.dataset.theme === 'dark'`; `setPref('light')` cambia el atributo y guarda `'light'` en `localStorage['saria.theme']`.
- [ ] **Step 2:** Ejecutar → FAIL.
- [ ] **Step 3:** Implementar. `tokens.css`: variables por tema en `:root[data-theme='dark']` y `:root[data-theme='light']` con los hex de Global Constraints, mapeadas en `@theme`. Usar `frontend-design:frontend-design` para escala tipográfica y espaciado.
- [ ] **Step 4:** Ejecutar → PASS.
- [ ] **Step 5: Commit** `feat(ui): tokens Laguna oscuro/claro, Bricolage Grotesque y tema`.

---

### Task 7: Componentes base

**Files:**
- Create: `src/ui/Button.tsx`, `Card.tsx`, `List.tsx`, `EmptyState.tsx`, `Sheet.tsx`, `Fab.tsx`, `BottomNav.tsx`
- Test: `src/ui/Button.test.tsx`, `List.test.tsx`, `Sheet.test.tsx`, `BottomNav.test.tsx`

**Interfaces:**
- Consumes: tokens (Task 6), `formatCents` (Task 2).
- Produces: `Button({ variant: 'primaria' | 'secundaria' | 'fantasma' | 'peligro', loading?: boolean, ...ButtonHTMLAttributes })`; `Card({ children, className? })`; `List({ children })`, `ListItem({ title: string, subtitle?: string, iconColor?: string, amountCents?: number, kind?: 'income' | 'expense' })`; `EmptyState({ title: string, text?: string, action?: ReactNode })`; `Sheet({ open: boolean, onClose(): void, title: string, children })`; `Fab({ onClick, label: string })`; `BottomNav({ items: { to: string, label: string, icon: ReactNode }[] })` (barra inferior < 1024 px, riel lateral ≥ 1024 px; usa `NavLink`).

- [ ] **Step 1: Write the failing tests:**
  - `Button` con `loading` está `disabled` y tiene `aria-busy="true"`.
  - `ListItem` con `amountCents={65000} kind="expense"` muestra `"−$650.00"`; con `kind="income"` muestra `"+$650.00"`.
  - `Sheet` abierto tiene `role="dialog"` con nombre accesible igual a `title`; `Escape` llama `onClose`; cerrado no se renderiza.
  - `BottomNav` dentro de `MemoryRouter` en `/cuentas`: el enlace "Cuentas" tiene `aria-current="page"` y hay 5 enlaces.
- [ ] **Step 2:** Ejecutar → FAIL.
- [ ] **Step 3:** Implementar con `frontend-design:frontend-design` siguiendo la spec §5 y §6.8 (objetivos ≥ 44 px, área segura inferior, Fab agua abajo a la derecha sobre la barra).
- [ ] **Step 4:** Ejecutar → PASS.
- [ ] **Step 5: Commit** `feat(ui): componentes base (botón, tarjeta, lista, hoja, fab, navegación)`.

---

### Task 8: AmountInput y WaterLevelCard

**Files:**
- Create: `src/ui/AmountInput.tsx`, `src/ui/WaterLevelCard.tsx`
- Test: `src/ui/AmountInput.test.tsx`, `src/ui/WaterLevelCard.test.tsx`

**Interfaces:**
- Consumes: `parseToCents`, `formatCents` (Task 2).
- Produces: `AmountInput({ label: string, valueCents: number | null, onChange(cents: number | null): void, error?: string })` — `inputMode="decimal"`, prefijo `$`, al perder el foco muestra el valor formateado sin `$` duplicado; muestra mensaje de error si `parseToCents` falla.
- Produces: `WaterLevelCard({ remainingCents: number | null, percent: number | null, daysLeft: number | null })` — `percent` se acota a 0–100; con `remainingCents === null` muestra el estado vacío "Aún no hay movimientos este mes" e invita a registrar el primer gasto; animación de llenado una sola vez, desactivada con `prefers-reduced-motion`.

- [ ] **Step 1: Write the failing tests:**
  - `AmountInput`: escribir `"1,234.5"` llama `onChange(123450)`; escribir `"12,50"` llama `onChange(1250)`; escribir `"abc"` llama `onChange(null)` y muestra "Escribe un monto válido"; tras `blur` con `123450` el input muestra `"1,234.50"`; tiene etiqueta accesible igual a `label`.
  - `WaterLevelCard`: con `remainingCents={724000} percent={58} daysLeft={8}` muestra `"$7,240.00"` y "faltan 8 días"; el elemento del agua tiene `style.height === '58%'`; `percent={140}` se acota a `'100%'`; `remainingCents={null}` muestra "Aún no hay movimientos este mes".
- [ ] **Step 2:** Ejecutar → FAIL.
- [ ] **Step 3:** Implementar con `frontend-design:frontend-design` (nivel de agua cobalto con superficie agua, tarjeta `superficie` oscura en ambos temas, cifra grande en Bricolage 800).
- [ ] **Step 4:** Ejecutar → PASS.
- [ ] **Step 5: Commit** `feat(ui): input de monto y tarjeta del nivel de agua`.

---

### Task 9: Sesión y autenticación

**Files:**
- Create: `src/auth/supabase.ts`, `src/auth/session.ts`, `src/auth/authService.ts`, `src/auth/useSession.ts`
- Modify: `src/db/repo.ts` (agregar `setRepoUserSource(fn: () => string | null): void` y `export const repo = createRepo(db, () => userSource())`)
- Test: `src/auth/session.test.ts`, `src/auth/authService.test.ts`

**Interfaces:**
- Produces (`supabase.ts`): `AUTH_STORAGE_KEY = 'saria.auth'`; `isConfigured(): boolean` (ambas `VITE_*` no vacías); `getSupabase(): SupabaseClient | null` (singleton; `persistSession: true`, `autoRefreshToken: true`, `storageKey: AUTH_STORAGE_KEY`; `null` si no está configurado).
- Produces (`session.ts`): `type GateState = 'misconfigured' | 'signed-in' | 'signed-out'`; `readStoredUserId(storage: Storage): string | null` (lee `saria.auth` y regresa `user.id` sin validar expiración); `decideGate(configured: boolean, storedUserId: string | null): GateState`.
- Produces (`authService.ts`): `type AuthError = 'invalid_credentials' | 'offline' | 'misconfigured' | 'unknown'`; `signIn(email: string, password: string): Promise<{ ok: true } | { ok: false; error: AuthError }>`; `sendPasswordReset(email: string): Promise<…mismo tipo>` (redirect `${location.origin}/restablecer`); `updatePassword(password: string): Promise<…>`; `signOut(): Promise<void>`.
- Produces (`useSession.ts`): `useSession(): { gate: GateState; userId: string | null }` (estado inicial síncrono desde `decideGate` + `onAuthStateChange`); al montar llama `setRepoUserSource` para que `repo` use el `userId` actual.
- Copy fija: `invalid_credentials` → "El correo o la contraseña no coinciden."; `offline` → "Necesitas internet para iniciar sesión la primera vez en este dispositivo."; `misconfigured` → "Falta configurar la conexión con Supabase (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY)."; `unknown` → "No se pudo iniciar sesión. Intenta de nuevo."

- [ ] **Step 1: Write the failing tests:**
  - `decideGate(false, 'u1')` → `'misconfigured'` (Review Focus 4); `(true, null)` → `'signed-out'`; `(true, 'u1')` → `'signed-in'`.
  - `readStoredUserId` con un `saria.auth` cuyo `expires_at` está en el pasado → regresa el `user.id` (Review Focus 1); con JSON inválido o sin clave → `null`.
  - Review Focus 1 completo: con `navigator.onLine` simulado en `false` y la sesión vencida guardada, `decideGate(true, readStoredUserId(localStorage))` → `'signed-in'`.
  - `signIn` (con `getSupabase` simulado vía `vi.mock`): error de Supabase con `code: 'invalid_credentials'` → `{ ok: false, error: 'invalid_credentials' }`; un `AuthRetryableFetchError` o `navigator.onLine === false` → `'offline'`; sin configuración → `'misconfigured'`.
- [ ] **Step 2:** Ejecutar → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Ejecutar → PASS; `npm run lint` confirma que solo `src/auth` importa supabase-js.
- [ ] **Step 5: Commit** `feat(auth): sesión persistente, puerta offline y servicio de email + contraseña`.

---

### Task 10: Pantallas, navegación y Más

**Files:**
- Create: `src/app/router.tsx`, `src/app/Layout.tsx`, `src/screens/Inicio.tsx`, `Movimientos.tsx`, `Cuentas.tsx`, `Graficas.tsx`, `Mas.tsx`, `IniciarSesion.tsx`, `Restablecer.tsx`, `Componentes.tsx`
- Modify: `src/app/App.tsx`
- Test: `src/app/router.test.tsx`, `src/screens/IniciarSesion.test.tsx`, `src/screens/Mas.test.tsx`

**Interfaces:**
- Consumes: `useSession`, `signIn`, `sendPasswordReset`, `updatePassword`, `signOut` (Task 9); `useTheme` (Task 6); componentes (Tasks 7–8); `repo` (Task 5).
- Produces: rutas `/`, `/movimientos`, `/cuentas`, `/graficas`, `/mas` (protegidas, dentro de `Layout` con `BottomNav` y `Fab`), `/iniciar-sesion`, `/restablecer`, y `/componentes` solo si `import.meta.env.DEV`.

- [ ] **Step 1: Write the failing tests:**
  - Router: con `gate = 'signed-out'`, ir a `/cuentas` redirige a `/iniciar-sesion`; con `'signed-in'`, `/cuentas` muestra el encabezado "Cuentas"; con `'misconfigured'`, se muestra el mensaje de configuración faltante; con `'signed-in'`, `/iniciar-sesion` redirige a `/`.
  - `IniciarSesion`: no existe ningún texto "crear cuenta"/"regístrate"; enviar con `signIn` simulado que regresa `invalid_credentials` muestra "El correo o la contraseña no coinciden."; el botón dice "Iniciar sesión" y queda en `loading` mientras espera.
  - `Mas`: elegir "Claro" llama `setPref('light')` y, con sesión, `repo.put('settings', { theme: 'light', … })`; "Cerrar sesión" pide confirmación en un `Sheet` y solo entonces llama `signOut`.
  - Inicio: el `Fab` abre un `Sheet` que dice que el registro de gastos llega en la Fase 1.
- [ ] **Step 2:** Ejecutar → FAIL.
- [ ] **Step 3:** Implementar con `frontend-design:frontend-design`. Inicio: "Hola, Brian", `WaterLevelCard` vacía, lista "Hoy" con `EmptyState`. Movimientos/Cuentas/Gráficas: título + `EmptyState` que dice qué llegará. Más: tema (Sistema/Claro/Oscuro), cerrar sesión, versión (`import.meta.env.VITE_APP_VERSION` desde `package.json`). `/componentes`: todos los componentes en ambos temas.
- [ ] **Step 4:** Ejecutar → PASS; `npm run typecheck && npm run lint` en verde.
- [ ] **Step 5:** Revisión visual: `npm run dev`, abrir `/` y `/componentes` a 390 px y 1280 px en claro y oscuro; tomar capturas y corregir con `frontend-design`.
- [ ] **Step 6: Commit** `feat(app): navegación de 5 pestañas, inicio de sesión, restablecer y Más`.

---

### Task 11: PWA (manifest, iconos, service worker, actualización)

**Files:**
- Create: `public/icon.svg`, `pwa-assets.config.ts`, `pwa-manifest.ts` (exporta `manifest`, lo importan `vite.config.ts` y la prueba), `src/app/UpdatePrompt.tsx`
- Modify: `vite.config.ts`, `index.html`, `src/app/App.tsx`, `package.json` (script `generate-pwa-assets`)
- Test: `src/app/UpdatePrompt.test.tsx`, `src/app/manifest.test.ts`

**Interfaces:**
- Produces: manifest con `name: 'Saria'`, `short_name: 'Saria'`, `lang: 'es-MX'`, `display: 'standalone'`, `start_url: '/'`, `theme_color` y `background_color` `#070F22`, iconos 192, 512 y 512 `purpose: 'maskable'`; `apple-touch-icon` 180.
- Produces: `generateSW` con `registerType: 'prompt'`, precache de `**/*.{js,css,html,svg,png,woff2}`, `navigateFallback: '/index.html'`.
- Produces: `UpdatePrompt` usando `useRegisterSW` de `virtual:pwa-register/react`: cuando `needRefresh` es verdadero muestra "Hay una versión nueva" con botón "Actualizar" que llama `updateServiceWorker(true)`.

- [ ] **Step 1: Write the failing tests:** `manifest.test.ts` importa `manifest` de `pwa-manifest.ts` y comprueba los valores anteriores y que hay un icono `maskable` de 512. `UpdatePrompt` (con `virtual:pwa-register/react` simulado): con `needRefresh = true` muestra el texto y el botón; clic en "Actualizar" llama `updateServiceWorker(true)`; con `false` no muestra nada.
- [ ] **Step 2:** Ejecutar → FAIL.
- [ ] **Step 3:** Diseñar `public/icon.svg` con `frontend-design` (gota o círculo con nivel de agua cobalto + superficie agua sobre `#070F22`, legible a 48 px y con zona segura para maskable). Generar PNG con `npm run generate-pwa-assets`. Configurar `vite-plugin-pwa` e `index.html`.
- [ ] **Step 4:** Ejecutar → PASS; `npm run build` genera `dist/sw.js` y `dist/manifest.webmanifest`.
- [ ] **Step 5:** Mostrar el ícono a Brian (captura a 192 px y 48 px) antes de seguir.
- [ ] **Step 6: Commit** `feat(pwa): manifest, iconos, service worker y aviso de actualización`.

---

### Task 12: Pruebas E2E

**Files:**
- Create: `e2e/fixtures.ts`, `e2e/app.spec.ts`
- Modify: `playwright.config.ts` (variables `VITE_SUPABASE_URL=http://127.0.0.1:54321` y `VITE_SUPABASE_ANON_KEY=e2e-anon` para el build de pruebas)

**Interfaces:**
- Produces (`fixtures.ts`): `seedSession(page)` — `addInitScript` que escribe en `localStorage['saria.auth']` una sesión falsa (`user.id` fijo, `expires_at` en el pasado); y `page.route('http://127.0.0.1:54321/**', r => r.abort())` para que ninguna prueba toque Supabase.

- [ ] **Step 1: Write the tests** (`app.spec.ts`, se ejecutan en `movil` y `escritorio`):
  - Sin sesión, `/` muestra "Iniciar sesión" y no muestra la barra de navegación.
  - Con `seedSession`, se navega por Inicio, Movimientos, Cuentas, Gráficas y Más haciendo clic en la navegación; cada una muestra su encabezado.
  - Offline (Review Focus 3): con sesión, cargar `/`, esperar `navigator.serviceWorker.ready` y que la página esté controlada, `context.setOffline(true)`, `page.goto('/cuentas')` → muestra "Cuentas"; `page.reload()` → sigue mostrando "Cuentas".
- [ ] **Step 2:** `npm run test:e2e` → las pruebas que dependan de algo faltante fallan; corregir la causa (no la prueba) usando `superpowers:systematic-debugging`.
- [ ] **Step 3:** `npm run test:e2e` → PASS en ambos proyectos.
- [ ] **Step 4: Commit** `test(e2e): inicio de sesión, navegación y apertura sin conexión`.

---

### Task 13: Despliegue en Vercel

**Files:**
- Create: `vercel.json`, `docs/despliegue.md`

**Interfaces:**
- Produces: `vercel.json` con `rewrites` de `/(.*)` a `/index.html` y `headers` para `/sw.js` y `/manifest.webmanifest` con `Cache-Control: public, max-age=0, must-revalidate`.

- [ ] **Step 1:** Escribir `vercel.json`.
- [ ] **Step 2:** Escribir `docs/despliegue.md`: crear repo en GitHub y hacer push de `main` (sin `data/` ni `.env*`); importar en Vercel (framework Vite, build `npm run build`, salida `dist`); agregar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; copiar la URL de producción a Supabase (Site URL y redirect `/restablecer`); instalar en Android (Chrome → menú → "Instalar app"), y en la computadora (Chrome/Edge → ícono de instalar); prueba en modo avión.
- [ ] **Step 3:** `npm run build && npx vite preview` y comprobar que `/cuentas` responde con la app (equivalente local del rewrite).
- [ ] **Step 4: Commit** `chore(deploy): configuración de Vercel y guía de despliegue`.

---

### Cierre de la fase (no es tarea de subagente)

1. `superpowers:verification-before-completion`: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`; mostrar la salida a Brian.
2. Punto de control manual con Brian (spec §8): aplicar la migración, poner `.env.local` y variables en Vercel, iniciar sesión real, restablecer contraseña, consulta sin sesión regresa `[]`, instalar en Android y computadora, abrir en modo avión.
3. `superpowers:requesting-code-review` → `superpowers:finishing-a-development-branch`.
4. No empezar la Fase 1 hasta que Brian apruebe.
