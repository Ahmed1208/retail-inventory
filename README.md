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

## Run the project locally

### Prerequisites

- **Node.js** (LTS recommended) and **npm**
- **Docker Desktop** (running) — required for local Supabase
- **Supabase CLI** — use `npx supabase …` from the repo (no global install required)

### Steps

Three commands, on any machine, from nothing:

```bash
git clone <repo-url>
cd retail-inventory
npm install
npm run dev
```

That is the whole setup. **There is nothing to fill in by hand and no file to copy from anyone else** — `npm run dev` runs [`scripts/stack-up.mjs`](./scripts/stack-up.mjs), which does everything the first time and almost nothing afterwards:

| Step | First run | Later runs |
|------|-----------|------------|
| Generate the root **`.env`** (own Compose project name, own free ports, freshly generated secrets) and **`.env.local`** for the SPA | created | left alone |
| `docker compose up -d` — Postgres, Auth, PostgREST, Storage, Realtime, Studio, Edge Runtime | started | started |
| Wait for Postgres to accept queries | waits | waits |
| Apply [`supabase/migrations/`](./supabase/migrations/) | applied | skipped |
| Sync [`supabase/functions/`](./supabase/functions/) into `volumes/functions/` and restart the runtime | synced | skipped |
| Load [`supabase/seed.sql`](./supabase/seed.sql) (creates the local **admin**) | seeded | skipped |
| Start Vite | ✓ | ✓ |

The slow steps run only when the database has no schema yet, so a normal start takes a couple of seconds. Open the URL Vite prints (usually `http://localhost:5173`) and sign in with **username** `admin` and password **`devpass123`** — **local only**; change it in **Studio → Authentication → Users** if others use your machine.

Ports and secrets are derived from the folder, never shared, so two checkouts on one machine each get their own stack and never collide. A checkout takes the shop ports plus 10000 (Kong **18000**, Postgres **15432**, pooler **16543**) leaving the shop block free.

> Only **Docker Desktop** and **Node** are needed. The bootstrap itself uses no npm packages, and migrations run through a throwaway container, so there is no Supabase CLI to install.

**Optional checks**

- Studio for this stack is your Kong URL (`http://127.0.0.1:18000`), using `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` from the root `.env`.
- **Admin → Members** needs Edge Functions such as `create-member` and `ensure-local-operator-auth`. After editing function code run `npm run functions:sync:docker && docker compose restart functions`; a **404** means the function was never synced into `volumes/functions/`.
- Pulled new migrations? `npm run dev` does not re-run them on an existing database — apply them with `npm run db:push:docker-compose`.

There is no hosted/cloud mode — see [Cloud is disabled in this checkout](#cloud-is-disabled-in-this-checkout).

## Environment files

Git ignores `*.local` env files (see [`.gitignore`](./.gitignore)); use them for secrets. **Never commit** real API keys, service role keys, or passwords.

### Summary: which file when?

There is **one** environment — the dev stack — with **two modes**: `development` and `shop`. Only three files sit in a checkout, and every one of them is generated or a template; nothing is hand-written.

| File | Typical use | Loaded by |
|------|-------------|------------|
| **`.env`** | Docker Compose config + secrets for the **dev stack** (ports, `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`). Generated on first `npm run dev` | `docker compose` |
| **`.env.local`** | The **only** SPA environment — `VITE_SUPABASE_*` for this folder's Kong, plus CLI secrets. Kept in step with `.env` by the generator | Loaded in **every** Vite mode, so `npm run dev` and `npm run build` share one backend |
| [`.env.docker.example`](.env.docker.example) | Committed template the generator fills in to produce `.env` / `.env.docker.shop` | `npm run generate:docker-env` |

**Deleting `.env` does not start you over.** Its `POSTGRES_PASSWORD` built the roles inside `volumes/db/data`, and a regenerated file would not match, so the generator refuses rather than leave you with a database nothing can connect to. Restore the file from a backup, or wipe both together with **`npm run fresh`**.

**Shop mode generates its own environment.** `npm run shop:up` writes `.env.docker.shop` (a second Compose stack with its own ports and its own `volumes-shop/` database) and `.env.shop.local` (the SPA env `npm run build:shop` reads). Neither is hand-maintained; delete them and the next `shop:up` recreates them. A standalone shop PC gets `.env` + `.env.production.local` from `second-pc:setup` instead — see [`docs/SECOND_PC.md`](./docs/SECOND_PC.md).

### Variables by file

**`.env.local`** (gitignored; this checkout's single environment)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | This folder's Docker Kong, e.g. `http://127.0.0.1:18000` — read `KONG_HTTP_PORT` from the root `.env` |
| `VITE_SUPABASE_ANON_KEY` | Yes | `ANON_KEY` from the root `.env` |
| `SUPABASE_DB_PASSWORD` | For some flows | Database password from Dashboard → **Connect** |
| `DATABASE_URL` | Alternative to password | Postgres URI (pooler) for CLI / [`npm run db:push:local`](./scripts/db-push-from-env.mjs) |
| `SUPABASE_POOLER_REGION` | Optional | e.g. `eu-west-1` when using pooler |
| `SUPABASE_ACCESS_TOKEN` | Optional | Personal access token for `supabase link` / remote CLI (never commit) |

Only `VITE_`-prefixed variables reach the browser bundle, so the CLI secrets above stay server-side. Do **not** add a `.env.development` or any other mode file with `VITE_SUPABASE_*` — a mode file outranks `.env.local` and would silently override this checkout's single environment.

**`.env.production.local`** (gitignored; optional)

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Production Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Production **anon** key |

All client-exposed variables must use the **`VITE_`** prefix.

## Cloud is disabled in this checkout

This project runs **local only**. There is no hosted Supabase connection: `.env.cloud.local`, `.env.mirror-auth.local` and their templates are gone, the `dev:cloud` and `mirror:cloud-auth-to-local` scripts are removed, and [`vite.config.ts`](./vite.config.ts) no longer injects `VITE_SYNC_CLOUD_*`. Builds contain no hosted project URL.

**Admin → Data sync** (`/admin/sync`) is still in the UI but reports that it is not configured and cannot connect, because `isSyncCloudConfigured()` in [`src/lib/supabaseCloud.ts`](./src/lib/supabaseCloud.ts) returns false without those variables.

To re-enable it later: create `.env.cloud.local` with the hosted **Project URL** and **anon public** key from **Dashboard → Project Settings → API**, then restore the `VITE_SYNC_CLOUD_*` merge in `vite.config.ts`. Only the **anon** key may ever go in a `VITE_*` variable — it ships to the browser; the **service_role** key must never appear in a Vite env file.

### Pushing database schema to a remote project from your machine

Put **non-`VITE_`** connection details in **`.env.local`** only (see [Variables by file](#variables-by-file) → `.env.local`): `SUPABASE_DB_PASSWORD` and/or `DATABASE_URL`, optional `SUPABASE_POOLER_REGION`, optional `SUPABASE_ACCESS_TOKEN` for the CLI. Use [`npm run db:push:local`](./scripts/db-push-from-env.mjs) or `npx supabase db push` when the project is linked. Never commit secrets.

### Checklist: every variable used across `.env.*` files

Use this as a single reference when filling templates.

| File | Variable | Fill with |
|------|----------|-------------|
| `.env.local` | `VITE_SUPABASE_URL` | This folder's Docker Kong (`http://127.0.0.1:<KONG_HTTP_PORT>` from the root `.env`) |
| `.env.local` | `VITE_SUPABASE_ANON_KEY` | `ANON_KEY` from the root `.env` |
| `.env.local` | `SUPABASE_DB_PASSWORD` | Database password (Dashboard → **Connect**) |
| `.env.local` | `DATABASE_URL` | Postgres pooler URI (alternative to password for CLI) |
| `.env.local` | `SUPABASE_POOLER_REGION` | *(Optional)* Pooler region |
| `.env.local` | `SUPABASE_ACCESS_TOKEN` | *(Optional)* Supabase personal access token for CLI |
| `.env.production.local` | `VITE_SUPABASE_URL` | *(Shop installs only)* That PC's Kong URL — written by `second-pc:setup` |
| `.env.production.local` | `VITE_SUPABASE_ANON_KEY` | *(Shop installs only)* That install's **anon** key |


## Admin data sync (disabled)

**Admin → Data sync** (`/admin/sync`) can merge **public** business tables with a **hosted** project in both directions. It is **inactive in this checkout** — no hosted credentials exist, so the page reports that the environment is not configured and refuses to sync. See [Cloud is disabled in this checkout](#cloud-is-disabled-in-this-checkout).

Which tables it would cover is defined in [`src/config/syncTableRegistry.ts`](./src/config/syncTableRegistry.ts), which is kept current so the feature works if you ever re-enable it.

The **`mirror:cloud-auth-to-local`** script (which wiped local Auth and recreated users from a hosted project using a **service_role** key) has been removed along with `.env.mirror-auth.local`.

## Database setup

**Local Docker:** you do **not** need to paste SQL by hand — `npm run db:push:docker-compose` applies everything under [`supabase/migrations/`](./supabase/migrations/) that this database is missing, in filename order. Use [Run the project locally](#run-the-project-locally) for the full flow.

### Self-hosted Supabase (root `docker-compose.yml`)

If you run the [official Docker Compose stack](https://github.com/supabase/supabase/tree/master/docker) from this repo (`docker compose up -d`), apply StockPilot migrations to the **Postgres `db` service** (not the pooler — that is Supavisor and may return **Tenant or user not found** until `POOLER_TENANT_ID` is configured).

Run **`npm run generate:docker-env`** once first. In a developer checkout it gives this folder a `dev-…` Compose project and its own host ports (Kong **18000**, Postgres **15432**, pooler **16543**) — the shop block plus 10000. Shop installs only ever search 200 ports up from **8000** / **5432** / **6543**, so the two can never take each other's ports even when one of them is stopped, and the repo and a client install can run at the same time.

To also run a **shop stack beside it** in the same folder, use **`npm run shop:up`**. That writes `.env.docker.shop` (its own `sp-…` project, the 8000 port block, its own secrets, and `DB_DATA_DIR=./volumes-shop/db/data`), starts it with `docker compose --env-file .env.docker.shop`, and applies migrations to it. Stop it with `npm run docker:shop:down`. Both stacks share only read-only config such as `kong.yml` and `roles.sql`, which read their values from the environment at runtime.

1. Ensure the stack is up: `npm run docker:dev` (or `npm run docker:shop` for the shop one).
2. From the repo root: **`npm run db:push:docker-compose`** — runs `supabase db push` in a one-off container on the compose network against `postgresql://postgres:…@db:5432/postgres` (reads **`POSTGRES_PASSWORD`** and **`POSTGRES_DB`** from root **`.env`**). Dry run: `DRY_RUN=1 npm run db:push:docker-compose`.
3. If your compose network is not `supabase_default`, set **`SUPABASE_DOCKER_NETWORK`** to the value from `docker network ls`, then rerun the script.
4. **Seed data** is not run by `db push`. `npm run dev` and `npm run shop:up` load [`supabase/seed.sql`](./supabase/seed.sql) automatically on an empty database; to re-run it by hand (it is idempotent and repairs the admin), use `docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/seed.sql`.

### Edge Functions (self-hosted Docker)

The compose **`functions`** service mounts **`./volumes/functions`** and runs the **`main`** router (`volumes/functions/main`), which loads each worker from a sibling folder (e.g. `create-member/index.ts`). Your app code lives under **`supabase/functions/`** — that path is **not** mounted by default.

1. **`npm run functions:sync:docker`** — copies each `supabase/functions/<name>/` (with `index.ts`) into `volumes/functions/<name>/`. The upstream **`main`** router is left unchanged.
2. **`docker compose restart functions`** — picks up new or changed files.
3. **Smoke test** (uses **`ANON_KEY`** and **`KONG_HTTP_PORT`** from root `.env`, so it works on either port block):

   ```bash
   KONG=$(grep '^KONG_HTTP_PORT=' .env | cut -d= -f2)
   curl -sS "http://127.0.0.1:$KONG/functions/v1/hello" \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "apikey: YOUR_ANON_KEY"
   ```

   StockPilot routes such as **`/functions/v1/create-member`** work the same way once synced.

**JWT:** root `.env` sets **`FUNCTIONS_VERIFY_JWT`** for the edge-runtime container. With **`false`**, you can call functions with only the anon key (dev-friendly). Use **`true`** in production and send a valid user JWT.

**Note:** `ensure-local-operator-auth` is intended for the **CLI local** stack (`supabase start`); on self-hosted it may still run if you sync it, but behavior is only needed where that flow is used.

**Second PC / shop (standalone program):** download the **zip** into its **own folder** on Windows, macOS, or Linux, then run **Start StockPilot** (`.bat` / `.command` / `.sh`) or **`npm run second-pc:setup`**. That auto-generates Docker `.env` + `.env.production.local` (unique Compose project name and free ports) and seeds a local admin. Every install is fully offline and self-contained. Multiple folders on one machine stay isolated, and a second download warns before it moves data — see [`docs/SECOND_PC.md`](./docs/SECOND_PC.md) for that plus **[Back up and restore your data](./docs/SECOND_PC.md#back-up-and-restore-your-data)**, which is the only thing standing between a shop and a lost database.

**This clone is not a shop install.** Any folder with a `.git` directory counts as a developer checkout: the shop commands refuse to run in it, and client installs on the same PC ignore its Docker stack completely — they never warn about it, copy data from it, or clean it up. A shop PC that really was installed with `git clone` confirms itself once with `npm run second-pc:setup -- --shop`.

**A clone can run both environments at once.** The dev stack (`npm run docker:dev`, Kong 18000) and a shop stack (`npm run shop:up`, Kong 8000) run side by side from this one folder, each with its own Compose project, host ports, secrets and database — the shop half keeps its data in `volumes-shop/` so the two Postgres servers never share a directory. `npm run build` produces the landing-page SPA in `dist/`; `npm run build:shop` produces the shop SPA in `dist-shop/`, where `/` goes straight to sign-in. A zip download is unaffected and still has only the shop environment. See [Developer checkouts](./docs/SECOND_PC.md#developer-checkouts).

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

### Operators (Auth + profiles)

- **Seeded local admin:** loading [`supabase/seed.sql`](./supabase/seed.sql) creates **username** `admin` / password **`devpass123`** (maps to `admin@members.stockpilot.local`). Change it in **Authentication → Users** if others use your stack.
- **Bootstrap without seed (optional):** In Studio → **Authentication → Users**, add `admin@members.stockpilot.local`, set a password, and user metadata such as `{ "username": "admin", "is_admin": true }` so the `profiles` trigger can run.
- **More operators:** **Admin → Members → Add member** calls the **`create-member`** Edge Function; password updates use **`update-member`**. Deploy with `supabase functions deploy create-member` and `supabase functions deploy update-member` on each environment. Never expose the **service role** key to the browser.

**Migrating from an old setup:** `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` now belong in **`.env.local`**. Delete any `.env.development.local` or `.env.production.local` left over from an earlier layout — a mode file outranks `.env.local` and would override it.

## Shop mode

The same checkout runs a **second, completely separate stack** that behaves like a shop PC: `/` goes straight to sign-in instead of the public landing page. It creates its own environment the same way development does, so there is nothing to prepare:

```bash
npm run shop:up      # own ports, own database, migrations + seed
npm run build:shop   # SPA build for it → dist-shop/
```

`shop:up` runs the same [`scripts/stack-up.mjs`](./scripts/stack-up.mjs) with `--shop`, writing `.env.docker.shop` and `.env.shop.local`, on the shop port block (Kong **8000**) with its database in **`volumes-shop/`**. Two Postgres containers must never share one data directory, so the two stacks are kept apart by design and can run at the same time. `npm run docker:shop:down` stops it.

Delete either shop env file and the next `shop:up` / `build:shop` regenerates it. Note the two stacks have **separate databases**: data entered in one does not appear in the other.

## Build

```bash
npm run build        # landing-page build → dist/
npm run build:shop   # shop build         → dist-shop/
```

Both read this folder's stack. Preview with `npm run preview`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | **The one command.** Creates the env if missing, starts the stack, migrates and seeds a new database, then starts Vite |
| `npm run dev:local` | Same as `dev` |
| `npm run shop:up` | Same, for the shop-mode stack (`--shop`) |
| `npm run fresh` | **Destructive.** Deletes this stack's containers, database and env files, then rebuilds it from nothing. Asks first; `-- --yes` skips the prompt |
| `npm run shop:fresh` | Same, for the shop-mode stack |
| `npm run generate:docker-env` | Recreate missing env files, or relocate the stack to free ports |
| `npm run db:push:docker-compose` | Apply pending migrations (needed after pulling new ones) |
| `npm run functions:sync:docker` | Copy `supabase/functions/` into `volumes/functions/` |
| `npm run check:app-target` | Self-test for the env generator (14 cases) |
| `npm run db:reset` | `npx supabase db reset` — **CLI stack only**; this checkout does not use it |
| Admin **Data sync** | `/admin/sync` — **disabled**; no hosted credentials in this checkout |
| `npm run build` / `build:shop` | TypeScript check + production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

## Branching strategy

We use a simple Git workflow with `master`, `develop`, and short-lived feature/fix branches. See **[BRANCHES.md](./BRANCHES.md)** for the full branching strategy and daily workflow.

## Deployment (Vercel)

- `vercel.json` is set up so all routes rewrite to `/index.html` for client-side routing.
- A hosted deploy would need `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set in the Vercel project environment, pointing at a Supabase project this checkout no longer references.
- A **local** production build (`npm run build` on your machine) reads the same gitignored **`.env.local`** as `npm run dev`, so it targets this folder's Docker stack.
- Production deploys from `master` are done manually.

## License

Private.
