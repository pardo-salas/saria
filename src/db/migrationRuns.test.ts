import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const dir = join(process.cwd(), 'supabase', 'migrations')
const USER_A = '00000000-0000-4000-8000-00000000000a'
const USER_B = '00000000-0000-4000-8000-00000000000b'

const stub = `
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema auth, public to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
insert into auth.users (id) values ('${USER_A}'), ('${USER_B}');
`

let db: PGlite

async function as(user: string) {
  await db.exec('reset role')
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [
    user,
  ])
  await db.exec('set role authenticated')
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(stub)
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  for (const f of files) await db.exec(readFileSync(join(dir, f), 'utf8'))
})

afterAll(async () => {
  await db.close()
})

afterEach(async () => {
  await db.exec('reset role')
})

const recent = (d: Date) => Date.now() - new Date(d).getTime() < 60_000

describe('la migración se ejecuta en Postgres (PGlite)', () => {
  it('RLS: cada usuario solo ve sus filas', async () => {
    await as(USER_A)
    await db.query(
      `insert into public.accounts (id, user_id, name, type)
       values (gen_random_uuid(), $1, 'Efectivo', 'cash')`,
      [USER_A],
    )
    const a = await db.query('select * from public.accounts')
    expect(a.rows).toHaveLength(1)
    await as(USER_B)
    const b = await db.query('select * from public.accounts')
    expect(b.rows).toHaveLength(0)
  })

  it('RLS: no permite insertar filas de otro usuario', async () => {
    await as(USER_B)
    await expect(
      db.query(
        `insert into public.accounts (id, user_id, name, type)
         values (gen_random_uuid(), $1, 'Ajena', 'cash')`,
        [USER_A],
      ),
    ).rejects.toThrow(/row-level security/i)
  })

  it('el trigger fija updated_at con la hora del servidor al insertar', async () => {
    await as(USER_A)
    const r = await db.query<{ updated_at: Date }>(
      `insert into public.categories (id, name, kind, updated_at)
       values (gen_random_uuid(), 'Comida', 'expense', '2020-01-01T00:00:00Z')
       returning updated_at`,
    )
    expect(recent(r.rows[0].updated_at)).toBe(true)
  })

  it('el trigger fija updated_at con la hora del servidor al actualizar', async () => {
    await as(USER_A)
    await db.query(
      `update public.categories set updated_at = '2020-01-01T00:00:00Z', name = 'Comida 2'`,
    )
    const r = await db.query<{ updated_at: Date }>(
      'select updated_at from public.categories',
    )
    expect(recent(r.rows[0].updated_at)).toBe(true)
  })

  it('delete como authenticated falla o no borra filas', async () => {
    await as(USER_A)
    let deleted = 0
    try {
      const r = await db.query('delete from public.accounts')
      deleted = r.affectedRows ?? 0
    } catch (e) {
      expect(String(e)).toMatch(/permission denied/i)
    }
    expect(deleted).toBe(0)
    await db.exec('reset role')
    const r = await db.query('select * from public.accounts')
    expect(r.rows).toHaveLength(1)
  })

  it('settings exige id = user_id', async () => {
    await as(USER_A)
    await expect(
      db.query(
        `insert into public.settings (id, user_id) values (gen_random_uuid(), $1)`,
        [USER_A],
      ),
    ).rejects.toThrow(/settings_id_is_user_id/)
    await db.query(
      `insert into public.settings (id, user_id) values ($1, $1)`,
      [USER_A],
    )
  })
})
