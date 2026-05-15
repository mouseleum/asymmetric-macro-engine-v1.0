# Asymmetrical Macro Finder

Thin Next.js dashboard for reading Macro Vault intelligence as an editorial macro-risk briefing.

Macro Vault is the only data/storage layer. This app does not connect directly to Supabase, scrape market data, run Gemini scans, or send Telegram alerts.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev -- --port 3000
```

Required server-side environment:

- `MACRO_VAULT_URL`
- `MACRO_VAULT_API_KEY`

Optional mock mode:

- `NEXT_PUBLIC_USE_MOCK_VAULT=true`

When `MACRO_VAULT_API_KEY` is missing, or mock mode is enabled, the app uses local fixtures. With a server-side key present, all Macro Vault reads happen from server code only.

Diagnostics are available at:

`/diagnostics`

The diagnostics page shows endpoint status, endpoint-shape inspection, parser coverage, readiness gaps for each buildup, current Vault contract gaps, and the recommended `dashboard-feed` opportunity shape.

Local dev note: running `npm run build` while `next dev` is active can leave this Next.js dev server in a stale Webpack/runtime state. If the preview shows a black overlay, unformatted page, or stale runtime behavior after a build, restart `npm run dev`.

## Macro Vault Endpoints

The app consumes these server-side only:

- `GET /api/vault/contract`
- `GET /api/vault/dashboard-feed`
- `GET /api/vault/events`
- `GET /api/vault/regime`
- `GET /api/vault/series`
- `GET /api/vault/latest`

## Opportunity Contract

Preferred explicit opportunity payloads are documented in:

`docs/macro-vault-opportunity-contract.md`

If Macro Vault does not return explicit opportunities, the app can derive watch items from generic dashboard-feed rows. Derived items are held below the main alert report unless they clear a strict quality gate.

## Verification

```bash
npm run verify
```

`npm run verify` runs parser/research tests, TypeScript checking, and a production build.
