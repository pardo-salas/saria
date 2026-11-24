-- Fase 4: categoría de cada compra a meses (los cargos mensuales la heredan).
alter table public.installment_plans add column category_id uuid references public.categories (id) deferrable initially deferred;

create index installment_plans_category_idx on public.installment_plans (category_id);
