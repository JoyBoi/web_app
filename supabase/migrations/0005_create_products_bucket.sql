-- Create 'products' storage bucket (public)
do $$
begin
  if not exists (
    select 1 from storage.buckets where name = 'products'
  ) then
    perform storage.create_bucket('products', public => true);
  end if;
end $$;