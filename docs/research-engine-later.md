# Research Engine Later

Finder V1 stays read-only and downstream-only. Alert discovery and deep research should live upstream in Macro Vault or a Macro Vault-adjacent worker.

## Recommended Pipeline

1. Scout pass gathers source material from search and telemetry providers such as Tavily, Exa, Brave Search, GDELT, FRED, shipping, flight, satellite, or Wikipedia attention data.
2. Buildup extraction turns source material into candidate asymmetric setups with Gemini, OpenAI, or another structured-output model.
3. Deep validation stress-tests only the best candidates with OpenAI Deep Research, Claude Web Search, Perplexity Sonar Deep Research, or an equivalent provider.
4. Macro Vault stores the result as an explicit opportunity or raw old-engine-style report.
5. Finder reads Macro Vault, parses the report, and renders it as an editorial macro-risk briefing.

## Finder Boundary

- No provider keys in the browser.
- No Supabase client.
- No writeback, ingest, scanner, Telegram, or local persistence in Finder V1.
- Provider choice should remain configurable upstream so quality and cost can be compared without changing Finder UI.
