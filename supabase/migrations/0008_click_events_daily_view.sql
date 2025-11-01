-- Daily aggregation view for WhatsApp click analytics
create or replace view public.click_events_daily_v as
select
  date_trunc('day', inserted_at)::date as day,
  product_id,
  coalesce(open_mode, 'unknown') as open_mode,
  coalesce(app_opened_guess, 'unknown') as app_opened_guess,
  count(*)::bigint as clicks
from public.click_events
where action = 'whatsapp_click'
group by 1,2,3,4;

comment on view public.click_events_daily_v is 'Aggregated daily clicks per product with mode and app-open heuristic';