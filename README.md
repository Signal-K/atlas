# Atlas

Offline-first astronomical events, calendar, watchlist, and citizen-science
companion webapp, backed by the shared Star Sailors PocketBase instance.

See `~/Navigation/workspace/projects/atlas/docs/brief.md` for the product
brief and `~/Navigation/pm-vault` (project `atlas`, ticket prefix `AT`) for
the ticket breakdown.

## Stack

- Vite + React + TypeScript, installable as a PWA (`vite-plugin-pwa`).
- Local-first data layer: IndexedDB (Dexie) mirrors the PocketBase
  collections; a sync queue flushes offline writes when reconnected
  (`src/lib/db.ts`, full sync engine tracked as AT-003).
- PocketBase JS SDK client in `src/lib/pocketbase.ts`.
- Widget-based dashboard: widgets self-register via
  `src/widgets/registry.ts` (events, watchlist, weather, streak,
  citizen-science &mdash; see AT-005 through AT-009).
- Event-source plugins (moon phase, meteor showers, ISS passes, ...) run
  out-of-band via scheduled GitHub Actions workflows, not in the app
  runtime (AT-004, AT-010, AT-011).

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_PB_URL` in `.env.local` to the PocketBase instance to use.
