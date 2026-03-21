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
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous (public) key |

All app env vars must use the `VITE_` prefix so Vite exposes them to the client.

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

   Follow the [Database setup](#database-setup) section above: create a Supabase project and run the migration files in order.

3. **Install dependencies**

   ```bash
   npm install
   ```

4. **Configure environment**

   Copy `.env.example` to `.env.local` and fill in your Supabase values:

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local`:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

5. **Run the dev server**

   ```bash
   npm run dev
   ```

## Build

```bash
npm run build
```

Output is in `dist/`. Preview with `npm run preview`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

## Branching strategy

We use a simple Git workflow with `master`, `develop`, and short-lived feature/fix branches. See **[BRANCHES.md](./BRANCHES.md)** for the full branching strategy and daily workflow.

## Deployment (Vercel)

- `vercel.json` is set up so all routes rewrite to `/index.html` for client-side routing.
- Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your Vercel project environment.
- Production deploys from `master` are done manually.

## License

Private.
