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

## Local setup

1. **Clone the repo**

   ```bash
   git clone <repo-url>
   cd retail-inventory
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment**

   Copy `.env.example` to `.env.local` and fill in your Supabase values:

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local`:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Run the dev server**

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
