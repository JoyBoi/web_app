create table if not exists public.deploy_logs (
  id bigserial primary key,
  inserted_at timestamptz default now(),
  op text,
  product_id bigint,
  status text,
  details jsonb
);

create index if not exists deploy_logs_inserted_at_idx on public.deploy_logs (inserted_at desc);