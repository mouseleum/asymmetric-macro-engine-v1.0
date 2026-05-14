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

export async function GET() {
  const model = await getDashboardModel();
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
    formatLine("Explicit opps", model.diagnostics.opportunities.explicitCount),
    formatLine("Derived buildups", model.diagnostics.opportunities.derivedCount),
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
