# Saria — Fase 4: Lo que hoy vive en el Excel (diseño)

Fecha: 2026-11-23 · Autor del diseño: Brian Roberto Salas Pardo (con Claude) · Referencias: `docs/ROADMAP.md`, specs de las Fases 1–3.

## 1. Intención

Traer a Saria lo que hoy vive en "Gastos Personales.xlsx" para dejar de abrirlo: tarjetas de crédito (línea, corte, pago), compras a meses, rendimientos y el resumen del mes con el sueldo.

**Criterio de terminado (del ROADMAP, ajustado por Brian):** las 6 tarjetas/cuentas del Excel con corte y pago; las compras a meses muestran las mismas cifras que el Excel (costo por mes, acumulado, restantes, fecha final, queda por pagar); el resumen del mes parte del sueldo de $18,600 contando los **cargos reales** del mes (decisión de Brian: no copia el atajo del Excel que cuenta "cada quincena" y "cada 2 semanas" una sola vez).

**Modo de ejecución:** ligero; TDD solo para los cálculos (el ROADMAP pide estrictos los de esta fase).

## 2. Objetivos, no-objetivos y anti-objetivos

**Objetivos:** compras a meses que generan su mensualidad; panel de tarjeta en el detalle de cuenta; estimado de rendimiento; resumen del mes y nivel de agua con "te queda"; carga desde el Excel y Money Manager.

**No-objetivos:** intereses de tarjeta o del crédito hipotecario; conciliación con estados de cuenta; notificaciones.

**Anti-objetivos:** cobrar doble una mensualidad (compra a meses + su pago habitual de la Fase 3); cifras de compras a meses distintas a las del Excel; contar dos veces un gasto en el resumen (como fijo y como gastado).

## 3. Enfoques

| Decisión | Elegido | Alternativa descartada |
| --- | --- | --- |
| Compras a meses vs. su mensualidad | **La compra genera su mensualidad y cuenta sola los meses (Brian)** | Solo mostrar el avance por fechas y dejar los pagos habituales generando el gasto: dos cosas que mantener y el avance no refleja pagos omitidos |
| Gastos fijos del resumen | **Cargos reales del mes (Brian)** | Copiar el Excel (cada partida una vez al mes) |
| Carga inicial | **Script + "Agregar desde archivo" (misma ruta de la Fase 3, extendida)** | Captura manual de 7 compras y 9 cuentas con tasas, cortes y líneas |

## 4. Modelo de datos

- **Migración `supabase/migrations/0002_installment_category.sql`:** `alter table installment_plans add column category_id uuid null references categories(id) deferrable initially deferred` + índice. `schema.ts` agrega `category_id` a `InstallmentPlan` (la prueba de paridad lee ambas migraciones). Brian la aplica en el SQL Editor de Supabase **antes** de publicar (pasos en `docs/supabase.md`).
- `installment_plans` (existente): `concept`, `account_id`, `purchase_date`, `total_cents`, `months`, `monthly_cents` (**pago real**, lo que se carga cada mes = "Costo Actual dado"), `paid_months` (**meses pagados antes de que Saria los registrara**), `active`, + `category_id`.
- `accounts` (existente): `credit_limit_cents`, `statement_day`, `due_day`, `yield_rate` y `yield_rate_over_cap` (porcentaje anual, p. ej. 15 = 15 %), `yield_cap_cents`.

## 5. Cálculos (`src/domain/installments.ts`, `cards.ts`, `yields.ts`, `monthSummary.ts`; TDD)

**Compras a meses** (fórmulas del Excel):
- `pagados = paid_months + nº de movimientos vivos con installment_plan_id = plan.id`
- `costoPorMes = round(total / meses)`; `restantes = meses − pagados`; `acumulado = pagados × costoPorMes` (el último mes absorbe el redondeo: si `restantes = 0`, `acumulado = total`); `quedaPorPagar = total − acumulado`; `fechaFinal = purchase_date + meses meses` (día acotado al fin de mes).
- **Cargo n-ésimo** (n = 1…meses): `purchase_date + n meses`, día acotado. **Próximo cargo** = cargo `pagados + 1`.
- **Generación:** al abrir la app y tras cada sincronización (mismo disparador que `runAutoCreate` de la Fase 3), cada plan activo con cuenta crea los cargos con fecha ≤ hoy: gasto por `monthly_cents` en su cuenta y categoría, `installment_plan_id`, ID determinista `uuidV5(plan.id + ':' + n)`. Al llegar a `pagados = meses`, `active = false`. Sin duplicados entre dispositivos.
- **Compromiso mensual** = Σ `monthly_cents` de los planes con un cargo en el mes.
- **Pantalla:** Más → Compras a meses: lista con concepto, tarjeta, "pagados / meses", pago real, queda por pagar y fecha final; totales arriba (compromiso mensual y total por pagar). Formulario: concepto, tarjeta, categoría, fecha de compra, total, meses, pago real (por defecto total/meses), meses ya pagados. Tocar una compra muestra el detalle con las cifras del Excel.

**Tarjetas** (cuentas `credit` con `statement_day`):
- `ultimoCorte` = fecha más reciente ≤ hoy con día `statement_day` (acotado); `periodoActual` = gastos de la cuenta con fecha > `ultimoCorte` y ≤ hoy.
- `saldoAlCorte` = saldo de la cuenta al cierre de `ultimoCorte`; **próximo pago** = `max(0, −saldoAlCorte)` con fecha = primer día `due_day` posterior a `ultimoCorte`.
- `disponible = credit_limit + saldo actual` (saldo negativo = deuda); `uso % = deuda / línea`.
- Panel en el detalle de la tarjeta: línea, disponible (barra de uso), corte, fecha límite y monto del próximo pago, gasto del periodo.

**Rendimientos** (cuentas con `yield_rate`):
- `estimadoMensual = (min(saldo, tope) × tasa + max(saldo − tope, 0) × tasaExcedente) / 100 / 12`, redondeado a centavos (sin tope: todo a `tasa`).
- Se muestra en el detalle de la cuenta y, sumado, en Cuentas ("Rendimiento estimado este mes").

**Resumen del mes** (mes actual):
- `gastosFijos` = Σ montos de **todas las ocurrencias del mes** de los pagos habituales activos de gasto (con `nextOccurrence`/la regla de cada frecuencia, aunque ya estén pagadas).
- `compromisos` = compromiso mensual de compras a meses.
- `disponible = sueldo − gastosFijos − compromisos`.
- `gastadoFuera` = gastos del mes sin `recurring_id` ni `installment_plan_id`.
- `teQueda = disponible − gastadoFuera`.
- **Nivel de agua (Inicio):** muestra `teQueda`, `percent = teQueda / disponible` (acotado; si `disponible ≤ 0`, agua en 0). Tocar la tarjeta abre una hoja con el desglose (sueldo, gastos fijos, compras a meses, disponible, gastado, te queda). Sin sueldo: igual que en la Fase 1.

## 6. Carga inicial

**Script** `scripts/importar-excel.mjs` (reutiliza helpers de los importadores anteriores; mismos namespaces e IDs) → `data/saria-excel-AAAA-MM-DD.json` con formato `{"format": "saria-excel", "version": 1, "installment_plans": [...], "account_updates": [...], "deactivate_recurring_ids": [...], "retag": [{ "recurring_id", "installment_plan_id" }]}` y resumen en terminal.

- **Compras a meses (7):** de "Pagos Recurrentes" (fecha de compra = serial de Excel → fecha; total; meses; pago real = "Costo Actual dado"; `paid_months` = meses − "Meses Restantes"): TLOZ (inactiva si ya terminó), Litera escritorio, Moto, Reloj, Switch, Casa; más **Laptop de karina** desde `reminding` de Money Manager (total = monto × meses entre inicio y fin; `paid_months` = cargos con fecha ≤ fecha del respaldo). Tarjeta: Mercado Pago → Mercado Pago crédito, Banamex → Banamex crédito, Liverpool → Liverpool, "BBVA | Nomina" → BBVA (débito). Categoría: la de su pago habitual de Money Manager; Moto → Moto; Casa → Casa; Litera → la de "Mesualidades de cama".
- **`deactivate_recurring_ids`:** los IDs de los 5 pagos habituales de compras a meses cargados en la Fase 3 (Reloj, cama, Laptop, TLOZ, Switch 2). **`retag`:** sus movimientos ya generados por la Fase 3 (`recurring_id`) pasan a `installment_plan_id` del plan correspondiente, para que cuenten como pagados y no se generen otra vez.
- **`account_updates`** (hoja "Cuentas"): tarjetas — Didi → Didi crédito, Nu → Nu crédito, Mercado Pago → Mercado Pago crédito, Liverpool, Banamex → Banamex crédito, BBVA → BBVA crédito con `credit_limit_cents`, `statement_day`, `due_day`; rendimientos — Didi, NU y Mercado Pago (débito) con `yield_rate` 15 / 13 / 12, `yield_cap_cents` 1,000,000 / 2,500,000 / 2,500,000, `yield_rate_over_cap` 7 / 6.5 / 5.4.

**En la app:** Más → Respaldo → "Agregar desde archivo" acepta `saria-recurring` (Fase 3) y `saria-excel`; para este último, en una transacción: upsert de los planes, actualización solo de esos campos de las cuentas, soft-delete de los pagos habituales listados y re-etiquetado de sus movimientos. Vista previa con conteos; nada más se borra. Reaplicar es idempotente.

## 7. Pruebas (modo ligero, TDD en cálculos)

- `installments`: las 6 compras del Excel con sus datos dan exactamente "Acumulado" y "Queda por pagar" del Excel (Casa: acumulado 0 y queda 658,476; Moto: acumulado 37,324 y queda 10,664…) y la fecha final; generación idempotente; plan se cierra al último cargo.
- `cards`: último corte y próximo pago con corte 23 / pago 10 (cruza de mes) y corte 7 / pago 22.
- `yields`: Didi con saldo bajo y sobre el tope.
- `monthSummary`: quincenal cuenta 2 veces en el mes; un gasto con `recurring_id` no cuenta en "gastado".
- Archivo `saria-excel`: aplicar dos veces = mismo resultado; los 5 pagos habituales quedan desactivados y sus movimientos re-etiquetados.
- Script: prueba condicionada a `data/`.
- Verificación final: `typecheck`, `lint`, `test`, `build`, `test:e2e` en verde.

## 8. Lo que queda al constructor

Diseño visual de los paneles (dentro de Laguna, con `frontend-design`), redacción exacta de etiquetas, lectura de seriales de fecha del Excel.
