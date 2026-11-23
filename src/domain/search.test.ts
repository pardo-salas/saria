import type { Account, Category, Transaction, Transfer } from '../db/schema'
import type { FeedEntry } from './feed'
import {
  EMPTY_FILTERS,
  PAGE_SIZE,
  feedTotals,
  filterFeed,
  matchesText,
  normalizeText,
  type Lookups,
} from './search'

const base = {
  user_id: 'u1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
}
let n = 0
const tx = (o: Partial<Transaction>): FeedEntry => ({
  type: 'transaction',
  row: {
    ...base,
    id: `t${n++}`,
    kind: 'expense',
    amount_cents: 100,
    date: '2026-11-21',
    account_id: 'a1',
    category_id: null,
    note: null,
    recurring_id: null,
    installment_plan_id: null,
    legacy_id: null,
    ...o,
  } satisfies Transaction,
})
const tr = (o: Partial<Transfer>): FeedEntry => ({
  type: 'transfer',
  row: {
    ...base,
    id: `r${n++}`,
    from_account_id: 'a1',
    to_account_id: 'a2',
    amount_cents: 100,
    date: '2026-11-21',
    note: null,
    legacy_id: null,
    ...o,
  } satisfies Transfer,
})
const acc = (id: string, name: string): Account =>
  ({ ...base, id, name }) as Account
const cat = (id: string, name: string): Category =>
  ({ ...base, id, name }) as Category

const lookups: Lookups = {
  accounts: new Map([
    ['a1', acc('a1', 'BBVA')],
    ['a2', acc('a2', 'NU')],
  ]),
  categories: new Map([['c1', cat('c1', 'Educación')]]),
}

describe('normalizeText', () => {
  it('quita acentos, minúsculas y colapsa espacios', () => {
    expect(normalizeText(' Educación  ')).toBe('educacion')
    expect(normalizeText('A   B')).toBe('a b')
  })
})

describe('matchesText', () => {
  it('encuentra la categoría sin acentos', () => {
    expect(matchesText(tx({ category_id: 'c1' }), 'educacion', lookups)).toBe(
      true,
    )
  })
  it('encuentra la nota sin distinguir mayúsculas', () => {
    expect(matchesText(tx({ note: 'tacos' }), 'TACOS', lookups)).toBe(true)
    expect(matchesText(tx({ note: 'tacos' }), 'pizza', lookups)).toBe(false)
  })
  it('encuentra montos con punto o coma', () => {
    const e = tx({ amount_cents: 18550 })
    expect(matchesText(e, '185.5', lookups)).toBe(true)
    expect(matchesText(e, '185,5', lookups)).toBe(true)
    expect(matchesText(e, '186', lookups)).toBe(false)
  })
  it('monto sin separador de miles', () => {
    expect(matchesText(tx({ amount_cents: 123456 }), '1234', lookups)).toBe(
      true,
    )
  })
  it('encuentra transferencias por nombre de cuenta', () => {
    expect(matchesText(tr({}), 'nu', lookups)).toBe(true)
    expect(matchesText(tr({}), 'bbva', lookups)).toBe(true)
  })
})

describe('filterFeed', () => {
  const nov = tx({ date: '2026-11-10', note: 'a' })
  const oct = tx({ date: '2026-10-10', note: 'a' })
  const feed = [nov, oct]

  it('sin filtros devuelve todo', () => {
    expect(filterFeed(feed, EMPTY_FILTERS, lookups)).toHaveLength(2)
  })
  it('month filtra por mes', () => {
    expect(
      filterFeed(feed, { ...EMPTY_FILTERS, month: '2026-11' }, lookups),
    ).toEqual([nov])
  })
  it('el texto ignora month y range', () => {
    const f = { ...EMPTY_FILTERS, text: 'a', month: '2026-11' }
    expect(filterFeed(feed, f, lookups)).toHaveLength(2)
  })
  it('range reemplaza a month y es inclusivo', () => {
    const f = {
      ...EMPTY_FILTERS,
      month: '2026-11',
      range: { from: '2026-10-10', to: '2026-10-10' },
    }
    expect(filterFeed(feed, f, lookups)).toEqual([oct])
  })
  it('kinds transfer solo transferencias', () => {
    const t = tr({})
    const r = filterFeed(
      [nov, t],
      { ...EMPTY_FILTERS, kinds: ['transfer'] },
      lookups,
    )
    expect(r).toEqual([t])
  })
  it('kinds expense/income por kind', () => {
    const inc = tx({ kind: 'income' })
    expect(
      filterFeed([nov, inc], { ...EMPTY_FILTERS, kinds: ['income'] }, lookups),
    ).toEqual([inc])
  })
  it('categoryIds excluye transferencias', () => {
    const c = tx({ category_id: 'c1' })
    const r = filterFeed(
      [c, nov, tr({})],
      { ...EMPTY_FILTERS, categoryIds: ['c1'] },
      lookups,
    )
    expect(r).toEqual([c])
  })
  it('accountIds incluye transferencia entrante', () => {
    const t = tr({ from_account_id: 'a1', to_account_id: 'a2' })
    const r = filterFeed([t], { ...EMPTY_FILTERS, accountIds: ['a2'] }, lookups)
    expect(r).toEqual([t])
    expect(
      filterFeed([t], { ...EMPTY_FILTERS, accountIds: ['a3'] }, lookups),
    ).toEqual([])
  })
})

describe('feedTotals', () => {
  it('ignora transferencias', () => {
    const r = feedTotals([
      tx({ kind: 'income', amount_cents: 1000 }),
      tx({ kind: 'expense', amount_cents: 300 }),
      tr({ amount_cents: 500 }),
    ])
    expect(r).toEqual({ incomeCents: 1000, expenseCents: 300, netCents: 700 })
  })
})

it('PAGE_SIZE es 100', () => {
  expect(PAGE_SIZE).toBe(100)
})
