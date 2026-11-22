import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { COLUMNS, type SyncedTableName } from './schema'

const dir = join(process.cwd(), 'supabase', 'migrations')
const files = existsSync(dir)
  ? readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
  : []
const sql = files.map((f) => readFileSync(join(dir, f), 'utf8')).join('\n')

const NON_COLUMN = /^(constraint|unique|check|primary|foreign)\b/i

function parseColumns(source: string): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  const createRe =
    /create table (?:if not exists )?public\.(\w+)\s*\(([\s\S]*?)\n\);/gi
  for (const m of source.matchAll(createRe)) {
    const cols = (result[m[1]] ??= [])
    for (const raw of m[2].split('\n')) {
      const line = raw.trim()
      if (!line || line.startsWith('--') || NON_COLUMN.test(line)) continue
      cols.push(line.split(/\s+/)[0].replace(/"/g, ''))
    }
  }
  const alterRe =
    /alter table public\.(\w+)\s+add column (?:if not exists )?"?(\w+)"?/gi
  for (const m of source.matchAll(alterRe)) {
    ;(result[m[1]] ??= []).push(m[2])
  }
  return result
}

const sqlColumns = parseColumns(sql)
const tables = Object.keys(COLUMNS) as SyncedTableName[]

describe('paridad Dexie <-> migraciones SQL', () => {
  it('hay al menos una migración', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('las tablas del SQL son exactamente las de schema.ts', () => {
    expect(Object.keys(sqlColumns).sort()).toEqual(Object.keys(COLUMNS).sort())
  })

  it.each(tables)('columnas de %s coinciden', (t) => {
    const sqlSet = new Set(sqlColumns[t] ?? [])
    const tsSet = new Set(COLUMNS[t])
    const missingInSql = [...tsSet].filter((c) => !sqlSet.has(c))
    const extraInSql = [...sqlSet].filter((c) => !tsSet.has(c))
    // Mensaje claro: lista las columnas que faltan o sobran en el SQL.
    expect(
      { table: t, missingInSql, extraInSql },
      `tabla ${t}: faltan en el SQL / sobran en el SQL`,
    ).toEqual({ table: t, missingInSql: [], extraInSql: [] })
    expect(sqlSet).toEqual(tsSet)
  })

  describe.each(tables)('%s', (t) => {
    it('habilita row level security', () => {
      expect(sql).toMatch(
        new RegExp(
          `alter table public\\.${t}\\s+enable row level security`,
          'i',
        ),
      )
    })

    it('tiene trigger set_updated_at', () => {
      expect(sql).toMatch(
        new RegExp(
          `create trigger \\w+\\s+before update on public\\.${t}\\s+for each row execute function public\\.set_updated_at\\(\\)`,
          'i',
        ),
      )
    })

    it('tiene índice sobre (user_id, updated_at)', () => {
      expect(sql).toMatch(
        new RegExp(
          `create index \\w+\\s+on public\\.${t}\\s*\\(user_id, updated_at\\)`,
          'i',
        ),
      )
    })
  })

  it('no define ninguna política for delete', () => {
    expect(sql).not.toMatch(/create policy[^;]*\bfor delete\b/i)
  })
})
