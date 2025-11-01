-- Add extra analytics fields for WhatsApp click events
-- Safe idempotent additions
alter table if exists public.click_events
  add column if not exists open_mode text;

alter table if exists public.click_events
  add column if not exists app_opened_guess text check (app_opened_guess in ('likely','unlikely'));

alter table if exists public.click_events
  add column if not exists inserted_at timestamptz default now();

comment on column public.click_events.open_mode is 'api_mobile or web_desktop';
comment on column public.click_events.app_opened_guess is 'heuristic: likely/unlikely based on window blur after deep-link attempt';