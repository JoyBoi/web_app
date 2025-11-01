-- Create product_images table to support multiple images per product
-- Uses ON DELETE CASCADE to remove images when a product is deleted

begin;

create table if not exists public.product_images (
  id bigserial primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  url text not null,
  display_order int not null default 0,
  alt_text text,
  inserted_at timestamptz default now()
);

-- Helpful indexes
create index if not exists product_images_product_id_idx on public.product_images(product_id);
create index if not exists product_images_product_id_display_idx on public.product_images(product_id, display_order);

-- Enable RLS and allow anonymous read-only access (to support SSG build fetching)
alter table public.product_images enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'product_images' and policyname = 'Anon read product_images'
  ) then
    create policy "Anon read product_images" on public.product_images
      for select
      to anon
      using (true);
  end if;
end $$;

commit;