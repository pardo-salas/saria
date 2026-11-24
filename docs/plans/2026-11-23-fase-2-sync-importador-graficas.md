# Saria — Fase 2: Sincronización, importador y gráficas — Plan (modo ligero)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (modo ligero: un implementador por tarea, solo pruebas clave, una revisión final). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Importar el historial de Money Manager con un script, sincronizar Dexie ↔ Supabase y mostrar tres gráficas.

**Architecture:** Script Node que genera un respaldo JSON de Saria (se carga con la importación existente). Motor de sync en `src/sync/` (push de `outbox` por lotes, pull por `updated_at`) disparado por eventos y cada 60 s. Gráficas con agregados puros en `src/domain/charts.ts` y Recharts cargado de forma diferida.

**Tech Stack:** Node ≥ 24 (`node:sqlite`), `fflate` (dev) para el ZIP; React 19, Dexie 4, `@supabase/supabase-js` 2, Recharts 3, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-23-fase-2-sync-importador-graficas-design.md` (se cita como §).

## Global Constraints

- Solo `src/auth/**` y `src/sync/**` importan `@supabase/supabase-js`.
- Montos en centavos enteros; fechas `YYYY-MM-DD` en `America/Mexico_City`.
- `data/` y todo JSON generado nunca entran a git ni a fixtures.
- UI en español de México, minúscula de oración; dirección visual Laguna con tokens existentes; `frontend-design` para UI.
- Commits en español terminados con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Antes de cada commit: `npx prettier --write` de lo cambiado y `npm run typecheck && npm run lint && npm test`.

## Review Focus

1. Escritura local durante un push: no se pierde (la entrada nueva de la misma fila sigue en `outbox`). → Task 2.
2. Pull de una fila con cambio local pendiente: no la pisa. → Task 2.
3. Primera sincronización con datos de prueba locales: se descartan y no suben. → Task 2.
4. Dos dispositivos editan la misma fila sin conexión: ambos terminan iguales. → Task 2.
5. Cuadratura del importador: saldo calculado por cuenta = `account_balance`. → Task 1.

---

### Task 1: Script importador

**Files:** Create `scripts/importar-money-manager.mjs`, `scripts/importar-money-manager.test.ts` (o `src/…` si Vitest no incluye `scripts/`; ajustar `include` si hace falta). Modify `package.json` (devDependency `fflate`, script `"importar": "node scripts/importar-money-manager.mjs"`).

**Interfaces:** Produces `export async function convertirMmbackup(rutaArchivo: string, opciones?: { ahora?: Date }): Promise<{ backup: Backup; resumen: Resumen }>` (exportada para la prueba) y el CLI de §5. `Backup` con el formato de `src/domain/backup.ts` (`format: 'saria-backup'`, `version: 1`).

- [ ] Implementar §5 completo (lectura del ZIP con bytes previos, reglas, mapeo de cuentas de la tabla de §5, saldo inicial derivado, categorías con iconos como `SEED_CATEGORIES`, settings con 1860000, UUID v5 desde `uid` con namespace fijo nuevo, resumen en terminal).
- [ ] Prueba condicionada (`describe.skipIf(!existsSync(ruta))`, ruta = primer `data/*.mmbackup`): `parseBackup(JSON.stringify(backup)).ok === true`; 14 cuentas, 28 categorías, 2706 movimientos, 325 transferencias; para cada cuenta, `balancesByAccount(...)` = valor de `account_balance` (0 si falta).
- [ ] Correr `npm run importar -- data/<archivo>.mmbackup`, revisar el resumen (saldos iniciales razonables) y pegar el resumen en el reporte (sin datos sensibles más allá de nombres de cuenta y saldos).
- [ ] Commit `feat(importador): script de Money Manager a respaldo de Saria`.

### Task 2: Motor de sincronización

**Files:** Create `src/sync/engine.ts`, `src/sync/engine.test.ts`, `src/sync/fakeSupabase.ts` (Supabase simulado en memoria para pruebas: tablas, `upsert`, `select … gte … order … range`, `updated_at` del "servidor").

**Interfaces:**
- `type SyncStatus = { state: 'sincronizado' | 'pendiente' | 'sin-conexion' | 'error' | 'sincronizando'; pending: number; lastSyncedAt: string | null; message: string | null }`
- `createSyncEngine(deps: { db: SariaDB; supabase: SupabaseClient; getUserId(): string | null; now?(): string; isOnline?(): boolean }): { syncNow(): Promise<void>; getStatus(): SyncStatus; subscribe(fn: (s: SyncStatus) => void): () => void }`
- `TABLE_ORDER = ['settings','accounts','categories','recurring_payments','installment_plans','transactions','transfers','reminders'] as const`

- [ ] Implementar §6.1 y §6.3 (push colapsado por fila, lotes de 500, borrar solo los `seq` enviados, backoff 1/2/5/10 min; pull con `gte` y páginas de 1,000, sin pisar filas con `outbox` pendiente, `last_pulled_at` por tabla; primera sincronización: sin filas en `sync_state` → borrar filas locales del usuario y `outbox`, luego pull completo).
- [ ] Pruebas (con `fakeSupabase` y dos `createDb` como dos dispositivos): las 4 primeras líneas de Review Focus, más "push sube padres antes que hijos" y "borrado lógico se propaga".
- [ ] Commit `feat(sync): motor de sincronización con outbox y pull incremental`.

### Task 3: Integración en la app

**Files:** Create `src/sync/SyncProvider.tsx` (crea el motor con `getSupabase()` y la sesión, `useSyncStatus()`), `src/ui/SyncPill.tsx`. Modify `src/app/Layout.tsx` (montar disparadores de §6.2; mover la siembra de categorías para que ocurra después de la primera sincronización exitosa y solo si no hay categorías, §6.3), `src/screens/Inicio.tsx` (pastilla junto al saludo), `src/screens/Mas.tsx` (sección "Sincronización": estado, última hora, botón "Sincronizar ahora"; aviso de cambios pendientes al cerrar sesión, §6.4).

**Interfaces:** Consumes Task 2. Produces `useSyncStatus(): SyncStatus` y `useSyncNow(): () => Promise<void>`.

- [ ] Implementar §6.2 y §6.4 (disparadores: sesión, montaje, `visibilitychange`, `online`, 2 s tras escritura detectada con `liveQuery` sobre `outbox.count()`, intervalo 60 s visible; textos: "Sincronizado", "N pendientes", "Sin conexión", "Error al sincronizar", "Sincronizando…", "Tu sesión venció; vuelve a iniciar sesión para sincronizar").
- [ ] Una prueba: la pastilla muestra "2 pendientes" con dos entradas en `outbox` y estado sin conexión. Ajustar pruebas existentes de Layout/Inicio/Más que se rompan (la siembra ya no ocurre al montar sin sync).
- [ ] Commit `feat(sync): indicador de estado y sincronización automática`.

### Task 4: Gráficas

**Files:** Create `src/domain/charts.ts`, `src/domain/charts.test.ts`, `src/screens/Graficas.tsx` (reemplaza el estado vacío), componentes de gráfica en `src/features/graficas/` cargados con `React.lazy`.

**Interfaces:**
- `spendingByCategory(txs, categories, month: string): { categoryId: string | null; name: string; color: string | null; cents: number }[]` (desc, solo gastos)
- `incomeVsExpenseByMonth(txs, endMonth: string, months = 12): { month: string; incomeCents: number; expenseCents: number }[]`
- `totalBalanceByMonth(accounts, txs, transfers, endMonth: string, months = 12): { month: string; cents: number }[]` (reglas de saldo total de §6.1 de la Fase 1, al cierre de cada mes)

- [ ] Pruebas de las tres funciones con datos pequeños (incluye mes sin movimientos = 0 y transferencias que no cambian el total).
- [ ] UI §7 con `frontend-design` y la skill `dataviz`; tocar una barra navega a `/movimientos` con la categoría y el mes (pasar por `location.state` y que Movimientos lo lea como filtros iniciales).
- [ ] Commit `feat(graficas): gasto por categoría, ingresos vs gastos y evolución del saldo`.

### Cierre

- [ ] Revisión final única del diff de la rama (sonnet) enfocada en bugs de datos; una ronda de correcciones.
- [ ] Verificación: `typecheck`, `lint`, `test`, `build`, `test:e2e` en verde, salida mostrada a Brian.
- [ ] Con aprobación de Brian: fusionar a `main` y `git push`; guía corta de estreno (orden de §6.3).
