import { getDashboardModel } from "@/lib/macro-vault/client";

export const dynamic = "force-dynamic";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatLine(label: string, value: string | number | boolean | undefined) {
  return `${label.padEnd(22, " ")} ${value ?? "--"}`;
}

function hasVaultContractGap(explicitCount: number, parsedCount: number) {
  return explicitCount === 0 && parsedCount === 0;
}

const recommendedDashboardFeedShape = {
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
};

export async function GET() {
  const model = await getDashboardModel();
  const { explicitCount, parsedCount, derivedCount } = model.diagnostics.opportunities;
  const missingSections = [
    model.buildups.length === 0 ? "buildups" : "",
    model.events.length === 0 ? "events" : "",
    model.series.length === 0 ? "series" : "",
    model.latest.length === 0 ? "latest" : "",
  ].filter(Boolean);

  const lines = [
    "ASYMMETRICAL MACRO FINDER / VAULT DIAGNOSTICS",
    "",
    formatLine("Mode", model.freshness.mode),
    formatLine("Generated", model.freshness.generatedAt),
    formatLine("Stale", model.freshness.stale),
    formatLine("Buildups", model.buildups.length),
    formatLine("Events", model.events.length),
    formatLine("Series", model.series.length),
    formatLine("Pulse metrics", model.latest.length),
    formatLine("Opportunity mode", model.diagnostics.opportunities.mode),
    formatLine("Explicit opps", explicitCount),
    formatLine("Parsed reports", parsedCount),
    formatLine("Derived buildups", derivedCount),
    "",
    "VAULT CONTRACT GAP",
    hasVaultContractGap(explicitCount, parsedCount)
      ? "Open: live Vault is returning derived watch rows, not explicit opportunity/report payloads."
      : "Closed: live Vault is returning explicit opportunities or parseable raw reports.",
    "",
    "Finder can produce true opportunity reports when dashboard-feed includes one of:",
    "- opportunities, buildups, alerts, reports, or setups rows",
    "- raw report text under rawReport, report, content, text, body, or analysis",
    "- coordinates or Geospatial Lock: lat, lon for map placement",
    "- asset basket fields: primaryLong, primaryShort, proxies, hedge",
    "- catalysts plus downside/invalidation",
    "- optional raw telemetry and source metadata for grounding",
    "",
    "RECOMMENDED DASHBOARD-FEED SHAPE",
    JSON.stringify(recommendedDashboardFeedShape, null, 2),
    "",
    "PARSER COVERAGE",
    ...model.buildups.map((buildup) =>
      [
        buildup.id.padEnd(26, " "),
        buildup.origin.toUpperCase().padEnd(8, " "),
        `coords=${buildup.coordinates ? "yes" : "no"}`.padEnd(12, " "),
        `basket=${buildup.assetBasket.primaryLong && buildup.assetBasket.primaryShort ? "yes" : "no"}`.padEnd(13, " "),
        `telemetry=${buildup.rawTelemetry.length}`,
        buildup.label,
      ].join("  "),
    ),
    model.buildups.length === 0 ? "No buildup candidates available." : "",
    "",
    "LATEST SERIES",
    formatLine("Provider", model.diagnostics.latestSeries.provider),
    formatLine("Code", model.diagnostics.latestSeries.code),
    formatLine("Country", model.diagnostics.latestSeries.country),
    "",
    "ENDPOINTS",
    ...model.diagnostics.endpoints.map((endpoint) =>
      [
        endpoint.endpoint.padEnd(16, " "),
        endpoint.state.toUpperCase().padEnd(7, " "),
        `items=${String(endpoint.itemCount ?? "--").padEnd(4, " ")}`,
        endpoint.status ? `status=${endpoint.status}` : "",
        endpoint.message,
      ]
        .filter(Boolean)
        .join("  "),
    ),
    "",
    "COVERAGE",
    missingSections.length === 0 ? "All dashboard sections have data." : `Missing sections: ${missingSections.join(", ")}`,
    "",
    "ERRORS",
    ...(model.errors.length > 0
      ? model.errors.map((error) => `${error.endpoint}: ${error.message}`)
      : ["None"]),
    "",
  ];

  const text = lines.join("\n");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Vault Diagnostics</title><style>html,body{margin:0;background:#fff;color:#111;}a{display:inline-block;margin:16px 16px 0;color:#111;font:700 12px ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;text-transform:uppercase;}pre{margin:0;padding:16px;font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;white-space:pre-wrap;}</style></head><body><a href="/">Back to dashboard</a><pre>${escapeHtml(text)}</pre></body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
