# Second PC — standalone StockPilot

A second PC is a **standalone program**: local database + built UI on **Windows, macOS, or Linux**. Daily work does **not** need the internet or another PC. Cloud is only for **uploading or importing** data so other standalone PCs can share the same catalog, stock, and orders.

**Each project folder is isolated:** its own Compose project name, host ports, containers, and database under `./volumes`. You can run two downloads on the same machine without mixing data — **do not copy `.env` between folders**. Downloaded it more than once? See [I downloaded StockPilot twice](#i-downloaded-stockpilot-twice).

Download: [retail-inventory (develop zip)](https://github.com/Ahmed1208/retail-inventory/archive/refs/heads/develop.zip). Use the **zip** — `git clone` is for developers working on the code (see [Developer checkouts](#developer-checkouts)).

**Journey:** Download → Start StockPilot → sign in → work offline. Share via cloud only when you need it (Part B).

---

## Part A — Standalone (required)

### 1. Install Docker and Node (once)

| OS | Docker | Node |
|----|--------|------|
| **Windows** | [Docker Desktop](https://docs.docker.com/desktop/) | [Node.js LTS](https://nodejs.org/) (≥ 20) |
| **macOS** | [Docker Desktop](https://docs.docker.com/desktop/) | [Node.js LTS](https://nodejs.org/) (≥ 20) |
| **Linux** | [Docker Engine](https://docs.docker.com/engine/install/) + [Compose plugin](https://docs.docker.com/compose/install/linux/) (or Docker Desktop) | [Node.js LTS](https://nodejs.org/) (≥ 20) |

Start Docker and wait until it is **running**. On Linux, add your user to the `docker` group if `docker` commands need `sudo`.

Open a **new** terminal and verify:

```bash
docker --version
docker compose version
node --version
npm --version
```

Expect **Node ≥ 20** (LTS). If `docker` or `node` is missing, finish the install and open a new terminal.

### 2. Get the program on this PC

Use **Download Now** on the StockPilot homepage (develop zip). Do not use `git clone` on a shop PC — that is the developer setup, and the shop commands refuse to run there (see [Developer checkouts](#developer-checkouts)).

Unzip if needed, then open **this** project folder (the directory that contains `docker-compose.yml` and `package.json`). Keep each download in its own folder if you run more than one. **Do not copy `.env` from another PC.**

### 3. Start StockPilot

| OS | Start (first run and daily use) | Update (keeps data) |
|----|----------------------------------|---------------------|
| **Windows** | Double-click **`Start StockPilot.bat`** | Double-click **`Update StockPilot.bat`** |
| **macOS** | Double-click **`Start StockPilot.command`** | Double-click **`Update StockPilot.command`** |
| **Linux** | `chmod +x` once, then run **`./Start StockPilot.sh`** (or double-click if your file manager allows it) | **`./Update StockPilot.sh`** |

Linux, once in the project folder:

```bash
chmod +x "./Start StockPilot.sh" "./Update StockPilot.sh"
"./Start StockPilot.sh"
```

Same as a terminal:

```bash
npm run second-pc:setup
```

This will:

1. **Check the PC for other StockPilot folders** — if one already exists you get a warning naming it (see [I downloaded StockPilot twice](#i-downloaded-stockpilot-twice)); folders that were **deleted** have their leftover containers removed automatically, and so do renamed orphans (`hash_supabase-*`). You do not need a separate cleanup command
2. **Create** root `.env` and `.env.production.local` if they are missing — unique `COMPOSE_PROJECT_NAME`, free host ports, secrets, SPA → this folder’s Kong (**no cloud files**)
3. `docker compose up -d` (retries with new ports / one automatic DB wipe if needed)
4. `npm install` → migrations → Edge Functions → seed admin → `npm run build`
5. Serve the UI (when you used Start StockPilot)

If the machine is in a bad state: `npm run second-pc:fresh`. **This deletes every product, order, and operator in this folder.** [Take a backup](#back-up-and-restore-your-data) first, and only use it when the install is genuinely broken.

Setup prints the **Compose project name** and the **ports** for this folder (Kong may not be `8000` if that port is already in use).

### 4. Open the app and sign in

Start StockPilot already serves the UI. Use the UI port printed by setup (also in `.env` as `STOCKPILOT_UI_PORT`; default `8080` when free).

If you ran only `npm run second-pc:setup`:

```bash
npx serve -s dist -l 8080
```

Replace `8080` with your `STOCKPILOT_UI_PORT` if different. Browser: **http://localhost:UI_PORT** (or `http://THIS-PC-LAN-IP:UI_PORT`).

Sign in with username **`admin`** and password **`devpass123`** (from the seed). That admin account shows **Control**, **Admin**, **Notifications**, and **Data sync** in the sidebar. Member accounts do not. Data sync page is available before cloud env is configured; sync **actions** stay disabled until Part B.

Unplug the internet: the app and local data keep working.

Firewall: allow this folder’s **Kong HTTP** and **UI** ports on the LAN if needed.

**Stop only this stack** (from this folder):

```bash
docker compose down
```

That does not stop other StockPilot folders running on the same machine.

---

## Back up and restore your data

Your whole business lives in **`volumes/db/data`** inside this folder. Nothing backs it up for you. Take a backup **before every update** and on a schedule that matches how much work you could stand to redo.

### Back up

Run from the StockPilot folder with the stack running (**Windows: use `cmd`, not PowerShell** — PowerShell writes the file in an encoding `psql` cannot read back):

```bash
docker compose exec -T db pg_dump -U postgres --clean --if-exists -d postgres > stockpilot-backup.sql
```

**Keep the file outside the project folder** — copy it to a USB drive, another disk, or cloud storage. **Update StockPilot** deletes anything at the top level of the folder that is not `volumes/`, `node_modules/`, `.env*`, `.git/`, or a `.stockpilot-*` marker, so a backup left in the folder will not survive an update.

### Restore

Stop working in the app first, then, from the folder you want to restore **into**:

```bash
docker compose exec -T db psql -U postgres -d postgres -f - < stockpilot-backup.sql
```

Messages such as `table … does not exist, skipping` are normal — the file rebuilds every table from scratch. When it finishes, restart the API so it picks up the restored tables:

```bash
docker compose restart rest
```

Sign in with the same username and password as before: operator accounts and passwords are inside the backup.

### Move to a new PC

Do **not** copy `.env` or `volumes/` between machines — each install has its own ports, keys, and secrets, and mixing them breaks sign-in.

1. **Old PC:** take a backup as above and copy the `.sql` file to the new PC.
2. **New PC:** install Docker and Node, download StockPilot, and run **Start StockPilot** once so a complete empty install exists.
3. **New PC:** restore the `.sql` file with the command above, then `docker compose restart rest`.

---

## I downloaded StockPilot twice

You only ever need **one** folder. If you unzip a second copy and start it, setup notices the folder you already have and prints a warning naming it.

| Situation | What setup does |
|-----------|-----------------|
| The new folder is **empty** and the old one has your data | Copies your database into the new folder, stops the old stack, and marks the old folder as replaced. Sign in with your usual username and password. |
| The new folder **already has its own data** | Warns and changes nothing. Two databases are never merged automatically — pick one folder and keep using it. |
| A previous download's folder was **deleted** | Removes its leftover containers and volumes, because nothing can be using them any more. |
| A **developer checkout** of the repo is on the same PC | Ignored completely — never listed, never copied from, never cleaned up. |
| An install from **before this naming existed** (its containers are called `supabase-db`, `supabase-kong`, …) | Listed and offered as a data source while its folder is still there, but never removed automatically — `supabase` is also the name Docker gives an unrelated Supabase stack. |

The old folder is only ever **read**. Its `volumes/` stays on disk as a fallback, and the copy taken during the move is kept in `.stockpilot-migration/` in the new folder.

After a move, the old folder gets a **`.stockpilot-superseded`** file, and starting it again warns you that its data is an old snapshot. Do not go on working there — entries you add in the old folder will not appear in the new one.

The old install keeps running until the new folder is fully built and its data verified, so **if anything fails at any point, the folder you already had still works**. Open it and run **Start StockPilot** there.

---

## Developer checkouts

A folder with a **`.git`** directory is a working copy of the repo, not a shop install. Shop downloads come from the zip and never contain `.git`, so the two are told apart automatically.

In a developer checkout:

- **`npm run second-pc:setup`**, **`second-pc:fresh`**, **`second-pc:update`**, and the Start / Update StockPilot launchers all **refuse to run**. Shop setup builds a shop stack and can wipe its database, and the shop updater would pull `develop` over whatever branch you are on.
- Run the repo the normal way instead: `npm run generate:docker-env` once, then `npm run docker:dev` and `npm run dev`.
- **The two never fight over ports.** A checkout gets a `dev-…` Compose project and the shop ports plus 10000 (Kong **18000**, Kong HTTPS **18443**, Postgres **15432**, pooler **16543**, UI **18080**). Shop installs only ever search 200 ports up from **8000** / **8443** / **5432** / **6543** / **8080**, so neither block can reach the other — a shop installed while the repo's stack is stopped still cannot take the ports it wants back.
- The checkout is **invisible to shop tooling on the same PC**. A client install never lists it, never copies data from it, and never cleans it up. This matters because a repo started without `COMPOSE_PROJECT_NAME` in its `.env` takes Compose's fallback project name `stockpilot`, which otherwise looks exactly like a shop stack.
- The build stays different too: `VITE_APP_TARGET=shop` is only written by shop setup, so `/` keeps showing the public landing page instead of jumping to sign-in.

### Running both environments in a checkout

A shop download has one environment and that is the point: unzip, **Start StockPilot**, done. A checkout can run **both** from the same folder, so you can develop and see the real shop experience without a second download.

```bash
npm run docker:dev     # dev stack   — Kong 18000, database in volumes/
npm run shop:up        # shop stack  — Kong 8000,  database in volumes-shop/
```

`shop:up` writes **`.env.docker.shop`** the first time (its own `sp-…` Compose project, the 8000 port block, its own generated secrets) and applies migrations to it. The two stacks share nothing that matters: separate projects, separate host ports, separate secrets, and separate Postgres data directories. Only read-only config such as `kong.yml`, `jwt.sql` and `roles.sql` is shared, and those read their values from the environment at run time, so each stack gets its own.

For the SPA, `npm run build` gives you the landing-page build in `dist/` and `npm run build:shop` gives you the shop build in `dist-shop/`, where `/` goes straight to sign-in. Stop either side with `npm run docker:dev:down` or `npm run docker:shop:down`.

The shop stack you run this way is still inside a checkout, so a real client install elsewhere on the machine continues to ignore it.

### A shop PC that was installed with `git clone`

Confirm it once:

```bash
npm run second-pc:setup -- --shop
```

Setup then writes this folder's `.env` with an `sp-…` project name, which marks it as a shop for good. From then on Start StockPilot and Update StockPilot work normally and you never need the flag again.

---

## Part B — Share with other PCs (removed)

Sharing data between PCs through a hosted Supabase project is **no longer available**. This project is local only: there are no cloud env files or templates, the `mirror:cloud-auth-to-local` script is gone, and **Admin → Data sync** reports that it is not configured.

Each install is therefore an independent master. To move data between machines, use a database dump — see [Back up and restore your data](#back-up-and-restore-your-data).

---

## You only need one start command (auto-cleans)

You do **not** need to remember a separate cleanup step.

| Command | When |
|---------|------|
| **`Start StockPilot`** (`.bat` / `.command` / `.sh`) | First run and daily use. Same as setup, then serves the UI. |
| **`Update StockPilot`** (`.bat` / `.command` / `.sh`) | Downloads latest `develop` into this folder (keeps data), runs setup, serves the UI. |
| **`npm run second-pc:setup`** | Terminal equivalent of Start (without serving unless you add `npx serve`). Recreates this folder’s stack and removes leftovers from downloads whose folder was deleted. |
| **`npm run second-pc:fresh`** | **Deletes all data in this folder**, then cleans and sets up again. Only when something is genuinely broken, and only after [a backup](#back-up-and-restore-your-data). |
| **`npm run second-pc:cleanup -- --all-orphans`** | Explicit teardown that also clears containers left by downloads whose folder no longer exists. |
| **`npm run second-pc:setup -- --shop`** | Only for a shop PC installed with `git clone` — confirms once that this checkout really is a shop. See [Developer checkouts](#developer-checkouts). |

Deleting a zip folder without running anything can leave Docker leftovers; the next `second-pc:setup` in a new folder cleans those automatically, because a folder that is gone cannot be in use. Folders that still exist are never touched — they are reported to you instead.

---

## Port already allocated / container name already in use

Another Docker stack (often `npx supabase start`) may be using the same **host ports** or fixed names like `supabase-imgproxy`.

This repo’s `docker-compose.yml` must use `name: ${COMPOSE_PROJECT_NAME:-stockpilot}` and must **not** hardcode `container_name: supabase-*` (except the project-scoped realtime name). Setup also picks free host ports automatically.

If compose still fails on an old zip:

1. Copy the latest `docker-compose.yml`, `scripts/generate-docker-env.mjs`, and `scripts/second-pc-setup.mjs` from this repo (or re-download develop after merge).
2. From the shop folder: `docker compose down` then `npm run second-pc:setup`
3. Confirm `docker compose ps` shows project-prefixed names (e.g. `sp-retail-inventory-…-kong-1`) and host bindings like `0.0.0.0:8002->8000`.

## Login shows “Unauthorized”

Usually the SPA is talking to the **wrong** API on port **8000** (another Docker Supabase / `npx supabase start`), while this folder’s Kong failed to bind that port.

1. From this folder: `npm run generate:docker-env` — reassigns free host ports if 8000 (etc.) are taken, and updates `.env.production.local`.
2. Recreate the stack: `docker compose up -d --force-recreate`
3. Rebuild the UI so it picks up the new Kong URL: `npm run build` (or `npm run second-pc:setup -- --no-seed`)
4. Serve `dist` and sign in with **admin** / **devpass123**

Confirm Kong is published: `docker compose ps` should show something like `0.0.0.0:NNNN->8000` for `kong`, and `.env` / `.env.production.local` must use that same `NNNN`.

---

## Updates (Admin → Updates)

Shop code tracks the **`develop`** branch.

| State | What you see |
|-------|----------------|
| **Offline** | Warning that update checks need internet; app keeps working. |
| **Online, up to date** | Local version matches the latest feed. |
| **Online, update available** | Instructions to run **Update StockPilot** (`.bat` / `.command` / `.sh`) in this folder. |

**Shop user:** [take a backup](#back-up-and-restore-your-data), then run **Update StockPilot** — it downloads the new code into the same folder, keeps `volumes/` and `.env*`, runs setup, and opens the app. No manual file copying.

After it finishes, press **I finished updating** on the Updates page. The page records the new version in this browser so the banner clears immediately, without waiting for the rebuilt files to be picked up. It changes nothing in your data.

**If an update fails:** your data is untouched — updates never write to `volumes/`. Run **Update StockPilot** again; if it still fails, run `npm run second-pc:setup` in the folder to finish the parts that did not complete. Only fall back to `npm run second-pc:fresh` plus a restore if the install is unusable, since that wipes the database.

**Why `/` opens sign-in here:** shop installs are built with `VITE_APP_TARGET=shop`, written into `.env.production.local` by `npm run generate:docker-env`. That skips the public landing page and goes straight to sign-in. The hosted site leaves it unset.

**Developer:** merge to `develop` only. A GitHub Action bumps `shop-version.json` (see [BRANCHES.md](../BRANCHES.md)).

---

## After the first time / troubleshooting

- When you change code or Docker config: `docker compose up -d`, then `npm run second-pc:setup` (or `--no-build` / full setup if you need a new `dist/`). Prefer **Admin → Updates** when online to see if `develop` is newer.
- **Repeated Docker failures wipe the database.** If `docker compose up` fails twice in a row, setup clears `volumes/db/data` once and retries, because a corrupt data directory is the usual cause. That is a last resort inside setup, and it is the main reason to keep [a recent backup](#back-up-and-restore-your-data).
- Re-run **Part B** mirror + Data sync when hosted operators change and the shop must match them again.
- If Data sync fails with a missing table (e.g. `admin_notifications`) in the schema cache, Postgres is behind migrations. With Compose running:

  ```bash
  npm run db:push:docker-compose
  ```

- For tablets on the LAN, set `VITE_SUPABASE_URL` in `.env.production.local` and Docker `.env` (`SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL`, `SITE_URL`) to this PC’s LAN IP with this folder’s **`KONG_HTTP_PORT`**, then recreate containers and rebuild.
- **Multiple folders on one PC:** each keeps its own `./volumes` DB and ports. Never share or copy `.env` / `.env.production.local` between them.

More context: main [README](../README.md), `npm run generate:docker-env`.
