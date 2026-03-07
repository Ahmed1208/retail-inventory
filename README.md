# StockPilot — Retail Inventory

A bilingual (English / Arabic) retail inventory management app built with React, TypeScript, Vite, Supabase, and Tailwind CSS. Manage products, categories, brands, stock movements, and orders with RTL support and i18n.

## Tech stack

- **React 19** + **TypeScript** + **Vite**
- **Supabase** (backend)
- **TanStack Query** (server state)
- **React Router** (routing)
- **Tailwind CSS** + **shadcn-style UI**
- **i18next** (Arabic/English, RTL/LTR)
- **React Hook Form** + **Zod** (forms/validation)
- **Recharts** (reports)
- **Sonner** (toasts)

## Setup

1. **Clone and install**

   ```bash
   npm install
   ```

2. **Environment variables**

   Create a `.env` or `.env.local` in the project root with:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

   All app env vars must use the `VITE_` prefix so Vite exposes them to the client.

3. **Run development server**

   ```bash
   npm run dev
   ```

4. **Production build**

   ```bash
   npm run build
   ```

   Output is in `dist/`. Preview with:

   ```bash
   npm run preview
   ```

## Scripts

| Command         | Description                |
|----------------|----------------------------|
| `npm run dev`  | Start dev server           |
| `npm run build`| TypeScript check + build   |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint                 |

## Deployment (e.g. Vercel)

- The repo includes a `vercel.json` that rewrites all routes to `/index.html` for client-side routing.
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your deployment environment.

## License

Private.
