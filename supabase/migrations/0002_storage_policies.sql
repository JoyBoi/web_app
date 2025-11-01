-- Public read on product images in 'products' bucket
create policy if not exists "public read products bucket" on storage.objects
for select to public
using (bucket_id = 'products');