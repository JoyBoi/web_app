-- Normalize existing categories to allowed set: fashion | beauty | footwear
update products
set category = 'beauty'
where lower(coalesce(category, '')) ~ '^(beauty|cosmetics|skincare|makeup|personal care)$'
   or lower(coalesce(category, '')) ~ '(cosmetic|skin|make ?up|care)';

update products
set category = 'footwear'
where lower(coalesce(category, '')) ~ '^(footwear|shoes|sneakers|sandals|boots)$';

update products
set category = 'fashion'
where category is null
   or lower(category) ~ '^(fashion|clothing|apparel|men|women|kids)$'
   or lower(category) ~ '(fashion|clothes|apparel|wear)';

-- Default any remaining non-allowed values to 'fashion'
update products
set category = 'fashion'
where lower(coalesce(category, '')) not in ('fashion','beauty','footwear');

-- Add CHECK constraint enforcing allowed categories
alter table products
  add constraint products_category_allowed
  check (category in ('fashion','beauty','footwear'));

-- Enable RLS and add read policies (anon/authenticated) on products
alter table products enable row level security;

create policy anon_read_active_products on products
for select
to anon
using (active = true);

create policy auth_read_active_products on products
for select
to authenticated
using (active = true);

-- product_images: enable RLS and allow read only when parent product is active
alter table product_images enable row level security;

create policy anon_read_active_images on product_images
for select
to anon
using (
  exists (
    select 1 from products p
    where p.id = product_images.product_id
      and p.active = true
  )
);

create policy auth_read_active_images on product_images
for select
to authenticated
using (
  exists (
    select 1 from products p
    where p.id = product_images.product_id
      and p.active = true
  )
);