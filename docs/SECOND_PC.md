# Second PC — standalone StockPilot

A second PC runs a **full local StockPilot** (Docker Supabase + built UI). You do **not** need cloud credentials to get started. Connecting to a hosted cloud project is an **optional** later step.

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

Unzip if needed, then `cd` into the project folder (the directory that contains `docker-compose.yml` and `package.json`).

### 3. One command (auto env + Docker + seed + build)

```bash
npm run second-pc:setup
```

This will:

1. **Create** root `.env` and `.env.production.local` if they are missing (generated secrets; SPA points at `http://127.0.0.1:8000`) — you do **not** copy env files from another PC for standalone use
2. `docker compose up -d`
3. `npm install`
4. Apply StockPilot migrations
5. Sync Edge Functions into the Docker volumes
6. Load `supabase/seed.sql` (local admin user) — skip with `--no-seed` if you must
7. `npm run build` — skip with `--no-build` if you only changed Docker

### 4. Open the app and sign in

```bash
npx serve -s dist -l 8080
```

Browser: **http://localhost:8080** (or `http://THIS-PC-LAN-IP:8080` from other devices).

Sign in with username **`admin`** and password **`devpass123`** (from the seed).

Firewall: allow **8000** (API) and **8080** (UI) on the LAN if needed.

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

Serve again with `npx serve -s dist -l 8080`.

### 3. Mirror Auth (same user ids as hosted)

Copy [`.env.mirror-auth.example`](../.env.mirror-auth.example) → **`.env.mirror-auth.local`**. Fill hosted **service_role** and local **`SERVICE_ROLE_KEY`** from this PC’s root `.env`. For **`MIRROR_LOCAL_SUPABASE_URL`** use **`http://127.0.0.1:8000`** (localhost only).

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

- For tablets on the LAN, set `VITE_SUPABASE_URL` in `.env.production.local` and Docker `.env` (`SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL`, `SITE_URL`) to `http://THIS-PC-LAN-IP:8000`, then recreate containers and rebuild.

More context: main [README](../README.md), [`.env.shop.example`](../.env.shop.example), `npm run generate:docker-env`.
