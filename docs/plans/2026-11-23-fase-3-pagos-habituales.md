# Saria — Fase 3: Pagos habituales y recordatorios — Plan (modo ligero)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (modo ligero: un implementador por tarea, solo pruebas clave, una revisión final). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Pagos habituales con Por pagar, marcar pagado/omitir, creación automática, recordatorio diario dentro de la app y carga de los 16 pagos del Excel y Money Manager.

**Architecture:** Reglas puras en `src/domain/recurring.ts`; escrituras con `repo` (sincronizan solas); pantallas en Inicio y Más; script Node + importación que agrega (upsert, sin borrar).

**Tech Stack:** React 19, Dexie 4, Vitest; Node ≥ 24 + `fflate` para el script.

**Spec:** `docs/superpowers/specs/2026-11-23-fase-3-pagos-habituales-design.md` (se cita como §).

## Global Constraints

- Montos en centavos; fechas `YYYY-MM-DD` en `America/Mexico_City`; toda escritura por `repo`.
- Sin migraciones SQL (el esquema ya tiene `recurring_payments`, `reminders`, `transactions.recurring_id`).
- `data/` y los JSON generados nunca entran a git.
- UI en español de México, minúscula de oración, Laguna, `frontend-design`.
- Commits en español terminados con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; antes de cada commit prettier + `typecheck`, `lint`, `test`.

## Review Focus

1. Día 31 en meses cortos y semimonthly 15/31. → Task 1.
2. Creación automática dos veces (o en dos dispositivos) no duplica. → Task 1.
3. Reimportar el archivo de pagos no duplica ni borra nada. → Task 3.

---

### Task 1: Dominio de pagos habituales

**Files:** Create `src/domain/recurring.ts`, `src/domain/recurring.test.ts`, `src/db/recurring.ts` (escrituras).

**Interfaces:**
- `nextOccurrence(p: RecurringPayment, after: string): string | null` (§4)
- `type DueGroup = { overdue: RecurringPayment[]; today: RecurringPayment[]; week: RecurringPayment[] }`; `dueGroups(payments, today: string): DueGroup`
- `occurrenceTransactionId(recurringId: string, date: string): Promise<string>` (`uuidV5` con `SARIA_NAMESPACE`)
- En `src/db/recurring.ts`: `markPaid(p, { amount_cents, account_id, category_id, date, note }): Promise<void>` (crea el movimiento con ID determinista y `recurring_id`, avanza `next_due_date`, desactiva si `null`, en una transacción Dexie); `skipOccurrence(p): Promise<void>`; `runAutoCreate(userId, today): Promise<number>` (§4, devuelve cuántos creó).

- [ ] Pruebas: monthly 31 → 28/29 feb; semimonthly 15/31 en abril (15, 30); biweekly; `end_date` corta; `dueGroups`; `runAutoCreate` dos veces = mismos movimientos (Review Focus 1 y 2).
- [ ] Commit `feat(dominio): reglas de pagos habituales y creación automática`.

### Task 2: Pantallas

**Files:** Create `src/features/recurring/RecurringSheet.tsx` (formulario), `src/features/recurring/PayDueSheet.tsx` (pagar con datos precargados), `src/screens/PagosHabituales.tsx` (ruta `mas/pagos`), `src/features/recurring/DueCard.tsx`, `src/features/recurring/DailyReminderBanner.tsx`. Modify `src/screens/Inicio.tsx`, `src/screens/Mas.tsx`, `src/app/router.tsx`, `src/app/Layout.tsx` (llamar `runAutoCreate` al montar y cuando cambie `useToday()`; asegurar la fila del recordatorio diario), `src/db/queries.ts` si hace falta.

- [ ] Implementar §5 con `frontend-design` (textos: "Por pagar", "Vencidos", "Hoy", "Esta semana", "Pagado", "Omitir este pago", "Ver todos", "¿Ya registraste tus gastos de hoy?", "Recordatorio diario", "Crear el movimiento automáticamente").
- [ ] Una prueba: Inicio muestra un pago vencido en "Por pagar" y "Pagado" crea el movimiento y lo saca de la lista.
- [ ] Commit `feat(pagos): por pagar, pagos habituales y recordatorio diario`.

### Task 3: Carga inicial

**Files:** Create `scripts/importar-pagos-habituales.mjs`, `scripts/importar-pagos-habituales.test.ts`, `src/domain/recurringFile.ts` (+ prueba), opción en `src/screens/Respaldo.tsx`. Modify `package.json` (script `"importar-pagos"`).

**Interfaces:** `parseRecurringFile(text, lookups): { ok: true; rows: NewRow<'recurring_payments'>[] & {id}; nuevos: number; existentes: number } | { ok: false; error: string }` (formato `saria-recurring` v1); `addRecurringPayments(rows): Promise<void>` (upsert con `repo.put`, nada se borra).

- [ ] Script §6 (lee `.xlsx` con `fflate` + XML, `reminding` del `.mmbackup`; IDs y cuentas/categorías con el mismo namespace y regla que `scripts/importar-money-manager.mjs` — reutilizar su lógica exportándola; tabla de §6; omitir PIF, Seguro banamex y el recordatorio diario; `next_due_date` posterior a hoy).
- [ ] Pruebas: archivo válido agrega sin borrar y reimportar no duplica (Review Focus 3); prueba condicionada a `data/` (16 pagos, todas las cuentas/categorías referidas existen en la importación de la Fase 2).
- [ ] Correr `npm run importar-pagos -- data/<mmbackup> "data/Gastos Personales.xlsx"` y pegar el resumen en la respuesta.
- [ ] Commit `feat(importador): pagos habituales del Excel y Money Manager`.

### Cierre

- [ ] Revisión final única (sonnet) enfocada en duplicados y fechas; una ronda de correcciones.
- [ ] Verificación: `typecheck`, `lint`, `test`, `build`, `test:e2e` en verde, salida a Brian.
- [ ] Con aprobación de Brian: fusionar a `main` y `git push`; pasos de estreno (agregar el archivo desde Más → Respaldo).
