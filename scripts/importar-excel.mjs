// Genera el archivo `saria-excel` (spec Fase 4 §6): compras a meses, datos de
// tarjetas y rendimientos de las cuentas, y la baja de los pagos habituales de
// compras a meses que la Fase 3 cargó. Uso:
//   node scripts/importar-excel.mjs data/<archivo>.mmbackup "data/Gastos Personales.xlsx"
// Reutiliza los namespaces, IDs y mapeos de los importadores anteriores.
import { existsSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { uuidV5, convertirMmbackup } from './importar-money-manager.mjs'
import {
  centavos,
  construirPagos,
  leerCeldas,
  leerRecordatorios,
} from './importar-pagos-habituales.mjs'

export const FORMATO = 'saria-excel'

/** Pago habitual de Money Manager del que sale cada compra del Excel (categoría y baja). */
const RECORDATORIO_DE = {
  TLOZ: 'Mensualidad TLOZ',
  'Litera escritorio': 'Mesualidades de cama',
  Reloj: 'Reloj mensualidad',
  Switch: 'Mensualidad switch 2',
}
/** Compras cuya categoría es una categoría de gasto con su mismo nombre. */
const CATEGORIA_PROPIA = { Moto: 'Moto', Casa: 'Casa' }
const LAPTOP = 'Laptop de karina'

/** Columna "Banco" de "Pagos Recurrentes" → cuenta de Saria. */
const CUENTA_DE_BANCO = {
  'Mercado Pago': 'Mercado Pago crédito',
  Banamex: 'Banamex crédito',
  Liverpool: 'Liverpool',
  'BBVA | Nomina': 'BBVA',
}

/** Hoja "Cuentas": banco → { crédito, débito (para rendimientos) }. */
const CUENTAS_DE_BANCO = {
  Didi: { credito: 'Didi crédito', debito: 'Didi' },
  Nu: { credito: 'Nu crédito', debito: 'NU' },
  'Mercado Pago': { credito: 'Mercado Pago crédito', debito: 'Mercado Pago' },
  Liverpool: { credito: 'Liverpool', debito: null },
  Banamex: { credito: 'Banamex crédito', debito: null },
  BBVA: { credito: 'BBVA crédito', debito: null },
}

// --- Fechas (mismo cálculo que src/domain/installments.ts) ---
const diasEnMes = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate()
const ymd = (y, m, d) =>
  `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** `fecha` + `n` meses con el día acotado al fin de mes. */
export function sumarMeses(fecha, n) {
  const total =
    Number(fecha.slice(0, 4)) * 12 + (Number(fecha.slice(5, 7)) - 1) + n
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  return ymd(y, m, Math.min(Number(fecha.slice(8, 10)), diasEnMes(y, m)))
}

/** Serial de Excel (días desde 1899-12-30) → AAAA-MM-DD. */
export function fechaDeSerial(serial) {
  const dias = Math.round(Number(serial)) - 25569
  return new Date(dias * 86_400_000).toISOString().slice(0, 10)
}

/** '0.065' → 6.5, sin ruido de flotantes (4 decimales). */
export function porcentaje(decimal) {
  return Math.round(Number(decimal) * 100 * 10_000) / 10_000
}

const entero = (texto) => Math.round(Number(texto))

/** Fecha del respaldo (AAAA_MM_DD_… en el nombre del archivo); si no, la de hoy. */
function fechaDelRespaldo(ruta, respaldo) {
  const m = /(\d{4})_(\d{2})_(\d{2})/.exec(basename(ruta))
  return m ? `${m[1]}-${m[2]}-${m[3]}` : respaldo
}

/**
 * @returns {Promise<{ archivo: object, planes: object[], cuentas: object[], desactivados: string[], advertencias: string[], fecha: string }>}
 */
export async function construirExcel(rutaMm, rutaExcel, opciones = {}) {
  const ahora = opciones.ahora ?? new Date()
  const { backup, resumen: resumenMm } = await convertirMmbackup(rutaMm, {
    ahora,
  })
  const { archivo: pagos } = await construirPagos(rutaMm, rutaExcel, { ahora })
  const fechaRespaldo = fechaDelRespaldo(rutaMm, resumenMm.fecha)
  const cuentaPorNombre = new Map(
    backup.tables.accounts.map((a) => [a.name, a]),
  )
  const categoriaGasto = new Map(
    backup.tables.categories
      .filter((c) => c.kind === 'expense')
      .map((c) => [c.name, c]),
  )
  const pagoPorNombre = new Map(
    pagos.recurring_payments.map((p) => [p.name, p]),
  )
  const cuenta = (nombre) => {
    const c = cuentaPorNombre.get(nombre)
    if (!c) throw new Error(`No existe la cuenta "${nombre}"`)
    return c
  }
  const pagoMm = (nombre) => {
    const p = pagoPorNombre.get(nombre)
    if (!p) throw new Error(`No existe el pago habitual "${nombre}"`)
    return p
  }

  const recordatorios = leerRecordatorios(rutaMm)
  /**
   * Compra que Money Manager también recuerda: el próximo cargo real es la
   * primera fecha posterior al respaldo con el día del recordatorio, sin mirar
   * su fecha final; la fecha de compra se calcula hacia atrás para que
   * chargeDate(plan, pagados + 1) caiga exactamente ahí.
   */
  const compraDesdeCobro = (titulo, pagados) => {
    const r = recordatorios.find((x) => x.title === titulo)
    if (!r) throw new Error(`No se encontró "${titulo}" en Money Manager`)
    const dia = Number(r.startDate.slice(8, 10))
    const [a, m] = fechaRespaldo.split('-').map(Number)
    let proximo = null
    for (let i = 0; i < 3 && proximo === null; i++) {
      const t = a * 12 + (m - 1) + i
      const y = Math.floor(t / 12)
      const mes = (t % 12) + 1
      const c = ymd(y, mes, Math.min(dia, diasEnMes(y, mes)))
      if (c > fechaRespaldo) proximo = c
    }
    const compra = sumarMeses(proximo, -(pagados + 1))
    if (sumarMeses(compra, pagados + 1) !== proximo)
      throw new Error(`No se pudo fijar el próximo cargo de "${titulo}"`)
    return compra
  }

  const planes = []
  const retag = []
  const plan = (id, datos) => ({
    id,
    concept: datos.concept,
    account_id: datos.account_id,
    purchase_date: datos.purchase_date,
    total_cents: datos.total_cents,
    months: datos.months,
    monthly_cents: datos.monthly_cents,
    paid_months: datos.paid_months,
    active: datos.active ?? datos.paid_months < datos.months,
    category_id: datos.category_id,
  })

  // Compras del Excel ("Pagos Recurrentes", filas 2 a 7)
  const hoja = leerCeldas(rutaExcel, 'Pagos Recurrentes')
  const excel = []
  for (let r = 2; r <= 7; r++) {
    const concepto = hoja.get(`B${r}`)?.trim()
    if (!concepto)
      throw new Error(`Fila ${r} de "Pagos Recurrentes" sin concepto`)
    const banco = hoja.get(`F${r}`)?.trim()
    const nombreCuenta = CUENTA_DE_BANCO[banco]
    if (!nombreCuenta) throw new Error(`Banco sin equivalente: "${banco}"`)
    const meses = entero(hoja.get(`H${r}`))
    const restantes = entero(hoja.get(`G${r}`))
    let categoria
    if (RECORDATORIO_DE[concepto])
      categoria = pagoMm(RECORDATORIO_DE[concepto]).category_id
    else if (CATEGORIA_PROPIA[concepto])
      categoria = categoriaGasto.get(CATEGORIA_PROPIA[concepto])?.id
    if (!categoria) throw new Error(`Sin categoría para "${concepto}"`)
    const pagados = meses - restantes
    const casa = concepto === 'Casa'
    const p = plan(await uuidV5(`excel-plan:${concepto}`), {
      concept: concepto,
      // La hipoteca se descuenta de la nómina: sin cuenta y en pausa.
      account_id: casa ? null : cuenta(nombreCuenta).id,
      active: casa ? false : undefined,
      purchase_date: RECORDATORIO_DE[concepto]
        ? compraDesdeCobro(RECORDATORIO_DE[concepto], pagados)
        : fechaDeSerial(hoja.get(`C${r}`)),
      monthly_cents: centavos(hoja.get(`D${r}`)),
      total_cents: centavos(hoja.get(`I${r}`)),
      months: meses,
      paid_months: meses - restantes,
      category_id: categoria,
    })
    planes.push(p)
    excel.push({
      concepto,
      pagoRealCents: centavos(hoja.get(`D${r}`)),
      acumuladoCents: centavos(hoja.get(`J${r}`)),
      quedaCents: centavos(hoja.get(`L${r}`)),
    })
    if (RECORDATORIO_DE[concepto])
      retag.push({
        recurring_id: pagoMm(RECORDATORIO_DE[concepto]).id,
        installment_plan_id: p.id,
      })
  }

  // Laptop de karina: solo está en el recordatorio de Money Manager.
  const laptop = recordatorios.find((r) => r.title === LAPTOP)
  if (!laptop) throw new Error(`No se encontró "${LAPTOP}" en Money Manager`)
  const compra = sumarMeses(laptop.startDate, -1)
  let cargos = 0
  let pagados = 0
  for (;;) {
    const fecha = sumarMeses(compra, cargos + 1)
    if (fecha > laptop.endDate) break
    cargos += 1
    if (fecha <= fechaRespaldo) pagados += 1
  }
  const laptopPlan = plan(await uuidV5(`mm-plan:${laptop.uid}`), {
    concept: LAPTOP,
    account_id: pagoMm(LAPTOP).account_id,
    purchase_date: compraDesdeCobro(LAPTOP, pagados),
    monthly_cents: laptop.amount,
    total_cents: laptop.amount * cargos,
    months: cargos,
    paid_months: pagados,
    category_id: pagoMm(LAPTOP).category_id,
  })
  planes.push(laptopPlan)
  retag.push({
    recurring_id: pagoMm(LAPTOP).id,
    installment_plan_id: laptopPlan.id,
  })

  // Cuentas
  const hojaCuentas = leerCeldas(rutaExcel, 'Cuentas')
  const actualizaciones = []
  for (let r = 2; r <= 7; r++) {
    const banco = hojaCuentas.get(`A${r}`)?.trim()
    const destino = CUENTAS_DE_BANCO[banco]
    if (!destino)
      throw new Error(`Banco sin equivalente en "Cuentas": "${banco}"`)
    actualizaciones.push({
      id: cuenta(destino.credito).id,
      credit_limit_cents: centavos(hojaCuentas.get(`B${r}`)),
      statement_day: entero(hojaCuentas.get(`F${r}`)),
      due_day: entero(hojaCuentas.get(`G${r}`)),
    })
    const tasa = porcentaje(hojaCuentas.get(`C${r}`))
    if (tasa > 0) {
      if (!destino.debito)
        throw new Error(`"${banco}" tiene rendimiento pero no cuenta de débito`)
      actualizaciones.push({
        id: cuenta(destino.debito).id,
        yield_rate: tasa,
        yield_cap_cents: centavos(hojaCuentas.get(`D${r}`)),
        yield_rate_over_cap: porcentaje(hojaCuentas.get(`E${r}`)),
      })
    }
  }

  const baja = [...Object.values(RECORDATORIO_DE), LAPTOP]
  const archivo = {
    format: FORMATO,
    version: 1,
    installment_plans: planes,
    account_updates: actualizaciones,
    deactivate_recurring_ids: baja.map((n) => pagoMm(n).id),
    retag,
  }
  const nombreCuenta = new Map(
    backup.tables.accounts.map((a) => [a.id, a.name]),
  )
  return {
    archivo,
    planes,
    excel,
    cuentas: actualizaciones.map((u) => ({
      ...u,
      nombre: nombreCuenta.get(u.id),
    })),
    desactivados: baja,
    nombreCuenta,
    fecha: resumenMm.fecha,
    fechaRespaldo,
  }
}

const pesos = (c) =>
  (c / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

async function main() {
  const [rutaMm, rutaExcel] = process.argv.slice(2)
  if (!rutaMm || !rutaExcel || !existsSync(rutaMm) || !existsSync(rutaExcel)) {
    console.error(
      'Uso: node scripts/importar-excel.mjs data/<archivo>.mmbackup "data/Gastos Personales.xlsx"',
    )
    process.exit(1)
  }
  const {
    archivo,
    planes,
    cuentas,
    desactivados,
    nombreCuenta,
    fecha,
    fechaRespaldo,
  } = await construirExcel(rutaMm, rutaExcel)
  const salida = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'data',
    `saria-excel-${fecha}.json`,
  )
  writeFileSync(salida, JSON.stringify(archivo))
  console.log(`Respaldo de Money Manager: ${fechaRespaldo}`)
  console.log(`\nCompras a meses: ${planes.length}\n`)
  for (const p of planes) {
    const restantes = p.months - p.paid_months
    const acumulado =
      restantes === 0
        ? p.total_cents
        : p.paid_months * Math.round(p.total_cents / p.months)
    const siguiente =
      restantes === 0 ? '—' : sumarMeses(p.purchase_date, p.paid_months + 1)
    console.log(
      `  ${p.concept.padEnd(18)} ${String(p.paid_months).padStart(2)}/${String(p.months).padEnd(3)} pago real ${pesos(p.monthly_cents).padStart(12)}  queda ${pesos(p.total_cents - acumulado).padStart(14)}  próximo: ${siguiente}${p.active ? '' : '  (inactiva)'}  [${nombreCuenta.get(p.account_id) ?? 'sin cuenta'}]`,
    )
  }
  console.log(`\nActualizaciones de cuenta: ${cuentas.length}\n`)
  for (const { nombre, id: _id, ...campos } of cuentas)
    console.log(`  ${String(nombre).padEnd(20)} ${JSON.stringify(campos)}`)
  console.log(`\nPagos habituales a desactivar: ${desactivados.length}`)
  for (const d of desactivados) console.log(`  - ${d}`)
  console.log(`\nArchivo generado: ${salida}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
