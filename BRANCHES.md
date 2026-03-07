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

### How to release to production

1. Open a **Pull Request** from `develop` → `master`.
2. After merge, deploy **manually** on Vercel (or trigger your production deployment).
