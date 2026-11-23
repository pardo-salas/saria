-- Saria, migración inicial (Fase 0).
-- Debe coincidir con src/db/schema.ts (la prueba schemaParity.test.ts lo verifica).
-- Borrado lógico: no existe política de delete; el cliente solo marca deleted_at.

-- ---------------------------------------------------------------------------
-- Función compartida: updated_at con la hora del servidor.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
create table public.accounts (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  name text not null,
  type text not null,
  institution text,
  color text,
  icon text,
  initial_balance_cents bigint not null default 0,
  include_in_total boolean not null default true,
  archived boolean not null default false,
  position integer not null default 0,
  credit_limit_cents bigint,
  statement_day integer,
  due_day integer,
  yield_rate numeric(7,4),
  yield_cap_cents bigint,
  yield_rate_over_cap numeric(7,4),
  constraint accounts_type_check check (type in ('cash', 'debit', 'credit', 'investment')),
  constraint accounts_credit_limit_check check (credit_limit_cents is null or credit_limit_cents >= 0),
  constraint accounts_statement_day_check check (statement_day is null or statement_day between 1 and 31),
  constraint accounts_due_day_check check (due_day is null or due_day between 1 and 31),
  constraint accounts_yield_cap_check check (yield_cap_cents is null or yield_cap_cents >= 0)
);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  name text not null,
  kind text not null,
  icon text,
  color text,
  monthly_limit_cents bigint,
  archived boolean not null default false,
  position integer not null default 0,
  constraint categories_kind_check check (kind in ('income', 'expense')),
  constraint categories_monthly_limit_check check (monthly_limit_cents is null or monthly_limit_cents >= 0)
);

-- ---------------------------------------------------------------------------
-- installment_plans
-- ---------------------------------------------------------------------------
create table public.installment_plans (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  concept text not null,
  account_id uuid,
  purchase_date date not null,
  total_cents bigint not null,
  months integer not null,
  monthly_cents bigint not null,
  paid_months integer not null default 0,
  active boolean not null default true,
  constraint installment_plans_account_fk foreign key (account_id) references public.accounts (id) deferrable initially deferred,
  constraint installment_plans_total_check check (total_cents > 0),
  constraint installment_plans_months_check check (months > 0),
  constraint installment_plans_monthly_check check (monthly_cents > 0),
  constraint installment_plans_paid_check check (paid_months between 0 and months)
);

-- ---------------------------------------------------------------------------
-- recurring_payments
-- ---------------------------------------------------------------------------
create table public.recurring_payments (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  name text not null,
  kind text not null,
  amount_cents bigint not null,
  account_id uuid,
  category_id uuid,
  frequency text not null,
  day_of_month integer,
  second_day_of_month integer,
  interval_days integer,
  start_date date,
  end_date date,
  next_due_date date,
  auto_create boolean not null default false,
  active boolean not null default true,
  constraint recurring_payments_account_fk foreign key (account_id) references public.accounts (id) deferrable initially deferred,
  constraint recurring_payments_category_fk foreign key (category_id) references public.categories (id) deferrable initially deferred,
  constraint recurring_payments_kind_check check (kind in ('income', 'expense')),
  constraint recurring_payments_amount_check check (amount_cents > 0),
  constraint recurring_payments_frequency_check check (frequency in ('daily', 'weekly', 'biweekly', 'semimonthly', 'monthly', 'yearly', 'custom')),
  constraint recurring_payments_day_check check (day_of_month is null or day_of_month between 1 and 31),
  constraint recurring_payments_second_day_check check (second_day_of_month is null or second_day_of_month between 1 and 31),
  constraint recurring_payments_interval_check check (interval_days is null or interval_days > 0)
);

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  kind text not null,
  amount_cents bigint not null,
  date date not null,
  account_id uuid not null,
  category_id uuid,
  note text,
  recurring_id uuid,
  installment_plan_id uuid,
  legacy_id text,
  constraint transactions_account_fk foreign key (account_id) references public.accounts (id) deferrable initially deferred,
  constraint transactions_category_fk foreign key (category_id) references public.categories (id) deferrable initially deferred,
  constraint transactions_recurring_fk foreign key (recurring_id) references public.recurring_payments (id) deferrable initially deferred,
  constraint transactions_installment_plan_fk foreign key (installment_plan_id) references public.installment_plans (id) deferrable initially deferred,
  constraint transactions_kind_check check (kind in ('income', 'expense')),
  constraint transactions_amount_check check (amount_cents > 0)
);

-- ---------------------------------------------------------------------------
-- transfers
-- ---------------------------------------------------------------------------
create table public.transfers (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  from_account_id uuid not null,
  to_account_id uuid not null,
  amount_cents bigint not null,
  date date not null,
  note text,
  legacy_id text,
  constraint transfers_from_account_fk foreign key (from_account_id) references public.accounts (id) deferrable initially deferred,
  constraint transfers_to_account_fk foreign key (to_account_id) references public.accounts (id) deferrable initially deferred,
  constraint transfers_amount_check check (amount_cents > 0)
);

-- ---------------------------------------------------------------------------
-- reminders
-- ---------------------------------------------------------------------------
create table public.reminders (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  title text not null,
  text text,
  time time,
  frequency text,
  second_day_of_month integer,
  interval_days integer,
  start_date date,
  enabled boolean not null default true,
  recurring_id uuid,
  constraint reminders_recurring_fk foreign key (recurring_id) references public.recurring_payments (id) deferrable initially deferred,
  constraint reminders_frequency_check check (frequency is null or frequency in ('daily', 'weekly', 'biweekly', 'semimonthly', 'monthly', 'yearly', 'custom')),
  constraint reminders_second_day_check check (second_day_of_month is null or second_day_of_month between 1 and 31),
  constraint reminders_interval_check check (interval_days is null or interval_days > 0)
);

-- ---------------------------------------------------------------------------
-- settings: una fila por usuario, con id = user_id.
-- ---------------------------------------------------------------------------
create table public.settings (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  monthly_income_cents bigint,
  pay_frequency text,
  currency text not null default 'MXN',
  theme text not null default 'system',
  constraint settings_id_is_user_id check (id = user_id),
  unique (user_id),
  constraint settings_income_check check (monthly_income_cents is null or monthly_income_cents >= 0),
  constraint settings_pay_frequency_check check (pay_frequency is null or pay_frequency in ('monthly', 'semimonthly', 'biweekly')),
  constraint settings_currency_check check (currency in ('MXN')),
  constraint settings_theme_check check (theme in ('system', 'light', 'dark'))
);

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------
create trigger accounts_set_updated_at
  before insert or update on public.accounts
  for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
  before insert or update on public.categories
  for each row execute function public.set_updated_at();

create trigger installment_plans_set_updated_at
  before insert or update on public.installment_plans
  for each row execute function public.set_updated_at();

create trigger recurring_payments_set_updated_at
  before insert or update on public.recurring_payments
  for each row execute function public.set_updated_at();

create trigger transactions_set_updated_at
  before insert or update on public.transactions
  for each row execute function public.set_updated_at();

create trigger transfers_set_updated_at
  before insert or update on public.transfers
  for each row execute function public.set_updated_at();

create trigger reminders_set_updated_at
  before insert or update on public.reminders
  for each row execute function public.set_updated_at();

create trigger settings_set_updated_at
  before insert or update on public.settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------
create index accounts_user_updated_idx on public.accounts (user_id, updated_at);
create index categories_user_updated_idx on public.categories (user_id, updated_at);
create index installment_plans_user_updated_idx on public.installment_plans (user_id, updated_at);
create index recurring_payments_user_updated_idx on public.recurring_payments (user_id, updated_at);
create index transactions_user_updated_idx on public.transactions (user_id, updated_at);
create index transfers_user_updated_idx on public.transfers (user_id, updated_at);
create index reminders_user_updated_idx on public.reminders (user_id, updated_at);
create index settings_user_updated_idx on public.settings (user_id, updated_at);

create index transactions_user_date_idx on public.transactions (user_id, date);
create index transactions_account_idx on public.transactions (account_id);
create index transactions_category_idx on public.transactions (category_id);
create index transfers_user_date_idx on public.transfers (user_id, date);
create index transfers_from_account_idx on public.transfers (from_account_id);
create index transfers_to_account_idx on public.transfers (to_account_id);
create index installment_plans_account_idx on public.installment_plans (account_id);
create index recurring_payments_account_idx on public.recurring_payments (account_id);
create index recurring_payments_category_idx on public.recurring_payments (category_id);
create index transactions_recurring_idx on public.transactions (recurring_id);
create index transactions_installment_plan_idx on public.transactions (installment_plan_id);
create index reminders_recurring_idx on public.reminders (recurring_id);

create unique index transactions_user_legacy_uidx on public.transactions (user_id, legacy_id) where legacy_id is not null;
create unique index transfers_user_legacy_uidx on public.transfers (user_id, legacy_id) where legacy_id is not null;

-- ---------------------------------------------------------------------------
-- Row level security: solo select, insert y update; sin delete.
-- ---------------------------------------------------------------------------
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.installment_plans enable row level security;
alter table public.recurring_payments enable row level security;
alter table public.transactions enable row level security;
alter table public.transfers enable row level security;
alter table public.reminders enable row level security;
alter table public.settings enable row level security;

create policy accounts_select on public.accounts for select to authenticated using (user_id = (select auth.uid()));
create policy accounts_insert on public.accounts for insert to authenticated with check (user_id = (select auth.uid()));
create policy accounts_update on public.accounts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy categories_select on public.categories for select to authenticated using (user_id = (select auth.uid()));
create policy categories_insert on public.categories for insert to authenticated with check (user_id = (select auth.uid()));
create policy categories_update on public.categories for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy installment_plans_select on public.installment_plans for select to authenticated using (user_id = (select auth.uid()));
create policy installment_plans_insert on public.installment_plans for insert to authenticated with check (user_id = (select auth.uid()));
create policy installment_plans_update on public.installment_plans for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy recurring_payments_select on public.recurring_payments for select to authenticated using (user_id = (select auth.uid()));
create policy recurring_payments_insert on public.recurring_payments for insert to authenticated with check (user_id = (select auth.uid()));
create policy recurring_payments_update on public.recurring_payments for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy transactions_select on public.transactions for select to authenticated using (user_id = (select auth.uid()));
create policy transactions_insert on public.transactions for insert to authenticated with check (user_id = (select auth.uid()));
create policy transactions_update on public.transactions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy transfers_select on public.transfers for select to authenticated using (user_id = (select auth.uid()));
create policy transfers_insert on public.transfers for insert to authenticated with check (user_id = (select auth.uid()));
create policy transfers_update on public.transfers for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy reminders_select on public.reminders for select to authenticated using (user_id = (select auth.uid()));
create policy reminders_insert on public.reminders for insert to authenticated with check (user_id = (select auth.uid()));
create policy reminders_update on public.reminders for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy settings_select on public.settings for select to authenticated using (user_id = (select auth.uid()));
create policy settings_insert on public.settings for insert to authenticated with check (user_id = (select auth.uid()));
create policy settings_update on public.settings for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Refuerzo: el borrado físico queda bloqueado desde el cliente.
revoke delete on public.accounts from anon, authenticated;
revoke delete on public.categories from anon, authenticated;
revoke delete on public.installment_plans from anon, authenticated;
revoke delete on public.recurring_payments from anon, authenticated;
revoke delete on public.transactions from anon, authenticated;
revoke delete on public.transfers from anon, authenticated;
revoke delete on public.reminders from anon, authenticated;
revoke delete on public.settings from anon, authenticated;

-- Privilegios explícitos (Supabase ya los concede por defecto; no incluye delete).
grant select, insert, update on public.accounts to authenticated;
grant select, insert, update on public.categories to authenticated;
grant select, insert, update on public.installment_plans to authenticated;
grant select, insert, update on public.recurring_payments to authenticated;
grant select, insert, update on public.transactions to authenticated;
grant select, insert, update on public.transfers to authenticated;
grant select, insert, update on public.reminders to authenticated;
grant select, insert, update on public.settings to authenticated;
