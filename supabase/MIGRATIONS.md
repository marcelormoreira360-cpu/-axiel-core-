# Database Migrations

## Directory structure

| Directory | Purpose |
|---|---|
| `migrations/` | **Active migrations** — these are the canonical set applied to all environments |
| `migrations_archive/` | Historical archive — pre-refactor migrations (001–052). Do NOT re-apply. |

## Applying migrations

### Local development
```bash
supabase db reset          # Reset and apply all migrations from scratch
supabase db push           # Apply pending migrations to linked project
```

### Production (Vercel / Supabase Cloud)
Migrations are NOT applied automatically on deploy.

To apply a new migration in production:
1. Create the migration: `supabase migration new <name>`
2. Write the SQL in `supabase/migrations/<timestamp>_<name>.sql`
3. Apply: `supabase db push --linked`

## RLS tests

Run the RLS test suite before any schema changes:
```bash
npm run test:rls
```

Test files: `supabase/tests/01_rls_clinic_isolation.test.sql`, `02_rls_portal_tokens.test.sql`

## Naming convention

Files: `<timestamp>_<verb>_<subject>.sql`  
Examples: `20260101_add_patients_status.sql`, `20260215_create_repasse_ledger.sql`
