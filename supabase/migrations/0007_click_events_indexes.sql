-- Indexes to speed up analytics queries
create index if not exists click_events_product_id_inserted_at_idx
  on public.click_events using btree (product_id, inserted_at);

create index if not exists click_events_inserted_at_idx
  on public.click_events using btree (inserted_at);

create index if not exists click_events_open_mode_idx
  on public.click_events using btree (open_mode);

create index if not exists click_events_action_idx
  on public.click_events using btree (action);