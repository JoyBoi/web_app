-- products schema
create table if not exists public.products (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  price numeric(10,2) not null,
  category text,
  image_url text,
  whatsapp_number text,
  active boolean default true,
  inserted_at timestamptz default now()
);

create index if not exists products_active_idx on public.products (active);
create index if not exists products_category_idx on public.products (category);

-- RLS
alter table public.products enable row level security;

-- Allow anon/public read only if active
create policy if not exists "anon can read active products"
  on public.products
  for select
  to public
  using (active = true);