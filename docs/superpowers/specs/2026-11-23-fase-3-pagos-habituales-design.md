# Saria — Fase 3: Pagos habituales y recordatorios (diseño)

Fecha: 2026-11-23 · Autor del diseño: Brian Roberto Salas Pardo (con Claude) · Referencias: `docs/ROADMAP.md`, specs de las Fases 1 y 2.

## 1. Intención

Que Saria avise lo que hoy avisa Money Manager y que los gastos fijos del Excel dejen de vivir ahí: pagos habituales con periodicidad, una vista "Por pagar", marcar como pagado en un toque (o creación automática) y el recordatorio diario de registrar gastos.

**Criterio de terminado (del ROADMAP, ajustado):** los 11 gastos fijos de "Resumen General" están como pagos habituales; "Por pagar" muestra los de la semana; el recordatorio diario aparece dentro de la app.

**Modo de ejecución:** ligero (pruebas solo de lo crítico, una revisión final).

## 2. Objetivos, no-objetivos y anti-objetivos

**Objetivos:** CRUD de pagos habituales; "Por pagar" (vencidos, hoy, esta semana); marcar pagado / omitir; creación automática; recordatorio diario dentro de la app; carga de los 16 pagos desde el Excel y Money Manager.

**No-objetivos (decidido por Brian):** notificaciones push o avisos con la app cerrada (requieren servidor). Compras a meses como módulo propio (Fase 4; aquí entran como pagos habituales con fecha de fin). Migraciones SQL (el esquema de la Fase 0 ya tiene `recurring_payments`, `reminders` y `transactions.recurring_id`).

**Anti-objetivos:** movimientos duplicados (por reimportar, por dos dispositivos o por pagos que Money Manager ya registró); que agregar pagos habituales borre o reemplace datos existentes.

## 3. Enfoques considerados (carga inicial)

| Enfoque | Ventajas | Desventajas |
| --- | --- | --- |
| **A. Script genera un archivo solo de pagos habituales + opción "Agregar pagos habituales desde archivo" que suma sin reemplazar (elegido por Brian)** | Cuentas y categorías ligadas sin errores; reimportar no duplica | Una tarea chica extra |
| B. Captura manual en el formulario | Sin desarrollo extra | ~15 min de captura, errores posibles |

Notificaciones: push con Supabase (tarea programada + función) descartado por Brian a favor de avisos al abrir la app.

## 4. Reglas del dominio (`src/domain/recurring.ts`, TDD ligero)

- **Frecuencias** (ya en el esquema): `daily`, `weekly` (cada 7 días desde `start_date`), `biweekly` (cada 14 días desde `start_date`), `semimonthly` (días `day_of_month` y `second_day_of_month`), `monthly` (día `day_of_month`), `yearly` (mismo día y mes de `start_date`), `custom` (cada `interval_days` desde `start_date`). Un día 29–31 que no existe en el mes cae en el último día del mes.
- `nextOccurrence(pago, despuesDe: string): string | null` — primera fecha > `despuesDe` (o ≥ `start_date` si es anterior); `null` si pasa de `end_date`.
- `next_due_date` guarda la próxima fecha pendiente; marcar pagado u omitir lo avanza con `nextOccurrence(pago, next_due_date)`; si es `null`, `active = false`.
- **ID determinista del movimiento generado:** `uuidV5(recurring_id + ':' + fecha)` (namespace de Saria). Así, marcar pagado y la creación automática en dos dispositivos escriben la misma fila (sin duplicados).
- **Por pagar:** pagos activos con `next_due_date` ≤ hoy + 6 días, agrupados en *Vencidos* (< hoy), *Hoy* y *Esta semana*; orden por fecha.
- **Creación automática:** al abrir la app y al cambiar el día, para cada pago activo con `auto_create` y `next_due_date` ≤ hoy, crea el movimiento de cada fecha pendiente hasta hoy (con su ID determinista, `recurring_id`, monto, cuenta, categoría y la fecha de la ocurrencia) y avanza `next_due_date`. Si el pago no tiene cuenta, no se crea solo: queda en Vencidos.

## 5. Pantallas (con `frontend-design`, dentro de Laguna)

- **Inicio:** tarjeta "Por pagar" bajo los resúmenes, solo si hay algo: renglones con nombre, monto, cuenta y fecha ("vencido hace 2 días", "hoy", "jue 27"); cada renglón tiene **Pagado** (abre una hoja con monto, cuenta y fecha precargados y editables → crea el movimiento) y en el menú del renglón **Omitir este pago**. "Ver todos" lleva a Más → Pagos habituales.
- **Recordatorio diario:** si la hora del recordatorio ya pasó y hoy no hay movimientos, Inicio muestra arriba "¿Ya registraste tus gastos de hoy?" con botón que abre el registro rápido y un ×  que lo oculta por hoy. Vive en la tabla `reminders` (una fila "Registra tus gastos del día", `daily`, 20:00, habilitada; se crea si no existe). Más → Recordatorio diario: activar y hora.
- **Más → Pagos habituales:** lista (activos primero, con próxima fecha) y formulario: nombre, gasto/ingreso, monto, cuenta (opcional), categoría, frecuencia con sus campos, fecha de inicio, fecha de fin (opcional), "Crear el movimiento automáticamente", activo. Borrar = borrado lógico; los movimientos ya creados se conservan.
- **Más → Respaldo:** nueva opción "Agregar pagos habituales desde archivo" (§6).

## 6. Carga inicial

**Script:** `node scripts/importar-pagos-habituales.mjs data/<respaldo>.mmbackup "data/Gastos Personales.xlsx"` → `data/saria-pagos-habituales-AAAA-MM-DD.json` con formato `{"format": "saria-recurring", "version": 1, "recurring_payments": [...]}` y resumen en terminal. Lee el `.xlsx` (ZIP + XML, con `fflate`) y la tabla `reminding` del `.mmbackup`.

- **IDs:** `uuidV5` desde el `uid` de Money Manager o desde `excel:<nombre>`; `account_id`/`category_id` con los mismos IDs que produjo el importador de la Fase 2 (mismo namespace y regla), para que apunten a las cuentas y categorías ya importadas.
- **Del Excel (11, `auto_create: false`):**

| Gasto | Monto | Cuenta | Frecuencia | Categoría (propuesta) |
| --- | --- | --- | --- | --- |
| Seguro Vida | 2,760 | Banamex | monthly día 22 | Seguro |
| Gastos de casa | 1,600 | Mercado Pago | semimonthly 15 y 31 | Casa |
| Gasolina | 450 | BBVA crédito | biweekly desde la fecha de carga | Moto |
| Internet casa de madre | 459 | Banamex crédito | monthly 15 | Casa |
| Agua | 293.38 | BBVA crédito | monthly 15 | Casa |
| Seguro Medico Chubb | 288 | Banamex crédito | monthly 15 | Seguro |
| Saldo | 200 | BBVA crédito | monthly 25 | Saldo |
| Gym | 150 | Banamex crédito | monthly 15 | Rutina |
| Seguro Liverpool | 132 | Liverpool | monthly 15 | Seguro |
| Spotify | 40 | Mercado Pago | monthly 17 | Entretenimiento |
| Claude | 350 | (sin cuenta) | monthly día 1 | Trabajo |

- **De Money Manager (5 compras a meses, `auto_create: true`, con `end_date`):** Reloj mensualidad, Mesualidades de cama, Laptop de karina, Mensualidad TLOZ, Mensualidad switch 2 — monto, cuenta y categoría de su `sync_link`, día = día de `startDate`. Se omiten "PIF" y "Seguro banamex" (ya vienen del Excel) y el recordatorio diario (se crea el de Saria).
- `next_due_date` = primera ocurrencia **posterior a hoy** (lo pasado ya está registrado en Money Manager).

**En la app:** "Agregar pagos habituales desde archivo" valida el formato (`saria-recurring` v1, columnas de `recurring_payments`, montos enteros, cuentas/categorías existentes o nulas), muestra "Se agregarán N pagos habituales (M ya existen y se actualizarán)", y con confirmación hace `repo.put` de cada uno (upsert por ID; nada se borra). Todo pasa por `outbox` y se sincroniza.

## 7. Pruebas (modo ligero)

- `recurring.ts`: `nextOccurrence` para monthly con día 31 en febrero, semimonthly 15/31, biweekly, fin de vigencia; agrupación de Por pagar; creación automática idempotente (dos llamadas = mismos movimientos).
- Importación que agrega: no borra filas existentes y reimportar no duplica.
- Script: prueba condicionada a `data/` (conteo 16, cuentas existentes en la importación de la Fase 2).
- Verificación final: `typecheck`, `lint`, `test`, `build`, `test:e2e` en verde.

## 8. Lo que queda al constructor

Diseño visual de la tarjeta Por pagar, del aviso diario y del formulario; texto relativo de fechas; mapeo exacto de columnas del Excel.
