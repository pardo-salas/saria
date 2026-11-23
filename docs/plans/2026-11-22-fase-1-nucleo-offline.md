# Saria — Fase 1: Núcleo offline — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer Saria usable sin internet: cuentas, categorías, movimientos, transferencias, Inicio con datos, registro rápido en 2 toques, búsqueda y filtros, y respaldo JSON; publicada en Vercel al fusionar.

**Architecture:** La UI lee filas vivas de Dexie con `useLiveQuery` (filtradas por usuario) y calcula todo con funciones puras de `src/domain/` (saldos, resúmenes, historial, búsqueda, validaciones). Toda escritura pasa por `repo` (encola en `outbox`). Sin cambios de esquema ni migraciones.

**Tech Stack:** React 19, TypeScript estricto, Vite 8, Dexie 4 + dexie-react-hooks, React Router 8, Tailwind 4, Vitest + fake-indexeddb + Testing Library, Playwright. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-11-22-fase-1-nucleo-offline-design.md` (leer junto con este plan; las secciones se citan como §). Contexto: `docs/ROADMAP.md` y la spec de la Fase 0.

## Global Constraints

- Todo el texto de la interfaz en español de México, en minúscula de oración.
- Montos siempre enteros en centavos; las sumas verifican `Number.isSafeInteger` del resultado; nunca `parseFloat` con dinero.
- La UI nunca importa `@supabase/supabase-js` (regla ESLint de la Fase 0); toda escritura va por `repo.put` / `repo.softDelete`.
- Zona horaria `America/Mexico_City` para "hoy", "este mes" y las fechas `YYYY-MM-DD`.
- Lecturas: solo filas con `deleted_at === null` y `user_id` igual al de la sesión (§6.3).
- Dirección visual "Laguna" (tokens de `src/ui/tokens.css`, Bricolage Grotesque, cifras tabulares); mockups aprobados en `.superpowers/brainstorm/3626-1795401236/content/registro-rapido.html` (opción A) y `pantallas.html` (local, no versionado). Toda pantalla o componente nuevo se construye con la skill `frontend-design:frontend-design`.
- Objetivos táctiles ≥ 44 px; foco visible; `prefers-reduced-motion` respetado; avisos con `aria-live`.
- Ninguna prueba ni fixture usa datos de `data/`; solo datos inventados.
- Rama `fase-1` en un worktree (`superpowers:using-git-worktrees`); commits pequeños en español terminados con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Medianoche y zona horaria:** un gasto registrado a las 23:30 de Ciudad de México (05:30 UTC del día siguiente) cuenta como "hoy" local, y el 1.º del mes a las 00:10 ya es el mes nuevo. → prueba en Task 2.
2. **Doble toque en una categoría** del registro rápido: se guarda un solo movimiento. → prueba en Task 12.
3. **Editar un movimiento cuya cuenta ya está archivada:** se guarda sin error y conserva la cuenta. → prueba en Task 6.
4. **Restaurar un respaldo exportado con otro `user_id`:** las filas quedan con el usuario actual y se ven en la app. → prueba en Task 9.
5. **Cuenta que solo tiene transferencias** (sin movimientos): cuenta como "en uso"; se archiva, no se borra. → prueba en Task 6.

---

## Mapa de archivos

```
src/domain/  dates.ts, balances.ts, feed.ts, search.ts, validate.ts, usage.ts,
             catalog.ts, seedCategories.ts, uuid.ts, backup.ts   (+ money.ts: sumCents)
src/db/      repo.ts (cambios), settings.ts, seed.ts, backup.ts, queries.ts
src/ui/      AppIcon.tsx, Toast.tsx, Chip.tsx, Segmented.tsx, FeedRow.tsx,
             List.tsx (cambios), AmountInput.tsx (cambios), WaterLevelCard.tsx (cambios), Sheet.tsx (escritorio)
src/app/     QuickAddContext.tsx, download.ts, Layout.tsx / router.tsx (cambios)
src/features/quick-add/   QuickAddSheet.tsx, TransferFields.tsx
src/features/forms/       TransactionSheet.tsx, TransferSheet.tsx, AccountSheet.tsx, CategorySheet.tsx
src/screens/ Inicio.tsx, Cuentas.tsx, CuentaDetalle.tsx, CuentasArchivadas.tsx, Movimientos.tsx,
             Mas.tsx, Categorias.tsx, Respaldo.tsx
src/auth/    authService.ts (mensajes)
e2e/         nucleo.spec.ts, app.spec.ts (localizador)
```
Las pruebas unitarias viven junto al archivo (`*.test.ts(x)`). Pruebas de Dexie con `createDb('test-' + crypto.randomUUID())` como en `src/db/repo.test.ts`.

---

### Task 1: Correcciones de `repo` y `updateSettings`

**Files:**
- Modify: `src/db/repo.ts`
- Create: `src/db/settings.ts`
- Modify: `src/screens/Mas.tsx` (usar `updateSettings` en `saveTheme`)
- Test: `src/db/repo.test.ts`, `src/db/settings.test.ts`

**Interfaces:**
- Produces: `class RowNotFoundError extends Error` (mensaje `` `No existe la fila ${id} en ${table}` ``).
- Produces: `repo.put<T>(table: T, row: NewRow<T>, opts?: { created_at?: string }): Promise<RowOf<T>>` — `opts.created_at` solo se usa si la fila es nueva (restauración, Task 9).
- Produces: `repo.softDelete(table, id): Promise<void>` — no-op (sin re-sellar ni encolar) si la fila ya está borrada; `RowNotFoundError` si no existe.
- Produces: `updateSettings(patch: Partial<Pick<Settings, 'monthly_income_cents' | 'pay_frequency' | 'theme'>>, deps?: { db: SariaDB; repo: Repo; userId: string }): Promise<Settings>` en `src/db/settings.ts`; por defecto usa `db`, `repo` y el usuario del repo. Lee y escribe en una sola transacción Dexie (`rw` sobre `settings` + `outbox`); sin fila previa, usa `monthly_income_cents: null, pay_frequency: null, currency: 'MXN', theme: 'system'`.
- Produces: `export type Repo = ReturnType<typeof createRepo>`.

- [ ] **Step 1: Write the failing tests** en `repo.test.ts`:
  - `softDelete de una fila ya borrada no cambia updated_at ni encola`: borrar en T1, borrar de nuevo en T2 → `updated_at === T1`, `outbox.count() === 2` (put + primer delete).
  - `softDelete de una fila inexistente lanza RowNotFoundError`.
  - `put con created_at en una fila nueva lo conserva` y `put con created_at sobre una fila existente lo ignora`.
  - `put anidado en una transacción externa se revierte con ella`: `db.transaction('rw', db.accounts, db.outbox, async () => { await repo.put(...); throw new Error('x') })` rechaza y `accounts.count() === 0`, `outbox.count() === 0`.
- [ ] **Step 2:** `settings.test.ts`: `updateSettings({ monthly_income_cents: 1860000 })` sin fila → crea con `theme: 'system'`; luego `updateSettings({ theme: 'dark' })` conserva `monthly_income_cents === 1860000`; dos llamadas en paralelo (`Promise.all`) con campos distintos dejan ambos campos.
- [ ] **Step 3:** `npx vitest run src/db` → FAIL.
- [ ] **Step 4:** Implementar; `Mas.tsx` reemplaza `saveTheme` por `updateSettings({ theme })`.
- [ ] **Step 5:** `npx vitest run src/db src/screens/Mas.test.tsx` → PASS.
- [ ] **Step 6: Commit** `fix(db): softDelete idempotente, created_at al restaurar y updateSettings atómico`.

---

### Task 2: Fechas locales (TDD)

**Files:**
- Create: `src/domain/dates.ts`
- Test: `src/domain/dates.test.ts`

**Interfaces:**
- Produces: `TIME_ZONE = 'America/Mexico_City'`
- Produces: `localDate(instant: Date): string` → `YYYY-MM-DD` en `TIME_ZONE` (vía `Intl.DateTimeFormat('en-CA', { timeZone })`).
- Produces: `monthKey(date: string): string` → `YYYY-MM`; `shiftMonth(month: string, delta: number): string`.
- Produces: `daysLeftInMonth(date: string): number` (días después de `date` hasta fin de mes; 0 el último día).
- Produces: `formatMonth(month: string): string` → `"Noviembre 2026"`.
- Produces: `formatDayLabel(date: string, today: string): string` → `"Hoy"`, `"Ayer · 21 nov"`, `"jue 19 nov"` (sin punto tras la abreviatura), y con año si es de otro año: `"lun 2 dic 2024"`.
- Produces: `isValidDate(date: string): boolean` (formato y fecha real).

- [ ] **Step 1: Write the failing tests:** `localDate(new Date('2026-11-23T05:30:00Z'))` → `'2026-11-22'` (Review Focus 1); `localDate(new Date('2026-12-01T06:10:00Z'))` → `'2026-12-01'` y `monthKey` → `'2026-12'`; `shiftMonth('2026-01', -1)` → `'2025-12'`, `shiftMonth('2026-12', 1)` → `'2027-01'`; `daysLeftInMonth('2026-11-22')` → 8, `('2026-11-30')` → 0, `('2028-02-28')` → 1; `formatMonth('2026-11')` → `'Noviembre 2026'`; las cuatro formas de `formatDayLabel` de arriba con `today = '2026-11-22'`; `isValidDate('2026-02-30')` → false, `('2026-2-3')` → false.
- [ ] **Step 2:** Ejecutar → FAIL. **Step 3:** Implementar con `Intl` y aritmética de fechas sobre `YYYY-MM-DD` (UTC a mediodía para evitar saltos). **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(domain): fechas locales de Ciudad de México`.

---

### Task 3: Saldos, resúmenes y nivel de agua (TDD)

**Files:**
- Modify: `src/domain/money.ts` (agregar `sumCents`)
- Create: `src/domain/balances.ts`
- Test: `src/domain/money.test.ts`, `src/domain/balances.test.ts`

**Interfaces:**
- Produces: `sumCents(values: Iterable<number>): number` — lanza `RangeError` si el resultado no es entero seguro.
- Produces: `balancesByAccount(accounts: Account[], txs: Transaction[], transfers: Transfer[]): Map<string, number>` (§6.1; todas las fechas).
- Produces: `totalBalance(accounts: Account[], balances: Map<string, number>): number` (solo `include_in_total && !archived`).
- Produces: `type AccountGroup = 'liquid' | 'credit' | 'investment'`; `groupOf(type: Account['type']): AccountGroup`.
- Produces: `interface AccountsBreakdown { totalCents: number; groups: { group: AccountGroup; subtotalCents: number; accounts: Account[] }[]; creditDebtCents: number; investmentApartCents: number }`; `accountsBreakdown(accounts, balances): AccountsBreakdown` — solo no archivadas; grupos en orden liquid, credit, investment, omitiendo vacíos; cuentas por `position`.
- Produces: `interface Flow { incomeCents: number; expenseCents: number }`; `periodSummary(txs: Transaction[], today: string): { today: Flow; month: Flow }` (todas las cuentas).
- Produces: `type WaterLevel = { state: 'no-salary' } | { state: 'ok'; remainingCents: number; percent: number; daysLeft: number }`; `waterLevel(salaryCents: number | null, monthExpenseCents: number, daysLeft: number): WaterLevel` — `percent` acotado 0–100, redondeado al entero.

- [ ] **Step 1: Write the failing tests** (fixtures con helpers `acct({...})`, `tx({...})`, `tr({...})`):
  - saldo: inicial 10000 + ingreso 5000 − gasto 2000 + transferencia entrante 1000 − saliente 500 → 13500; crédito con inicial −285936 y gasto 10000 → −295936; movimiento con fecha futura cuenta.
  - total: excluye `include_in_total: false` y `archived: true`.
  - desglose con NU 2517663 (debit), Cartera 61500 (cash), BBVA Crédito −285936 (credit), Banamex Crédito −351258 (credit, excluida), Póliza 7166202 (investment, excluida): `totalCents === 2293227`, subtotal liquid 2579163, credit −637194, investment 7166202, `creditDebtCents === 637194`, `investmentApartCents === 7166202`.
  - `periodSummary` con `today='2026-11-22'`: gasto del 22 y del 1.º de nov, ingreso del 31 de oct → today `{0, gasto22}`, month suma ambos gastos, ingreso de octubre fuera; cuenta excluida sí suma.
  - agua: `(1860000, 742000, 8)` → `{ok, remainingCents: 1118000, percent: 60, daysLeft: 8}`; `(1860000, 2000000, 3)` → `remainingCents: -140000, percent: 0`; `(null, 5, 1)` → `no-salary`; `(1000, 0, 0)` → percent 100.
  - `sumCents([Number.MAX_SAFE_INTEGER, 1])` lanza `RangeError`.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(domain): saldos por cuenta, total, resumen del mes y nivel de agua`.

---

### Task 4: Historial unificado y saldo diario (TDD)

**Files:**
- Create: `src/domain/feed.ts`
- Test: `src/domain/feed.test.ts`

**Interfaces:**
- Produces: `type FeedEntry = { type: 'transaction'; row: Transaction } | { type: 'transfer'; row: Transfer }`.
- Produces: `buildFeed(txs: Transaction[], transfers: Transfer[]): FeedEntry[]` — orden `date` desc, luego `created_at` desc.
- Produces: `signedAmount(entry: FeedEntry, accountId?: string): number` — movimiento: +ingreso / −gasto; transferencia: con `accountId`, −salida / +entrada; sin `accountId`, 0.
- Produces: `entriesForAccount(feed: FeedEntry[], accountId: string): FeedEntry[]` (movimientos de la cuenta y transferencias donde es origen o destino).
- Produces: `interface DayGroup { date: string; entries: FeedEntry[]; netCents: number; closingBalanceCents: number | null }`; `groupByDay(feed: FeedEntry[], opts?: { accountId?: string; openingBalanceCents?: number; fullFeed?: FeedEntry[] }): DayGroup[]` — `netCents` suma `signedAmount(entry, accountId)` de las entradas visibles del día; con `accountId` y `openingBalanceCents`, `closingBalanceCents` es el saldo de la cuenta al cierre de cada día, acumulado en orden ascendente sobre `fullFeed ?? feed` (el historial completo de la cuenta, aunque `feed` venga filtrado por chip); sin ellos, `null`.

- [ ] **Step 1: Write the failing tests:** orden por fecha y luego `created_at`; `signedAmount` en los cuatro casos; `entriesForAccount` incluye una transferencia como origen y otra como destino; `groupByDay` para una cuenta con inicial 0: día 21 (+500 entrada, −320 gasto) y día 22 (−18550 gasto, −200000 salida) → cierres 180 y −218370, `netCents` 180 el 21 y −218550 el 22; con `feed` filtrado solo a transferencias y `fullFeed` completo, los cierres siguen siendo 180 y −218370.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(domain): historial unificado con saldo al cierre del día`.

---

### Task 5: Búsqueda y filtros (TDD)

**Files:**
- Create: `src/domain/search.ts`
- Test: `src/domain/search.test.ts`

**Interfaces:**
- Consumes: `FeedEntry`, `signedAmount` (Task 4); `formatCents` (money).
- Produces: `type EntryKind = 'expense' | 'income' | 'transfer'`.
- Produces: `interface FeedFilters { text: string; month: string | null; range: { from: string; to: string } | null; kinds: EntryKind[]; accountIds: string[]; categoryIds: string[] }`; `EMPTY_FILTERS: FeedFilters` (`month: null`).
- Produces: `interface Lookups { accounts: Map<string, Account>; categories: Map<string, Category> }`.
- Produces: `normalizeText(s: string): string` (NFD, sin diacríticos, minúsculas, espacios colapsados).
- Produces: `matchesText(entry: FeedEntry, query: string, lookups: Lookups): boolean` — busca en nota, nombre de categoría, nombre(s) de cuenta(s); si la consulta es numérica (`/^\d+([.,]\d{0,2})?$/`), coincide si el monto sin `$` ni comas (`"185.50"`) empieza con la consulta normalizada a punto.
- Produces: `filterFeed(feed: FeedEntry[], filters: FeedFilters, lookups: Lookups): FeedEntry[]` — con `text` no vacío ignora `month` y `range`; `range` reemplaza a `month`; listas vacías = sin filtro; un filtro de categoría excluye transferencias; un filtro de cuenta incluye transferencias donde la cuenta es origen o destino.
- Produces: `feedTotals(feed: FeedEntry[]): { incomeCents: number; expenseCents: number; netCents: number }` (transferencias no cuentan).
- Produces: `PAGE_SIZE = 100`.

- [ ] **Step 1: Write the failing tests:** `normalizeText(' Educación  ')` → `'educacion'`; buscar `"educacion"` encuentra la categoría "Educación"; `"TACOS"` encuentra la nota "tacos"; `"185.5"` y `"185,5"` encuentran $185.50; `"nu"` encuentra una transferencia de "NU"; texto ignora `month`; `range` reemplaza `month`; `kinds: ['transfer']` solo transferencias; `categoryIds` excluye transferencias; `accountIds` incluye transferencia entrante; `feedTotals` con un ingreso 1000, gasto 300, transferencia 500 → `{1000, 300, 700}`.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(domain): búsqueda sin acentos y filtros combinables`.

---

### Task 6: Validaciones y reglas de uso (TDD)

**Files:**
- Create: `src/domain/validate.ts`, `src/domain/usage.ts`
- Test: `src/domain/validate.test.ts`, `src/domain/usage.test.ts`

**Interfaces:**
- Produces (`validate.ts`): `type Validation<F extends string> = { ok: true } | { ok: false; errors: Partial<Record<F, string>> }`.
  - `validateAccount(input: { name: string }): Validation<'name'>`
  - `validateCategory(input: { id?: string; name: string; kind: Category['kind']; monthly_limit_cents: number | null }, existing: Category[]): Validation<'name' | 'monthly_limit_cents'>`
  - `validateTransaction(input: { id?: string; kind; amount_cents: number | null; account_id: string | null; category_id: string | null; date: string; note: string | null; original_account_id?: string }, lookups: Lookups): Validation<'amount_cents' | 'account_id' | 'category_id' | 'date' | 'note'>` — cuenta archivada válida solo si `account_id === original_account_id` (edición).
  - `validateTransfer(input: { amount_cents: number | null; from_account_id: string | null; to_account_id: string | null; date: string; note: string | null }, lookups: Lookups): Validation<'amount_cents' | 'from_account_id' | 'to_account_id' | 'date' | 'note'>`
  - Mensajes exactos: nombre vacío `'Escribe un nombre'`; > 40 `'Máximo 40 caracteres'`; duplicado `'Ya tienes una categoría con ese nombre'`; límite ≤ 0 `'El límite debe ser mayor a 0'`; monto nulo o 0 `'Escribe un monto'`; sin cuenta `'Elige una cuenta'`; cuenta archivada `'Esa cuenta está archivada'`; categoría de otro tipo `'La categoría no es del tipo correcto'`; fecha `'Elige una fecha válida'`; nota > 200 `'Máximo 200 caracteres'`; mismas cuentas `'Elige dos cuentas distintas'`.
- Produces (`usage.ts`):
  - `categoriesByUsage(categories: Category[], txs: Transaction[], kind: Category['kind']): Category[]` (no archivadas; conteo desc, luego `position`, luego nombre).
  - `defaultAccountId(accounts: Account[], txs: Transaction[], transfers: Transfer[]): string | null` (§6.1).
  - `isAccountInUse(id: string, txs: Transaction[], transfers: Transfer[]): boolean`; `isCategoryInUse(id: string, txs: Transaction[]): boolean`.
  - `nextPosition(rows: { position: number }[]): number` (máximo + 1; 0 si vacío).

- [ ] **Step 1: Write the failing tests:** cada mensaje exacto de arriba; duplicado sin distinguir acentos ni mayúsculas ("comida" vs "Comida") y no choca consigo mismo al editar (`id` igual) ni con otro tipo; editar movimiento con `account_id === original_account_id` archivada → ok (Review Focus 3), crear con cuenta archivada → error; `isAccountInUse` con solo una transferencia → true (Review Focus 5); `categoriesByUsage` orden y exclusión de archivadas; `defaultAccountId`: la transferencia más reciente gana sobre un movimiento más viejo, salta archivadas, cae a la primera por `position`, `null` sin cuentas.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar (`Lookups` desde `search.ts`). **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(domain): validaciones de formularios y reglas de uso`.

---

### Task 7: Catálogo de iconos, colores y categorías iniciales

**Files:**
- Create: `src/domain/catalog.ts`, `src/domain/uuid.ts`, `src/domain/seedCategories.ts`, `src/db/seed.ts`
- Test: `src/domain/uuid.test.ts`, `src/domain/seedCategories.test.ts`, `src/db/seed.test.ts`

**Interfaces:**
- Produces (`catalog.ts`): `ICON_NAMES = ['transporte','cafe','dulces','palomitas','casa','moto','seguro','regalo','deporte','monedero','celular','ropa','trabajo','higiene','super','familia','corazon','perfume','educacion','banco','nomina','pago','inversion','tarjeta','cartera','efectivo','otros'] as const`; `type IconName`; `PALETTE: readonly string[]` (10 hex legibles en ambos temas, elegidos con frontend-design); `colorAt(i: number): string`.
- Produces (`uuid.ts`): `uuidV5(name: string, namespace: string): Promise<string>` (SHA-1 vía `crypto.subtle`, RFC 4122 §4.3).
- Produces (`seedCategories.ts`): `SARIA_NAMESPACE = '4f1d2c3a-8b7e-5c6d-9a0b-1e2f3a4b5c6d'`; `SEED_CATEGORIES: readonly { name: string; kind: 'income' | 'expense'; icon: IconName; monthly_limit_cents: number | null }[]` — gasto: Transporte/transporte, Comida/cafe, Antojo/dulces, Entretenimiento/palomitas, Casa/casa, Moto/moto, Otros/otros, Seguro/seguro (28800), Regalos/regalo, Rutina/deporte, Ocio/monedero, Saldo/celular, Ropa/ropa, Trabajo/trabajo, Higiene personal/higiene, Alimentación/super, Familia/familia, Salud/corazon, Perfume/perfume, Educación/educacion; ingreso: Interés/banco, Salario/nomina, Transferencia/pago, Regalo/regalo, Otros/otros, Aguinaldo/pago, Cashback/inversion, Utilidades/otros. `seedCategoryId(userId: string, kind: string, name: string): Promise<string>` = `uuidV5(`${userId}:${kind}:${name}`, SARIA_NAMESPACE)`.
- Produces (`db/seed.ts`): `ensureCategoriesSeeded(db: SariaDB, repo: Repo, userId: string): Promise<boolean>` — si el usuario no tiene ninguna categoría (viva o borrada), crea las 28 en una transacción (`position` = índice dentro de su tipo, `color = colorAt(índice global)`, `archived: false`) y devuelve `true`; si no, `false`.

- [ ] **Step 1: Write the failing tests:** `uuidV5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')` → `'2ed6657d-e927-568b-95e1-2665a8aea6a2'`; `SEED_CATEGORIES` tiene 20 de gasto y 8 de ingreso, sin nombres duplicados por tipo, Seguro con 28800; `seedCategoryId` es igual para la misma entrada y distinto entre "Otros" de gasto e ingreso; `ensureCategoriesSeeded` crea 28 filas y 28 entradas en `outbox`, la segunda llamada devuelve `false` sin escribir, con una categoría borrada previa devuelve `false`, y dos bases distintas producen los mismos `id`.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(domain): catálogo de iconos y categorías iniciales con IDs deterministas`.

---

### Task 8: Hooks de lectura

**Files:**
- Create: `src/db/queries.ts`
- Modify: `src/app/Layout.tsx` (llamar `ensureCategoriesSeeded` al montar con sesión)
- Test: `src/db/queries.test.tsx`

**Interfaces:**
- Consumes: `useSessionContext().userId`; `balancesByAccount` (Task 3); `buildFeed` (Task 4); `Lookups` (Task 5).
- Produces: `useLiveRows<T extends SyncedTableName>(table: T): RowOf<T>[] | undefined` (vivas y del usuario; `undefined` mientras carga).
- Produces: `useSettings(): Settings | null | undefined`.
- Produces: `useToday(): string` — `localDate(new Date())`, se recalcula con `visibilitychange` y con un temporizador a la siguiente medianoche local.
- Produces: `interface FinanceData { accounts: Account[]; categories: Category[]; transactions: Transaction[]; transfers: Transfer[]; balances: Map<string, number>; feed: FeedEntry[]; lookups: Lookups }`; `useFinance(): FinanceData | undefined` (memo sobre los cuatro `useLiveRows`).

- [ ] **Step 1: Write the failing test** (`renderHook` dentro de `SessionValueProvider` con `userId: 'u1'`, usando la `db` de la app limpiada en `beforeEach`): `useLiveRows('accounts')` excluye una fila borrada y una de `user_id: 'u2'`; tras `repo.put` de una cuenta nueva el hook la incluye (`waitFor`); `useFinance()` devuelve el saldo esperado de una cuenta con un gasto.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar; en `Layout` un `useEffect` con `userId` que llama `ensureCategoriesSeeded(db, repo, userId)` (errores ignorados con comentario). **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(db): hooks de lectura por usuario y siembra al entrar`.

---

### Task 9: Respaldo JSON (TDD)

**Files:**
- Create: `src/domain/backup.ts`, `src/db/backup.ts`
- Test: `src/domain/backup.test.ts`, `src/db/backup.test.ts`

**Interfaces:**
- Consumes: `COLUMNS`, `SyncedTableName`, `RowOf` (schema); `repo.put` con `created_at` y `repo.softDelete` (Task 1).
- Produces (`domain/backup.ts`): `BACKUP_FORMAT = 'saria-backup'`, `BACKUP_VERSION = 1`; `type BackupTables = { [T in SyncedTableName]: RowOf<T>[] }`; `interface Backup { format: typeof BACKUP_FORMAT; version: number; exported_at: string; tables: BackupTables }`; `buildBackup(tables: BackupTables, exportedAt: string): Backup`; `backupFileName(date: string): string` → `'saria-respaldo-2026-11-22.json'`; `type BackupCheck = { ok: true; backup: Backup; counts: Record<SyncedTableName, number> } | { ok: false; error: string }`; `parseBackup(text: string): BackupCheck` — primer error, mensajes exactos: `'El archivo no es un respaldo de Saria'` (JSON inválido, `format` distinto o falta `tables`), `'Este respaldo es de una versión más nueva de Saria'` (`version > 1`), `` `Falta la columna ${col} en ${table}` ``, `` `Hay un monto inválido en ${table}` ``, `` `Hay un ID inválido en ${table}` ``, `'Un movimiento apunta a una cuenta o categoría que no está en el respaldo'`, `'Una transferencia apunta a una cuenta que no está en el respaldo'`, `'Una transferencia tiene la misma cuenta de origen y destino'`.
- Produces (`db/backup.ts`): `readLiveTables(db: SariaDB, userId: string): Promise<BackupTables>`; `restoreBackup(db: SariaDB, repo: Repo, userId: string, backup: Backup): Promise<void>` — una transacción `rw` sobre las 8 tablas + `outbox`: cada fila del archivo con `repo.put(table, row, { created_at: row.created_at })` (el repo reescribe `user_id`; settings con `id = userId`), y cada fila viva del usuario cuyo `id` no está en el archivo con `repo.softDelete`.

- [ ] **Step 1: Write the failing tests:** ida y vuelta (`readLiveTables` → `buildBackup` → `JSON.stringify` → `parseBackup` → `restoreBackup` en otra base) da las mismas filas salvo `updated_at`; cada mensaje de error exacto; un archivo inválido no cambia nada; restaurar borra lógicamente una cuenta que no estaba en el archivo y encola su `delete`; un respaldo con `user_id: 'otro'` queda con el usuario actual y `useLiveRows`/`readLiveTables` del usuario lo ve (Review Focus 4); si una escritura falla a la mitad (mock de `repo.put` que lanza en la tercera fila), no cambia nada; `created_at` del archivo se conserva.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(backup): exportar y restaurar respaldo JSON con validación`.

---

### Task 10: Componentes base nuevos y correcciones de la Fase 0

Construir con `frontend-design:frontend-design` dentro de Laguna; agregar cada componente a `/componentes` (`src/screens/Componentes.tsx`).

**Files:**
- Create: `src/ui/AppIcon.tsx`, `src/ui/Toast.tsx`, `src/ui/Chip.tsx`, `src/ui/Segmented.tsx`, `src/ui/FeedRow.tsx`
- Modify: `src/ui/List.tsx`, `src/ui/AmountInput.tsx`, `src/ui/Sheet.tsx`, `src/screens/Componentes.tsx`
- Test: `src/ui/List.test.tsx`, `src/ui/AmountInput.test.tsx`, `src/ui/Toast.test.tsx`, `src/ui/FeedRow.test.tsx`

**Interfaces:**
- Produces: `<AppIcon name={IconName | null} color?: string size?: 'sm' | 'md' | 'lg' />` (SVG propio por nombre; `null` → `otros`).
- Produces: `ListItem` nuevo: `{ title: string; subtitle?: string; icon?: ReactNode; amountCents?: number /* con signo */; tone?: 'auto' | 'neutral'; onClick?(): void }` — `+$x` en agua si > 0, `−$x` en coral si < 0 (`neutral` = color de texto, conserva el signo); con `onClick` el renglón es un `<button>` de ancho completo. Se elimina la prop `kind`.
- Produces: `AmountInput` acepta `autoFocus?: boolean` e `inputRef?: Ref<HTMLInputElement>`; si el padre cambia `valueCents` con foco a `null`, el texto se vacía; el error está en una región `aria-live="polite"`.
- Produces: `ToastProvider` y `useToast(): { show(t: { message: string; actionLabel?: string; onAction?(): void }): void }` — un aviso a la vez, 5000 ms, `role="status"`, encima de la barra inferior.
- Produces: `<Chip label: string; selected?: boolean; onClick?(): void; onRemove?(): void; icon?: ReactNode />`, `<Segmented<T extends string> options: { value: T; label: string }[]; value: T; onChange(v: T): void; label: string />` (radiogroup como el selector de tema de Más).
- Produces: `<FeedRow entry: FeedEntry; lookups: Lookups; accountId?: string; onOpen(entry: FeedEntry): void />` — movimiento: título = categoría (o "Sin categoría"), subtítulo = nota o cuenta; transferencia: título "A {cuenta}"/"De {cuenta}" con `accountId`, o "{origen} → {destino}" sin él, `tone="neutral"`.
- Produces: `Sheet` en ≥ 1024 px se muestra como diálogo centrado (solo CSS).

- [ ] **Step 1: Write the failing tests:** `ListItem` con `-18550` muestra `"−$185.50"` y clase de gasto, con `4120` `"+$41.20"`, `tone="neutral"` y `-200000` muestra `"−$2,000.00"` sin clase de gasto; `onClick` → rol `button`; `AmountInput`: con foco, el padre pone `valueCents` en `null` → el input queda vacío; error dentro de `[aria-live="polite"]`; `Toast`: `show` muestra el mensaje y el botón "Deshacer", al tocarlo llama `onAction` y se cierra, a los 5000 ms se cierra (fake timers); `FeedRow` de transferencia con `accountId` de origen dice "A BBVA Crédito".
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar y actualizar `Componentes.tsx` (usos de `ListItem` con `kind`). **Step 4:** `npx vitest run src/ui` → PASS; `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(ui): iconos, aviso con deshacer, chips y renglón del historial`.

---

### Task 11: Formularios de cuenta, categoría, movimiento y transferencia

Construir con `frontend-design:frontend-design`.

**Files:**
- Create: `src/features/forms/AccountSheet.tsx`, `CategorySheet.tsx`, `TransactionSheet.tsx`, `TransferSheet.tsx`, `src/features/forms/pickers.tsx` (selectores de cuenta, categoría y fecha)
- Test: `src/features/forms/AccountSheet.test.tsx`, `TransactionSheet.test.tsx`, `TransferSheet.test.tsx`, `CategorySheet.test.tsx`

**Interfaces:**
- Consumes: `validate*`, `isAccountInUse`, `isCategoryInUse`, `nextPosition` (Task 6); `useFinance` (Task 8); `repo`; `Sheet`, `AmountInput`, `TextField`, `Segmented`, `Button`.
- Produces: `<AccountSheet open onClose account?: Account />` — campos nombre, tipo (Efectivo, Débito, Crédito, Inversión), saldo inicial (en crédito con etiqueta "Debes" y se guarda negativo), "Contar en el saldo total" (por defecto sí), icono y color; en edición: "Archivar"/"Desarchivar" y "Borrar" solo si `!isAccountInUse` (si está en uso se muestra "Tiene movimientos: puedes archivarla"); archivar con saldo ≠ 0 pide confirmar con el texto `` `Esta cuenta tiene saldo de ${formatCents(saldo)}; al archivarla deja de contar en el total` ``.
- Produces: `<CategorySheet open onClose kind: 'income' | 'expense' category?: Category />` — nombre, icono, color, límite mensual opcional; tipo fijo si `isCategoryInUse`; archivar/borrar con la misma regla.
- Produces: `<TransactionSheet open onClose transaction?: Transaction defaults?: Partial<Pick<Transaction, 'kind' | 'amount_cents' | 'account_id' | 'category_id' | 'date' | 'note'>> />` — formulario completo (§6.8); "Borrar" pide confirmación "¿Borrar este movimiento?".
- Produces: `<TransferSheet open onClose transfer?: Transfer />` — monto, De, A, fecha, nota; "Borrar" con confirmación.
- Produces: `<TransferFields value onChange errors />` exportado de `TransferSheet.tsx` para reutilizar en la hoja rápida.

- [ ] **Step 1: Write the failing tests:** crear cuenta de crédito con "Debes" 2,859.36 guarda `initial_balance_cents: -285936` y `position` siguiente; nombre vacío muestra "Escribe un nombre" y no guarda; cuenta con una transferencia no muestra "Borrar"; editar movimiento cambia monto y conserva `id`/`created_at`; borrar movimiento tras confirmar lo deja con `deleted_at`; transferencia con De = A muestra "Elige dos cuentas distintas"; categoría duplicada muestra el mensaje exacto.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(forms): formularios de cuenta, categoría, movimiento y transferencia`.

---

### Task 12: Registro rápido (botón +)

Construir con `frontend-design:frontend-design` siguiendo `registro-rapido.html`, opción A.

**Files:**
- Create: `src/app/QuickAddContext.tsx`, `src/features/quick-add/QuickAddSheet.tsx`
- Modify: `src/app/Layout.tsx` (reemplazar la hoja provisional; montar `ToastProvider` y `QuickAddProvider`), `src/app/App.tsx` si hace falta
- Test: `src/features/quick-add/QuickAddSheet.test.tsx`

**Interfaces:**
- Consumes: `categoriesByUsage`, `defaultAccountId` (Task 6); `useFinance`, `useToday` (Task 8); `TransactionSheet`, `TransferFields` (Task 11); `useToast` (Task 10).
- Produces: `useQuickAdd(): { open(opts?: { accountId?: string; kind?: 'expense' | 'income' | 'transfer' }): void }`.
- Produces: `<QuickAddSheet open onClose accountId?: string initialKind? />` — §5.1 y §6.8: pestañas Gasto/Ingreso/Transferir (`Segmented`), monto con `autoFocus`, chips de cuenta / fecha (hoy) / nota, rejilla de categorías por uso con "Más"; tocar una categoría valida (`validateTransaction`), guarda con `repo.put`, cierra, limpia y muestra `useToast().show({ message: 'Gasto guardado' | 'Ingreso guardado', actionLabel: 'Deshacer', onAction: softDelete })`; nombre accesible de cada categoría `` `Guardar gasto de ${formatCents(monto)} en ${nombre}` `` (o `'Guardar gasto en ${nombre}'` sin monto); monto vacío o 0 → error "Escribe un monto" y foco al monto; sin cuentas → "Primero crea una cuenta" con botón que abre `AccountSheet`; "Más opciones" abre `TransactionSheet` con lo capturado; Transferir usa `TransferFields` + botón "Transferir" y aviso "Transferencia guardada · Deshacer".
- Fab: etiqueta accesible "Registrar".

- [ ] **Step 1: Write the failing tests:** con una cuenta y categorías sembradas: escribir `185.50` y tocar "Comida" guarda un gasto de 18550 en la cuenta por defecto con fecha de hoy, cierra la hoja y muestra "Gasto guardado"; tocar "Deshacer" deja el movimiento con `deleted_at`; **doble clic rápido en "Comida" guarda un solo movimiento** (Review Focus 2; bloquear mientras guarda); sin monto, tocar "Comida" no guarda y muestra "Escribe un monto"; la pestaña Ingreso muestra "Salario" y no "Comida"; `open({ accountId })` preselecciona esa cuenta; transferencia de 500 entre dos cuentas guarda una fila en `transfers`.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(registro): registro rápido en dos toques con deshacer`.

---

### Task 13: Inicio con datos y tarjeta del agua

Construir con `frontend-design:frontend-design` siguiendo `pantallas.html` (Inicio).

**Files:**
- Modify: `src/screens/Inicio.tsx`, `src/ui/WaterLevelCard.tsx`
- Test: `src/ui/WaterLevelCard.test.tsx`, `src/screens/Inicio.test.tsx`

**Interfaces:**
- Consumes: `periodSummary`, `waterLevel`, `totalBalance` (Task 3); `groupByDay`, `buildFeed` (Task 4); `useFinance`, `useSettings`, `useToday` (Task 8); `FeedRow` (Task 10); `TransactionSheet`, `TransferSheet` (Task 11).
- Produces: `WaterLevelCardProps = { level: WaterLevel | null /* null = cargando */ }` — `no-salary`: "Captura tu sueldo en Más para ver cuánto te queda" con enlace a `/mas`; `ok`: "Te queda este mes", monto (negativo con `formatCents`), detalle `` `${percent}% de tu sueldo · faltan ${n} días` `` / `'falta 1 día'` / `'último día del mes'`; contraste del detalle ≥ 4.5:1 con agua alta y baja (fondo de la línea de detalle o color fijo, decisión de frontend-design).

- [ ] **Step 1: Write the failing tests:** tarjeta `no-salary` muestra el texto y el enlace a Más; `ok` con `daysLeft: 0` dice "último día del mes" y con `percent: 60` dice "60% de tu sueldo"; altura del agua 0% con `remainingCents` negativo; Inicio con sueldo 1,860,000 y un gasto de hoy de 18550 muestra "Te queda este mes", "$18,414.50", el gasto en "Hoy" y el saldo total; tocar el renglón abre la edición; "Ver todo" enlaza a `/movimientos`.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(inicio): nivel de agua con sueldo, hoy, mes y saldo total`.

---

### Task 14: Cuentas, detalle de cuenta y archivadas

Construir con `frontend-design:frontend-design` siguiendo `pantallas.html` (Cuentas, Detalle).

**Files:**
- Modify: `src/screens/Cuentas.tsx`, `src/app/router.tsx`
- Create: `src/screens/CuentaDetalle.tsx`, `src/screens/CuentasArchivadas.tsx`
- Test: `src/screens/Cuentas.test.tsx`, `src/screens/CuentaDetalle.test.tsx`

**Interfaces:**
- Consumes: `accountsBreakdown` (Task 3); `entriesForAccount`, `groupByDay` (Task 4); `useFinance`, `useToday`; `AccountSheet`, `TransactionSheet`, `TransferSheet` (Task 11); `useQuickAdd` (Task 12).
- Produces: rutas `/cuentas/:id` y `/cuentas/archivadas` dentro del layout; id inexistente o borrado → redirige a `/cuentas`.
- Cuentas: tarjeta de total con la línea `` `Debes en tarjetas ${…} · Inversión aparte ${…}` `` (omitir partes en 0); grupos "Efectivo y débito", "Crédito", "Inversión" con subtotal; etiqueta "fuera del total"; "Archivadas ›" solo si hay; "Nueva cuenta"; estado vacío "Aún no tienes cuentas" con botón.
- Detalle: saldo, tipo y saldo inicial; chips Todo / Movimientos / Transferencias; días con `formatDayLabel` y "Saldo $X"; "Editar cuenta"; el Fab de esta pantalla llama `useQuickAdd().open({ accountId })` (vía contexto: `QuickAddContext` expone `setContextAccount(id | null)` que la pantalla fija al montar y limpia al desmontar).

- [ ] **Step 1: Write the failing tests:** Cuentas con las cuentas del caso de Task 3 muestra "$22,932.27", "Debes en tarjetas $6,371.94", "fuera del total" en Banamex Crédito y los tres grupos; una archivada no aparece y sí aparece "Archivadas"; detalle de NU muestra "A BBVA Crédito" y el cierre del día; el chip Transferencias oculta los gastos sin cambiar los saldos de cierre; `/cuentas/no-existe` redirige.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(cuentas): lista por tipo, detalle con historial y archivadas`.

---

### Task 15: Movimientos con búsqueda y filtros

Construir con `frontend-design:frontend-design` (misma lista agrupada por día de `pantallas.html`).

**Files:**
- Modify: `src/screens/Movimientos.tsx`
- Create: `src/features/movimientos/FiltersSheet.tsx`
- Test: `src/screens/Movimientos.test.tsx`

**Interfaces:**
- Consumes: `filterFeed`, `feedTotals`, `EMPTY_FILTERS`, `PAGE_SIZE` (Task 5); `groupByDay` (Task 4); `formatMonth`, `shiftMonth`, `monthKey`, `formatDayLabel` (Task 2); `FeedRow`, `Chip`; hojas de edición (Task 11).
- Estado en la pantalla: `filters` (inicia con `month = monthKey(today)`), página visible. Buscador con `type="search"` y etiqueta "Buscar movimientos". Selector ‹ mes › con "Todo el historial"; con texto, el selector se muestra deshabilitado con la nota "Buscando en todo el historial". Hoja Filtros: tipo, cuentas, categorías, rango (desde/hasta) y "Limpiar". Línea de totales: gastos, ingresos, neto. "Ver más" agrega `PAGE_SIZE`. Estado vacío: "Nada coincide con tu búsqueda" / "Aún no hay movimientos este mes".

- [ ] **Step 1: Write the failing tests:** muestra solo el mes actual y cambia con "‹"; buscar "tacos" encuentra una nota de otro mes; filtro de tipo Transferencia con chip removible; totales del resultado; con 150 movimientos se ven 100 y "Ver más" muestra 150.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(movimientos): búsqueda, filtros y paginación`.

---

### Task 16: Más: sueldo, categorías y respaldo

Construir con `frontend-design:frontend-design`.

**Files:**
- Modify: `src/screens/Mas.tsx`, `src/app/router.tsx`, `src/app/SessionProvider.tsx` (`markSignedOut` en `finally`)
- Create: `src/screens/Categorias.tsx`, `src/screens/Respaldo.tsx`, `src/app/download.ts`
- Test: `src/screens/Mas.test.tsx`, `src/screens/Categorias.test.tsx`, `src/screens/Respaldo.test.tsx`, `src/app/SessionProvider.test.tsx`

**Interfaces:**
- Consumes: `updateSettings` (Task 1); `buildBackup`, `parseBackup`, `backupFileName` (Task 9); `readLiveTables`, `restoreBackup` (Task 9); `CategorySheet` (Task 11); `isCategoryInUse`.
- Produces: `downloadJson(fileName: string, data: unknown): void` (Blob + `<a download>` + `URL.revokeObjectURL`).
- Rutas `/mas/categorias` y `/mas/respaldo`.
- Más: "Sueldo mensual" (`AmountInput`, guarda en blur con `updateSettings`; vacío → `null`), enlaces "Categorías" y "Respaldo", Tema, Sesión con el texto "Cerrar sesión no borra tus datos de este dispositivo", versión.
- Categorías: `Segmented` Gasto/Ingreso; lista con icono, nombre y, si tiene límite, `` `${gastado} de ${límite}` `` del mes; "Nueva categoría"; archivadas al final en un grupo "Archivadas".
- Respaldo: "Exportar respaldo" → `downloadJson(backupFileName(today), buildBackup(await readLiveTables(...), now))`; "Importar respaldo" → input de archivo; error de `parseBackup` con `role="alert"`; vista previa `` `Este respaldo tiene ${n} cuentas, ${n} categorías, ${n} movimientos y ${n} transferencias (exportado el ${fecha})` ``; hoja de confirmación con "Esto reemplaza todo lo que hay en este dispositivo. Antes descargaremos un respaldo de lo actual." → descarga automática → `restoreBackup` → aplicar el tema restaurado (`useTheme().setPref`) → aviso "Respaldo restaurado".

- [ ] **Step 1: Write the failing tests:** capturar sueldo 18,600 guarda `monthly_income_cents: 1860000` y vaciarlo guarda `null`; el texto de sesión nuevo; `signOut` que lanza aún llama `markSignedOut`; Categorías lista "Seguro" con "$0.00 de $288.00"; Respaldo: exportar llama `downloadJson` con `'saria-respaldo-2026-11-22.json'` (fecha fija con `vi.setSystemTime`); importar un archivo inválido muestra "El archivo no es un respaldo de Saria"; importar uno válido muestra la vista previa, al confirmar descarga primero el respaldo actual y luego restaura.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(mas): sueldo mensual, categorías y respaldo`.

---

### Task 17: Mensajes de error de inicio de sesión

**Files:**
- Modify: `src/auth/authService.ts`
- Test: `src/auth/authService.test.ts`

**Interfaces:**
- Produces: `AuthError` agrega `'email_not_confirmed'` y `'invalid_api_key'`; `AUTH_ERROR_MESSAGES.email_not_confirmed = 'Tu correo aún no está confirmado. Confírmalo desde el enlace que te llegó o márcalo como confirmado en Supabase (Authentication → Users).'`; `AUTH_ERROR_MESSAGES.invalid_api_key = 'La clave de Supabase no es válida. Revisa VITE_SUPABASE_ANON_KEY en Vercel y vuelve a desplegar.'`.
- `toAuthError`: `isAuthApiError(e) && e.code === 'email_not_confirmed'` → `email_not_confirmed`; error con `status === 401` y mensaje que contiene `'Invalid API key'` → `invalid_api_key`.

- [ ] **Step 1: Write the failing tests** con el mock de cliente existente: los dos casos nuevos devuelven su código; `invalid_credentials` sigue igual.
- [ ] **Step 2:** → FAIL. **Step 3:** Implementar. **Step 4:** `npx vitest run src/auth src/screens/IniciarSesion.test.tsx` → PASS.
- [ ] **Step 5: Commit** `fix(auth): mensajes claros para correo sin confirmar y clave inválida`.

---

### Task 18: E2E sin conexión, tamaño del build y cierre

**Files:**
- Create: `e2e/nucleo.spec.ts`
- Modify: `e2e/app.spec.ts` (localizadores exactos: `getByRole('heading', { name: 'Cuentas', exact: true })` y `getByRole('link', { name: 'Cuentas', exact: true })`), `src/app/router.tsx` (carga diferida)

**Interfaces:**
- Consumes: `seedSession` y `test` de `e2e/fixtures.ts`.

- [ ] **Step 1: Write the E2E tests** (`nucleo.spec.ts`, ambos perfiles): 
  - `registra un gasto sin conexión en dos toques`: cargar `/`, esperar el service worker (`navigator.serviceWorker.ready`), `context.setOffline(true)`, comprobar `navigator.onLine === false`; Cuentas → "Nueva cuenta" "Cartera" efectivo con saldo inicial 1,000 → guardar; tocar "Registrar", escribir `185.50`, tocar "Comida"; Inicio muestra "−$185.50" en Hoy; Cuentas muestra Cartera con "$814.50"; recargar sin conexión y el gasto sigue ahí.
  - `una transferencia mueve ambos saldos`: dos cuentas (1,000 y 0), transferir 300 → "$700.00" y "$300.00"; el detalle de cada una muestra "A …" / "De …".
  - `respaldo de ida y vuelta`: crear cuenta, exportar (`page.waitForEvent('download')`), borrar la cuenta, importar el archivo descargado (`setInputFiles`), confirmar (acepta la descarga automática), la cuenta vuelve.
- [ ] **Step 2:** `npm run test:e2e` → los nuevos pasan; corregir lo que falle con `superpowers:systematic-debugging`.
- [ ] **Step 3:** `npm run build`: si avisa de un chunk > 500 kB, cargar con `React.lazy` las rutas `CuentaDetalle`, `CuentasArchivadas`, `Movimientos`, `Categorias`, `Respaldo` (y `Componentes` ya lo es) y repetir hasta que no haya aviso; confirmar que la E2E sin conexión sigue pasando (los chunks quedan en el precache).
- [ ] **Step 4: Verificación completa** (`superpowers:verification-before-completion`): `npm run typecheck && npm run lint && npm test && npm run build && npm run test:e2e` → todo en verde; mostrar la salida a Brian.
- [ ] **Step 5: Commit** `test(e2e): registro sin conexión, transferencias y respaldo`.
- [ ] **Step 6: Cierre de fase:** `superpowers:requesting-code-review` sobre la rama; atender hallazgos; `superpowers:finishing-a-development-branch` (fusionar a `main` y `git push` cuando Brian lo apruebe) → Vercel publica; verificar la URL de producción: el aviso de actualización aparece, se registra un gasto en modo avión en el teléfono. Actualizar la memoria de pendientes con lo que quede diferido.
