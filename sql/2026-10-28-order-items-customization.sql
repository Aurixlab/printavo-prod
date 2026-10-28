-- Personalized webstore items (lib/webstore-customization).
-- Run once in Supabase (SQL editor, project "Budget Promotion Webstore Integration")
-- BEFORE deploying the code that writes these columns.
-- Additive only: three empty, nullable columns; existing rows are not changed.
alter table public.order_items
  add column if not exists customization text,   -- e.g. "Text + Number"
  add column if not exists custom_text text,     -- "Custom Text" line item property
  add column if not exists custom_number text;   -- "Custom Number" line item property
