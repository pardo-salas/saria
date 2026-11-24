// Convierte un respaldo de Money Manager (.mmbackup) en un respaldo JSON de
// Saria (spec Fase 2 §5). Uso:
//   node scripts/importar-money-manager.mjs data/<archivo>.mmbackup
// Es JS plano (no importa los fuentes TS): lo que duplica del código de la app
// (columnas, UUID v5, iconos) lo vigila scripts/importar-money-manager.test.ts.
import { createHash } from 'node:crypto'
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { unzipSync } from 'fflate'

/** Namespace fijo del importador: reimportar da los mismos IDs. */
export const NAMESPACE_IMPORTADOR = '7c1b9e52-3d4a-5f08-b6a1-2e9d0c4f8a37'
/** Marcador de usuario; la importación de respaldo lo reescribe. */
export const USER_MARCADOR = '00000000-0000-0000-0000-000000000000'
export const SUELDO_CENTAVOS = 1860000

export const COLUMNS = {
  accounts: [
    'id',
    'user_id',
    'created_at',
    'updated_at',
    'deleted_at',
    'name',
    'type',
    'institution',
    'color',
    'icon',
    'initial_balance_cents',
    'include_in_total',
    'archived',
    'position',
    'credit_limit_cents',
    'statement_day',
    'due_day',
    'yield_rate',
    'yield_cap_cents',
    'yield_rate_over_cap',
  ],
  categories: [
    'id',
    'user_id',
    'created_at',
    'updated_at',
    'deleted_at',
    'name',
    'kind',
    'icon',
    'color',
    'monthly_limit_cents',
    'archived',
    'position',
  ],
  transactions: [
    'id',
    'user_id',
    'created_at',
    'updated_at',
    'deleted_at',
    'kind',
    'amount_cents',
    'date',
    'account_id',
    'category_id',
    'note',
    'recurring_id',
    'installment_plan_id',
    'legacy_id',
  ],
  transfers: [
    'id',
    'user_id',
    'created_at',
    'updated_at',
    'deleted_at',
    'from_account_id',
    'to_account_id',
    'amount_cents',
    'date',
    'note',
    'legacy_id',
  ],
  recurring_payments: [
    'id',
    'user_id',
    'created_at',
    'updated_at',
    'deleted_at',
    'name',
    'kind',
    'amount_cents',
    'account_id',
    'category_id',
    'frequency',
    'day_of_month',
    'second_day_of_month',
    'interval_days',
    'start_date',
    'end_date',
    'next_due_date',
    'auto_create',
    'active',
  ],
  reminders: [
    'id',
    'user_id',
    'created_at',
    'updated_at',
    'deleted_at',
    'title',
    'text',
    'time',
    'frequency',
    'second_day_of_month',
    'interval_days',
    'start_date',
    'enabled',
    'recurring_id',
  ],
  installment_plans: [
    'id',
    'user_id',
    'created_at',
    'updated_at',
    'deleted_at',
    'concept',
    'account_id',
    'purchase_date',
    'total_cents',
    'months',
    'monthly_cents',
    'paid_months',
    'active',
  ],
  settings: [
    'id',
    'user_id',
    'created_at',
    'updated_at',
    'deleted_at',
    'monthly_income_cents',
    'pay_frequency',
    'currency',
    'theme',
  ],
}

/** Cuentas decididas por Brian: nombre en Money Manager (sin espacios sobrantes). */
const CUENTAS = {
  NU: ['NU', 'debit', true, false],
  'Nu crédito': ['Nu crédito', 'credit', false, false],
  MercadoPago: ['Mercado Pago', 'debit', true, false],
  'Mercado Pago': ['Mercado Pago crédito', 'credit', false, false],
  'Didi cuenta': ['Didi', 'debit', true, false],
  'Didi Card': ['Didi crédito', 'credit', false, false],
  BANAMEX: ['Banamex', 'debit', true, false],
  'Banamex Credito': ['Banamex crédito', 'credit', false, false],
  BBVA: ['BBVA', 'debit', true, false],
  'BBVA Credito': ['BBVA crédito', 'credit', true, false],
  Liverpool: ['Liverpool', 'credit', true, false],
  Cartera: ['Cartera', 'cash', true, false],
  'Póliza de ahorro': ['Póliza de ahorro', 'investment', false, false],
  Internet: ['Internet', 'debit', true, true],
}

const ICONO_CUENTA = {
  debit: 'banco',
  credit: 'tarjeta',
  cash: 'cartera',
  investment: 'inversion',
}

/** Mismo mapeo que SEED_CATEGORIES (src/domain/seedCategories.ts). */
const ICONO_CATEGORIA = {
  'expense:Transporte': 'transporte',
  'expense:Comida': 'cafe',
  'expense:Antojo': 'dulces',
  'expense:Entretenimiento': 'palomitas',
  'expense:Casa': 'casa',
  'expense:Moto': 'moto',
  'expense:Otros': 'otros',
  'expense:Seguro': 'seguro',
  'expense:Regalos': 'regalo',
  'expense:Rutina': 'deporte',
  'expense:Ocio': 'monedero',
  'expense:Saldo': 'celular',
  'expense:Ropa': 'ropa',
  'expense:Trabajo': 'trabajo',
  'expense:Higiene personal': 'higiene',
  'expense:Alimentación': 'super',
  'expense:Familia': 'familia',
  'expense:Salud': 'corazon',
  'expense:Perfume': 'perfume',
  'expense:Educación': 'educacion',
  'income:Interés': 'banco',
  'income:Salario': 'nomina',
  'income:Transferencia': 'pago',
  'income:Regalo': 'regalo',
  'income:Otros': 'otros',
  'income:Aguinaldo': 'pago',
  'income:Cashback': 'inversion',
  'income:Utilidades': 'otros',
}

/** Paleta de src/domain/catalog.ts (cíclica). */
const PALETA = [
  '#E8735A',
  '#E0A13B',
  '#5DB36A',
  '#2FB5A3',
  '#3A9BDC',
  '#5B7CF0',
  '#9B6BE0',
  '#D063B5',
  '#C98A5E',
  '#8A94A8',
]
const colorAt = (i) =>
  PALETA[((i % PALETA.length) + PALETA.length) % PALETA.length]

/** UUID v5 (RFC 4122 §4.3), igual que src/domain/uuid.ts. */
export function uuidV5(nombre, namespace = NAMESPACE_IMPORTADOR) {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex')
  const h = createHash('sha1').update(ns).update(nombre, 'utf8').digest()
  const b = h.subarray(0, 16)
  b[6] = (b[6] & 0x0f) | 0x50
  b[8] = (b[8] & 0x3f) | 0x80
  const x = b.toString('hex')
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`
}

/** Fecha de calendario en America/Mexico_City ('YYYY-MM-DD'). */
function fechaMexico(fecha) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha)
}

/** Fecha de Money Manager a 'YYYY-MM-DD' (hoy ya viene así; si trae hora, se convierte). */
function normalizarFecha(texto) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto
  const d = new Date(texto)
  if (Number.isNaN(d.getTime()))
    throw new Error(`Fecha no reconocida: ${texto}`)
  return fechaMexico(d)
}

function iso(texto, respaldo) {
  const d = new Date(texto)
  return Number.isNaN(d.getTime()) ? respaldo : d.toISOString()
}

function extraerDb(ruta, carpeta) {
  const buf = readFileSync(ruta)
  let i = 0
  while (
    i < buf.length - 3 &&
    !(
      buf[i] === 0x50 &&
      buf[i + 1] === 0x4b &&
      buf[i + 2] === 3 &&
      buf[i + 3] === 4
    )
  )
    i++
  if (i >= buf.length - 3)
    throw new Error('El archivo no parece un .mmbackup (sin ZIP)')
  const archivos = unzipSync(buf.subarray(i))
  const nombre = Object.keys(archivos).find((k) => k.endsWith('.db'))
  if (!nombre) throw new Error('El .mmbackup no contiene una base .db')
  const destino = join(carpeta, 'mm.db')
  writeFileSync(destino, archivos[nombre])
  return destino
}

/**
 * Convierte el .mmbackup en un respaldo de Saria.
 * @returns {Promise<{ backup: object, resumen: object }>}
 */
export async function convertirMmbackup(rutaArchivo, opciones = {}) {
  const ahora = opciones.ahora ?? new Date()
  const ahoraIso = ahora.toISOString()
  const carpeta = mkdtempSync(join(tmpdir(), 'saria-mm-'))
  let db
  try {
    db = new DatabaseSync(extraerDb(rutaArchivo, carpeta), { readOnly: true })
    return convertir(db, ahora, ahoraIso)
  } finally {
    try {
      db?.close()
    } catch {
      /* ya cerrada */
    }
    rmSync(carpeta, { recursive: true, force: true })
  }
}

function convertir(db, ahora, ahoraIso) {
  const todo = (sql) => db.prepare(sql).all()
  const descartes = []
  const advertencias = []
  const descartar = (tabla, motivo, n) => {
    if (n > 0) descartes.push({ tabla, motivo, n })
  }
  const id = (uid) => uuidV5(uid)
  const base = (uid, creado, modificado) => ({
    id: id(uid),
    user_id: USER_MARCADOR,
    created_at: iso(creado, ahoraIso),
    updated_at: iso(modificado ?? creado, ahoraIso),
    deleted_at: null,
  })

  // --- Cuentas ---
  const saldos = new Map(
    todo('SELECT uid, value FROM account_balance').map((r) => [r.uid, r.value]),
  )
  const cuentasMm = todo('SELECT * FROM account ORDER BY position, title')
  descartar(
    'account',
    'isRemoved = 1',
    cuentasMm.filter((a) => a.isRemoved === 1).length,
  )
  const accounts = []
  const cuentaPorUid = new Map()
  for (const a of cuentasMm.filter((x) => x.isRemoved !== 1)) {
    const def = CUENTAS[String(a.title).trim()]
    if (!def)
      throw new Error(`Cuenta sin mapeo en la tabla de §5: "${a.title}"`)
    const [name, type, incluir, archivada] = def
    const ignorar = a.ignoreInBalance === 1
    if (ignorar === incluir)
      advertencias.push(
        `"${name}": include_in_total de la tabla (${incluir}) difiere de Money Manager`,
      )
    const fila = {
      ...base(a.uid, a.created, a.modified),
      name,
      type,
      institution: null,
      color: colorAt(accounts.length),
      icon: ICONO_CUENTA[type],
      initial_balance_cents: 0,
      include_in_total: incluir,
      archived: archivada,
      position: accounts.length,
      credit_limit_cents: null,
      statement_day: null,
      due_day: null,
      yield_rate: null,
      yield_cap_cents: null,
      yield_rate_over_cap: null,
    }
    accounts.push(fila)
    cuentaPorUid.set(a.uid, fila)
  }

  // --- Categorías ---
  const catsMm = todo('SELECT * FROM category')
  descartar(
    'category',
    'isRemoved = 1',
    catsMm.filter((c) => c.isRemoved === 1).length,
  )
  const vivasCat = catsMm.filter((c) => c.isRemoved !== 1)
  const categories = []
  const categoriaPorUid = new Map()
  for (const kind of ['expense', 'income']) {
    const delTipo = vivasCat
      .filter((c) => String(c.type).toLowerCase() === kind)
      .sort(
        (x, y) =>
          y.useCount - x.useCount ||
          String(x.title).localeCompare(String(y.title)),
      )
    delTipo.forEach((c, posicion) => {
      const nombre = String(c.title).trim()
      const icono = ICONO_CATEGORIA[`${kind}:${nombre}`]
      if (!icono)
        advertencias.push(
          `Categoría sin icono conocido: "${nombre}" (${kind}); se usa "otros"`,
        )
      const fila = {
        ...base(c.uid, c.created, c.modified),
        name: nombre,
        kind,
        icon: icono ?? 'otros',
        color: colorAt(categories.length),
        monthly_limit_cents: c.limitAmount > 0 ? c.limitAmount : null,
        archived: c.isArchived === 1,
        position: posicion,
      }
      categories.push(fila)
      categoriaPorUid.set(c.uid, fila)
    })
  }

  // --- Enlaces vivos (sync_link) ---
  const enlaces = todo('SELECT * FROM sync_link')
  descartar(
    'sync_link',
    'isRemoved = 1',
    enlaces.filter((l) => l.isRemoved === 1).length,
  )
  const enlace = new Map() // `${entityType}|${otherType}|${entityUid}` -> otherUid
  for (const l of enlaces.filter((x) => x.isRemoved !== 1))
    enlace.set(`${l.entityType}|${l.otherType}|${l.entityUid}`, l.otherUid)

  // --- Movimientos ---
  const txMm = todo('SELECT * FROM "transaction" ORDER BY date, created')
  descartar(
    'transaction',
    'isRemoved = 1',
    txMm.filter((t) => t.isRemoved === 1).length,
  )
  const transactions = []
  let sinCategoria = 0
  let otraMoneda = 0
  for (const t of txMm.filter((x) => x.isRemoved !== 1)) {
    const kind =
      t.type === 'Income' ? 'income' : t.type === 'Expense' ? 'expense' : null
    if (!kind) {
      descartar('transaction', `tipo desconocido (${t.type})`, 1)
      continue
    }
    const cuenta = cuentaPorUid.get(enlace.get(`Transaction|Account|${t.uid}`))
    if (!cuenta) {
      descartar('transaction', 'sin cuenta viva enlazada', 1)
      continue
    }
    const categoria =
      categoriaPorUid.get(enlace.get(`Transaction|Category|${t.uid}`)) ?? null
    if (!categoria) sinCategoria++
    if (t.amountInDefaultCurrency !== t.amountInAccountCurrency) otraMoneda++
    const nota =
      typeof t.comment === 'string' && t.comment.trim() !== ''
        ? t.comment
        : null
    transactions.push({
      ...base(t.uid, t.created, t.modified),
      kind,
      amount_cents: t.amountInDefaultCurrency,
      date: normalizarFecha(t.date),
      account_id: cuenta.id,
      category_id: categoria?.id ?? null,
      note: nota,
      recurring_id: null,
      installment_plan_id: null,
      legacy_id: t.uid,
    })
  }
  if (sinCategoria > 0)
    advertencias.push(
      `${sinCategoria} movimientos sin categoría viva (category_id = null)`,
    )
  if (otraMoneda > 0)
    advertencias.push(
      `${otraMoneda} movimientos con monto en moneda de cuenta distinto al predeterminado (se usó el predeterminado)`,
    )

  // --- Transferencias ---
  const trMm = todo('SELECT * FROM transfer ORDER BY date, created')
  descartar(
    'transfer',
    'isRemoved = 1',
    trMm.filter((t) => t.isRemoved === 1).length,
  )
  const transfers = []
  let montosDistintos = 0
  for (const t of trMm.filter((x) => x.isRemoved !== 1)) {
    const origen = cuentaPorUid.get(enlace.get(`Transfer|FromAccount|${t.uid}`))
    const destino = cuentaPorUid.get(enlace.get(`Transfer|ToAccount|${t.uid}`))
    if (!origen || !destino || origen.id === destino.id) {
      descartar('transfer', 'sin cuentas de origen y destino válidas', 1)
      continue
    }
    if (t.toAmount !== null && t.toAmount !== t.fromAmount) montosDistintos++
    const nota =
      typeof t.comment === 'string' && t.comment.trim() !== ''
        ? t.comment
        : null
    transfers.push({
      ...base(t.uid, t.created, t.modified),
      from_account_id: origen.id,
      to_account_id: destino.id,
      amount_cents: t.fromAmount,
      date: normalizarFecha(t.date),
      note: nota,
      legacy_id: t.uid,
    })
  }
  if (montosDistintos > 0)
    advertencias.push(
      `${montosDistintos} transferencias con fromAmount distinto de toAmount (se usó fromAmount)`,
    )

  // --- Saldo inicial derivado = saldo actual − movimiento neto ---
  const neto = new Map(accounts.map((a) => [a.id, 0]))
  for (const t of transactions)
    neto.set(
      t.account_id,
      neto.get(t.account_id) +
        (t.kind === 'income' ? t.amount_cents : -t.amount_cents),
    )
  for (const r of transfers) {
    neto.set(r.to_account_id, neto.get(r.to_account_id) + r.amount_cents)
    neto.set(r.from_account_id, neto.get(r.from_account_id) - r.amount_cents)
  }
  const cuentas = []
  for (const [uid, fila] of cuentaPorUid) {
    const actual = saldos.get(uid) ?? 0
    fila.initial_balance_cents = actual - neto.get(fila.id)
    cuentas.push({
      nombre: fila.name,
      saldoMm: actual,
      saldoCalculado: fila.initial_balance_cents + neto.get(fila.id),
      saldoInicial: fila.initial_balance_cents,
    })
  }

  const settings = [
    {
      id: USER_MARCADOR,
      user_id: USER_MARCADOR,
      created_at: ahoraIso,
      updated_at: ahoraIso,
      deleted_at: null,
      monthly_income_cents: SUELDO_CENTAVOS,
      pay_frequency: null,
      currency: 'MXN',
      theme: 'system',
    },
  ]

  const backup = {
    format: 'saria-backup',
    version: 1,
    exported_at: ahoraIso,
    tables: {
      accounts,
      categories,
      transactions,
      transfers,
      recurring_payments: [],
      reminders: [],
      installment_plans: [],
      settings,
    },
  }
  const conteos = Object.fromEntries(
    Object.entries(backup.tables).map(([t, rows]) => [t, rows.length]),
  )
  return {
    backup,
    resumen: {
      fecha: fechaMexico(ahora),
      conteos,
      descartes,
      advertencias,
      cuentas,
    },
  }
}

const pesos = (c) =>
  (c / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

function imprimirResumen(resumen, salida) {
  const log = console.log
  log('Conteos por tabla:')
  for (const [t, n] of Object.entries(resumen.conteos))
    log(`  ${t.padEnd(20)} ${n}`)
  log('\nFilas descartadas:')
  if (resumen.descartes.length === 0) log('  ninguna')
  for (const d of resumen.descartes) log(`  ${d.tabla}: ${d.n} (${d.motivo})`)
  log('\nAdvertencias:')
  if (resumen.advertencias.length === 0) log('  ninguna')
  for (const a of resumen.advertencias) log(`  - ${a}`)
  log(
    '\nCuentas (saldo en Money Manager | saldo calculado | saldo inicial derivado):',
  )
  for (const c of resumen.cuentas)
    log(
      `  ${c.nombre.padEnd(22)} ${pesos(c.saldoMm).padStart(14)} | ${pesos(c.saldoCalculado).padStart(14)} | ${pesos(c.saldoInicial).padStart(14)}`,
    )
  log(`\nArchivo generado: ${salida}`)
}

async function main() {
  const ruta = process.argv[2]
  if (!ruta || !existsSync(ruta)) {
    console.error(
      'Uso: node scripts/importar-money-manager.mjs data/<archivo>.mmbackup',
    )
    process.exit(1)
  }
  const { backup, resumen } = await convertirMmbackup(ruta)
  const carpetaSalida = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'data',
  )
  const salida = join(carpetaSalida, `saria-importacion-${resumen.fecha}.json`)
  writeFileSync(salida, JSON.stringify(backup))
  imprimirResumen(resumen, salida)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
