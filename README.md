# WingetWebUI

WingetWebUI is a client-side WinGet workspace for finding Windows applications, arranging an install plan, and generating commands or downloadable scripts. It never executes WinGet or generated scripts.

## Features

- Browse the package catalog by category, use fuzzy search, inspect package details, and switch between card and list views.
- Select individual packages, Ctrl/Cmd-toggle items, Shift-select ranges, or select an entire category without losing selection when filters change.
- Preserve installation order with drag-and-drop and keyboard-accessible move controls.
- Configure supported WinGet flags and update the command, PowerShell, and Batch previews immediately.
- Copy commands, download `.ps1`/`.bat` files, and import or export validated versioned configurations.
- Use light, dark, or system theme preferences in a responsive interface.
- Browse a committed snapshot generated from the official WinGet package repository, with a small curated catalog available if the snapshot cannot be loaded.

## Tech stack

React 19, TypeScript, Vite, Fuse.js, dnd-kit, Zod, Lucide React, Vitest, ESLint, and Prettier. The application is static and client-centric: package selection, search, ordering, generation, downloads, and configuration handling all run in the browser. A development script prepares the static package snapshot before deployment.

## Local setup

Node.js 22.12 or later is recommended. The installed Vite version also supports Node.js 20.19 or newer on the 20.x line.

```powershell
npm ci
Copy-Item .env.example .env.local # optional
npm run dev
```

Open the URL printed by Vite. No database, account, or backend is required.

### Official package snapshot

The primary source is `public/packages.json`, a committed, browser-ready snapshot generated from the YAML manifests in Microsoft's official [`winget-pkgs`](https://github.com/microsoft/winget-pkgs) repository. The application resolves `packages.json` against Vite's base URL (`/packages.json` on a root-hosted deployment), so no environment variable, database, GitHub token, or runtime backend is required. Visitors do not clone the repository or call the GitHub API.

The synchronizer selects one latest version per package ID deterministically and prefers English locale metadata (`en-US`, then `en-GB`) before falling back to the manifest's default locale. Each generated record includes the package ID, name, publisher, version, description, tags, inferred category, and a deterministic monogram icon. The snapshot also records the upstream repository commit and its timestamp. Identical upstream commits produce byte-identical output.

WinGet does not define WingetWebUI's category taxonomy. Categories are inferred from manifest tags and package metadata using deterministic keyword rules; packages that do not match a rule are placed in `Others`. Categories are therefore browsing aids, not official Microsoft classifications.

To refresh the snapshot locally, install Git and Node.js, then run:

```powershell
npm ci
npm run sync:catalog
```

The first run creates a shallow, filtered cache of the official repository under `.cache/winget-pkgs`; later runs fetch the newest upstream commit. The script sparsely checks out only the selected latest-version manifest directories and writes `public/packages.json`. The cache is local and ignored by Git. Review the generated change and run the normal checks before committing it.

The `Sync WinGet catalog` GitHub Actions workflow performs the refresh every six hours (at minute 17) and can also be started from the Actions tab with `workflow_dispatch`. It uses a clean dependency install, generates the snapshot, runs linting, tests, and a production build, and commits only `public/packages.json` when its content changed. A failed sync leaves the last successful committed snapshot intact. The workflow deliberately has no `push` trigger, and GitHub does not start new workflow runs for pushes made with its built-in `GITHUB_TOKEN`, so the bot commit cannot create an Actions loop.

### Optional package-source override

`VITE_PACKAGE_API_URL` may override the built-in snapshot source with another same-origin path or an absolute HTTP(S) GET endpoint; use HTTPS in production:

```dotenv
VITE_PACKAGE_API_URL=https://example.com/api/v1/packages
```

The endpoint may return either a package array or `{ "data": Package[] }`. Each record requires string `id` and `name` fields and may include `publisher`, `version`, `description`, `category`, and an `icon` object with `monogram`, `background`, and `foreground`. Extra generated fields such as `tags` are allowed. The adapter bounds, validates, sanitizes, and de-duplicates records before exposing them to the UI; unknown categories map to `Others`.

If the snapshot or configured override cannot provide usable data, the adapter loads a curated catalog containing 26 verified WinGet IDs (two per category). This is emergency fallback/demo data, not a complete or live representation of the WinGet repository. Results identify whether their source is the snapshot/override or the curated fallback, and source failures remain retryable.

Like every `VITE_` variable, `VITE_PACKAGE_API_URL` is embedded in browser code at build time. It must never contain credentials. A cross-origin endpoint must allow requests from the deployed site.

## Commands

| Command                | Purpose                                                |
| ---------------------- | ------------------------------------------------------ |
| `npm run dev`          | Start the Vite development server                      |
| `npm run sync:catalog` | Refresh `public/packages.json` from official manifests |
| `npm run lint`         | Run ESLint with warnings treated as failures           |
| `npm run test`         | Run the Vitest suite once                              |
| `npm run test:watch`   | Run tests in watch mode                                |
| `npm run build`        | Type-check and create the production build in `dist/`  |
| `npm run preview`      | Preview the production build locally                   |
| `npm run format`       | Format supported files with Prettier                   |
| `npm run format:check` | Check formatting without changing files                |

CI runs a clean install, lint, tests, and production build for pushes and pull requests. The separate catalog workflow performs the same checks before publishing a changed official snapshot.

## Configuration format (v1)

Exported JSON stores package IDs in installation order and all supported option values:

```json
{
  "version": 1,
  "packages": [{ "id": "Microsoft.VisualStudioCode" }, { "id": "Git.Git" }],
  "wingetOptions": {
    "acceptSourceAgreements": true,
    "disableInteractivity": true,
    "force": false,
    "ignoreSecurityHash": false,
    "silent": true,
    "verbose": false
  }
}
```

Imports are treated as untrusted input. The strict schema rejects invalid JSON, unsupported versions, unknown or missing fields, duplicate entries, and unsafe package IDs. The import preview identifies IDs that are unavailable in the current catalog and skips them only after the user confirms; replacing an existing plan is called out before anything changes.

## Architecture

```text
public/packages.json              Generated, committed official catalog snapshot
scripts/sync-winget-catalog.mjs   Official-manifest synchronization script
src/
├── components/                   Reusable UI and workspace panels
├── data/                         Package-source adapter and emergency fallback
├── hooks/                        Browser and UI state hooks
├── lib/                          Search, selection, generation, and configuration logic
├── styles/                       Design tokens and responsive application styles
├── types/                        Shared domain contracts
├── App.tsx                       Workspace composition and state coordination
└── main.tsx                      Browser entry point
```

The package-source boundary isolates external data from the rest of the application. Ordered package IDs are the selection source of truth; deterministic pure functions in `src/lib/` derive WinGet commands, scripts, and exported configuration from that state. Tests are colocated as `*.test.ts` beside the logic they cover.

## Accessibility

The workspace uses semantic controls and landmarks, visible focus styles, accessible names and status feedback, non-color selection cues, keyboard alternatives for reordering, and reduced-motion styles. Package browsing and output generation remain usable without drag-and-drop or a pointer.

## Deployment

Run `npm run sync:catalog` when a fresh official snapshot is needed, then run `npm run build` before deployment. Vite copies `public/packages.json` into the production output as `packages.json` at the configured base. A successful scheduled sync commits the changed snapshot to the default branch. Git-based hosting integrations may deploy that push automatically; otherwise, start a deployment for the new commit.

The workflow uses the built-in `GITHUB_TOKEN`; its sync job receives only `contents: write`, while the separate deployment job receives only `pages: write` and `id-token: write`. No personal access token or upstream GitHub credential is needed. Repository or organization policy must allow Actions to write to the default branch. If branch protection rejects direct bot commits, allow the GitHub Actions bot for this workflow or adapt it to open a reviewed pull request. As [documented by GitHub](https://docs.github.com/en/actions/concepts/security/github_token#when-github_token-triggers-workflow-runs), a push authenticated with this token does not trigger another GitHub Actions workflow. The sync workflow therefore performs all checks and, when needed, deploys its own Pages artifact. Do not replace it with a personal token merely to chain workflows unless that broader credential and recursion risk are intentionally managed. Never place tokens in `VITE_PACKAGE_API_URL` or another `VITE_` variable.

### Vercel (preferred)

Import the Git repository into Vercel. The committed `vercel.json` selects Vite, runs `npm run build`, publishes `dist/`, and rewrites application routes to `index.html` for SPA deep links. The committed package snapshot is deployed with the rest of the static site. Vercel can otherwise use its standard Git preview and production deployment flow without custom server infrastructure.

### GitHub Pages

The committed `Deploy GitHub Pages` workflow installs dependencies, builds Vite with the repository name as its base path, uploads `dist/`, and deploys it on every push to `main` or a manual dispatch. In **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions** once; publishing the repository root directly will not compile the TypeScript/React source.

GitHub does not trigger another workflow from the catalog bot's `GITHUB_TOKEN` push. The catalog synchronization workflow therefore uploads its already validated Pages build and deploys it directly whenever `public/packages.json` changes.

The current application uses a single browser entry route. If history-based client routes are added later, GitHub Pages will also need a `404.html` fallback or hash-based routing because it does not provide Vercel-style rewrites.

## Rollback

- **Vercel:** promote or redeploy the last known-good deployment from deployment history, then revert the faulty commit before the next production build.
- **GitHub Pages:** revert to a known-good commit and rerun the Pages deployment (or rerun the workflow for that revision).
- Revert `public/packages.json` to the last known-good snapshot, or restore the matching `VITE_PACKAGE_API_URL` value when the incident was caused by a package-source change.

Generated files are portable artifacts only. Review commands and scripts before running them on Windows.
