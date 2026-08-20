# Branching strategy

## Branches

| Branch | Purpose |
|--------|---------|
| **master** | Production. Deployed to Vercel **manually only**. |
| **develop** | Active development. All features merge here first. |
| **feature/xxx** | New features. Always branch from `develop`. |
| **fix/xxx** | Bug fixes. Always branch from `develop`. |

## Daily workflow

### How to start a new feature

```bash
git checkout develop
git pull
git checkout -b feature/your-feature-name
```

### How to save and push work

```bash
git add .
git commit -m "feat: describe what you did"
git push -u origin feature/your-feature-name
```

### How to merge

Open a **Pull Request** on GitHub targeting `develop`. After review and CI passing, merge.

### How to ship updates to second PCs (shops)

1. Merge your feature/fix into **`develop`** and push (PR merge is enough).
2. The **Shop version** GitHub Action runs on `develop` and writes `shop-version.json` (and `public/shop-version.json`) with an automatic version like `26.7.26.12` (UTC date + run number) plus the commit SHA. No tags or Releases required.
3. Online second PCs: **Admin → Updates** compares the local install to that file on `develop`. Offline PCs show an Offline warning and skip the check.
4. Shop staff apply updates by running **Update StockPilot** (`.bat` / `.command` / `.sh`) in the same folder — no manual zip/copy.

`master` is not used for shop updates.

**Note:** The browser can only read `shop-version.json` (and the develop zip) if the repo is **public**, or you publish the version feed another way. Private repos block raw GitHub fetches from the shop UI.

### How to release to production

1. Open a **Pull Request** from `develop` → `master`.
2. After merge, deploy **manually** on Vercel (or trigger your production deployment).
