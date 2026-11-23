# Saria — Fase 1: Núcleo offline (diseño)

Fecha: 2026-11-22 · Autor del diseño: Brian Roberto Salas Pardo (con Claude) · Referencias: `docs/ROADMAP.md`, `docs/superpowers/specs/2026-11-22-fase-0-fundaciones-design.md`, `docs/plans/2026-11-22-fase-0-fundaciones.md`

## 1. Intención

Con la Fase 1, Saria se vuelve usable para el registro diario **sin internet**: cuentas, categorías, movimientos, transferencias, una pantalla de Inicio con datos reales, búsqueda y filtros, y respaldo JSON. Brian usa Saria principalmente en su teléfono Android, con una mano; la regla de oro es **registrar un gasto en 2 toques**.

**Uso durante esta fase (decidido por Brian):** solo se va a *probar*. Brian sigue anotando en Money Manager hasta la Fase 2. Lo que se registre en Saria durante la Fase 1 es de prueba: el importador de la Fase 2 podrá borrar lo de prueba y cargar el historial completo, sin tener que combinar datos.

**Criterio de terminado (del ROADMAP):** se registra un gasto en 2 toques sin conexión; una transferencia actualiza ambos saldos; el respaldo JSON se exporta y se importa; la app está desplegada con HTTPS (Vercel, ya configurado en la Fase 0: al fusionar a `main` se publica).

## 2. Objetivos, no-objetivos y anti-objetivos

**Objetivos**
- CRUD de cuentas (efectivo, débito, crédito, inversión) con saldo inicial, archivar y excluir del total.
- CRUD de categorías de ingreso y de gasto, con icono, color y límite mensual.
- Movimientos (ingreso/gasto): crear, editar y borrar.
- Transferencias entre cuentas propias: crear, editar y borrar; aparecen en el historial de ambas cuentas.
- Inicio: nivel de agua (sueldo − gastos del mes), hoy y el mes, saldo total y lista de hoy.
- Registro rápido desde el botón + (Gasto / Ingreso / Transferir).
- Pestaña Movimientos con búsqueda y filtros.
- Sueldo mensual configurable en Más.
- Exportar e importar un respaldo JSON.
- Todo funciona en modo avión.

**No-objetivos (llegan después)**
- Sincronización con Supabase (Fase 2). Las escrituras siguen encolándose en `outbox`, pero nadie la envía.
- Importador de Money Manager y del Excel (Fases 2 y 4); gráficas (Fase 2).
- Pagos habituales y recordatorios (Fase 3); atributos de tarjeta (corte, pago, línea), MSI, rendimientos y resumen del mes con gastos fijos (Fase 4). Los campos ya existen en el esquema, pero esta fase no los muestra ni los edita.
- Cambios al esquema o nuevas migraciones SQL: no hacen falta.

**Anti-objetivos (sería un fracaso aunque "funcione")**
- Que registrar un gasto tome más de 2 toques en el caso normal (+ → monto → categoría).
- Saldos guardados como dato o calculados con punto flotante.
- Que algo de esta fase requiera red: ninguna pantalla nueva llama a la red.
- Que un movimiento quede apuntando a una cuenta o categoría borrada.
- Que importar un respaldo destruya datos sin confirmación ni copia previa.

## 3. Restricciones

- Stack y reglas de arquitectura de la Fase 0 y del ROADMAP, sin cambios: la UI solo lee y escribe en Dexie; toda escritura pasa por `repo` (que encola en `outbox`); IDs UUID del cliente; montos en centavos enteros.
- Dirección visual "Laguna" con la paleta Cobalto y Bricolage Grotesque (tokens de `src/ui/tokens.css`). Toda pantalla nueva se construye con la skill `frontend-design:frontend-design`.
- Zona horaria de Brian: `America/Mexico_City`. "Hoy" y "este mes" se calculan en esa zona; las fechas `date` son `YYYY-MM-DD` locales.
- Trabajo en una rama/worktree `fase-1`; `main` solo se toca al fusionar.
- TDD para toda la lógica de dominio (sección 8).

## 4. Enfoques considerados para saldos y totales

| Enfoque | Qué es | Ventajas | Desventajas |
| --- | --- | --- | --- |
| **A. Cálculo en memoria con funciones puras (elegido)** | La UI lee las filas vivas de Dexie (`useLiveQuery`) y funciones puras de `src/domain/` calculan saldos, totales, resúmenes, historial, búsqueda y filtros | Simple; todo con TDD sin base de datos; cumple "saldos calculados, nunca guardados"; con ~2,700 movimientos y 325 transferencias tarda milisegundos | Carga todo el historial en memoria (aceptable con este volumen) |
| B. Saldos guardados que se actualizan en cada escritura | Tabla o campo de saldo por cuenta | Lecturas instantáneas | Rompe la regla 4 del ROADMAP; con el sync de la Fase 2 dos dispositivos pueden dejar saldos que no cuadran |
| C. Consultas indexadas de Dexie por vista | Agregaciones por cuenta y rango de fechas con índices | Escala a cientos de miles de filas | Más código y más difícil de probar, sin beneficio visible con este volumen |

Brian eligió **A**. Si alguna vista se volviera lenta, se puede pasar a C solo en esa vista sin rehacer lo demás.

## 5. Decisiones de producto

### 5.1 Lo que decidió Brian

- **Nivel de agua = sueldo mensual − gastos del mes.** El sueldo se captura en Más (`settings.monthly_income_cents`). En la Fase 4 se le restarán los compromisos (gastos fijos y meses).
- **Registro rápido, opción A:** + → se abre una hoja con el monto enfocado (teclado decimal del teléfono) → **tocar una categoría guarda el gasto**. Exactamente 2 toques más escribir el monto.
  - La hoja tiene tres pestañas arriba: **Gasto** (por defecto), **Ingreso**, **Transferir**.
  - Debajo del monto, chips para cambiar la **cuenta** (por defecto, la última usada), la **fecha** (por defecto, hoy) y agregar una **nota**.
  - Las categorías del tipo elegido aparecen en una rejilla, **ordenadas por uso** (las más usadas primero), con un botón "Más" si no caben todas.
  - Tras guardar, la hoja se cierra y aparece un aviso "Gasto guardado · Deshacer" por unos 5 segundos; Deshacer borra el movimiento (borrado lógico).
- **Pantallas** como en los mockups aprobados (`.superpowers/brainstorm/3626-1795401236/content/pantallas.html`, local, no versionado):
  - **Inicio:** saludo; tarjeta del agua ("Te queda este mes", monto, "% de tu sueldo · faltan N días"); dos tarjetas: **Hoy** y **mes** (gastos en grande y en coral, ingresos debajo en verde agua); tarjeta **Saldo total**; lista **Hoy** con "Ver todo ›" (lleva a Movimientos); botón +.
  - **Cuentas:** tarjeta de saldo total con una línea de detalle ("Debes en tarjetas $X · Inversión aparte $Y"); grupos por tipo (*Efectivo y débito*, *Crédito*, *Inversión*) con su subtotal; las tarjetas muestran el saldo negativo en coral; las cuentas excluidas llevan la etiqueta "fuera del total"; al final, "Archivadas ›" y "+ Nueva cuenta".
  - **Detalle de cuenta:** nombre, saldo, tipo y saldo inicial; chips de filtro **Todo / Movimientos / Transferencias**; historial agrupado por día con el **saldo al cierre de cada día**; las transferencias se muestran como "A {cuenta}" (salida) o "De {cuenta}" (entrada); acciones "Editar cuenta" y "Archivar". El + desde aquí trae esta cuenta seleccionada.
- **El pago de tarjeta de crédito es una transferencia** de la cuenta de débito a la tarjeta (el gasto se cuenta una sola vez, al comprar).
- **Datos de esta fase = de prueba** (sección 1).

### 5.2 Lo que propuso Claude y Brian aceptó

- Tocar un movimiento o una transferencia abre su formulario para **editar o borrar**; borrar pide confirmación.
- Una cuenta o categoría **con movimientos no se borra: se archiva**. Sin movimientos, sí se puede borrar (borrado lógico).
- **Categorías iniciales:** las 28 de Money Manager (20 de gasto, 8 de ingreso) con los mismos nombres, para que el importador de la Fase 2 las empate por nombre (sección 6.6).
- **Restaurar un respaldo JSON reemplaza** todo lo del dispositivo, tras confirmación y **descargando antes un respaldo automático** de lo actual.

## 6. Diseño técnico

### 6.1 Reglas de cálculo (`src/domain/`, TDD)

Las funciones reciben filas **vivas** (`deleted_at === null`); filtrar borradas es responsabilidad de la capa de lectura (6.3).

- **Saldo de una cuenta** = `initial_balance_cents` + Σ ingresos − Σ gastos + Σ transferencias entrantes − Σ transferencias salientes, sobre todos los movimientos y transferencias de la cuenta, sin importar la fecha (también fechas futuras).
- **Saldo total** = Σ saldos de las cuentas con `include_in_total = true` y `archived = false`.
- **Desglose de Cuentas:** subtotal por grupo (efectivo y débito = `cash` + `debit`; crédito = `credit`; inversión = `investment`). Los subtotales de grupo suman **todas** las cuentas no archivadas del grupo, también las excluidas. "Debes en tarjetas" = valor absoluto de la suma de saldos negativos de las cuentas `credit` no archivadas. "Inversión aparte" = suma de las cuentas `investment` no archivadas que están excluidas del total. Cada parte de la línea se omite si vale 0.
- **Ingresos y gastos de hoy y del mes:** suman los movimientos de **todas** las cuentas (también las excluidas del total y las archivadas) con `date` en el día o el mes actual. Las transferencias no son ingreso ni gasto.
- **Nivel de agua:** `queda = sueldo − gastos del mes`. `percent = queda / sueldo × 100`, acotado a 0–100 para la altura del agua; el texto muestra el porcentaje acotado. Si `queda` es negativo, el monto se muestra negativo ("−$1,200.00") y el agua en 0. Sin sueldo configurado, la tarjeta muestra el estado "Captura tu sueldo en Más para ver cuánto te queda", con enlace a Más. `daysLeft` = días que faltan para terminar el mes sin contar hoy; si es 0, el texto es "último día del mes".
- **Historial de una cuenta:** lista de entradas (movimiento o transferencia, con signo según la cuenta), ordenadas por `date` descendente y luego `created_at` descendente; agrupadas por día; cada día lleva el saldo de la cuenta al cierre de ese día (calculado acumulando desde el saldo inicial en orden ascendente).
- **Orden de categorías por uso:** número de movimientos de esa categoría; empate → `position`, luego nombre. Solo categorías no archivadas del tipo elegido.
- **Cuenta por defecto del registro rápido:** la cuenta del movimiento o transferencia (cuenta de origen) creado más recientemente (`created_at`) que no esté archivada; si no hay, la primera cuenta no archivada por `position`. Si no existe ninguna cuenta, la hoja muestra "Primero crea una cuenta" con un botón a Nueva cuenta.

Todo el dinero se suma como enteros; cada función que sume verifica `Number.isSafeInteger` del resultado.

### 6.2 Búsqueda y filtros (pestaña Movimientos, TDD)

- La lista mezcla movimientos y transferencias, agrupada por día (encabezado con la fecha y el neto del día), del más reciente al más antiguo.
- **Periodo:** por defecto el mes actual, con selector ‹ mes › para moverse entre meses; opción "Todo el historial".
- **Buscador:** texto libre, sin distinguir mayúsculas ni acentos, que busca en la nota, el nombre de la categoría, el nombre de la(s) cuenta(s) y el monto (por ejemplo, "185.5" encuentra $185.50). **Mientras hay texto, busca en todo el historial**, ignorando el periodo.
- **Filtros** (hoja "Filtros", combinables): tipo (gasto / ingreso / transferencia), cuenta (varias), categoría (varias), rango de fechas personalizado (reemplaza al periodo). Un chip por filtro activo, con ×, y "Limpiar".
- Encima de la lista, una línea con el total del resultado: gastos, ingresos y el neto.
- Rendimiento: se muestran los primeros 100 resultados y "Ver más" agrega los siguientes 100.
- Las funciones de filtrado, normalización de texto y totales son puras y van en `src/domain/`.

### 6.3 Lectura de datos (`src/db/queries.ts` o similar)

- Hooks sobre `useLiveQuery` que devuelven filas vivas: `useAccounts()`, `useCategories()`, `useTransactions()`, `useTransfers()`, `useSettings()`. Las pantallas combinan esos datos con las funciones de 6.1 y 6.2 (con `useMemo`).
- Ninguna pantalla nueva importa `supabase`; la regla de ESLint de la Fase 0 lo impone.
- **Datos por usuario:** Saria tiene un solo usuario (registro deshabilitado, Fase 0), pero Dexie no separa por usuario y cerrar sesión no borra nada. Para que otra cuenta en el mismo dispositivo nunca vea ni toque datos ajenos, los hooks de lectura, la comprobación de la siembra (6.6) y el reemplazo del respaldo (6.7) filtran por el `user_id` de la sesión actual. *(Decisión de Claude; qué hacer con los datos locales al cambiar de usuario se decide en la Fase 2.)*

### 6.4 Escrituras y validaciones (`src/domain/` + `src/db/`)

Todas pasan por `repo.put` / `repo.softDelete`. Las validaciones son funciones puras con TDD que devuelven errores en español para los formularios:

- **Cuenta:** nombre obligatorio (sin espacios sobrantes, ≤ 40 caracteres); tipo de los 4; saldo inicial entero en centavos (puede ser negativo: en crédito se captura como "Debes" y se guarda negativo); `include_in_total` por defecto `true`; `position` = máximo + 1 al crear. Los campos de tarjeta y rendimiento quedan `null`.
- **Categoría:** nombre obligatorio, único (sin distinguir mayúsculas ni acentos) entre categorías vivas del mismo tipo; tipo ingreso o gasto (no se cambia al editar si ya tiene movimientos); límite mensual opcional (> 0).
- **Movimiento:** monto > 0; cuenta existente y no archivada al crear (al editar se conserva aunque esté archivada); categoría del mismo tipo que el movimiento, o ninguna; fecha válida; nota opcional (≤ 200 caracteres).
- **Transferencia:** monto > 0; cuentas de origen y destino distintas y existentes; fecha y nota como arriba.
- **Archivar / borrar cuenta:** si tiene movimientos o transferencias vivos, solo se archiva (y puede desarchivarse); si no, se puede borrar. Archivar una cuenta con saldo distinto de 0 muestra un aviso: "Esta cuenta tiene saldo de $X; al archivarla deja de contar en el total".
- **Archivar / borrar categoría:** igual. Una categoría archivada no aparece en el registro rápido, pero los movimientos existentes la siguen mostrando.

**Pendientes de `repo.ts` de la Fase 0 que esta fase corrige** (porque ahora se usa mucho): `softDelete` sobre una fila ya borrada no hace nada (no vuelve a sellarla ni a encolarla); `put` sobre una fila borrada no la revive salvo que se pida explícitamente (Deshacer usa softDelete, no revive); error con mensaje claro si falta la fila.

### 6.5 Settings (sueldo y tema)

- Un helper `updateSettings(patch)` lee la fila y escribe solo los campos del parche **dentro de una misma transacción**. Corrige la carrera get→put del tema que quedó pendiente en la Fase 0. El tema y el sueldo lo usan.
- Más → **Sueldo mensual**: campo `AmountInput`; vacío = sin sueldo.

### 6.6 Categorías iniciales

- Si el usuario no tiene ninguna categoría (viva o borrada) al entrar, se crean las 28 de Money Manager con su tipo, un icono propio equivalente y un color de la paleta de categorías:
  - **Gasto (20):** Transporte, Comida, Antojo, Entretenimiento, Casa, Moto, Otros, Seguro, Regalos, Rutina, Ocio, Saldo, Ropa, Trabajo, Higiene personal, Alimentación, Familia, Salud, Perfume, Educación.
  - **Ingreso (8):** Interés, Salario, Transferencia, Regalo, Otros, Aguinaldo, Cashback, Utilidades.
  - Lista verificada contra el respaldo real de Money Manager (`category` con `isRemoved = 0`: 20 de gasto y 8 de ingreso; el conteo 19/9 del ROADMAP incluía una fila borrada o estaba desfasado). "Otros" existe en ambos tipos; "Transferencia" es de ingreso.
  - `position` en ese orden (el de uso en Money Manager). Seguro con límite mensual de $288.00, como en Money Manager; las demás sin límite.
- **IDs deterministas:** el `id` de cada categoría inicial se deriva de `user_id + kind + nombre` (UUID v5 con un namespace fijo de Saria). Así, si el teléfono y la computadora siembran por separado, en la Fase 2 el sync los ve como la misma fila y no las duplica.
- La siembra ocurre una vez, en una sola transacción, y es idempotente.
- No se siembran cuentas: Brian crea las suyas para probar (o las trae el importador en la Fase 2).

### 6.7 Respaldo JSON (Más → Respaldo, TDD)

- **Formato:** `{"format": "saria-backup", "version": 1, "exported_at": ISO, "tables": {accounts, categories, transactions, transfers, recurring_payments, reminders, installment_plans, settings}}` con las filas vivas, todas sus columnas tal como están en Dexie. Sin `outbox` ni `sync_state`.
- **Exportar:** descarga `saria-respaldo-AAAA-MM-DD.json` (Blob + enlace de descarga; funciona en Chrome Android y en escritorio, sin conexión).
- **Importar:** `<input type="file" accept="application/json,.json">` →
  1. Validación pura: formato y versión; cada tabla con las columnas de `COLUMNS`; montos enteros; IDs UUID; referencias internas válidas (cuentas y categorías referidas existen en el archivo; `from ≠ to`). Si algo falla, se muestra el primer error en español y no se cambia nada.
  2. Vista previa: "Este respaldo tiene N cuentas, N categorías, N movimientos, N transferencias (exportado el …)".
  3. Confirmación: "Esto reemplaza todo lo que hay en este dispositivo. Antes descargaremos un respaldo de lo actual."
  4. Descarga el respaldo automático de lo actual.
  5. **Reemplazo en una sola transacción Dexie:** cada fila del archivo se escribe con `repo` (conserva su `id` y su `created_at` del archivo; `updated_at` = ahora, para que en la Fase 2 el sync lo trate como el cambio más reciente; `user_id` se reescribe con el usuario actual; settings con `id = user_id`) y cada fila viva actual del usuario que no está en el archivo se borra lógicamente. Todo se encola en `outbox`. Si algo falla, no cambia nada. *(Decisión de Claude: conservar `created_at` mantiene el orden del historial y la cuenta por defecto; por eso `repo` necesita un modo de restauración que acepte `created_at`.)*
  6. **Settings:** el sueldo y el tema del respaldo reemplazan los actuales; el tema se aplica al terminar. *(Decisión de Claude.)*
- **"Mismos datos" en la prueba de ida y vuelta** = todas las columnas iguales salvo `updated_at` (y `user_id`, si el usuario es otro).
- Exportar e importar funcionan en modo avión.

### 6.8 Pantallas y navegación

Rutas nuevas (nombres finales a criterio del constructor): `/cuentas/:id` (detalle), `/cuentas/archivadas`, `/mas/categorias`, `/mas/respaldo`. Formularios en hojas (`Sheet`) sobre la pantalla actual: cuenta, categoría, movimiento, transferencia, filtros.

- **Hoja de registro rápido (botón +):** sección 5.1. En la pestaña Ingreso, la rejilla muestra categorías de ingreso. En **Transferir**: monto, chips "De" y "A" (por defecto: la última transferencia usada, o la cuenta actual si se abrió desde un detalle), fecha, nota y botón "Transferir" (aquí sí hay botón, porque no hay categoría que tocar). Si el monto está vacío o es 0 al tocar una categoría, no se guarda: el campo de monto muestra "Escribe un monto" y recibe el foco.
- **Formulario completo de movimiento** (al editar, o con "Más opciones" desde la hoja): tipo, monto, cuenta, categoría, fecha, nota; botones Guardar y Borrar.
- **Cuentas, Detalle de cuenta, Inicio:** sección 5.1.
- **Movimientos:** sección 6.2.
- **Más:** Sueldo mensual, Categorías (lista por tipo con lo gastado este mes vs. el límite si tiene, crear, editar, archivar), Respaldo, Tema, Sesión, versión. El texto "Tus datos se quedan en este dispositivo" se cambia por uno exacto: "Cerrar sesión no borra tus datos de este dispositivo".
- **Iconos:** un set propio de iconos SVG para categorías y cuentas (inspirado en los nombres de Money Manager: transporte, café, dulces, palomitas, casa, moto, seguro, regalo, deporte, monedero, celular, ropa, trabajo, higiene, súper, familia, corazón, perfume, educación, banco, nómina, pago, inversión, tarjeta, cartera, otros). Colores de una paleta fija de ~10 tonos que funcione sobre ambos temas.
- **Escritorio (≥ 1024 px):** las hojas se muestran como diálogos centrados; el resto igual que en la Fase 0 (riel lateral).
- **Accesibilidad:** cada botón de categoría del registro rápido tiene un nombre accesible completo ("Guardar gasto de $185.50 en Comida"); el aviso de Deshacer se anuncia con `aria-live`; objetivos táctiles ≥ 44 px.

### 6.9 Pendientes de la Fase 0 que entran aquí

Por tocar las mismas piezas:
- `ListItem`: aceptar montos con signo y transferencias (tercer estilo, neutro), sin convertir negativos en absolutos.
- `AmountInput`: sincronizar el texto si el padre cambia el valor con foco (necesario para limpiar la hoja tras guardar); error con `aria-live`.
- `WaterLevelCard`: % acotado en el texto; "último día del mes"; contraste del texto secundario sobre agua alta; detalle legible con nivel bajo.
- `repo.ts`: los de 6.4. Más: el texto de sesión; `markSignedOut` en `finally`; la carrera del tema (6.5).
- Auth: mensajes específicos para `email_not_confirmed` y "Invalid API key" en lugar del genérico (Brian ya lo sufrió).
- E2E: el localizador de "Cuentas" debe ser exacto (ahora habrá más textos "Cuentas").
- Build > 500 kB: dividir supabase y las pantallas con carga diferida, si sigue arriba tras esta fase.

### 6.10 Despliegue

Vercel ya publica `main` (Fase 0). Al fusionar la rama `fase-1`, la nueva versión se publica sola; el aviso "Hay una versión nueva · Actualizar" de la PWA la trae al teléfono. Verificación: abrir la URL de producción, actualizar, registrar un gasto en modo avión.

## 7. Seguridad y datos

- Sin cambios en Supabase ni en RLS. Nada de esta fase sale del dispositivo, salvo el archivo de respaldo que Brian descarga.
- El respaldo contiene datos financieros: se descarga al dispositivo y nunca se sube a ningún lado. Ningún fixture de pruebas usa datos reales de `data/`: las pruebas usan datos inventados.

## 8. Pruebas y verificación

**TDD (Vitest, prueba primero):**
- Saldos por cuenta (ingresos, gastos, transferencias en ambos sentidos, saldo inicial negativo, fechas futuras), saldo total (excluidas, archivadas), desglose de Cuentas.
- Hoy y mes en `America/Mexico_City` (bordes: 23:59 y 00:00 locales, último día del mes, cambio de mes).
- Nivel de agua (sin sueldo, gastado > sueldo, 0 días).
- Historial con saldo diario; orden por uso; cuenta por defecto.
- Búsqueda (acentos, mayúsculas, montos), filtros combinados, totales del resultado, paginación.
- Validaciones de cuenta, categoría, movimiento y transferencia; reglas de archivar/borrar.
- Siembra de categorías: idempotente, IDs deterministas.
- Respaldo: ida y vuelta (exportar → importar da los mismos datos), archivo inválido no cambia nada, reemplazo borra lógicamente lo que no está, todo encolado en `outbox`.
- `repo.ts` (correcciones de 6.4) y `updateSettings`.

**Testing Library:** hoja de registro rápido (2 toques guarda; monto vacío no guarda; Deshacer), formulario de cuenta, de transferencia, lista de Movimientos con filtros, Cuentas.

**Playwright (sobre `vite preview`, móvil y escritorio, Supabase simulado como en la Fase 0):**
- **Con la red cortada:** crear una cuenta, registrar un gasto en 2 toques, verlo en Inicio y en el saldo de la cuenta.
- Transferencia entre dos cuentas: ambos saldos cambian y aparece en ambos historiales.
- Exportar respaldo, borrar algo, importarlo y ver los datos de vuelta.

**Antes de cerrar la fase:** `typecheck`, `lint`, `test`, `build` y `test:e2e` en verde, con la salida mostrada a Brian; prueba manual en el teléfono con la URL de Vercel, incluido el modo avión.

## 9. Lo que queda al constructor

- Nombres de archivos, hooks y componentes; estructura de rutas exacta.
- Diseño de los iconos y de la paleta de colores de categorías y cuentas (dentro de Laguna, con frontend-design).
- Cómo componer la transacción del reemplazo del respaldo con `repo` (p. ej., una variante de `put` que acepte una transacción ya abierta).
- Detalles de animación de hojas y del aviso de Deshacer.
- Diseño de la hoja de Filtros y del selector de mes.
