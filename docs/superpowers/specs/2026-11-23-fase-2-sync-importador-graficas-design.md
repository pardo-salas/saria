# Saria — Fase 2: Sincronización, importador y gráficas (diseño)

Fecha: 2026-11-23 · Autor del diseño: Brian Roberto Salas Pardo (con Claude) · Referencias: `docs/ROADMAP.md`, specs de las Fases 0 y 1 en esta carpeta.

## 1. Intención

Con la Fase 2, Saria deja de ser de prueba: trae los 4 años de historial de Money Manager, sincroniza teléfono y computadora a través de Supabase y muestra gráficas. Es el paso que permite empezar a usar solo Saria.

**Criterio de terminado (del ROADMAP):** un cambio hecho sin conexión en el teléfono aparece en la computadora al reconectar; los 2,706 movimientos y 325 transferencias están importados; los saldos coinciden con los de Money Manager.

**Orden de trabajo (propuesta de Claude, aceptada):** importador → sincronización → gráficas.

**Modo de ejecución:** ligero (preferencia de Brian): pruebas solo de lo crítico (reglas de sincronización, conversión del importador, agregados de gráficas) y una sola revisión final.

## 2. Objetivos, no-objetivos y anti-objetivos

**Objetivos**
- Script de una sola vez que convierte el `.mmbackup` en un respaldo JSON de Saria, que Brian carga con **Más → Respaldo → Importar** (ya existe).
- Motor de sincronización Dexie ↔ Supabase con indicador de estado.
- Pestaña Gráficas con tres gráficas.

**No-objetivos**
- Importador dentro de la app, vista previa en la app o `sql.js` (decidido por Brian: script, más barato).
- Importar recordatorios/pagos habituales (`reminding`) y el Excel (Fases 3 y 4).
- Cambios en vivo (Supabase Realtime); multi-usuario; varias monedas.
- Migraciones SQL nuevas: el esquema de la Fase 0 alcanza.

**Anti-objetivos**
- Perder un cambio hecho sin conexión, o que un dato de un dispositivo pise uno más reciente sin que nadie lo note.
- Duplicar categorías o cuentas entre dispositivos.
- Que `data/` o el JSON generado lleguen a git.
- Que la UI llame a Supabase directamente (solo `src/sync/` y `src/auth/`).

## 3. Restricciones

- Stack y reglas de las fases anteriores sin cambios. Solo `src/auth/**` y `src/sync/**` importan `@supabase/supabase-js`.
- La migración `0001_init.sql` ya aplicada: RLS `user_id = auth.uid()`, sin política de borrado (borrado lógico), trigger que pone `updated_at = now()` del servidor en cada `update`, FKs diferibles.
- El script corre en la computadora de Brian con Node ≥ 24 (trae `node:sqlite`); lee y escribe solo en `data/`.

## 4. Enfoques considerados

**Importador**

| Enfoque | Ventajas | Desventajas |
| --- | --- | --- |
| **Script Node de una vez → JSON de respaldo (elegido por Brian)** | Reutiliza la importación de respaldo existente (validación, reemplazo atómico, outbox); cero código nuevo en la app | Sin vista previa en la app: la vista previa y la cuadratura salen en la terminal |
| Importador en la app con `sql.js` | Vista previa visual; reutilizable | Mucho más código y peso en el bundle para algo que se usa una vez |

**Sincronización**

| Enfoque | Ventajas | Desventajas |
| --- | --- | --- |
| **A. Motor propio: subir la cola + bajar por `updated_at`, por eventos y cada minuto (elegido por Brian)** | Usa lo que ya existe; plan gratuito; probable con dos bases simuladas | Hasta ~1 minuto de retraso entre dispositivos |
| B. A + Supabase Realtime | Cambios al instante | Conexión abierta, batería, reconexión; se puede agregar después |
| C. Librería (PowerSync, ElectricSQL, RxDB) | Resuelve más casos | Cambia el stack, planes de pago, rehace la capa de datos |

## 5. Importador (`scripts/importar-money-manager.mjs`)

**Uso:** `node scripts/importar-money-manager.mjs data/<archivo>.mmbackup` → escribe `data/saria-importacion-AAAA-MM-DD.json` e imprime el resumen.

**Lectura:** el `.mmbackup` es un ZIP (con 8 bytes extra al inicio, que `unzip` tolera) que contiene una base SQLite (`*.db`). Se extrae a una carpeta temporal y se abre con `node:sqlite` en solo lectura. Cómo descomprimir queda al constructor (p. ej. una dependencia de desarrollo pequeña como `fflate`, saltando los bytes previos a la firma `PK\x03\x04`).

**Reglas (del ROADMAP):** ignorar filas con `isRemoved = 1` en todas las tablas, incluido `sync_link`; la cuenta y la categoría de cada movimiento se resuelven con `sync_link` (`entityType='Transaction'`, `otherType='Account'|'Category'`); las transferencias con `FromAccount`/`ToAccount`; montos ya en centavos; se descartan `reminding`, `regular_payment_period` y las tablas de sistema.

**Mapeo:**
- **IDs:** cada fila recibe un UUID v5 derivado del `uid` de Money Manager (namespace fijo del script), así reimportar da los mismos IDs. `legacy_id` = `uid` original en movimientos y transferencias.
- **Fechas:** `date` a `YYYY-MM-DD` en `America/Mexico_City` (el constructor verifica el formato real de la columna); `created_at` = `created` de Money Manager en ISO UTC (conserva el orden dentro del día).
- **Cuentas (decidido por Brian, sin unificar):**

| Money Manager | Saria | `type` | `include_in_total` | `archived` |
| --- | --- | --- | --- | --- |
| NU | NU | debit | sí | no |
| Nu crédito | Nu crédito | credit | no | no |
| MercadoPago | Mercado Pago | debit | sí | no |
| Mercado Pago | Mercado Pago crédito | credit | no | no |
| Didi cuenta | Didi | debit | sí | no |
| Didi Card | Didi crédito | credit | no | no |
| BANAMEX | Banamex | debit | sí | no |
| Banamex Credito | Banamex crédito | credit | no | no |
| BBVA | BBVA | debit | sí | no |
| BBVA Credito | BBVA crédito | credit | sí | no |
| Liverpool | Liverpool | credit | sí | no |
| Cartera | Cartera | cash | sí | no |
| Póliza de ahorro | Póliza de ahorro | investment | no | no |
| Internet | Internet | debit | sí | **sí** |

  `include_in_total` = `!ignoreInBalance` de Money Manager (coincide con la tabla). `position` = orden de Money Manager. Icono y color: equivalentes del catálogo de Saria (decisión del constructor).
- **Saldo inicial:** Money Manager guarda el saldo actual (`account_balance`), no el inicial. `initial_balance_cents = saldo_actual − (ingresos − gastos + transferencias entrantes − salientes)` de esa cuenta. Así los saldos cuadran por construcción; la verificación útil es que los saldos iniciales resultantes sean razonables (el script los imprime). Cuenta sin fila en `account_balance` → saldo actual 0.
- **Categorías:** las 28 vivas, con `kind` (`Income`/`Expense`), `monthly_limit_cents` = `limitAmount` (0 → null), icono del catálogo (mismo mapeo que las categorías iniciales de la Fase 1), `position` por uso.
- **Transferencias:** `amount_cents = fromAmount`; si `fromAmount ≠ toAmount`, se reporta como advertencia.
- **Settings:** se incluye una fila con `monthly_income_cents = 1860000` (sueldo del Excel), `currency 'MXN'`, `theme 'system'`.
- `user_id` de todas las filas: un marcador; la importación de respaldo lo reescribe con el usuario actual.

**Salida en terminal:** conteos por tabla (esperado: 14 cuentas, 28 categorías, 2,706 movimientos, 325 transferencias), filas descartadas y por qué, y una tabla por cuenta con saldo actual de Money Manager, saldo calculado y saldo inicial derivado.

**Verificación:** una prueba de Vitest corre la conversión sobre `data/` **solo si el archivo existe** (se salta en CI y en otras máquinas) y comprueba que `parseBackup` acepta el JSON, los conteos esperados y que el saldo calculado de cada cuenta con `balancesByAccount` es igual a `account_balance`. Nada de `data/` se copia a fixtures.

## 6. Sincronización (`src/sync/`)

### 6.1 Motor

`createSyncEngine({ db, supabase, getUserId, now })` con `syncNow(): Promise<SyncResult>`; una sola sincronización a la vez (candado en memoria + `navigator.locks` cuando exista, para varias pestañas).

**Subir (push):**
- Lee `outbox` en orden de `seq`. Varias entradas de la misma fila se colapsan en la última.
- Sube por tabla en orden de dependencias: `settings`, `accounts`, `categories`, `recurring_payments`, `installment_plans`, `transactions`, `transfers`, `reminders`; `upsert` por `id` en lotes de hasta 500.
- Al confirmar un lote, borra de `outbox` exactamente esas entradas (por `seq`; una entrada nueva de la misma fila escrita mientras tanto se conserva).
- Error: incrementa `attempts` de las entradas del lote y se detiene; el siguiente intento ocurre en el próximo disparador (con espera creciente tras fallos seguidos: 1, 2, 5, 10 min).

**Bajar (pull):**
- Por tabla, filas del usuario con `updated_at` ≥ `sync_state.last_pulled_at`, ordenadas por `updated_at`, en páginas de 1,000.
- Cada fila remota se escribe directo en Dexie (sin pasar por `repo`, sin encolar), **salvo** que haya una entrada pendiente en `outbox` para ese `id`: el cambio local aún no subido gana y se respeta.
- `last_pulled_at` = mayor `updated_at` recibido (el `≥` y la reescritura idempotente cubren empates).
- Las filas con `deleted_at` también bajan (así se propagan los borrados lógicos).

**Orden:** primero subir, luego bajar. Consecuencia: "gana el último en llegar al servidor"; como el trigger fija `updated_at` con la hora del servidor, todos los dispositivos convergen al mismo valor.

### 6.2 Cuándo sincroniza

Al iniciar sesión, al abrir la app, al volver a estar visible, al recuperar conexión (`online`), 2 s después de cada escritura local (se detecta por la `outbox`), y cada 60 s mientras la app está visible. Nunca sin sesión ni sin conexión.

### 6.3 Primera sincronización de un dispositivo (propuesta de Claude)

Los datos locales de la Fase 1 son de prueba (acordado). En la **primera sincronización** de cada dispositivo (no existe ninguna fila en `sync_state`), el motor **descarta los datos locales del usuario y su `outbox`** y baja todo del servidor. Así el teléfono y la computadora no suben sus datos de prueba.

Consecuencias:
- **Orden de uso para Brian:** publicar la Fase 2 → abrir la app con internet en cada dispositivo (primera sincronización) → importar el JSON en **un** dispositivo → el otro lo recibe al sincronizar.
- Las categorías iniciales se siembran **solo después** de la primera sincronización y solo si el servidor tampoco tenía categorías (evita duplicarlas con las importadas). Si el dispositivo abre por primera vez sin conexión, espera a tener conexión para sembrar.

### 6.4 Indicador y sesión

- Estado: `sincronizado` (cola vacía, último intento bien), `pendiente` (n cambios en cola), `sin conexión`, `error` (último intento falló; mensaje en español) y `sincronizando`.
- **Inicio:** una pastilla pequeña junto al saludo (icono + texto corto). **Más:** sección "Sincronización" con el estado, la hora de la última sincronización y el botón "Sincronizar ahora".
- Si el token no se puede renovar (sesión vencida), estado `error` con "Tu sesión venció; vuelve a iniciar sesión para sincronizar".
- **Cerrar sesión:** si hay cambios pendientes, la confirmación lo advierte ("Hay N cambios sin sincronizar; se subirán la próxima vez que inicies sesión en este dispositivo"). Los datos locales se conservan (ya están filtrados por usuario).

## 7. Gráficas (pestaña Gráficas)

Con Recharts, cargado de forma diferida. Las agregaciones son funciones puras en `src/domain/charts.ts` (montos en centavos; Recharts recibe pesos solo para dibujar).
1. **Gasto por categoría del mes:** barras horizontales ordenadas de mayor a menor, con selector ‹ mes › y total del mes; tocar una barra lleva a Movimientos filtrado por esa categoría y mes.
2. **Ingresos vs. gastos por mes:** barras agrupadas de los últimos 12 meses.
3. **Evolución del saldo total:** línea con el saldo total al cierre de cada mes de los últimos 12 meses (mismas reglas de "saldo total" que Inicio).

Colores de las categorías y paleta Laguna; diseño con `frontend-design` y la guía de la skill `dataviz`; funcionan sin conexión.

## 8. Pruebas y verificación (modo ligero)

- **Sincronización (Vitest, Supabase simulado en memoria):** push colapsa y respeta el orden; una entrada escrita durante el push no se borra; pull no pisa un cambio local pendiente; dos dispositivos simulados convergen tras editar la misma fila sin conexión; primera sincronización descarta lo local.
- **Importador:** la prueba condicionada a `data/` (sección 5).
- **Gráficas:** agregados de las tres funciones.
- **E2E:** sin cambios grandes; las existentes siguen en verde con Supabase simulado.
- **Manual (criterio de la fase):** importar el JSON en el teléfono; ver los saldos igual que en Money Manager; hacer un gasto en modo avión y verlo en la computadora al reconectar.

Antes de cerrar: `typecheck`, `lint`, `test`, `build` y `test:e2e` en verde, con la salida mostrada a Brian.

## 9. Lo que queda al constructor

- Descompresión del ZIP; formato real de fechas de Money Manager; mapeo exacto de iconos y colores.
- Forma del Supabase simulado para pruebas.
- Diseño visual de la pastilla de estado y de las gráficas (dentro de Laguna).
