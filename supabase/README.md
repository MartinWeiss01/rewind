# Database

SQL migrations for Rewind's tables. They work on any Supabase project; nothing here names one.

```bash
# Apply pending migrations to the database in DATABASE_URL
pnpm db:push
# Regenerate TypeScript types (only rewind_* tables are kept)
pnpm db:types
```

Both read `DATABASE_URL` from the environment (load `.env.local` into the shell first).
