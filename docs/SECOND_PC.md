# Second PC — standalone StockPilot

A second PC runs a **full local StockPilot** (Docker Supabase + built UI). You do **not** need cloud credentials to get started. Connecting to a hosted cloud project is an **optional** later step.

**Each project folder is isolated:** its own Compose project name, host ports, containers, and database under `./volumes`. You can run two downloads on the same machine without mixing data — **do not copy `.env` between folders**.

Download: [retail-inventory (develop zip)](https://github.com/Ahmed1208/retail-inventory/archive/refs/heads/develop.zip) — or `git clone` the repo.

---

## Part A — Standalone (required)

### 1. Install Docker and Node

| Tool | Install (pick one) |
|------|----------------------|
| **Docker Desktop** (Windows / Mac) | [Docker Desktop — download & docs](https://docs.docker.com/desktop/) |
| **Docker Engine** (Linux) | [Install Docker Engine](https://docs.docker.com/engine/install/) — then [install Compose plugin](https://docs.docker.com/compose/install/linux/) |
| **Node.js LTS** | [Node.js — download](https://nodejs.org/) (choose **LTS**). |

**Start Docker Desktop** (Mac/Windows) and wait until it reports **running**.

Open a **new** terminal and verify:

```bash
docker --version
docker compose version
node --version
npm --version
```

Expect **Node ≥ 20** (LTS). If `docker` or `node` is missing, finish the install and open a new terminal.

### 2. Get the project on this PC

- Use **Download Now** on the StockPilot homepage (develop zip), **or**
- `git clone` the repository

Unzip if needed, then `cd` into **this** project folder (the directory that contains `docker-compose.yml` and `package.json`). Keep each download in its own folder if you run more than one.

### 3. One command (auto env + Docker + seed + build)

```bash
npm run second-pc:setup
```

This will:

1. **Create** root `.env` and `.env.production.local` if they are missing — unique `COMPOSE_PROJECT_NAME`, free host ports (Kong / Postgres publish / UI), generated secrets, SPA pointed at this folder’s Kong URL. You do **not** copy env files from another PC or folder.
2. `docker compose up -d` (only this folder’s stack)
3. `npm install`
4. Apply StockPilot migrations
5. Sync Edge Functions into the Docker volumes
6. Load `supabase/seed.sql` (local admin user) — skip with `--no-seed` if you must
7. `npm run build` — skip with `--no-build` if you only changed Docker

Setup prints the **Compose project name** and the **ports** for this folder (Kong may not be `8000` if that port is already in use).

### 4. Open the app and sign in

Use the UI port printed by setup (also in `.env` as `STOCKPILOT_UI_PORT`; default `8080` when free):

```bash
npx serve -s dist -l 8080
```

Replace `8080` with your `STOCKPILOT_UI_PORT` if different. Browser: **http://localhost:UI_PORT** (or `http://THIS-PC-LAN-IP:UI_PORT`) — use the port printed by setup.

Sign in with username **`admin`** and password **`devpass123`** (from the seed). That admin account shows **Control**, **Admin**, **Notifications**, and **Data sync** in the sidebar. Member accounts do not. Data sync page is available before cloud env is configured; sync **actions** stay disabled until Part B.

Firewall: allow this folder’s **Kong HTTP** and **UI** ports on the LAN if needed.

**Stop only this stack** (from this folder):

```bash
docker compose down
```

That does not stop other StockPilot folders running on the same machine.

---

## Part B — Connect to cloud (optional)

Do this only after Part A works and you want **Admin → Data sync** with a hosted Supabase project.

### 1. Hosted API keys for the built app

Copy [`.env.cloud.example`](../.env.cloud.example) → **`.env.cloud.local`**. Set hosted project URL + **anon** key (Dashboard → Settings → API).

### 2. Rebuild

Vite bakes sync keys into `dist/` at build time:

```bash
npm run build
```

Serve again with your `STOCKPILOT_UI_PORT`.

### 3. Mirror Auth (same user ids as hosted)

Copy [`.env.mirror-auth.example`](../.env.mirror-auth.example) → **`.env.mirror-auth.local`**. Fill hosted **service_role** and local **`SERVICE_ROLE_KEY`** from this PC’s root `.env`. For **`MIRROR_LOCAL_SUPABASE_URL`** use `http://127.0.0.1:` plus this folder’s **`KONG_HTTP_PORT`** from `.env` (localhost only).

```bash
npm run mirror:cloud-auth-to-local -- --dry-run
```

```bash
# bash / zsh / macOS / Linux
I_CONFIRM_WIPE_LOCAL_AUTH=YES npm run mirror:cloud-auth-to-local
```

```powershell
# Windows PowerShell
$env:I_CONFIRM_WIPE_LOCAL_AUTH="YES"; npm run mirror:cloud-auth-to-local
```

**Warning:** mirroring **deletes all local Auth users**, then recreates them from hosted. Hosted passwords are **not** copied; everyone gets **`MIRROR_LOCAL_PASSWORD`** (default `devpass123` if unset).

### 4. Data sync

Sign in to the local app with a mirrored operator, open **Admin → Data sync**, connect to hosted cloud, and run sync once (refreshes `profiles` and business tables).

---

## After the first time / troubleshooting

- When you change code or Docker config: `docker compose up -d`, then `npm run second-pc:setup` (or `--no-build` / full setup if you need a new `dist/`).
- Re-run **Part B** mirror + Data sync when hosted operators change and the shop must match them again.
- If Data sync fails with a missing table (e.g. `admin_notifications`) in the schema cache, Postgres is behind migrations. With Compose running:

  ```bash
  npm run db:push:docker-compose
  ```

- For tablets on the LAN, set `VITE_SUPABASE_URL` in `.env.production.local` and Docker `.env` (`SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL`, `SITE_URL`) to this PC’s LAN IP with this folder’s **`KONG_HTTP_PORT`**, then recreate containers and rebuild.
- **Multiple folders on one PC:** each keeps its own `./volumes` DB and ports. Never share or copy `.env` / `.env.production.local` between them.

More context: main [README](../README.md), [`.env.shop.example`](../.env.shop.example), `npm run generate:docker-env`.
