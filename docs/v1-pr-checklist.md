# V1 PR Checklist

Use this before merging the Macro Finder V1 dashboard branch.

## Architecture

- Macro Vault is the only data/storage layer.
- No direct Supabase client or Supabase environment dependency is present.
- No Gemini scanning, market-data scraping, Telegram alerting, or write actions are present.
- `MACRO_VAULT_API_KEY` is read only in server-side Macro Vault client code.

## Data Behavior

- Explicit or parsed Vault opportunities render as `Opportunity identified`.
- Derived Vault watch rows render as exploratory/watch-grade unless they clear the strict research gate.
- Alert threshold `0` returns exploratory candidates without presenting them as true alerts.
- Normal thresholds keep watch-grade derived rows below true alert status.
- Raw payload previews are redacted before display.

## Manual Smoke

- `/` renders without a runtime overlay.
- Set `Alert Threshold` to `0`, run research, and confirm `Exploratory candidate`.
- Click `Parser Demo` and confirm `Opportunity identified`.
- Open `Vault Signal Inspector` and then `Raw Vault Payload Preview`.
- Open `/diagnostics` and confirm endpoint-shape inspector, opportunity readiness, contract gap, and recommended `dashboard-feed` shape.

## Verification

```bash
npm run verify
git status -sb
```

The branch should be clean before merge.
