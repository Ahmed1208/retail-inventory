# Second PC — simple steps

## Before you run anything

### 1. Install Docker and Node

| Tool | Install (pick one) |
|------|----------------------|
| **Docker Desktop** (Windows / Mac) | [Docker Desktop — download & docs](https://docs.docker.com/desktop/) |
| **Docker Engine** (Linux) | [Install Docker Engine](https://docs.docker.com/engine/install/) — then [install Compose plugin](https://docs.docker.com/compose/install/linux/) |
| **Node.js LTS** | [Node.js — download](https://nodejs.org/) (choose **LTS**). Package managers: [nvm](https://github.com/nvm-sh/nvm), [fnm](https://github.com/Schniz/fnm), or your OS store. |

**Start Docker Desktop** (Mac/Windows) and wait until it reports **running** before the checks below.

### 2. Check they are on your PATH

Open a **new** terminal (PowerShell, cmd, Terminal.app, or your Linux shell) and run:

```bash
docker --version
docker compose version
docker run --rm hello-world
```

- If `docker: command not found` → Docker is not installed or not on PATH; finish install and restart the terminal (or reboot on Windows).
- If `docker compose` fails but `docker-compose` works → install the [Compose V2 plugin](https://docs.docker.com/compose/install/).
- `hello-world` prints a welcome message then exits — confirms the daemon can pull and run images.

```bash
node --version
npm --version
```

- Expect **Node ≥ 20** (LTS). If `node` is missing → install Node LTS from [nodejs.org](https://nodejs.org/) and open a new terminal.
- `npm` ships with Node; if missing, reinstall Node.

### 3. Get the project folder on this PC

Use **git clone**, a **zip**, or **USB** — see the rest of this doc after the files table.

## Copy these files into the project folder (same level as `docker-compose.yml`)

| File | What it is |
|------|------------|
| **`.env`** | Docker Supabase secrets (from your first PC, or regenerate — see main README). |
| **`.env.production.local`** | Copy [`.env.shop.example`](../.env.shop.example) → rename, set `VITE_SUPABASE_URL` (this PC’s Kong, e.g. `http://192.168.1.10:8000`) and `VITE_SUPABASE_ANON_KEY` (= `ANON_KEY` from root `.env`). |
| **`.env.cloud.local`** | Copy [`.env.cloud.example`](../.env.cloud.example) → rename, hosted URL + anon — needed for **Admin → Data sync** in the built app. |
| **`.env.mirror-auth.local`** | **Required if operators/members must match hosted Auth** (same user ids on self‑hosted GoTrue). Copy [`.env.mirror-auth.example`](../.env.mirror-auth.example) → rename, fill hosted **service_role** + local **`SERVICE_ROLE_KEY`** from root `.env`. For **`MIRROR_LOCAL_SUPABASE_URL`** use **`http://127.0.0.1:8000`** on the PC that runs Docker (the mirror script only allows localhost-class URLs, not a LAN hostname). |

**Why mirror is not optional for that case:** **Admin → Data sync** moves business rows and `profiles`, but **sign-in** is **GoTrue (Auth)**. Mirroring recreates hosted users on local Auth with the **same ids**, then you run **Data sync** so `profiles` and permissions line up. Without mirroring, hosted-only operators will not exist on the shop stack and member flows break.

## One command (installs, DB, functions, build)

In a terminal, **cd into the project folder**, then:

```bash
npm run second-pc:setup
```

This runs: `docker compose up -d` → `npm install` → migrations → sync Edge Functions → restart functions → **`npm run build`**.

Options:

```bash
npm run second-pc:setup -- --with-seed   # also load supabase/seed.sql into Postgres
npm run second-pc:setup -- --no-build    # skip npm run build (faster if you only changed Docker)
```

## Align members (Auth) with cloud — run on this PC after `second-pc:setup`

With **`.env.mirror-auth.local`** filled (see table above):

```bash
npm run mirror:cloud-auth-to-local -- --dry-run
I_CONFIRM_WIPE_LOCAL_AUTH=YES npm run mirror:cloud-auth-to-local
```

Then open the app and run **Admin → Data sync** once (refreshes `profiles` and business tables from cloud).

**Warning:** mirroring **deletes all local Auth users** on this stack, then recreates them from hosted. Hosted passwords are **not** copied; everyone gets **`MIRROR_LOCAL_PASSWORD`** (default `devpass123` if unset).

## Open the app

```bash
npx serve -s dist -l 8080
```

Browser: **http://localhost:8080** — or `http://THIS-PC-LAN-IP:8080` from other devices.  
If others use the shop PC, set Docker **`.env`** `SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL`, and `SITE_URL` to the same base URL with port **8000** (e.g. `http://192.168.1.10:8000`), then run `docker compose up -d` again.

Firewall: allow **8000** (API) and **8080** (UI) on the LAN if needed.

## After the first time

Only when you change code or Docker config:

- `docker compose up -d`
- `npm run second-pc:setup -- --no-build` **or** full `npm run second-pc:setup` if you need a new `dist/`
- Re-run **mirror** + **Data sync** when hosted operators change and the shop must match them again.

---

More context: main [README](../README.md) and [`.env.example`](../.env.example).
