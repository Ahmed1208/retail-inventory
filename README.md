# StockPilot — Retail Inventory

Retail inventory management system with bilingual support (English / Arabic), RTL layout, and full CRUD for products, categories, brands, stock movements, and orders.

## Tech stack

- **React** + **TypeScript** + **Vite**
- **Supabase** (backend)
- **Tailwind CSS** + **shadcn/ui**
- **TanStack Query** (server state), **React Router** (routing)
- **i18next** (Arabic/English, RTL/LTR)
- **React Hook Form** + **Zod** (forms and validation)
- **Recharts** (reports), **Sonner** (toasts)

## Required environment variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL (local or cloud, depending on mode) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous (public) key |

All app env vars must use the `VITE_` prefix so Vite exposes them to the client.

### Local vs cloud (no comment/uncomment in `.env.local`)

Vite **modes** pick which file supplies `VITE_SUPABASE_*`:

| Command | Mode | Source |
|---------|------|--------|
| `npm run dev` or `npm run dev:local` | `development` | [`.env.development`](.env.development) (local defaults + optional sync keys) and optional **`.env.development.local`** (gitignored overrides) |
| `npm run dev:cloud` | `cloud` | **`.env.cloud.local`** only (gitignored; copy from [`.env.cloud.example`](.env.cloud.example)) |

**Important:** Do **not** set `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` in root **`.env.local`**. Vite always loads `.env.local` in every mode, and those entries would **override** the mode files, so local/cloud switching would stop working. Use **`.env.local`** only for non-Vite tooling (for example `SUPABASE_DB_PASSWORD` / `DATABASE_URL` for [`npm run db:push:local`](./scripts/db-push-from-env.mjs)).

If local Supabase rejects the default anon key (CLI version differences), run `npx supabase status -o env` and update **`VITE_SUPABASE_*`** in [`.env.development`](.env.development) or in **`.env.development.local`**.

### Admin data sync (local ↔ hosted)

When the app points at **local** Supabase (`npm run dev`), **Admin → Data sync** (`/admin/sync`) can merge **public** business tables with a **hosted** project in both directions (new/updated rows).

**Hosted credentials** (pick one):

1. **`VITE_SYNC_CLOUD_URL`** and **`VITE_SYNC_CLOUD_ANON_KEY`** in [`.env.development`](.env.development) or **`.env.development.local`**, or  
2. The same **`VITE_SUPABASE_URL`** / **`VITE_SUPABASE_ANON_KEY`** you keep in **`.env.cloud.local`** for `npm run dev:cloud` — Vite merges that file into `development` for sync only (restart **`npm run dev`** after changing env files).

Then sign in on the sync page with a **hosted** Supabase user that is allowed by **RLS** to read and upsert those tables (no service role in the browser).

**Operator profiles (`public.profiles`)**: sync copies profile rows only when `auth.users` on the **target** database already has the same user id (see RPC `upsert_profile_for_data_sync`). If Auth is missing on the target, the app calls the Edge Function **`ensure-local-operator-auth`** on **that** project (using your session’s JWT against local or hosted): it creates `auth.users` with the **same id** as the source row, then the profile RPC succeeds. Use this when **pulling** from host → local *or* **pushing** from local → host after creating a member only on one side. New mirrored users sign in with **`{username}@members.stockpilot.local`** and the function’s temp password (`OPERATOR_MIRROR_TEMP_PASSWORD` secret on that project, min 8 chars; default **`devpass123`** when unset locally). Deploy the function on **each** Supabase project: [`supabase/functions/ensure-local-operator-auth`](./supabase/functions/ensure-local-operator-auth) — **`npx supabase start`** picks it up locally, or **`supabase functions deploy ensure-local-operator-auth`** on hosted (set `OPERATOR_MIRROR_TEMP_PASSWORD` in hosted function secrets if you do not use the default). Hosted passwords are never copied between environments.

Multi-table sync is best-effort across HTTP (not one giant SQL transaction).

#### Mirror hosted Auth onto local (optional, dev)

To **replace all local Auth users** with the same ids as on the hosted project (so profile sync applies every operator), use the **service role** script (run on your machine only; keys stay in a gitignored env file):

1. Copy [`.env.example`](.env.example) → **`.env.mirror-auth.local`** and set `MIRROR_CLOUD_*`, `MIRROR_LOCAL_*`, and optionally `MIRROR_LOCAL_PASSWORD` (default `devpass123`).
2. `npm run mirror:cloud-auth-to-local -- --dry-run` — lists counts only.
3. `I_CONFIRM_WIPE_LOCAL_AUTH=YES npm run mirror:cloud-auth-to-local` — deletes **every** local Auth user, then recreates users from the host with the **same ids**. Hosted passwords are **not** copied; everyone gets `MIRROR_LOCAL_PASSWORD`.
4. Run **Admin → Data sync** once to refresh `profiles` and business tables from cloud.

See comments at the top of [`scripts/mirror-cloud-auth-to-local.mjs`](./scripts/mirror-cloud-auth-to-local.mjs) for details.

## Database setup

### First time setup

1. Create a new Supabase project at [https://supabase.com](https://supabase.com).
2. Go to **Supabase → SQL Editor**.
3. Run the migration files **in order**:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/supabase-purchase-orders.sql` (if present)
   - `supabase/migrations/002_order_payments.sql`  
   (Always run in numerical order; never skip a file.)

### Adding new migrations

- **Never modify existing migration files.**
- Always add a **new numbered file** for schema changes (e.g. `003_add_suppliers.sql`).
- Run the new file in the Supabase SQL Editor.
- Commit the new migration file to the repo.

### Migration naming convention

- Format: `NNN_description.sql`
- Examples: `001_initial_schema.sql`, `002_add_purchase_orders.sql`, `003_add_suppliers_table.sql`

### Important rules

- **Never edit a migration file that has already been run in production.**
- Always test migrations on a fresh Supabase project before running in production.
- Keep migration files in the repo — they are the **source of truth** for the database schema.
- To undo something, **create a new migration** that reverses it; do not delete or edit old migrations.

## Local setup

1. **Clone the repo**

   ```bash
   git clone <repo-url>
   cd retail-inventory
   ```

2. **Set up the database**

   **Local (Docker):** use `npx supabase db reset` in step 4 — migrations and [`supabase/seed.sql`](./supabase/seed.sql) run automatically.  
   **Hosted Supabase:** follow [Database setup](#database-setup): create a project and run migration SQL in order (or `supabase db push` when linked).

3. **Install dependencies**

   ```bash
   npm install
   ```

4. **Configure environment**

   Read [`.env.example`](.env.example) for the full layout.

   - **Local Supabase:** install [Docker](https://docs.docker.com/get-docker/) and run `npx supabase start`. Then run **`npm run dev`** — settings come from [`.env.development`](.env.development) (and optional **`.env.development.local`** for overrides).
   - **Hosted Supabase while developing:** copy [`.env.cloud.example`](.env.cloud.example) to **`.env.cloud.local`** and set your project URL and anon key. Run **`npm run dev:cloud`**.
   - **Pushing migrations to hosted DB:** keep `SUPABASE_DB_PASSWORD` or `DATABASE_URL` in **`.env.local`** (see `.env.example`); that file is **not** used for Vite `VITE_*` switching.

   **Migrating from an old setup:** if you previously put `VITE_SUPABASE_*` in `.env.local`, **remove those two lines** from `.env.local` and put cloud values in **`.env.cloud.local`** instead so `npm run dev` / `npm run dev:cloud` work as intended.

   **Operators (Auth + profiles)** — after migration `034_operator_profiles.sql`:

   - Run **`npx supabase db reset`** (migrations + [`supabase/seed.sql`](./supabase/seed.sql)). Seeding is enabled in [`supabase/config.toml`](./supabase/config.toml); it creates a **local dev admin** you can use immediately:
     - **Username:** `admin` (the login screen maps this to `admin@members.stockpilot.local`)
     - **Password:** `devpass123` (local Supabase only — change it in **Authentication → Users** if you share the stack)
   - If login still fails while cloud works, run **`npm run verify:local-login`** (uses the same `VITE_SUPABASE_*` as `npm run dev`). It confirms GoTrue + seed; if it fails, reset the DB or align keys from **`npx supabase status -o env`**. Use **`npm run dev`** for local, not **`npm run dev:cloud`**.
   - **Bootstrap admin manually (optional):** If you prefer not to use the seed, add a user in **Authentication → Users** with email `admin@members.stockpilot.local`, set a password, and in **User metadata** set JSON such as `{ "username": "admin", "is_admin": true }`. A trigger creates the `public.profiles` row. Do not put passwords in `VITE_*` or client code.
   - **Additional members:** Admins use **Admin → Members → Add member** in the app, which calls the **`create-member`** Edge Function. **Edit member → Update password** uses **`update-member`**. Deploy with `supabase functions deploy create-member` and `supabase functions deploy update-member`, and ensure the project has the **service role** secret available to Edge Functions (default when linked). Never expose the service role key to the browser.

5. **Run the dev server**

   ```bash
   npm run dev          # local Supabase (see table above)
   npm run dev:cloud    # hosted Supabase — requires .env.cloud.local
   ```

## Build

```bash
npm run build
```

Output is in `dist/`. Preview with `npm run preview`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server against **local** Supabase ([`.env.development`](.env.development)) |
| `npm run dev:local` | Same as `dev` |
| `npm run dev:cloud` | Dev server against **hosted** Supabase (`.env.cloud.local`) |
| Admin **Data sync** | `/admin/sync` — local `VITE_SUPABASE_*` plus hosted `VITE_SYNC_CLOUD_*` in `.env.development` or `.env.development.local`, or hosted pair merged from `.env.cloud.local` (see above) |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

## Branching strategy

We use a simple Git workflow with `master`, `develop`, and short-lived feature/fix branches. See **[BRANCHES.md](./BRANCHES.md)** for the full branching strategy and daily workflow.

## Deployment (Vercel)

- `vercel.json` is set up so all routes rewrite to `/index.html` for client-side routing.
- Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your Vercel project environment (production mode does not read `.env.cloud.local`).
- For a **local** production build (`npm run build` on your machine), use gitignored **`.env.production.local`** with the same two variables, or export them in the shell before `npm run build`.
- Production deploys from `master` are done manually.

## License

Private.
