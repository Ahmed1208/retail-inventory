# Onboarding: loading your data into StockPilot

This guide is for **end users** and admins who want a smooth first setup or a one-time bulk load. Developers may use the Supabase SQL editor or CLI for migrations; day-to-day catalog and document loading is meant to happen **in the app** with CSV where available.

**Interactive checklist:** In the app, open **Admin** → **Migration checklist** (or go to `/admin/migration`). **Step 1 is customers & sellers** — a guided paste wizard. Progress is saved in your browser so you can stop and continue later.

## Recommended order

1. **Customers and sellers (start here)**  
   Open **People → Import customers & sellers** (or the first card on the Migration guide). Paste a range from Excel. You can start with **names + old IDs** only; add **balances** and **phones** in later pastes. The wizard maps columns, warns when someone is already on the system (saved old ID / phone / name), and lets you skip, update, merge (net one signed balance), or separate. Role column is optional (default both). Phone is not required on the first pass.

2. **Warehouses and registers**  
   Define locations (codes, names) and which sites have a cash register. Orders and POs attach to a warehouse; payments and register activity need a register where applicable.

3. **People tidy-up (optional)**  
   After the guided import, edit roles or add anyone missing. The old CSV importer remains as a fallback.

4. **Products**  
   Import or add products (Inventory → Products → Import CSV). You can include opening stock per warehouse on the product import when you want **live** stock from day one.

5. **Payments (optional)**  
   Standalone balance payments can be imported from the Payments area when your process needs it. Split tenders on old orders are easier to fix in the UI than in CSV.

6. **Sales orders and purchase orders (last)**  
   Use **Orders** and **Purchase orders** list pages → **Import CSV** only after warehouses, people, and products exist (or map columns so missing products/brands/categories can be created during import).

## Live vs Historical import (orders & POs)

When you import orders or purchase orders from CSV, you choose a mode **before** uploading the file.

### Live (draft)

- **Sales orders:** Creates normal **draft** orders. **Inventory and register do not change** until you use the usual flows (confirm, complete, checkout) like any order created in the POS.
- **Purchase orders:** Creates **draft** POs. **Stock in, catalog cost updates, and supplier ledger** apply only when you **confirm and receive** from the PO screen.

Use **Live** for data you will operate on going forward.

### Historical (analysis only)

- Inserts rows that **look** completed for **reports and charts** (completed sales / received POs).
- **Does not** post stock movements, register lines, or balance/ledger entries tied to those documents.

Use **Historical** for **backfill** so dashboards reflect the past without changing today’s stock or books.

## CSV shape (orders & POs)

- **Long format:** one **row per line** on the document.
- **Group id:** every row that belongs to the same order or PO must share the same **group id** (e.g. `INV-2024-001`). The app groups rows before creating one document per group.
- **Headers repeated:** warehouse, customer/supplier, notes, and order-level discount should be **the same on every row** in a group (the importer flags inconsistent groups).

**Templates:** use **Export CSV** on the same list page to download a file that matches the import columns (including `is_historical_snapshot` on export for traceability).

## Bulk load and database access

- **Admins** may use the Supabase **Connect** pooler string and `db:push` (or migrations) to align the database schema with the app.
- **Routine users** should rely on **in-app CSV** and column mapping rather than raw SQL, so validation and relationships stay consistent.

## First operational day

- Create a **small draft order or PO** in the normal screens to verify warehouse, register, and stock behavior.
- Optionally run a **tiny CSV** import in **Live** mode and complete one document end-to-end as a smoke test.

## Where to find CSV in the app

| Area            | Import              | Export              |
|----------------|---------------------|---------------------|
| Orders         | Orders list         | Orders list         |
| Purchase orders| Purchase orders list| Purchase orders list|
| Products       | Products            | Products            |
| People         | People              | People              |

Feature toggles for order/PO CSV live under **Control** if your workspace hides them.
