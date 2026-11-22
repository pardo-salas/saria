# Roadmap — App de Finanzas Personales (PWA + Supabase)

Nov 22, 2026 · @Brian Roberto Salas Pardo

## Resumen y objetivo

Construir una PWA personal de finanzas que reemplace la app con anuncios (Money Manager) y el Excel "Gastos Personales", usable en computadora y teléfono, también sin internet, con datos sincronizados en Supabase.

- **Problema:** hoy se consultan dos fuentes al final del día (app del teléfono + Excel) y la app tiene anuncios.
- **Solución:** una sola app web instalable (PWA), local-first: todo se guarda primero en el dispositivo y se sincroniza con Supabase cuando hay conexión.
- **No es app nativa:** se instala desde el navegador ("Agregar a pantalla de inicio") en Android/iPhone y como app en Windows/Mac.
- **Valor extra frente a la app actual:** tarjetas de crédito con día de corte y de pago, compras a meses sin intereses (MSI), rendimientos por cuenta y el resumen mensual de sueldo vs. gastos fijos que hoy vive en Excel.

**Criterio de éxito:** durante 30 días seguidos se registra todo en la nueva app, sin abrir Money Manager ni el Excel, y los saldos coinciden con los bancos.

## Stack técnico

Opción elegida: PWA local-first con React + IndexedDB y sincronización con Supabase.

| Capa | Tecnología | Por qué |
| --- | --- | --- |
| Framework | React + TypeScript + Vite | Rápido, tipado, gran ecosistema |
| PWA / offline | vite-plugin-pwa (Workbox) | Service worker, manifest, instalable, caché de la app |
| Base de datos local | IndexedDB con Dexie.js (+ dexie-react-hooks) | Consultas rápidas offline; la UI siempre lee de aquí |
| Backend / nube | Supabase (Postgres + Auth + Row Level Security) | Plan gratuito, SQL real, login seguro |
| Sincronización | Motor propio: cola de cambios + `updated_at` + borrado lógico | Simple, sin dependencias de pago; último cambio gana |
| Estilos / UI | Tailwind CSS + componentes propios (skill frontend-design) | Diseño con identidad, modo oscuro, mobile-first |
| Gráficas | Recharts | Ligera, buena con React |
| Fechas / dinero | date-fns (locale es) · montos en centavos (enteros) | Sin errores de redondeo; MXN por defecto |
| Pruebas | Vitest + Testing Library + Playwright | TDD del dominio y flujos clave (skill superpowers) |
| Hosting | Vercel, Netlify o Cloudflare Pages (gratis, HTTPS) | La PWA requiere HTTPS |

Reglas de arquitectura:

1. La UI nunca llama a Supabase directamente; solo lee y escribe en Dexie.
2. Cada escritura local se agrega a una cola `outbox`; el motor de sync la envía al reconectar.
3. IDs UUID generados en el cliente, para crear registros sin conexión.
4. Saldos calculados a partir de movimientos (no se guardan como dato editable), con saldo inicial por cuenta.
5. Respaldo: exportar/importar JSON desde Ajustes, además de Supabase.

## Datos actuales a migrar

Todo el historial se puede importar: el respaldo `.mmbackup` es un ZIP con una base SQLite (`MyFinance.db`) y el Excel tiene tres hojas con tablas estructuradas.

### Respaldo de Money Manager (`.mmbackup`)

| Tabla | Registros | Notas |
| --- | --- | --- |
| `transaction` | 2,745 (2,706 activos) | 13-sep-2022 a 21-nov-2026; `type` = Income/Expense; montos en centavos (`110000` = $1,100.00) |
| `transfer` | 325 | `fromAmount`/`toAmount`, `date`, `comment` |
| `account` | 14 | `title`, `currencyCode`, `isActive`, `isArchived`, `ignoreInBalance`, color, icono |
| `account_balance` | 13 | Saldo actual por cuenta (centavos); sirve para validar la importación |
| `category` | 28 | 9 de ingreso, 19 de gasto; `limitAmount` (presupuesto), icono, color |
| `reminding` | 15 | Recordatorios y pagos habituales: `period` (Day/Month…), `amount`, `startDate`, `time`, `addAutomatically` |
| `regular_payment_period` | 26 | Periodos de pagos habituales ya generados |
| `sync_link` | 6,293 | **Relaciones:** movimiento→cuenta, movimiento→categoría, transferencia→FromAccount/ToAccount, recordatorio→cuenta/categoría |

Reglas de importación:

- Ignorar filas con `isRemoved = 1` (borrados) en todas las tablas, incluido `sync_link`.
- La cuenta y la categoría de un movimiento **no** están en `transaction`: se resuelven con `sync_link` (`entityType='Transaction'`, `otherType='Account'|'Category'`).
- Tablas que se descartan: `sync_action`, `sync_data`, `sync_file`, `user`, `user_profile`, `android_metadata`.
- Cuentas duplicadas a unificar (decidir en la importación): `NU` / `Nu crédito`, `Mercado Pago` / `MercadoPago`, `BANAMEX` / `Banamex Credito`, `BBVA` / `BBVA Credito`, `Didi cuenta` / `Didi Card` (posiblemente débito vs. crédito: conservar separadas pero ligadas a la misma institución).
- Validación: el saldo calculado por cuenta tras importar debe igualar `account_balance`.

### Excel "Gastos Personales"

| Hoja | Contenido | Se convierte en |
| --- | --- | --- |
| Resumen General | Gastos fijos (Seguro Vida $2,760, Gastos de casa $1,600 quincenal, Gasolina, Internet, Agua, Seguro Médico, Gym, Spotify, Claude…), sueldo $18,600, disponible del mes y remanente | Pagos habituales + vista "Mes actual" |
| Pagos Recurrentes (tabla `Pagos_a_Meses`) | Compras a meses: TLOZ, Litera escritorio, Moto (18 meses, Liverpool), Reloj, Switch, Casa (276 meses, BBVA Nómina); costo total, meses, fecha final, queda por pagar | Módulo de compras a meses / créditos |
| Cuentas | Didi, Nu, Mercado Pago, Liverpool, Banamex, BBVA: línea de crédito, rendimiento, tope de rendimiento, rendimiento excedente, día de corte, día límite de pago | Atributos de tarjetas y cuentas de inversión |

Fórmulas del Excel que la app debe replicar: costo por mes = total / meses; acumulado = (meses totales − restantes) × costo por mes; fecha final = fecha de compra + meses; queda por pagar = total − acumulado; disponible del mes = sueldo − gastos fijos; remanente = disponible − gastado.

## Funcionalidades

El MVP cubre todo lo que hoy hace Money Manager; lo que hoy vive en el Excel llega en las fases siguientes.

| Módulo | Qué incluye | Origen | Fase |
| --- | --- | --- | --- |
| Cuentas | Tipos: efectivo, débito, crédito, inversión/ahorro; saldo inicial; archivar; excluir del total; color e icono | App | 1 |
| Movimientos | Ingreso / gasto con monto, fecha, cuenta, categoría, nota; editar, borrar; búsqueda y filtros | App | 1 |
| Transferencias | Entre cuentas propias; historial de transferencias por cuenta | App | 1 |
| Categorías | De ingreso y gasto, icono, color, límite mensual (presupuesto) | App | 1 |
| Inicio / Hoy | Saldo total, ingresos y gastos del día y del mes, registro rápido en 2 toques | App + Excel | 1 |
| Gráficas | Gasto por categoría (mes), ingresos vs. gastos por mes, evolución del saldo | App | 2 |
| Pagos habituales | Gastos fijos con periodicidad (mensual, quincenal, cada 2 semanas, día fijo), cuenta y monto; generar movimiento con un toque o automático | App + Excel | 3 |
| Recordatorios | Lista de "por pagar hoy / esta semana"; aviso diario para registrar gastos; notificaciones si la PWA instalada lo permite | App | 3 |
| Tarjetas de crédito | Línea de crédito, disponible, día de corte, día límite de pago, saldo del periodo y próximo pago | Excel | 4 |
| Compras a meses (MSI) | Total, meses, pago mensual, meses restantes, fecha final, queda por pagar; compromiso mensual total | Excel | 4 |
| Rendimientos | Tasa anual, tope con tasa principal, tasa excedente; estimado mensual por cuenta | Excel | 4 |
| Resumen del mes | Sueldo, gastos fijos, compromisos a meses, disponible y remanente (la hoja "Resumen General") | Excel | 4 |
| Importación | `.mmbackup` y `.xlsx` desde Ajustes, con vista previa y validación de saldos | — | 2 |
| Respaldo | Exportar / importar JSON; sincronización Supabase | — | 1–2 |

Fuera de alcance por ahora: varias monedas (todo en MXN), conexión directa con bancos, usuarios compartidos.

## Modelo de datos

Ocho tablas, iguales en Dexie y en Supabase; todas llevan `id` (UUID), `user_id`, `created_at`, `updated_at` y `deleted_at` (borrado lógico, necesario para sincronizar).

| Tabla | Campos principales |
| --- | --- |
| `accounts` | name, type (cash / debit / credit / investment), institution, color, icon, initial\_balance\_cents, include\_in\_total, archived, position, credit\_limit\_cents, statement\_day, due\_day, yield\_rate, yield\_cap\_cents, yield\_rate\_over\_cap |
| `categories` | name, kind (income / expense), icon, color, monthly\_limit\_cents, archived, position |
| `transactions` | kind (income / expense), amount\_cents, date, account\_id, category\_id, note, recurring\_id (opcional), installment\_plan\_id (opcional), legacy\_id |
| `transfers` | from\_account\_id, to\_account\_id, amount\_cents, date, note, legacy\_id |
| `recurring_payments` | name, kind, amount\_cents, account\_id, category\_id, frequency (daily / weekly / biweekly / monthly / yearly / custom), day\_of\_month, start\_date, end\_date, next\_due\_date, auto\_create, active |
| `reminders` | title, text, time, frequency, start\_date, enabled, recurring\_id (opcional) |
| `installment_plans` | concept, account\_id, purchase\_date, total\_cents, months, monthly\_cents, paid\_months, active (compras a meses) |
| `settings` | monthly\_income\_cents (sueldo), pay\_frequency, currency (MXN), theme |

Local-only en Dexie: `outbox` (cambios pendientes de subir) y `sync_state` (última sincronización por tabla).

En Supabase: Row Level Security en todas las tablas con la política `user_id = auth.uid()`, índice en `(user_id, updated_at)` y trigger que actualiza `updated_at`. `legacy_id` guarda el `uid` de Money Manager para que la importación sea idempotente.

## Roadmap por fases

Seis fases en orden; desde la Fase 1 la app ya sirve para el registro diario, y cada fase cierra solo cuando cumple su criterio (el rombo).

&#91;embedded content: roadmap · 6 fases, cada una con su criterio de terminado\]

La sincronización va después del núcleo offline a propósito: primero la app funciona sola en el dispositivo y luego se conecta a Supabase.

Criterios de terminado:

- [ ] **Fase 0:** la PWA se instala en el teléfono y la computadora y abre en modo avión; migración de Supabase aplicada con RLS; login funciona.
- [ ] **Fase 1:** registro un gasto en 2 toques sin conexión; transferencias actualizan ambos saldos; respaldo JSON se exporta e importa; app desplegada con HTTPS.
- [ ] **Fase 2:** un cambio hecho sin conexión en el teléfono aparece en la computadora al reconectar; los 2,706 movimientos y 325 transferencias importados; saldos iguales a los de Money Manager.
- [ ] **Fase 3:** los 11 gastos fijos de "Resumen General" están como pagos habituales; "Por pagar" muestra los de la semana; el recordatorio diario funciona.
- [ ] **Fase 4:** las 6 tarjetas/cuentas del Excel con corte y pago; las compras a meses (Moto, Switch, Casa…) muestran las mismas cifras que el Excel; resumen del mes cuadra con sueldo de $18,600.
- [ ] **Fase 5:** Lighthouse PWA sin fallas; E2E en móvil y escritorio; 30 días usando solo la app.

## Flujo de trabajo en Claude Code

Cada fase se trabaja como un ciclo de superpowers: diseñar, planear, ejecutar con pruebas, revisar y verificar; frontend-design entra en cada fase que toca pantallas.

| Momento | Skill | Para qué |
| --- | --- | --- |
| Antes de escribir código | `superpowers:brainstorming` | Hace preguntas, propone enfoques y deja un diseño aprobado por ti |
| Plan de la fase | `superpowers:writing-plans` | Convierte el diseño en tareas pequeñas con archivos, pruebas y comandos, guardado en `docs/plans/` |
| Aislar el trabajo | `superpowers:using-git-worktrees` | Una rama por fase, sin romper `main` |
| Ejecutar | `superpowers:subagent-driven-development` (o `executing-plans`) | Implementa tarea por tarea con revisión entre tareas |
| Cada función de dominio | `superpowers:test-driven-development` | Prueba primero: saldos, MSI, cortes de tarjeta, sync, importador |
| Cuando algo falla | `superpowers:systematic-debugging` | Encontrar la causa antes de parchar |
| Pantallas y estilo | `frontend-design:frontend-design` | Dirección visual propia, tipografía, color, mobile-first, modo oscuro |
| Fin de fase | `superpowers:requesting-code-review` → `verification-before-completion` → `finishing-a-development-branch` | Revisar, comprobar con pruebas y build reales, y fusionar |

Preparación antes de la primera sesión:

- [ ] Verificar con `/plugin` que los plugins superpowers y frontend-design están instalados.
- [ ] Crear un proyecto en Supabase (plan gratuito) y anotar la URL y la clave `anon`.
- [ ] Crear la carpeta del proyecto con `git init` y una carpeta `data/` con el `.mmbackup` y el `.xlsx`.
- [ ] Agregar `data/` y `.env*` a `.gitignore` antes del primer commit: son tus datos financieros reales.
- [ ] Copiar este documento como `docs/ROADMAP.md` dentro del repo, para que Claude Code lo lea en cada sesión.

Consejo: una sesión de Claude Code por fase. Al empezar cada una, pega el prompt de fase de la siguiente sección.

## Prompt para Claude Code

Pega el prompt principal en la primera sesión; en las siguientes, usa el prompt corto de la fase que toque.

### Prompt principal (Fase 0)

```text
Vamos a construir "Mis Finanzas", una PWA personal de finanzas en español (México, MXN) que reemplaza la app Money Manager del teléfono y mi Excel "Gastos Personales". La debo poder usar en computadora y teléfono, también sin internet. NO quiero una app nativa: es una web app instalable.

Lee primero docs/ROADMAP.md: tiene el objetivo, el stack, el modelo de datos, la estructura de mis datos actuales y las fases. Mis archivos reales están en data/ (respaldo .mmbackup y Gastos_Personales.xlsx). data/ y .env* NUNCA se suben a git; verifícalo en .gitignore antes del primer commit.

Stack decidido (no lo cambies sin preguntármelo):
- React + TypeScript + Vite, vite-plugin-pwa (instalable y offline)
- IndexedDB con Dexie.js como fuente de verdad local; la UI solo lee/escribe en Dexie
- Supabase (Postgres + Auth por email + Row Level Security) para sincronizar entre dispositivos
- Sync propio: UUID en el cliente, cola outbox, updated_at, borrado lógico con deleted_at, último cambio gana
- Tailwind CSS, Recharts, date-fns (locale es)
- Montos SIEMPRE en centavos (enteros); saldos calculados desde movimientos + saldo inicial
- Vitest + Testing Library + Playwright

Forma de trabajo obligatoria:
1. Usa superpowers:brainstorming antes de escribir código. Hazme las preguntas que necesites, una a la vez.
2. Con el diseño aprobado, usa superpowers:writing-plans y guarda el plan en docs/plans/.
3. Trabaja en una rama o worktree por fase (superpowers:using-git-worktrees).
4. Ejecuta con superpowers:subagent-driven-development y superpowers:test-driven-development: toda la lógica de dominio (saldos, transferencias, sync, importadores, MSI, cortes de tarjeta) lleva pruebas primero.
5. Para TODA la interfaz usa la skill frontend-design:frontend-design: quiero una identidad visual propia y cuidada, no una plantilla genérica. Mobile-first (uso principal en el teléfono con una mano), funcional en escritorio, modo claro y oscuro, registro de un gasto en máximo 2 toques.
6. Antes de decir que algo está terminado, usa superpowers:verification-before-completion: corre pruebas, lint y build, y muéstrame la salida.
7. Al final de cada fase: superpowers:requesting-code-review y superpowers:finishing-a-development-branch.

Alcance de esta sesión: FASE 0 — Fundaciones.
- Proyecto Vite + React + TS con Tailwind, ESLint, Prettier, Vitest y Playwright configurados.
- PWA: manifest (nombre, iconos, colores), service worker, instalable, la app abre sin conexión.
- Dirección visual con frontend-design: paleta, tipografía, componentes base (botón, input de monto, lista, tarjeta, barra inferior de navegación).
- Esquema Dexie con las tablas de docs/ROADMAP.md + outbox y sync_state.
- Migración SQL de Supabase (supabase/migrations/) con las mismas tablas, RLS user_id = auth.uid(), índices y trigger de updated_at. No necesito que la ejecutes; déjame los pasos para aplicarla.
- Variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local (te las doy yo). Nunca uses la service_role key en el cliente.
- Pantalla de inicio de sesión (email) y esqueleto de navegación: Inicio, Movimientos, Cuentas, Gráficas, Más.

No avances a la Fase 1 hasta que yo apruebe la Fase 0.
```

### Prompts cortos por fase

```text
FASE 1 — Núcleo offline. Lee docs/ROADMAP.md y el plan anterior en docs/plans/. Sigue el mismo flujo superpowers (brainstorming → writing-plans → TDD → verification) y frontend-design para las pantallas. Alcance: CRUD de cuentas (efectivo, débito, crédito, inversión; saldo inicial; archivar; excluir del total), categorías de ingreso/gasto, movimientos, transferencias con historial por cuenta, pantalla Inicio (saldo total, ingresos/gastos de hoy y del mes, botón de registro rápido), búsqueda y filtros, exportar/importar respaldo JSON. Todo debe funcionar en modo avión. Deja la app desplegada en Vercel/Netlify/Cloudflare Pages para probarla en mi teléfono.
```

```text
FASE 2 — Sincronización, importador y gráficas. Mismo flujo superpowers + frontend-design. Alcance: (1) motor de sync Dexie ↔ Supabase con outbox, pull incremental por updated_at, borrado lógico, reintentos e indicador de estado (sincronizado / pendiente / sin conexión); pruebas de conflicto entre dos dispositivos. (2) Importador del .mmbackup desde Ajustes: es un ZIP con MyFinance.db (SQLite; usa sql.js en el navegador). Montos en centavos; ignora isRemoved=1; la cuenta y categoría de cada movimiento están en sync_link (entityType='Transaction', otherType='Account'|'Category'); las transferencias usan FromAccount/ToAccount. Guarda el uid original en legacy_id para poder reimportar sin duplicar. Muestra vista previa, permite unificar cuentas duplicadas y valida que el saldo de cada cuenta coincida con account_balance. Usa data/ solo para pruebas locales, nunca como fixture subido a git. (3) Gráficas: gasto por categoría del mes, ingresos vs gastos por mes, evolución del saldo.
```

```text
FASE 3 — Pagos habituales y recordatorios. Mismo flujo. Alcance: pagos habituales con periodicidad (diaria, semanal, quincenal, cada 2 semanas, mensual en día fijo, anual), cuenta, categoría y monto; vista "Por pagar" (hoy, esta semana, vencidos); marcar como pagado genera el movimiento; opción de crear automático. Recordatorios con hora, incluido "registra tus gastos del día"; notificaciones de la PWA donde el navegador lo permita y aviso dentro de la app siempre. Importa los recordatorios/pagos habituales del .mmbackup (tabla reminding) y los gastos fijos de la hoja "Resumen General" del Excel.
```

```text
FASE 4 — Lo que hoy vive en mi Excel. Mismo flujo, TDD estricto para los cálculos. Alcance: (1) Tarjetas de crédito: línea, disponible, día de corte, día límite de pago, gasto del periodo actual y monto/fecha del próximo pago. (2) Compras a meses: concepto, cuenta, fecha de compra, total, meses; calcula pago mensual = total/meses, acumulado, meses restantes, fecha final = compra + meses, queda por pagar; total comprometido por mes. (3) Rendimientos: tasa anual, tope con tasa principal y tasa excedente; estimado mensual por cuenta. (4) Resumen del mes: sueldo, gastos fijos, compromisos a meses, disponible y remanente. (5) Importador de Gastos_Personales.xlsx (hojas Cuentas, Pagos Recurrentes y Resumen General) con SheetJS. Los resultados deben coincidir con los del Excel.
```

```text
FASE 5 — Pulido y cambio definitivo. Mismo flujo. Alcance: auditoría de accesibilidad y rendimiento (Lighthouse PWA), estados vacíos y de error, onboarding corto, ajustes (tema, sueldo, moneda), pruebas E2E de los flujos principales en móvil y escritorio, y checklist para usar la app en paralelo 30 días antes de desinstalar Money Manager.
```

## Riesgos y decisiones pendientes

El riesgo principal es la sincronización; por eso llega en la Fase 2, cuando la app ya funciona sola en el dispositivo.

| Riesgo | Mitigación |
| --- | --- |
| Conflictos al editar lo mismo en teléfono y computadora sin conexión | Último cambio gana por `updated_at`; borrado lógico; pruebas con dos dispositivos simulados |
| iPhone (Safari) borra datos de PWAs que no se abren en semanas y limita notificaciones | Instalar la PWA en pantalla de inicio; Supabase como copia; recordatorios también dentro de la app |
| Datos financieros reales en el repo | `data/` y `.env*` en `.gitignore`; RLS en Supabase; nunca la `service_role` key en el cliente |
| Plan gratuito de Supabase pausa proyectos inactivos | Uso diario lo mantiene activo; respaldo JSON exportable desde Ajustes |
| Importación con cuentas duplicadas o saldos que no cuadran | Vista previa, unificación manual y validación contra `account_balance` |

Decisiones que conviene llevar pensadas al brainstorming:

- [ ] Qué cuentas duplicadas de Money Manager se unifican (Nu, Mercado Pago, Banamex, BBVA, Didi).
- [ ] Cómo registrar un pago de tarjeta de crédito: transferencia de débito a crédito (recomendado) o gasto.
- [ ] Si las compras a meses generan su movimiento mensual automáticamente o solo se muestran como compromiso.
- [ ] Nombre y estilo visual de la app.

Siguiente paso: hacer la preparación de la sección "Flujo de trabajo" y pegar el prompt principal en Claude Code.
