# StockPilot — Retail Inventory

Retail inventory management with bilingual support (English / Arabic), RTL layout, and full CRUD for products, categories, brands, stock movements, orders, and sales returns.

## Tech stack

- **React** + **TypeScript** + **Vite**
- **Supabase**, self-hosted through Docker Compose
- **Tailwind CSS** + **shadcn/ui**
- **TanStack Query** (server state), **React Router** (routing)
- **i18next** (Arabic/English, RTL/LTR)
- **React Hook Form** + **Zod** (forms and validation)
- **Recharts** (reports), **Sonner** (toasts)

## Quick start

You need **Node.js** (LTS) and **Docker Desktop**, running. That is the whole list — migrations run inside a throwaway container, so there is no Supabase CLI to install.

```bash
git clone <repo-url>
cd retail-inventory
npm install
npm run dev
```

**There is nothing to fill in by hand and no file to copy from anyone else.** Open the URL Vite prints (usually `http://localhost:5173`) and sign in with username **`admin`** and password **`devpass123`**.

`npm run dev` runs [`scripts/stack-up.mjs`](./scripts/stack-up.mjs), which does everything on the first run and almost nothing afterwards:

| Step | First run | Later runs |
|------|-----------|------------|
| Generate **`.env`** (own Compose project, own free ports, fresh secrets) and **`.env.local`** for the SPA | created | left alone |
| `docker compose up -d` — Postgres, Auth, PostgREST, Storage, Realtime, Studio, Edge Runtime | started | started |
| Wait for Postgres to accept queries | waits | waits |
| Apply [`supabase/migrations/`](./supabase/migrations/) | applied | skipped |
| Sync [`supabase/functions/`](./supabase/functions/) into `volumes/functions/` and restart the runtime | synced | skipped |
| Load [`supabase/seed.sql`](./supabase/seed.sql), creating the local **admin** | seeded | skipped |
| Start Vite | ✓ | ✓ |

The slow steps only run on an empty database, so a normal start takes a couple of seconds.

**Every folder is its own stack.** Ports and secrets are generated from the folder itself and never shared, so two checkouts on one machine cannot collide. A checkout takes the shop ports plus 10000 — Kong **18000**, Postgres **15432**, pooler **16543** — which leaves the shop block free.

The `admin` password is **local only**. Change it in **Studio → Authentication → Users** if other people use your machine. Studio for this stack is your Kong URL, `http://127.0.0.1:18000`, with `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` from `.env`.

> **Pulled new migrations?** `npm run dev` does not re-run them on a database that already has a schema — apply them with `npm run db:push:docker-compose`.

## Everyday commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | **The one command.** Creates anything missing, starts the stack, then starts Vite |
| `npm run docker:dev:down` | Stop the containers. Loses nothing |
| `npm run fresh` | **Destructive.** Delete this stack and rebuild it empty |
| `npm run db:push:docker-compose` | Apply migrations you pulled from git |
| `npm run functions:sync:docker` | Copy `supabase/functions/` into `volumes/functions/` after editing one |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve the `dist/` build locally |
| `npm run lint` | ESLint |
| `npm run generate:docker-env` | Recreate missing env files, or move the stack to free ports |
| `npm run check:app-target` | Self-test for the env generator (14 cases) |
| `npm run verify:returns` | Self-test for the sales-returns stock guard |

Shop mode has the same commands with different names: `shop:up`, `docker:shop:down`, `shop:fresh`, `build:shop`.

## Start over from scratch

`npm run dev` keeps whatever database is already there. To throw it away and rebuild from nothing:

```bash
npm run fresh        # the dev stack
npm run shop:fresh   # the shop-mode stack
```

Either one removes that stack's containers, its database directory and its env files, then falls straight into the normal bootstrap: new secrets, new ports, every migration, and a freshly seeded `admin`. You land on an empty app.

**There is no undo**, so it prints exactly what it is about to delete and waits for you to type `wipe`. Add `-- --yes` to skip the prompt from a script; with no terminal to ask on, it refuses rather than guess.

Stopping the containers is a different thing and loses nothing: `npm run docker:dev:down`.

## Shop mode

The same checkout runs a **second, completely separate stack** that behaves like a shop PC: `/` goes straight to sign-in instead of the public landing page. It builds its own environment the same way development does, so there is nothing to prepare:

```bash
npm run shop:up                  # own ports, own database, migrations + seed
npm run build:shop               # SPA build → dist-shop/
npx serve -s dist-shop -l 8080   # serve it → http://localhost:8080
```

Nothing serves the SPA for you — no container hosts it, so that third command is part of the flow. **8080** is this folder's `STOCKPILOT_UI_PORT` from `.env.docker.shop`, and its Kong is on **8000**. The `-s` flag rewrites unknown paths to `index.html`, without which refreshing on a route like `/orders/returns` returns a 404. Sign in as `admin` / `devpass123`.

`shop:up` runs the same [`scripts/stack-up.mjs`](./scripts/stack-up.mjs) with `--shop`, writing `.env.docker.shop` and `.env.shop.local` and keeping its database in **`volumes-shop/`**. Two Postgres containers must never share a data directory, so the two stacks are separated by design and can run at the same time. Stop it with `npm run docker:shop:down`.

The two stacks have **separate databases**: data entered in one never appears in the other. Delete either shop env file and the next `shop:up` / `build:shop` regenerates it.

This is for testing what a shop PC sees. A real shop PC installs differently — see [Shop PCs](#shop-pcs-second-pc-installs).

## Build

```bash
npm run build        # landing-page build → dist/
npm run build:shop   # shop build         → dist-shop/
```

Both read this folder's stack. Preview `dist/` with `npm run preview`; the shop build needs `npx vite preview --mode shop`, because the output folder only switches to `dist-shop/` when Vite runs in shop mode.

## Environment files

Git ignores `*.local` env files (see [`.gitignore`](./.gitignore)). **Never commit** API keys, service role keys, or passwords.

There is **one** environment — the dev stack — with **two modes**, `development` and `shop`. Only three files sit in a checkout, and every one is generated or a template. Nothing is hand-written.

| File | What it is | Loaded by |
|------|------------|-----------|
| **`.env`** | Docker Compose config and secrets for the dev stack: ports, `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`. Generated on the first `npm run dev` | `docker compose` |
| **`.env.local`** | The **only** SPA environment — `VITE_SUPABASE_*` for this folder's Kong. Kept in step with `.env` by the generator | Every Vite mode, so `npm run dev` and `npm run build` share one backend |
| [`.env.docker.example`](.env.docker.example) | Committed template the generator fills in to produce `.env` and `.env.docker.shop` | `npm run generate:docker-env` |

Shop mode adds `.env.docker.shop` and `.env.shop.local`, both generated by `npm run shop:up`. A standalone shop PC gets `.env` plus `.env.production.local` from `second-pc:setup` instead.

**Deleting `.env` does not start you over.** Its `POSTGRES_PASSWORD` created the roles inside `volumes/db/data`, and a regenerated file could never match them, so the generator refuses rather than leave you with a database nothing can connect to. Restore the file from a backup, or wipe both together with `npm run fresh`.

**Never add a mode file** such as `.env.development` or `.env.production.local` to a checkout. Vite ranks mode files above `.env.local`, so one would silently point the app at a different backend. Delete any left over from an older layout.

### Variables

| File | Variable | Value |
|------|----------|-------|
| `.env.local` | `VITE_SUPABASE_URL` | This folder's Kong, `http://127.0.0.1:<KONG_HTTP_PORT>` from `.env` |
| `.env.local` | `VITE_SUPABASE_ANON_KEY` | `ANON_KEY` from `.env` |
| `.env.production.local` | `VITE_SUPABASE_URL` | *(Shop installs only)* that PC's Kong URL, written by `second-pc:setup` |
| `.env.production.local` | `VITE_SUPABASE_ANON_KEY` | *(Shop installs only)* that install's anon key |

Both are written for you. Only `VITE_`-prefixed variables reach the browser bundle, so a **service_role** key must never appear in any of them.

## Database and migrations

`npm run db:push:docker-compose` applies everything under [`supabase/migrations/`](./supabase/migrations/) that this database is missing, in filename order. There is no SQL to paste by hand. It runs `supabase db push` in a one-off container on the Compose network, reading `POSTGRES_PASSWORD` and `POSTGRES_DB` from `.env`, and connects to the **`db`** service directly rather than the pooler, which would answer **Tenant or user not found** until `POOLER_TENANT_ID` is configured.

- Dry run: `DRY_RUN=1 npm run db:push:docker-compose`
- Different Compose network: set `SUPABASE_DOCKER_NETWORK` to the value from `docker network ls` and rerun
- Shop stack: `npm run db:push:docker-compose -- --env-file .env.docker.shop`

**Seed data is not part of `db push`.** `npm run dev` and `npm run shop:up` load [`supabase/seed.sql`](./supabase/seed.sql) automatically on an empty database. To re-run it by hand — it is idempotent and repairs the admin:

```bash
docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/seed.sql
```

### Rules for migrations

- **Never edit a migration that has already run**, here or in production. To undo something, add a new migration that reverses it.
- Always add a **new numbered file**: `NNN_description.sql`, e.g. `003_add_suppliers.sql`. Newer ones use a timestamp prefix, e.g. `20260902120000_sales_returns.sql`.
- Commit it. Migration files are the **source of truth** for the schema.

## Edge Functions

The Compose **`functions`** service mounts **`./volumes/functions`** and runs the **`main`** router, which loads each worker from a sibling folder such as `create-member/index.ts`. Your code lives under **`supabase/functions/`**, which is **not** mounted, so it has to be copied across:

1. **`npm run functions:sync:docker`** — copies each `supabase/functions/<name>/` that has an `index.ts` into `volumes/functions/<name>/`, leaving the upstream `main` router alone.
2. **`docker compose restart functions`** — picks up the new files.

A **404** from a function means it was never synced. Smoke test, using `ANON_KEY` and `KONG_HTTP_PORT` from `.env` so it works on either port block:

```bash
KONG=$(grep '^KONG_HTTP_PORT=' .env | cut -d= -f2)
curl -sS "http://127.0.0.1:$KONG/functions/v1/create-member" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "apikey: YOUR_ANON_KEY"
```

`FUNCTIONS_VERIFY_JWT` in `.env` controls the edge runtime. With **`false`** you can call functions with only the anon key, which is convenient in development; use **`true`** in production and send a real user JWT.

## Operators (Auth + profiles)

- **Seeded admin:** [`supabase/seed.sql`](./supabase/seed.sql) creates username `admin` / password `devpass123`, which maps to `admin@members.stockpilot.local`.
- **More operators:** **Admin → Members → Add member** calls the **`create-member`** Edge Function; password changes use **`update-member`**. Both must be synced (above) or the page returns 404.
- **Without the seed:** in Studio → **Authentication → Users**, add `admin@members.stockpilot.local`, set a password, and give it metadata such as `{ "username": "admin", "is_admin": true }` so the `profiles` trigger can run.

## Shop PCs (second-PC installs)

A shop PC does **not** use this checkout's shop mode. It downloads the **zip** into its own folder on Windows, macOS or Linux and runs **Start StockPilot** (`.bat` / `.command` / `.sh`), or `npm run second-pc:setup`. That generates `.env` and `.env.production.local` with a unique Compose project and free ports, seeds an admin, builds the SPA and serves it. Every install is fully offline and self-contained.

Multiple installs on one machine stay isolated, and a second download warns before it moves any data. See [`docs/SECOND_PC.md`](./docs/SECOND_PC.md), especially [Back up and restore your data](./docs/SECOND_PC.md#back-up-and-restore-your-data) — the only thing standing between a shop and a lost database.

**A clone is never treated as a shop install.** Any folder with a `.git` directory counts as a developer checkout: the shop commands refuse to run in it, and client installs on the same machine ignore its Docker stack entirely — they never warn about it, copy from it, or clean it up. A shop PC that really was installed with `git clone` confirms itself once with `npm run second-pc:setup -- --shop`.

## Branching strategy

We use `master`, `develop`, and short-lived feature/fix branches. See **[BRANCHES.md](./BRANCHES.md)**.

## Disabled in this checkout

Everything below is **inactive**. The project runs local only.

**Cloud connection.** There is no hosted Supabase anywhere in this checkout: `.env.cloud.local`, `.env.mirror-auth.local` and their templates are gone, the `dev:cloud` and `mirror:cloud-auth-to-local` scripts are removed, and [`vite.config.ts`](./vite.config.ts) no longer injects `VITE_SYNC_CLOUD_*`. Builds contain no hosted project URL. To re-enable it, create `.env.cloud.local` with a hosted **Project URL** and **anon public** key, then restore the `VITE_SYNC_CLOUD_*` merge in `vite.config.ts`. Only the **anon** key may ever go in a `VITE_*` variable; it ships to the browser.

**Admin → Data sync** (`/admin/sync`) would merge public business tables with a hosted project in both directions. The page still exists but reports that it is not configured and refuses to sync, because `isSyncCloudConfigured()` in [`src/lib/supabaseCloud.ts`](./src/lib/supabaseCloud.ts) returns false without those variables. The tables it would cover are listed in [`src/config/syncTableRegistry.ts`](./src/config/syncTableRegistry.ts), which is kept current so the feature still works if you ever switch it back on.

**Pushing schema to a remote project.** [`npm run db:push:local`](./scripts/db-push-from-env.mjs) and `npx supabase db push` target a linked hosted project, which this checkout does not have. They need `SUPABASE_DB_PASSWORD` or `DATABASE_URL` in `.env.local`, plus an optional `SUPABASE_ACCESS_TOKEN`. Never commit those.

**`npm run db:reset`** is `npx supabase db reset`, which belongs to the Supabase CLI stack. This checkout does not use the CLI — `npm run fresh` is the equivalent here.

**Vercel deploys.** [`vercel.json`](./vercel.json) still rewrites all routes to `/index.html`, but a hosted deploy would need `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project pointing at a Supabase project this checkout no longer references. A local `npm run build` reads the same `.env.local` as `npm run dev`, so it targets your Docker stack.

## License

Private.
