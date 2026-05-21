-- Add branding columns to clinics table.
-- logo_url   — public URL for the clinic logo (PNG/SVG)
-- primary_color — hex color used in patient portal and scheduling page

alter table clinics
  add column if not exists logo_url     text default null,
  add column if not exists primary_color text default null;
