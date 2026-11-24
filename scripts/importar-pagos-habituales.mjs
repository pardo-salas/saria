// Genera el archivo de pagos habituales de Saria (spec Fase 3 §6). Uso:
//   node scripts/importar-pagos-habituales.mjs data/<archivo>.mmbackup "data/Gastos Personales.xlsx"
// Reutiliza del importador de la Fase 2 el namespace, la regla de IDs y el
// mapeo de cuentas y categorías, para que los IDs coincidan con lo ya importado.
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
import { unzipSync, strFromU8 } from 'fflate'
import {
  COLUMNS,
  USER_MARCADOR,
  uuidV5,
  extraerDb,
  convertirMmbackup,
} from './importar-money-manager.mjs'

export const FORMATO = 'saria-recurring'

/** Compras a meses de Money Manager que se importan (el resto ya viene del Excel). */
const COMPRAS_MM = [
  'Reloj mensualidad',
  'Mesualidades de cama',
  'Laptop de karina',
  'Mensualidad TLOZ',
  'Mensualidad switch 2',
]

/** Cuenta del Excel → nombre de la cuenta de Saria. */
const CUENTAS_EXCEL = {
  'Banamex Débito': 'Banamex',
  'Mercado Pago': 'Mercado Pago',
  'BBVA Crédito': 'BBVA crédito',
  'Banamex Crédito': 'Banamex crédito',
  Liverpoool: 'Liverpool',
  Liverpool: 'Liverpool',
}

/** Tabla de §6: frecuencia, día y categoría de cada gasto del Excel. */
const REGLAS_EXCEL = {
  'Seguro Vida': { frequency: 'monthly', day: 22, categoria: 'Seguro' },
  'Gastos de casa': {
    frequency: 'semimonthly',
    day: 15,
    segundo: 31,
    categoria: 'Casa',
  },
  Gasolina: { frequency: 'biweekly', categoria: 'Moto' },
  'Internet casa de madre': {
    frequency: 'monthly',
    day: 15,
    categoria: 'Casa',
  },
  Agua: { frequency: 'monthly', day: 15, categoria: 'Casa' },
  'Seguro Medico Chubb': { frequency: 'monthly', day: 15, categoria: 'Seguro' },
  Saldo: { frequency: 'monthly', day: 25, categoria: 'Saldo' },
  Gym: { frequency: 'monthly', day: 15, categoria: 'Rutina' },
  'Seguro Liverpool': { frequency: 'monthly', day: 15, categoria: 'Seguro' },
  Spotify: { frequency: 'monthly', day: 17, categoria: 'Entretenimiento' },
  Claude: { frequency: 'monthly', day: 1, categoria: 'Trabajo' },
}

// --- Fechas: mismo algoritmo que src/domain/recurring.ts (nextOccurrence) ---
const MS_DIA = 86_400_000
const toDay = (date) => {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / MS_DIA
}
const fromDay = (day) => new Date(day * MS_DIA).toISOString().slice(0, 10)
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate()
const ymd = (y, m, d) =>
  `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const clamped = (y, m, d) => ymd(y, m, Math.min(d, daysInMonth(y, m)))

function firstOnOrAfter(p, from, anchor) {
  const fromDayN = toDay(from)
  switch (p.frequency) {
    case 'daily':
      return from
    case 'weekly':
    case 'biweekly':
    case 'custom': {
      const step =
        p.frequency === 'weekly'
          ? 7
          : p.frequency === 'biweekly'
            ? 14
            : (p.interval_days ?? 0)
      if (!Number.isInteger(step) || step < 1) return null
      const a = toDay(anchor)
      if (fromDayN <= a) return fromDay(a)
      return fromDay(a + Math.ceil((fromDayN - a) / step) * step)
    }
    case 'monthly':
    case 'semimonthly': {
      const base = p.day_of_month ?? Number(anchor.slice(8, 10))
      const days =
        p.frequency === 'semimonthly'
          ? [base, p.second_day_of_month ?? base]
          : [base]
      let y = Number(from.slice(0, 4))
      let m = Number(from.slice(5, 7))
      for (let i = 0; i < 3; i++) {
        const found = days
          .map((d) => clamped(y, m, d))
          .sort()
          .find((c) => c >= from)
        if (found) return found
        m += 1
        if (m > 12) {
          m = 1
          y += 1
        }
      }
      return null
    }
    case 'yearly': {
      const mo = Number(anchor.slice(5, 7))
      const d = Number(anchor.slice(8, 10))
      let y = Number(from.slice(0, 4))
      for (let i = 0; i < 9; i++, y++) {
        const c = clamped(y, mo, d)
        if (c >= from) return c
      }
      return null
    }
    default:
      return null
  }
}

/** Primera fecha posterior a `after` (o desde start_date); null si pasó de end_date. */
export function nextOccurrence(p, after) {
  let from = fromDay(toDay(after) + 1)
  if (p.start_date && from < p.start_date) from = p.start_date
  const found = firstOnOrAfter(p, from, p.start_date ?? after)
  if (found === null) return null
  if (p.end_date && found > p.end_date) return null
  return found
}

// --- Excel ---

/** '293.38' → 29338 con aritmética de texto (sin flotantes). */
export function centavos(texto) {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(String(texto).trim())
  if (!m) throw new Error(`Importe no reconocido: "${texto}"`)
  const frac = (m[2] ?? '').padEnd(3, '0')
  let c = Number(m[1]) * 100 + Number(frac.slice(0, 2))
  if (Number(frac[2]) >= 5) c += 1
  return c
}

const decodificar = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

/** Filas 4–14 de la hoja "Resumen General": { gasto, importe, cuenta, fechaPago }. */
export function leerExcel(ruta) {
  const z = unzipSync(readFileSync(ruta))
  const texto = (n) => strFromU8(z[n])
  const libro = texto('xl/workbook.xml')
  const hoja = /<sheet [^>]*name="Resumen General"[^>]*r:id="([^"]+)"/.exec(
    libro,
  )
  if (!hoja) throw new Error('El Excel no tiene la hoja "Resumen General"')
  const rels = texto('xl/_rels/workbook.xml.rels')
  const rel = new RegExp(`<Relationship [^>]*Id="${hoja[1]}"[^>]*>`).exec(rels)
  const destino = /Target="([^"]+)"/.exec(rel?.[0] ?? '')?.[1]
  if (!destino) throw new Error('No se encontró la hoja "Resumen General"')
  const ruta_hoja = destino.startsWith('/')
    ? destino.slice(1)
    : `xl/${destino.replace(/^\.?\//, '')}`
  const compartidas = [
    ...texto('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g),
  ].map((m) =>
    decodificar(
      [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''),
    ),
  )
  const celdas = new Map()
  for (const c of texto(ruta_hoja).matchAll(
    /<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,
  )) {
    const tipo = /t="([^"]+)"/.exec(c[2])?.[1]
    const cuerpo = c[3] ?? ''
    const v = /<v>([\s\S]*?)<\/v>/.exec(cuerpo)?.[1]
    if (tipo === 's' && v !== undefined)
      celdas.set(c[1], compartidas[Number(v)])
    else if (tipo === 'inlineStr')
      celdas.set(
        c[1],
        decodificar(
          [...cuerpo.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
            .map((t) => t[1])
            .join(''),
        ),
      )
    else if (v !== undefined) celdas.set(c[1], decodificar(v))
  }
  const filas = []
  for (let r = 4; r <= 14; r++) {
    const gasto = celdas.get(`A${r}`)?.trim()
    if (!gasto) throw new Error(`Fila ${r} del Excel sin nombre de gasto`)
    filas.push({
      gasto,
      importe: celdas.get(`B${r}`),
      cuenta: celdas.get(`C${r}`)?.trim() || null,
      fechaPago: celdas.get(`D${r}`)?.trim() || null,
    })
  }
  return filas
}

// --- Construcción ---

function leerRecordatorios(ruta) {
  const carpeta = mkdtempSync(join(tmpdir(), 'saria-pagos-'))
  let db
  try {
    db = new DatabaseSync(extraerDb(ruta, carpeta), { readOnly: true })
    const filas = db
      .prepare(
        `SELECT * FROM reminding WHERE isRemoved = 0 AND remindingType = 'regularPayments'`,
      )
      .all()
    const enlaces = db
      .prepare(
        `SELECT * FROM sync_link WHERE entityType = 'Reminding' AND isRemoved = 0 AND otherType IN ('Account','Category')`,
      )
      .all()
    return filas.map((r) => ({
      ...r,
      cuentaUid:
        enlaces.find((l) => l.entityUid === r.uid && l.otherType === 'Account')
          ?.otherUid ?? null,
      categoriaUid:
        enlaces.find((l) => l.entityUid === r.uid && l.otherType === 'Category')
          ?.otherUid ?? null,
    }))
  } finally {
    try {
      db?.close()
    } catch {
      /* ya cerrada */
    }
    rmSync(carpeta, { recursive: true, force: true })
  }
}

/**
 * @returns {Promise<{ archivo: object, resumen: object[], advertencias: string[], fecha: string }>}
 */
export async function construirPagos(rutaMm, rutaExcel, opciones = {}) {
  const ahora = opciones.ahora ?? new Date()
  const ahoraIso = ahora.toISOString()
  const { backup, resumen: resumenMm } = await convertirMmbackup(rutaMm, {
    ahora,
  })
  const hoy = resumenMm.fecha
  const { accounts, categories } = backup.tables
  const cuentaPorNombre = new Map(accounts.map((a) => [a.name, a]))
  const categoriaPorNombre = new Map(
    categories.filter((c) => c.kind === 'expense').map((c) => [c.name, c]),
  )
  const cuentaPorId = new Map(accounts.map((a) => [a.id, a]))
  const categoriaPorId = new Map(categories.map((c) => [c.id, c]))
  const advertencias = []

  const fila = (clave, datos) => {
    const p = {
      id: uuidV5(clave),
      user_id: USER_MARCADOR,
      created_at: ahoraIso,
      updated_at: ahoraIso,
      deleted_at: null,
      second_day_of_month: null,
      interval_days: null,
      start_date: null,
      end_date: null,
      ...datos,
    }
    p.next_due_date = nextOccurrence(p, hoy)
    // Una compra a meses que ya no tiene pagos por venir queda terminada.
    p.active = p.next_due_date !== null
    if (!p.active)
      advertencias.push(
        `"${p.name}" ya no tiene pagos por venir (queda inactivo)`,
      )
    return Object.fromEntries(COLUMNS.recurring_payments.map((c) => [c, p[c]]))
  }

  const pagos = []
  // Del Excel
  const excel = leerExcel(rutaExcel)
  for (const e of excel) {
    const regla = REGLAS_EXCEL[e.gasto]
    if (!regla) throw new Error(`Gasto del Excel sin regla en §6: "${e.gasto}"`)
    let cuenta = null
    if (e.cuenta) {
      const nombre = CUENTAS_EXCEL[e.cuenta]
      cuenta = nombre ? cuentaPorNombre.get(nombre) : undefined
      if (!cuenta)
        throw new Error(`Cuenta del Excel sin equivalente: "${e.cuenta}"`)
    }
    const categoria = categoriaPorNombre.get(regla.categoria)
    if (!categoria)
      throw new Error(`No existe la categoría "${regla.categoria}"`)
    pagos.push(
      fila(`excel:${e.gasto}`, {
        name: e.gasto,
        kind: 'expense',
        amount_cents: centavos(e.importe),
        account_id: cuenta?.id ?? null,
        category_id: categoria.id,
        frequency: regla.frequency,
        day_of_month: regla.day ?? null,
        second_day_of_month: regla.segundo ?? null,
        start_date: regla.frequency === 'biweekly' ? hoy : null,
        auto_create: false,
      }),
    )
  }
  // De Money Manager
  const recordatorios = leerRecordatorios(rutaMm)
  for (const titulo of COMPRAS_MM) {
    const r = recordatorios.find((x) => x.title === titulo)
    if (!r) throw new Error(`No se encontró "${titulo}" en Money Manager`)
    const cuenta = r.cuentaUid ? cuentaPorId.get(uuidV5(r.cuentaUid)) : null
    if (!cuenta) throw new Error(`"${titulo}" no tiene cuenta viva en Saria`)
    const categoria = r.categoriaUid
      ? (categoriaPorId.get(uuidV5(r.categoriaUid)) ?? null)
      : null
    if (!categoria)
      advertencias.push(`"${titulo}" sin categoría viva (category_id = null)`)
    pagos.push(
      fila(r.uid, {
        name: r.title,
        kind: 'expense',
        amount_cents: r.amount,
        account_id: cuenta.id,
        category_id: categoria?.id ?? null,
        frequency: 'monthly',
        day_of_month: Number(r.startDate.slice(8, 10)),
        start_date: r.startDate,
        end_date: r.endDate,
        auto_create: true,
      }),
    )
  }

  const resumen = pagos.map((p) => ({
    name: p.name,
    amount_cents: p.amount_cents,
    cuenta: cuentaPorId.get(p.account_id)?.name ?? '(sin cuenta)',
    frequency: p.frequency,
    day_of_month: p.day_of_month,
    second_day_of_month: p.second_day_of_month,
    next_due_date: p.next_due_date,
    auto_create: p.auto_create,
  }))
  return {
    archivo: { format: FORMATO, version: 1, recurring_payments: pagos },
    resumen,
    advertencias,
    fecha: hoy,
  }
}

const pesos = (c) =>
  (c / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

function describirFrecuencia(r) {
  if (r.frequency === 'monthly') return `mensual, día ${r.day_of_month}`
  if (r.frequency === 'semimonthly')
    return `quincenal, días ${r.day_of_month} y ${r.second_day_of_month}`
  if (r.frequency === 'biweekly') return 'cada 2 semanas'
  return r.frequency
}

async function main() {
  const [rutaMm, rutaExcel] = process.argv.slice(2)
  if (!rutaMm || !rutaExcel || !existsSync(rutaMm) || !existsSync(rutaExcel)) {
    console.error(
      'Uso: node scripts/importar-pagos-habituales.mjs data/<archivo>.mmbackup "data/Gastos Personales.xlsx"',
    )
    process.exit(1)
  }
  const { archivo, resumen, advertencias, fecha } = await construirPagos(
    rutaMm,
    rutaExcel,
  )
  const salida = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'data',
    `saria-pagos-habituales-${fecha}.json`,
  )
  writeFileSync(salida, JSON.stringify(archivo))
  console.log(`Pagos habituales: ${resumen.length}\n`)
  for (const r of resumen)
    console.log(
      `  ${r.name.padEnd(24)} ${pesos(r.amount_cents).padStart(12)}  ${r.cuenta.padEnd(16)} ${describirFrecuencia(r).padEnd(24)} próximo: ${r.next_due_date ?? '—'}${r.auto_create ? '  (automático)' : ''}`,
    )
  console.log('\nAdvertencias:')
  if (advertencias.length === 0) console.log('  ninguna')
  for (const a of advertencias) console.log(`  - ${a}`)
  console.log(`\nArchivo generado: ${salida}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })
}
