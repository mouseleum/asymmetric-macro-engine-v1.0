import type { Buildup } from "./types";

export const sampleNorthernFrontBuildup: Buildup = {
  id: "sample-northern-front-expansion",
  origin: "example",
  label: "Northern Front Expansion",
  situation:
    "Strategic operational silence is masking the imminent expansion of ground maneuvers into the Litani River basin after a failed ceasefire framework. Markets are misreading a tactical lull as durable de-escalation.",
  coordinates: { lat: 33.27, lon: 35.2, label: "Litani River Basin" },
  observableFacts: [
    "Telemetry shows zero thermal anomalies in South Lebanon and a thin aircraft count in the Levant box, consistent with a blackout or pre-offensive pause.",
    "Leadership language still frames the campaign as prolonged and focused on infrastructure south of the Litani River.",
    "Energy-flow risk remains unresolved despite ceasefire headlines.",
    "European gas storage remains below a critical industrial comfort threshold.",
  ],
  timeline: [
    "Feb 2026: Hormuz closure drives crude repricing.",
    "Apr 2026: ceasefire rumors pull Brent lower and lift the DAX.",
    "Current: kinetic pause creates operational silence while Phase 2 risk remains unresolved.",
  ],
  groundTruth: "Escalating risk masked by operational silence and unresolved energy-flow disruption.",
  marketReaction:
    "Complacent / rallying. The DAX is behaving as if the energy crisis is resolved while crude is pricing de-escalation.",
  binaryEvent:
    "Forces cross the Litani River or strike remaining sovereign infrastructure, shattering the ceasefire narrative.",
  assetBasket: {
    primaryLong: "Brent Crude (BZ=F)",
    primaryShort: "DAX (^GDAXI)",
    proxies: ["PAXG", "FEZ"],
    hedge: "ILS=X",
  },
  sentimentDivergence: {
    groundTruth: "Escalating, with a major operational pause masking troop repositioning risk.",
    mainstreamNews: "Cautiously optimistic around ceasefire headlines and potential diplomatic deals.",
    divergenceLevel: "extreme",
    mispricingLogic:
      "The market is valuing European recovery while ignoring unresolved physical energy disruption and a still-live theater-expansion trigger.",
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
      "Rare-earth supply chains become a tail risk if regional tension spills into great-power escalation.",
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
  rawTelemetry: [
    "[LIVE MARKET_DATA API] ^GDAXI: rallying despite unresolved event risk.",
    "[LIVE MARKET_DATA API] BZ=F: lower on de-escalation pricing.",
    "[LIVE THERMAL_ANOMALIES API] SOUTH LEBANON: 0 anomalies in last 24h.",
    "[LIVE FLIGHT_RADAR API] LEVANT: 3 aircraft in monitored bounding box.",
    "[LIVE ATTENTION_PROXY API] public-interest proxies: flat.",
  ],
  divergenceScore: 91,
  conviction: 90,
  catalysts: [
    "May 15-20, 2026: deal deadline window.",
    "June 1, 2026: expected operational-readiness window.",
  ],
  invalidation:
    "If a durable ceasefire is signed and energy flows normalize, European equities can extend higher while crude collapses toward pre-crisis levels.",
  severity: "extreme",
  status: "example",
  updatedAt: "2026-05-13T20:30:39.000Z",
  sources: [{ title: "Sample old-engine report", url: "https://macro-vault-v3.vercel.app" }],
};
