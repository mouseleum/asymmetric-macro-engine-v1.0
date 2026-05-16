export const recommendedDashboardFeedPayload = {
  generated_at: "2026-05-15T00:00:00.000Z",
  opportunities: [
    {
      id: "hormuz-blockade",
      label: "Hormuz Blockade",
      status: "opportunity",
      severity: "high",
      conviction: 85,
      divergenceScore: 88,
      coordinates: {
        lat: 26.56,
        lon: 56.25,
        label: "Strait of Hormuz",
      },
      assetBasket: {
        primaryLong: "Brent Crude (BZ=F)",
        primaryShort: "European cyclicals",
        proxies: ["TTF gas", "PAXG", "freight rates"],
        hedge: "USD cash",
      },
      catalysts: [
        "Next tanker-insurance renewal window.",
        "Next EU gas storage print.",
      ],
      invalidation: "Two consecutive weeks of normalized tanker flow and compressed insurance spreads.",
      report: "[LABEL: Hormuz Blockade]\n[COORDINATES: 26.56, 56.25]\n\nBUILDUP DETECTED\nSituation: Maritime chokepoint pressure around Hormuz is being treated as temporary noise while energy importers remain priced for uninterrupted flows.\n\nDIVERGENCE METER: 88/100",
      rawTelemetry: [
        "[LIVE SHIPPING_PROXY API] Hormuz: elevated delay signal.",
        "[LIVE MARKET_DATA API] BZ=F: route-risk premium muted.",
      ],
      sources: [
        {
          title: "Macro Vault report",
          url: "https://macro-vault-v3.vercel.app",
        },
      ],
    },
  ],
} as const;

export const recommendedDashboardFeedPayloadText = JSON.stringify(recommendedDashboardFeedPayload, null, 2);
