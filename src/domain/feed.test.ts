import type { Transaction, Transfer } from '../db/schema'
import {
  buildFeed,
  entriesForAccount,
  groupByDay,
  signedAmount,
  type FeedEntry,
} from './feed'

const base = {
  user_id: 'u1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
}
let n = 0
const tx = (o: Partial<Transaction>): Transaction => ({
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
})
const tr = (o: Partial<Transfer>): Transfer => ({
  ...base,
  id: `r${n++}`,
  from_account_id: 'a1',
  to_account_id: 'a2',
  amount_cents: 100,
  date: '2026-11-21',
  note: null,
  legacy_id: null,
  ...o,
})

describe('buildFeed', () => {
  it('ordena por fecha desc y luego created_at desc', () => {
    const a = tx({ id: 'a', date: '2026-11-20' })
    const b = tx({ id: 'b', date: '2026-11-22' })
    const c = tr({
      id: 'c',
      date: '2026-11-22',
      created_at: '2026-01-02T00:00:00Z',
    })
    const ids = buildFeed([a, b], [c]).map((e) => e.row.id)
    expect(ids).toEqual(['c', 'b', 'a'])
  })
})

describe('signedAmount', () => {
  it('movimientos y transferencias', () => {
    const inc: FeedEntry = {
      type: 'transaction',
      row: tx({ kind: 'income', amount_cents: 500 }),
    }
    const exp: FeedEntry = {
      type: 'transaction',
      row: tx({ kind: 'expense', amount_cents: 320 }),
    }
    const t: FeedEntry = { type: 'transfer', row: tr({ amount_cents: 1000 }) }
    expect(signedAmount(inc)).toBe(500)
    expect(signedAmount(exp)).toBe(-320)
    expect(signedAmount(t, 'a1')).toBe(-1000)
    expect(signedAmount(t, 'a2')).toBe(1000)
    expect(signedAmount(t)).toBe(0)
  })
})

describe('entriesForAccount', () => {
  it('incluye transferencias como origen y como destino', () => {
    const feed = buildFeed(
      [tx({ id: 'm1', account_id: 'a1' }), tx({ id: 'm2', account_id: 'a2' })],
      [
        tr({ id: 'o', from_account_id: 'a1', to_account_id: 'a3' }),
        tr({ id: 'd', from_account_id: 'a3', to_account_id: 'a1' }),
        tr({ id: 'x', from_account_id: 'a2', to_account_id: 'a3' }),
      ],
    )
    const ids = entriesForAccount(feed, 'a1').map((e) => e.row.id)
    expect(ids.sort()).toEqual(['d', 'm1', 'o'])
  })
})

describe('groupByDay', () => {
  const feed = buildFeed(
    [
      tx({ kind: 'income', amount_cents: 500, date: '2026-11-21' }),
      tx({ kind: 'expense', amount_cents: 320, date: '2026-11-21' }),
      tx({ kind: 'expense', amount_cents: 18550, date: '2026-11-22' }),
    ],
    [tr({ amount_cents: 200000, date: '2026-11-22' })],
  )

  it('calcula neto y saldo al cierre por día', () => {
    const g = groupByDay(feed, { accountId: 'a1', openingBalanceCents: 0 })
    expect(g.map((d) => d.date)).toEqual(['2026-11-22', '2026-11-21'])
    expect(g.map((d) => d.netCents)).toEqual([-218550, 180])
    expect(g.map((d) => d.closingBalanceCents)).toEqual([-218370, 180])
  })

  it('usa fullFeed para el saldo aunque feed venga filtrado', () => {
    const filtered = feed.filter((e) => e.type === 'transfer')
    const g = groupByDay(filtered, {
      accountId: 'a1',
      openingBalanceCents: 0,
      fullFeed: feed,
    })
    expect(g).toHaveLength(1)
    expect(g[0]?.netCents).toBe(-200000)
    expect(g[0]?.closingBalanceCents).toBe(-218370)
  })

  it('sin cuenta o saldo inicial, cierre nulo', () => {
    const g = groupByDay(feed)
    expect(g.every((d) => d.closingBalanceCents === null)).toBe(true)
  })
})
