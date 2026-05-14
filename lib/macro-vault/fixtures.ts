import type { VaultPayloads } from "./types";

const now = "2026-05-13T14:30:00.000Z";

export const mockVaultPayloads: Required<VaultPayloads> = {
  contract: {
    name: "Macro Vault API",
    version: "v3",
    endpoints: [
      "/api/vault/contract",
      "/api/vault/dashboard-feed",
      "/api/vault/events",
      "/api/vault/regime",
      "/api/vault/series",
      "/api/vault/latest",
    ],
  },
  "dashboard-feed": {
    generated_at: now,
    opportunities: [
      {
        id: "northern-front-expansion",
        label: "Northern Front Expansion",
        situation:
          "Strategic operational silence is masking the risk of expanded ground maneuvers after a failed ceasefire framework. Markets are treating the lull as de-escalation.",
        coordinates: { lat: 33.27, lon: 35.2, label: "Litani River Basin" },
        observableFacts: [
          "Telemetry shows no thermal anomalies in the monitored zone, consistent with a tactical pause rather than confirmed de-escalation.",
          "Leadership language still points to a prolonged operation and remaining infrastructure targets.",
          "Energy-flow risk remains unresolved despite ceasefire rumors.",
          "European industrial sensitivity to another energy shock remains elevated.",
        ],
        timeline: [
          "Feb 2026: energy-flow disruption drives crude repricing.",
          "Apr 2026: ceasefire rumors pull crude lower and lift European equities.",
          "Current: kinetic pause creates operational silence while positioning risk remains unresolved.",
        ],
        binaryEvent:
          "Forces cross the Litani River or strike remaining sovereign infrastructure, breaking the ceasefire narrative.",
        assetBasket: {
          primaryLong: "Brent Crude (BZ=F)",
          primaryShort: "DAX (^GDAXI)",
          proxies: ["PAXG", "FEZ"],
          hedge: "ILS=X",
        },
        marketReaction:
          "Complacent / rallying. European equities are behaving as if energy and theater-expansion risk has cleared.",
        sentimentDivergence: {
          groundTruth: "Escalating risk masked by operational silence.",
          mainstreamNews: "Cautiously optimistic around ceasefire and deal headlines.",
          divergenceLevel: "extreme",
          mispricingLogic:
            "The market is pricing a recovery while the physical and security setup still contains unresolved binary escalation risk.",
        },
        crowdedness: [
          "Social/Retail Sentiment: quiet; attention is focused on the equity rally.",
          "Institutional Positioning: rotated back toward risk-on after the lull.",
          "Short Squeeze Risk: elevated if a kinetic trigger forces commodity hedges back on.",
        ],
        complacency: {
          buildupSeverity: "extreme",
          marketReaction: "None / risk-on",
          gap: "Critical",
        },
        scoreBreakdown: {
          visibility: 18,
          escalation: 25,
          mispricing: 24,
          directness: 23,
          total: 90,
        },
        action: "Review OTM put options on DAX and long volatility positions.",
        ultraDeepAnalysis: {
          tradeStructuring: [
            "Long European energy volatility through TTF gas options rather than relying only on a broad DAX short.",
            "Use freight futures or container-rate proxies to express supply-chain disruption if the route-risk thesis confirms.",
            "Consider USD/NOK as a less crowded commodity and European-risk expression than a direct Brent-only trade.",
          ],
          redTeam: [
            "Hormuz closure assumptions may be wrong if shadow flows or alternative supply routes are offsetting the headline disruption.",
            "Operational silence may represent genuine de-escalation instead of pre-offensive repositioning.",
            "The DAX rally may reflect sector strength or adaptation rather than pure complacency.",
            "A surprise diplomatic deal would be directly hostile to the thesis.",
          ],
          secondOrderEffects: [
            "European banks could transmit industrial stress through credit exposure to energy-intensive firms.",
            "Fertilizer prices can rise if gas inputs spike, feeding food-inflation pressure.",
            "Shipping insurance rates may widen before broad markets acknowledge route disruption.",
          ],
          historicalAnalogs: [
            "1973 Oil Crisis: energy-sensitive equities repriced violently after supply risk became undeniable.",
            "2011 Libyan Civil War: smaller supply disruption still produced a temporary crude spike.",
            "2022 Russia-Ukraine shock: closest analog for European gas and industrial-production stress.",
          ],
          invalidationTriggers: [
            "Verified full resumption of critical energy flows for two consecutive weeks.",
            "DAX sustains a decisive break above the risk-on threshold without confirming stress in energy proxies.",
            "Formal ceasefire plus verifiable troop withdrawal from the relevant border zone.",
          ],
        },
        catalysts: [
          "May 15-20, 2026: deal deadline window.",
          "June 1, 2026: expected operational-readiness window.",
        ],
        invalidation:
          "If a durable ceasefire is signed and energy flows normalize, European equities can extend higher while crude collapses toward pre-crisis levels.",
        rawTelemetry: [
          "[LIVE MARKET_DATA API] ^GDAXI: rallying despite unresolved event risk.",
          "[LIVE MARKET_DATA API] BZ=F: lower on de-escalation pricing.",
          "[LIVE THERMAL_ANOMALIES API] monitored zone: 0 anomalies in last 24h.",
          "[LIVE ATTENTION_PROXY API] relevant public-interest proxies: flat.",
        ],
        divergenceScore: 91,
        conviction: 90,
        severity: "extreme",
        status: "opportunity",
        updated_at: now,
        sources: [
          { title: "Macro Vault example chain", url: "https://macro-vault-v3.vercel.app" },
        ],
      },
    ],
    risks: [
      {
        id: "hormuz-energy-beta",
        title: "Hormuz Energy Beta",
        summary:
          "Shipping risk is no longer a headline abstraction. European cyclicals remain priced as if crude logistics stay ordinary.",
        severity: "high",
        conviction: 82,
        divergence: 76,
        status: "building",
        updated_at: now,
        catalysts: ["OPEC monitoring update", "EU gas storage release", "Next EIA inventory print"],
        invalidation: "Brent backwardation compresses while tanker routing normalizes.",
        sources: [
          { title: "Macro Vault event chain", url: "https://macro-vault-v3.vercel.app" },
        ],
      },
      {
        id: "jpy-volatility-pressure",
        title: "JPY Volatility Pressure",
        summary:
          "Rates volatility is pressing against funding trades while public risk appetite still reads benign.",
        severity: "medium",
        conviction: 68,
        divergence: 61,
        status: "watch",
        updated_at: "2026-05-13T12:20:00.000Z",
        catalysts: ["BOJ communication window", "US real-yield repricing"],
        invalidation: "Dollar-yen range compresses with lower realized vol.",
        sources: [],
      },
      {
        id: "credit-liquidity-crack",
        title: "Credit Liquidity Crack",
        summary:
          "Credit spreads are not yet confirming the deterioration visible in liquidity-sensitive series.",
        severity: "medium",
        conviction: 64,
        divergence: 58,
        status: "early",
        updated_at: "2026-05-13T09:45:00.000Z",
        catalysts: ["Primary issuance calendar", "HY ETF flow data"],
        invalidation: "Breadth improves and spreads tighten on rising volume.",
        sources: [],
      },
    ],
  },
  events: {
    events: [
      {
        id: "evt-001",
        title: "Energy Inventory Window",
        date: "2026-05-14",
        region: "Global Energy",
        impact: "high",
        summary: "Inventory data tests whether physical tightness is becoming visible in pricing.",
      },
      {
        id: "evt-002",
        title: "Central Bank Communication Cluster",
        date: "2026-05-15",
        region: "US / Japan / Europe",
        impact: "medium",
        summary: "Policy language can either validate or deflate the rates-volatility setup.",
      },
      {
        id: "evt-003",
        title: "European Industrial PMI",
        date: "2026-05-21",
        region: "Europe",
        impact: "medium",
        summary: "Industrial data checks whether energy-sensitive demand is rolling over.",
      },
    ],
  },
  regime: {
    label: "Late-Cycle Fragility",
    summary:
      "The regime is defined by acceptable headline liquidity, narrow leadership, and rising sensitivity to energy and funding shocks.",
    risk_level: "high",
    updated_at: now,
  },
  series: {
    series: [
      {
        id: "brent-term-structure",
        label: "Brent Term Structure",
        latest: "+0.84",
        trend: "up",
        description: "Physical crude tightness proxy",
        points: [
          { date: "2026-05-07", value: 0.31 },
          { date: "2026-05-08", value: 0.38 },
          { date: "2026-05-09", value: 0.44 },
          { date: "2026-05-10", value: 0.52 },
          { date: "2026-05-11", value: 0.66 },
          { date: "2026-05-12", value: 0.71 },
          { date: "2026-05-13", value: 0.84 },
        ],
      },
      {
        id: "vix-front",
        label: "VIX Front",
        latest: "18.7",
        trend: "flat",
        description: "Equity risk complacency proxy",
        points: [
          { date: "2026-05-07", value: 17.9 },
          { date: "2026-05-08", value: 18.1 },
          { date: "2026-05-09", value: 18.5 },
          { date: "2026-05-10", value: 18.4 },
          { date: "2026-05-11", value: 18.6 },
          { date: "2026-05-12", value: 18.8 },
          { date: "2026-05-13", value: 18.7 },
        ],
      },
      {
        id: "dxy",
        label: "DXY",
        latest: "104.2",
        trend: "up",
        description: "Dollar funding pressure proxy",
        points: [
          { date: "2026-05-07", value: 103.1 },
          { date: "2026-05-08", value: 103.4 },
          { date: "2026-05-09", value: 103.8 },
          { date: "2026-05-10", value: 103.7 },
          { date: "2026-05-11", value: 104.0 },
          { date: "2026-05-12", value: 104.1 },
          { date: "2026-05-13", value: 104.2 },
        ],
      },
    ],
  },
  latest: {
    generated_at: now,
    metrics: [
      { id: "risk", label: "Risk", value: "High", trend: "up", detail: "Composite vault risk state" },
      { id: "asymmetry", label: "Asymmetry", value: "82", trend: "up", detail: "Top divergence score" },
      { id: "freshness", label: "Freshness", value: "Live-ish", trend: "flat", detail: "Fixture timestamp" },
      { id: "events", label: "Catalysts", value: "3", trend: "flat", detail: "Upcoming tracked events" },
    ],
  },
};
