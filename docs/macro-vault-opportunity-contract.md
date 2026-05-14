# Macro Vault Opportunity Contract

Asymmetrical Macro Finder consumes Macro Vault as the only data/storage layer. The preferred V1 payload is an explicit opportunity array returned from:

`GET /api/vault/dashboard-feed`

The app will use the first array it finds under one of these keys:

- `opportunities`
- `buildups`
- `alerts`
- `reports`
- `setups`

If none are present, the app derives weaker buildup records from generic risk/event rows.

## Example

```json
{
  "generated_at": "2026-05-14T05:00:00.000Z",
  "opportunities": [
    {
      "id": "northern-front-expansion",
      "label": "Northern Front Expansion",
      "situation": "Strategic operational silence is masking the imminent expansion of ground maneuvers into the Litani River basin after a failed ceasefire framework.",
      "coordinates": {
        "lat": 33.27,
        "lon": 35.2,
        "label": "Litani River Basin"
      },
      "observableFacts": [
        "Telemetry shows zero thermal anomalies in South Lebanon.",
        "Leadership language still points to a prolonged operation.",
        "Energy-flow risk remains unresolved despite ceasefire rumors."
      ],
      "timeline": [
        "Feb 2026: Hormuz closure drives crude repricing.",
        "Apr 2026: ceasefire rumors pull Brent lower and lift European equities.",
        "Current: kinetic pause creates operational silence while escalation risk remains unresolved."
      ],
      "binaryEvent": "Forces cross the Litani River or strike remaining sovereign infrastructure.",
      "assetBasket": {
        "primaryLong": "Brent Crude (BZ=F)",
        "primaryShort": "DAX (^GDAXI)",
        "proxies": ["PAXG", "FEZ"],
        "hedge": "ILS=X"
      },
      "marketReaction": "Complacent / rallying. European equities are behaving as if energy and theater-expansion risk has cleared.",
      "sentimentDivergence": {
        "groundTruth": "Escalating risk masked by operational silence.",
        "mainstreamNews": "Cautiously optimistic around ceasefire headlines.",
        "divergenceLevel": "extreme",
        "mispricingLogic": "The market is pricing recovery while unresolved binary escalation risk remains."
      },
      "crowdedness": [
        "Social/Retail Sentiment: quiet.",
        "Institutional Positioning: rotated back toward risk-on.",
        "Short Squeeze Risk: elevated if a kinetic trigger lands."
      ],
      "complacency": {
        "buildupSeverity": "extreme",
        "marketReaction": "None / risk-on",
        "gap": "Critical"
      },
      "scoreBreakdown": {
        "visibility": 18,
        "escalation": 25,
        "mispricing": 24,
        "directness": 23,
        "total": 90
      },
      "action": "Review OTM put options on DAX and long volatility positions.",
      "ultraDeepAnalysis": {
        "tradeStructuring": [
          "Long European energy volatility through TTF gas options.",
          "Use freight futures or route proxies for supply-chain disruption."
        ],
        "redTeam": [
          "Hormuz closure assumptions may be wrong.",
          "Operational silence may represent genuine de-escalation."
        ],
        "secondOrderEffects": [
          "European banks can transmit industrial stress.",
          "Fertilizer and shipping insurance can reprice before equities."
        ],
        "historicalAnalogs": [
          "1973 Oil Crisis.",
          "2022 Russia-Ukraine gas shock."
        ],
        "invalidationTriggers": [
          "Verified full resumption of critical energy flows for two consecutive weeks.",
          "Formal ceasefire plus verifiable troop withdrawal."
        ]
      },
      "catalysts": [
        "May 15-20, 2026: deal deadline window.",
        "June 1, 2026: operational-readiness window."
      ],
      "invalidation": "If a durable ceasefire is signed and energy flows normalize, the trade thesis fails.",
      "rawTelemetry": [
        "[LIVE MARKET_DATA API] ^GDAXI: rallying despite unresolved event risk.",
        "[LIVE THERMAL_ANOMALIES API] SOUTH LEBANON: 0 anomalies in last 24h."
      ],
      "divergenceScore": 91,
      "conviction": 90,
      "severity": "extreme",
      "status": "opportunity",
      "updated_at": "2026-05-14T05:00:00.000Z",
      "sources": [
        {
          "title": "Macro Vault report chain",
          "url": "https://macro-vault-v3.vercel.app"
        }
      ]
    }
  ]
}
```

## Field Notes

- `divergenceScore`, `conviction`, and `scoreBreakdown.total` should be `0-100`.
- `severity` should be one of `low`, `medium`, `high`, or `extreme`.
- `sentimentDivergence.divergenceLevel` should be one of `low`, `medium`, `high`, or `extreme`.
- `coordinates` is optional, but when present it enables the report geospatial lock.
- `rawTelemetry` should contain compact source-prefixed lines, not full raw JSON.
- `ultraDeepAnalysis` is optional. If omitted, the app derives conservative fallback sections.
- The app is read-only. Do not include write actions, ingest commands, Telegram operations, or Supabase references in this payload.
