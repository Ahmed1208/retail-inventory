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

1. **Clone and install**

   ```bash
   git clone <repo-url>
   cd retail-inventory
   npm install
   ```

2. **Start local Supabase** (from the repo root; Docker must be running)

   ```bash
   npx supabase start
   ```

   This starts Postgres, Auth (GoTrue), API, Studio, and serves Edge Functions from [`supabase/functions/`](./supabase/functions/). If you change function code, restart with `npx supabase stop` then `npx supabase start`, or use the CLI’s hot reload flow for functions if available in your CLI version.

3. **Apply migrations and seed** (first time, or whenever you need a clean DB)

   ```bash
   npx supabase db reset
   ```

   This runs all SQL under [`supabase/migrations/`](./supabase/migrations/) in order and applies [`supabase/seed.sql`](./supabase/seed.sql) (including the local dev **admin** user).

4. **Align `VITE_SUPABASE_*` with your stack** (if login fails with “Invalid API key” or similar)

   ```bash
   npx supabase status -o env
   ```

   Copy `API_URL` and `anon key` into [`.env.development`](.env.development) or into **`.env.development.local`** (see [Environment files](#environment-files) below).

5. **Run the app**

   ```bash
   npm run dev
   ```

   Open the URL Vite prints (usually `http://localhost:5173`). Sign in with **username** `admin` (the app maps this to `admin@members.stockpilot.local`) and password **`devpass123`** after a fresh seed — **local only**; change it in **Supabase Studio → Authentication → Users** if others use your machine.

6. **Optional checks**

   - `npm run verify:local-login` — validates local GoTrue + keys match [`.env.development`](.env.development).
   - **Admin → Members** and **Data sync** need Edge Functions such as `create-member` and `ensure-local-operator-auth`; they should respond after `supabase start`. If you see **404** on function calls, confirm the stack is up and restart it.

For day-to-day development against **hosted** Supabase instead of Docker, see **[Connect to the hosted Supabase project](#connect-to-the-hosted-supabase-project)** (`.env.cloud.local` + `npm run dev:cloud`).

## Environment files

Git ignores `*.local` env files (see [`.gitignore`](./.gitignore)); use them for secrets. **Never commit** real API keys, service role keys, or passwords.

### Summary: which file when?

| File | Typical use | Loaded by |
|------|-------------|------------|
| [`.env.development`](.env.development) | Default **local** `VITE_SUPABASE_*` (and optional placeholder `VITE_SYNC_CLOUD_*`); safe to commit generic local values | `npm run dev` / `npm run dev:local` (Vite `development`) |
| **`.env.development.local`** | **Secrets / overrides** for local dev (hosted sync URL, real cloud anon key, corrected local keys) | Same as above; overrides `.env.development` |
| [`.env.cloud.example`](.env.cloud.example) | Template only | Copy to `.env.cloud.local` |
| **`.env.cloud.local`** | **Hosted** Supabase URL + anon for `npm run dev:cloud` | Vite `cloud` mode; merged into **`development`** and **`production`** builds as **`VITE_SYNC_CLOUD_*`** when unset in mode files (see [`vite.config.ts`](./vite.config.ts)) |
| **`.env.local`** | **CLI / scripts only** — DB password, `DATABASE_URL`, optional `SUPABASE_ACCESS_TOKEN` | Not for switching app target: **do not** put `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` here (they override every mode and break local vs cloud switching) |
| [`.env.example`](.env.example) | Long-form comments and patterns for all of the above | Reference only |
| **`.env.mirror-auth.local`** | **`npm run mirror:cloud-auth-to-local`** — copy hosted Auth users to local/self-hosted (same ids) | Template: [`.env.mirror-auth.example`](./.env.mirror-auth.example); see [`.env.example`](./.env.example) and [`docs/SECOND_PC.md`](./docs/SECOND_PC.md) |
| **`.env.production.local`** | Local **`npm run build`** — self-hosted Kong (`VITE_SUPABASE_*`) or hosted dashboard vars on Vercel | Vite `production`; shop Docker + sync: see [`.env.shop.example`](./.env.shop.example) and [`docs/SECOND_PC.md`](./docs/SECOND_PC.md) |

### Variables by file

**[`.env.development`](.env.development)** (committed defaults for local stack)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Local API URL, usually `http://127.0.0.1:54321` |
| `VITE_SUPABASE_ANON_KEY` | Yes | Local **anon** key from `npx supabase status -o env` |
| `VITE_SYNC_CLOUD_URL` | No | Hosted project URL for **Admin → Data sync** while the app uses local Supabase |
| `VITE_SYNC_CLOUD_ANON_KEY` | No | Hosted **anon** key for the same sync target |

Prefer **`.env.development.local`** for real `VITE_SYNC_CLOUD_*` values so they are not committed.

**`.env.development.local`** (gitignored)

Same variable names as `.env.development`; any line here wins over `.env.development`.

**`.env.cloud.local`** (gitignored; create from [`.env.cloud.example`](.env.cloud.example))

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Hosted project URL, e.g. `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Yes | Hosted **anon** key (Dashboard → **Settings → API**) |

Used by `npm run dev:cloud`. Vite merges this file into **`development`** and **`production`** builds to fill `VITE_SYNC_CLOUD_*` for **Admin → Data sync** when you did not set them in `.env.development` / `.env.production.local` (see [`vite.config.ts`](./vite.config.ts)).

**`.env.local`** (gitignored)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_DB_PASSWORD` | For some flows | Database password from Dashboard → **Connect** |
| `DATABASE_URL` | Alternative to password | Postgres URI (pooler) for CLI / [`npm run db:push:local`](./scripts/db-push-from-env.mjs) |
| `SUPABASE_POOLER_REGION` | Optional | e.g. `eu-west-1` when using pooler |
| `SUPABASE_ACCESS_TOKEN` | Optional | Personal access token for `supabase link` / remote CLI (never commit) |

**`.env.mirror-auth.local`** (gitignored; **`npm run mirror:cloud-auth-to-local`** — use when shop/self-hosted **Auth** must match **hosted** operators)

| Variable | Description |
|----------|-------------|
| `MIRROR_CLOUD_SUPABASE_URL` | Hosted project URL |
| `MIRROR_CLOUD_SERVICE_ROLE_KEY` | Hosted **service role** (machine only; script use) |
| `MIRROR_LOCAL_SUPABASE_URL` | Local API: **`http://127.0.0.1:8000`** (Docker Compose Kong on this PC) or **`http://127.0.0.1:54321`** (`npx supabase start` only) |
| `MIRROR_LOCAL_SERVICE_ROLE_KEY` | Local **service_role**: Docker root **`.env`** → `SERVICE_ROLE_KEY`; CLI → `npx supabase status -o env` |
| `MIRROR_LOCAL_PASSWORD` | Optional; default password applied to mirrored users (min 8 chars) |

**`.env.production.local`** (gitignored; optional)

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Production Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Production **anon** key |

All client-exposed variables must use the **`VITE_`** prefix.

## Connect to the hosted Supabase project

Use your **cloud** (hosted) Supabase project when you want the app or **Data sync** to talk to production/staging in the cloud. Values always come from the Supabase Dashboard — never guess URLs.

### Where to copy values from (Dashboard)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) and select the **hosted** project.
2. Go to **Project Settings** (gear) → **API**.
3. Copy:
   - **Project URL** — use as `VITE_SUPABASE_URL` (cloud app mode) or as `VITE_SYNC_CLOUD_URL` (sync target while the app uses local).
   - **Project API keys → `anon` `public`** — use as `VITE_SUPABASE_ANON_KEY` or `VITE_SYNC_CLOUD_ANON_KEY`.

**Security:** only the **anon** key belongs in any `VITE_*` variable (it is shipped to the browser). Do **not** put the **service_role** key in `.env.cloud.local`, `.env.development*`, or any Vite env file.

4. Apply the same migrations to this hosted project as in the repo ([Database setup](#database-setup) / `supabase db push` when linked) before expecting the app to work end-to-end.

### Option A — App talks only to cloud (no local Docker for the SPA)

| Step | Action |
|------|--------|
| 1 | Copy [`.env.cloud.example`](.env.cloud.example) → **`.env.cloud.local`** (gitignored). |
| 2 | Set **`VITE_SUPABASE_URL`** = hosted **Project URL**. |
| 3 | Set **`VITE_SUPABASE_ANON_KEY`** = hosted **anon public** key. |
| 4 | Run **`npm run dev:cloud`** (Vite `cloud` mode loads **only** `.env.cloud.local` for those two variables). |
| 5 | Restart the dev server after any edit to `.env.cloud.local`. |

Sign in with a user that exists in **hosted** Auth (e.g. create `admin@members.stockpilot.local` in **Authentication → Users** if you have not migrated operators yet).

### Option B — App uses local Docker, but Data sync talks to cloud

Keep **`npm run dev`** with local `VITE_SUPABASE_*` in [`.env.development`](.env.development). Add hosted sync credentials in **one** of these ways:

| Approach | Files to fill | Variables |
|----------|---------------|-----------|
| **B1 — Dedicated sync keys** | [`.env.development`](.env.development) or (recommended) **`.env.development.local`** | `VITE_SYNC_CLOUD_URL` = hosted Project URL · `VITE_SYNC_CLOUD_ANON_KEY` = hosted **anon** key |
| **B2 — Reuse cloud app file** | **`.env.cloud.local`** (same two vars as Option A) | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` for hosted — Vite merges this file in **`development`** mode so the sync page can open a second client to the host without duplicating secrets (see [`vite.config.ts`](./vite.config.ts)) |

Then open **Admin → Data sync** (`/sync`). When the UI asks for hosted credentials, use an email/password that exist on **hosted** (not only the short `admin` username unless that literal email exists in hosted Auth).

### Pushing database schema to cloud from your machine

Put **non-`VITE_`** connection details in **`.env.local`** only (see [Variables by file](#variables-by-file) → `.env.local`): `SUPABASE_DB_PASSWORD` and/or `DATABASE_URL`, optional `SUPABASE_POOLER_REGION`, optional `SUPABASE_ACCESS_TOKEN` for the CLI. Use [`npm run db:push:local`](./scripts/db-push-from-env.mjs) or `npx supabase db push` when the project is linked. Never commit secrets.

### Checklist: every variable used across `.env.*` files

Use this as a single reference when filling templates.

| File | Variable | Fill with |
|------|----------|-------------|
| `.env.development` | `VITE_SUPABASE_URL` | Local API URL (`http://127.0.0.1:54321` or from `npx supabase status -o env`) |
| `.env.development` | `VITE_SUPABASE_ANON_KEY` | Local **anon** key (`npx supabase status -o env`) |
| `.env.development` | `VITE_SYNC_CLOUD_URL` | *(Optional)* Hosted Project URL — prefer `.env.development.local` for real values |
| `.env.development` | `VITE_SYNC_CLOUD_ANON_KEY` | *(Optional)* Hosted **anon** key — prefer `.env.development.local` |
| `.env.development.local` | *(same names as above)* | Overrides / secrets for local `npm run dev` |
| `.env.cloud.local` | `VITE_SUPABASE_URL` | Hosted **Project URL** |
| `.env.cloud.local` | `VITE_SUPABASE_ANON_KEY` | Hosted **anon public** key |
| `.env.local` | `SUPABASE_DB_PASSWORD` | Database password (Dashboard → **Connect**) |
| `.env.local` | `DATABASE_URL` | Postgres pooler URI (alternative to password for CLI) |
| `.env.local` | `SUPABASE_POOLER_REGION` | *(Optional)* Pooler region |
| `.env.local` | `SUPABASE_ACCESS_TOKEN` | *(Optional)* Supabase personal access token for CLI |
| `.env.mirror-auth.local` | `MIRROR_CLOUD_SUPABASE_URL` | Hosted project URL |
| `.env.mirror-auth.local` | `MIRROR_CLOUD_SERVICE_ROLE_KEY` | Hosted **service_role** (script only) |
| `.env.mirror-auth.local` | `MIRROR_LOCAL_SUPABASE_URL` | Local URL |
| `.env.mirror-auth.local` | `MIRROR_LOCAL_SERVICE_ROLE_KEY` | Local **service_role** (`npx supabase status -o env`) |
| `.env.mirror-auth.local` | `MIRROR_LOCAL_PASSWORD` | *(Optional)* Password applied to mirrored users |
| `.env.production.local` | `VITE_SUPABASE_URL` | Production project URL |
| `.env.production.local` | `VITE_SUPABASE_ANON_KEY` | Production **anon** key |

[`.env.example`](.env.example) documents the same patterns in prose (no secrets).

## Admin data sync (local ↔ hosted)

When the app points at **local** Supabase (`npm run dev`), **Admin → Data sync** (`/admin/sync`) can merge **public** business tables with a **hosted** project in both directions (new/updated rows).

**Hosted credentials** (pick one):

1. **`VITE_SYNC_CLOUD_URL`** and **`VITE_SYNC_CLOUD_ANON_KEY`** in [`.env.development`](.env.development) or **`.env.development.local`**, or  
2. The same **`VITE_SUPABASE_URL`** / **`VITE_SUPABASE_ANON_KEY`** you keep in **`.env.cloud.local`** for `npm run dev:cloud` — Vite merges that file into `development` for sync only (restart **`npm run dev`** after changing env files).

Then sign in on the sync page with a **hosted** Supabase user that is allowed by **RLS** to read and upsert those tables (no service role in the browser).

**Operator profiles (`public.profiles`)**: sync copies profile rows only when `auth.users` on the **target** database already has the same user id (see RPC `upsert_profile_for_data_sync`). If Auth is missing on the target, the app calls the Edge Function **`ensure-local-operator-auth`** on **that** project (using your session’s JWT against local or hosted): it creates `auth.users` with the **same id** as the source row, then the profile RPC succeeds. Use this when **pulling** from host → local *or* **pushing** from local → host after creating a member only on one side. New mirrored users sign in with **`{username}@members.stockpilot.local`** and the function’s temp password (`OPERATOR_MIRROR_TEMP_PASSWORD` secret on that project, min 8 chars; default **`devpass123`** when unset locally). Deploy the function on **each** Supabase project: [`supabase/functions/ensure-local-operator-auth`](./supabase/functions/ensure-local-operator-auth) — **`npx supabase start`** picks it up locally, or **`supabase functions deploy ensure-local-operator-auth`** on hosted (set `OPERATOR_MIRROR_TEMP_PASSWORD` in hosted function secrets if you do not use the default). Hosted passwords are never copied between environments.

Multi-table sync is best-effort across HTTP (not one giant SQL transaction).

#### Mirror hosted Auth onto local (required for shop ↔ cloud operator parity)

To **replace all local Auth users** with the same ids as on the hosted project (so **members/operators** and **`profiles`** line up with cloud), use the **service role** script (run on your machine only; keys stay in a gitignored env file). On a **second PC** with Docker Compose Kong, treat this as **part of the standard setup**, not an edge case — see [`docs/SECOND_PC.md`](./docs/SECOND_PC.md).

1. Copy [`.env.mirror-auth.example`](./.env.mirror-auth.example) → **`.env.mirror-auth.local`** and set `MIRROR_CLOUD_*`, `MIRROR_LOCAL_*` (for self-hosted Docker use **`http://127.0.0.1:8000`** and **`SERVICE_ROLE_KEY`** from root **`.env`**), and optionally `MIRROR_LOCAL_PASSWORD` (default `devpass123`).
2. `npm run mirror:cloud-auth-to-local -- --dry-run` — lists counts only.
3. `I_CONFIRM_WIPE_LOCAL_AUTH=YES npm run mirror:cloud-auth-to-local` — deletes **every** local Auth user, then recreates users from the host with the **same ids**. Hosted passwords are **not** copied; everyone gets `MIRROR_LOCAL_PASSWORD`.
4. Run **Admin → Data sync** once to refresh `profiles` and business tables from cloud.

See comments at the top of [`scripts/mirror-cloud-auth-to-local.mjs`](./scripts/mirror-cloud-auth-to-local.mjs) for details.

## Database setup

**Local Docker:** you do **not** need to paste SQL by hand — `npx supabase db reset` applies everything under [`supabase/migrations/`](./supabase/migrations/) in filename order plus [`supabase/seed.sql`](./supabase/seed.sql). Use [Run the project locally](#run-the-project-locally) for the full flow.

### Self-hosted Supabase (root `docker-compose.yml`)

If you run the [official Docker Compose stack](https://github.com/supabase/supabase/tree/master/docker) from this repo (`docker compose up -d`), apply StockPilot migrations to the **Postgres `db` service** (not the pooler on host port `5432` — that is Supavisor and may return **Tenant or user not found** until `POOLER_TENANT_ID` is configured).

1. Ensure the stack is up: `docker compose up -d`.
2. From the repo root: **`npm run db:push:docker-compose`** — runs `supabase db push` in a one-off container on the compose network against `postgresql://postgres:…@db:5432/postgres` (reads **`POSTGRES_PASSWORD`** and **`POSTGRES_DB`** from root **`.env`**). Dry run: `DRY_RUN=1 npm run db:push:docker-compose`.
3. If your compose network is not `supabase_default`, set **`SUPABASE_DOCKER_NETWORK`** to the value from `docker network ls`, then rerun the script.
4. **Seed data** is not run by `db push`. Load [`supabase/seed.sql`](./supabase/seed.sql) manually if you need the local dev admin (e.g. `docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/seed.sql`), or create users in Studio → Authentication.

### Edge Functions (self-hosted Docker)

The compose **`functions`** service mounts **`./volumes/functions`** and runs the **`main`** router (`volumes/functions/main`), which loads each worker from a sibling folder (e.g. `create-member/index.ts`). Your app code lives under **`supabase/functions/`** — that path is **not** mounted by default.

1. **`npm run functions:sync:docker`** — copies each `supabase/functions/<name>/` (with `index.ts`) into `volumes/functions/<name>/`. The upstream **`main`** router is left unchanged.
2. **`docker compose restart functions`** — picks up new or changed files.
3. **Smoke test** (use **`ANON_KEY`** from root `.env` and your Kong port, usually **8000**):

   ```bash
   curl -sS "http://127.0.0.1:8000/functions/v1/hello" \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "apikey: YOUR_ANON_KEY"
   ```

   StockPilot routes such as **`/functions/v1/create-member`** work the same way once synced.

**JWT:** root `.env` sets **`FUNCTIONS_VERIFY_JWT`** for the edge-runtime container. With **`false`**, you can call functions with only the anon key (dev-friendly). Use **`true`** in production and send a valid user JWT.

**Note:** `ensure-local-operator-auth` is intended for the **CLI local** stack (`supabase start`); on self-hosted it may still run if you sync it, but behavior is only needed where that flow is used.

**Second PC / shop + hosted Data sync:** copy env files (see [`docs/SECOND_PC.md`](./docs/SECOND_PC.md)), then run **`npm run second-pc:setup`**. Build env template: [`.env.shop.example`](./.env.shop.example).

### First time setup (hosted Supabase)

1. Create a new Supabase project at [https://supabase.com](https://supabase.com).
2. Go to **Supabase → SQL Editor** (or link the CLI and use `supabase db push`).
3. Run migration files **in order** (same order as in the repo; never skip a file). For ongoing schema changes, add new timestamped files under `supabase/migrations/` and push or paste them in order.

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

- **Seeded local admin:** after `npx supabase db reset`, seeding (see [`supabase/config.toml`](./supabase/config.toml)) creates **username** `admin` / password **`devpass123`** (maps to `admin@members.stockpilot.local`). Change it in **Authentication → Users** if others use your stack.
- **Bootstrap without seed (optional):** In Studio → **Authentication → Users**, add `admin@members.stockpilot.local`, set a password, and user metadata such as `{ "username": "admin", "is_admin": true }` so the `profiles` trigger can run.
- **More operators:** **Admin → Members → Add member** calls the **`create-member`** Edge Function; password updates use **`update-member`**. Deploy with `supabase functions deploy create-member` and `supabase functions deploy update-member` on each environment. Never expose the **service role** key to the browser.

**Migrating from an old setup:** remove `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from **`.env.local`** if present; put hosted values in **`.env.cloud.local`** only so `npm run dev` and `npm run dev:cloud` keep working.

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
| `npm run dev:cloud` | Dev server against **hosted** Supabase (**`.env.cloud.local`**) |
| `npm run db:reset` | `npx supabase db reset` — reapply migrations + seed to **local** Docker stack |
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
