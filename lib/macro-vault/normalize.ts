import type {
  Buildup,
  DashboardError,
  DashboardDiagnostics,
  DashboardModel,
  MacroEvent,
  PulseMetric,
  RegimeSummary,
  RiskItem,
  SeriesItem,
  VaultEndpoint,
  VaultPayloads,
} from "./types";

type AnyRecord = Record<string, unknown>;

const endpoints: VaultEndpoint[] = [
  "contract",
  "dashboard-feed",
  "events",
  "regime",
  "series",
  "latest",
];

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown, fallback: string[] = []) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (isRecord(item)) return asString(item.title ?? item.label ?? item.text ?? item.summary ?? item.description);
        return "";
      })
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim().length > 0) return [value];
  return fallback;
}

function asTrend(value: unknown): "up" | "down" | "flat" {
  if (value === "up" || value === "down" || value === "flat") return value;
  if (value === "neutral") return "flat";
  return "flat";
}

function asRiskLevel(value: unknown): RegimeSummary["riskLevel"] {
  if (value === "low" || value === "medium" || value === "high" || value === "extreme") return value;
  return "medium";
}

function asSeverity(value: unknown): RiskItem["severity"] {
  if (value === "low" || value === "medium" || value === "high" || value === "extreme") return value;
  if (typeof value === "number") {
    if (value >= 90) return "extreme";
    if (value >= 70) return "high";
    if (value >= 40) return "medium";
    return "low";
  }
  return "medium";
}

function redactRawValue(key: string, value: unknown): unknown {
  if (/api[_-]?key|token|secret|password|authorization|bearer|credential/i.test(key)) return "[REDACTED]";
  if (typeof value === "string") {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
      .replace(/\b(?:sk|pk|eyJ)[A-Za-z0-9._~+/=-]{16,}\b/g, "[REDACTED]");
  }
  return value;
}

function buildRawPreview(value: unknown) {
  try {
    return JSON.stringify(
      value,
      (key, currentValue) => redactRawValue(key, currentValue),
      2,
    ).slice(0, 6000);
  } catch {
    return "[Unable to serialize raw Vault payload]";
  }
}

function normalizeSources(value: unknown): Buildup["sources"] {
  return asArray(value)
    .filter(isRecord)
    .map((source, sourceIndex) => ({
      title: asString(source.title ?? source.name ?? source.source_title, `Source ${sourceIndex + 1}`),
      url: asString(source.url ?? source.href ?? source.source_url, "https://macro-vault-v3.vercel.app"),
    }));
}

function asImpact(value: unknown): MacroEvent["impact"] {
  if (value === "low" || value === "medium" || value === "high") return value;
  if (typeof value === "number") {
    if (value >= 70) return "high";
    if (value >= 40) return "medium";
    return "low";
  }
  return "medium";
}

function getFirstArray(payload: unknown, keys: string[]) {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  for (const key of keys) {
    const candidate = payload[key];
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function normalizeRegime(payload: unknown): RegimeSummary {
  const source = isRecord(payload) ? payload : {};
  const regime = isRecord(source.regime) ? source.regime : source;
  const metadataRegime = isRecord(source.series) && isRecord(source.series.metadata) && isRecord(source.series.metadata.current_regime)
    ? source.series.metadata.current_regime
    : {};
  const merged = { ...metadataRegime, ...regime };
  const riskAppetite = asNumber(merged.risk_appetite, 0.5);

  return {
    label: asString(merged.label ?? merged.name ?? merged.regime, "Unknown Regime"),
    summary: asString(
      merged.summary ?? merged.description ?? merged.reasoning ?? merged.note,
      "Macro Vault has not provided a regime summary yet.",
    ),
    riskLevel: asRiskLevel(merged.risk_level ?? merged.riskLevel ?? merged.severity ?? (riskAppetite >= 0.75 ? "high" : riskAppetite <= 0.25 ? "low" : "medium")),
    updatedAt: asString(
      source.updated_at ?? source.updatedAt ?? source.generated_at ?? source.timestamp ?? (isRecord(source.series) ? source.series.last_synced : undefined),
      new Date().toISOString(),
    ),
  };
}

function normalizeLatest(payload: unknown, riskItems: RiskItem[], events: MacroEvent[]): PulseMetric[] {
  if (isRecord(payload) && isRecord(payload.series) && isRecord(payload.observation)) {
    const series = payload.series;
    const observation = payload.observation;
    const metadata = isRecord(observation.metadata) ? observation.metadata : {};
    return [
      {
        id: asString(series.series_code, "latest-observation"),
        label: asString(series.name ?? series.series_code, "Latest Observation"),
        value: String(observation.value ?? "--"),
        trend: "flat",
        detail: [
          asString(series.provider),
          asString(series.country_code),
          asString(series.unit),
          asString(metadata.classification),
        ].filter(Boolean).join(" / ") || "Macro Vault latest observation",
      },
    ];
  }

  const rows = getFirstArray(payload, ["metrics", "latest", "items", "data"]);
  const metrics = rows
    .filter(isRecord)
    .map((item, index): PulseMetric => ({
      id: asString(item.id, `metric-${index}`),
      label: asString(item.label ?? item.name, `Metric ${index + 1}`),
      value: asString(item.value ?? item.latest, "--"),
      trend: asTrend(item.trend ?? item.direction),
      detail: asString(item.detail ?? item.description ?? item.summary, "Macro Vault latest metric"),
    }));

  if (metrics.length > 0) return metrics;

  const topRisk = riskItems[0];
  return [
    {
      id: "risk-count",
      label: "Risks",
      value: String(riskItems.length),
      trend: "flat",
      detail: "Tracked situations in the dashboard feed",
    },
    {
      id: "top-conviction",
      label: "Top Conviction",
      value: topRisk ? String(topRisk.conviction) : "--",
      trend: topRisk && topRisk.conviction >= 70 ? "up" : "flat",
      detail: topRisk?.title ?? "No high-conviction item available",
    },
    {
      id: "catalysts",
      label: "Catalysts",
      value: String(events.length),
      trend: "flat",
      detail: "Upcoming event count",
    },
  ];
}

function normalizeRiskItems(payload: unknown): RiskItem[] {
  const rows = getFirstArray(payload, ["risks", "items", "feed", "data", "signals", "upcomingCriticalEvents", "events"]);
  return rows.filter(isRecord).map((item, index): RiskItem => {
    const sourceFromEvent = item.source_url
      ? [{ title: asString(item.source_title, "Macro Vault source"), url: asString(item.source_url) }]
      : [];
    const sources = normalizeSources([...asArray(item.sources), ...sourceFromEvent]);
    const impactScore = asNumber(item.impact_score ?? (isRecord(item.metadata) ? item.metadata.impact_score : undefined), 50);
    const confidence = asNumber(item.confidence, 0.5);
    const eventDate = asString(item.event_date ?? item.date);
    const forecast = asString(item.forecast ?? (isRecord(item.metadata) ? item.metadata.forecast : undefined));
    const previous = asString(item.previous ?? (isRecord(item.metadata) ? item.metadata.previous : undefined));
    const catalysts = asArray(item.catalysts).map((catalyst) => asString(catalyst)).filter(Boolean);

    return {
      id: asString(item.id, `risk-${index}`),
      title: asString(item.title ?? item.label ?? item.name, `Risk ${index + 1}`),
      summary: asString(item.summary ?? item.description ?? item.thesis ?? item.narrative, "No summary provided."),
      severity: asSeverity(item.severity ?? item.risk_level ?? item.riskLevel ?? impactScore),
      conviction: Math.max(0, Math.min(100, asNumber(item.conviction ?? item.score, Math.round(confidence * 100)))),
      divergence: Math.max(0, Math.min(100, asNumber(item.divergence ?? item.divergence_score ?? impactScore, 50))),
      status: asString(item.status ?? item.state ?? item.theme ?? item.category, "watch"),
      updatedAt: asString(item.updated_at ?? item.updatedAt ?? item.created_at ?? item.event_date, new Date().toISOString()),
      catalysts: catalysts.length > 0
        ? catalysts
        : [
            eventDate ? `Scheduled date: ${eventDate}` : "",
            forecast ? `Forecast: ${forecast}` : "",
            previous ? `Previous: ${previous}` : "",
          ].filter(Boolean),
      invalidation: asString(item.invalidation ?? item.downside ?? item.risk, "The release lands in line with consensus and produces no cross-asset repricing."),
      sources,
      rawPreview: buildRawPreview(item),
    };
  });
}

function normalizeEvents(payload: unknown): MacroEvent[] {
  const rows = getFirstArray(payload, ["events", "items", "data"]);
  return rows.filter(isRecord).map((event, index): MacroEvent => ({
    id: asString(event.id, `event-${index}`),
    title: asString(event.title ?? event.name, `Event ${index + 1}`),
    date: asString(event.date ?? event.event_date ?? event.starts_at ?? event.timestamp, new Date().toISOString()),
    region: asString(event.region ?? event.country_code ?? event.country ?? event.scope, "Global"),
    impact: asImpact(event.impact ?? event.severity ?? event.impact_score ?? (isRecord(event.metadata) ? event.metadata.impact_score : undefined)),
    summary: asString(event.summary ?? event.description ?? event.narrative, "No event summary provided."),
  }));
}

function normalizeSeries(payload: unknown): SeriesItem[] {
  const rows = getFirstArray(payload, ["series", "items", "data"]);
  return rows.filter(isRecord).map((series, index): SeriesItem => ({
    id: asString(series.id ?? series.key, `series-${index}`),
    label: asString(series.label ?? series.name ?? series.series_code, `Series ${index + 1}`),
    latest: asString(series.latest ?? series.value ?? series.unit, "--"),
    trend: asTrend(series.trend ?? series.direction),
    description: asString(series.description ?? series.detail ?? series.provider, "Macro Vault series"),
    points: asArray(series.points ?? series.data)
      .filter(isRecord)
      .map((point) => ({
        date: asString(point.date ?? point.timestamp, new Date().toISOString()),
        value: asNumber(point.value),
      })),
  }));
}

function compactDate(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function inferAssetBasket(item: RiskItem, series: SeriesItem[]): Buildup["assetBasket"] {
  const text = `${item.title} ${item.summary} ${item.status}`.toLowerCase();
  const seriesLabels = series.map((entry) => entry.label).slice(0, 4);

  if (text.includes("inflation")) {
    return {
      primaryLong: "Rates volatility / inflation-linked exposure",
      primaryShort: "Duration-sensitive equities",
      proxies: ["DXY", "Gold", ...seriesLabels].slice(0, 4),
      hedge: "Broad equity index exposure",
    };
  }

  if (text.includes("gdp") || text.includes("growth") || text.includes("pmi")) {
    return {
      primaryLong: "Quality defensives",
      primaryShort: "Cyclical growth beta",
      proxies: ["Industrial metals", "Regional FX", ...seriesLabels].slice(0, 4),
      hedge: "Long volatility or cash buffer",
    };
  }

  if (text.includes("oil") || text.includes("energy") || text.includes("shipping")) {
    return {
      primaryLong: "Energy complex",
      primaryShort: "Energy-importer equities",
      proxies: ["Brent/WTI", "Freight", "European cyclicals", ...seriesLabels].slice(0, 4),
      hedge: "Broad commodity basket",
    };
  }

  return {
    primaryLong: "Macro-sensitive beneficiary basket",
    primaryShort: "Complacent risk beta",
    proxies: seriesLabels.length > 0 ? seriesLabels : ["DXY", "Gold", "Rates volatility"],
    hedge: "Position-size and event-risk hedge",
  };
}

function normalizeAssetBasket(value: unknown, fallback: Buildup["assetBasket"]): Buildup["assetBasket"] {
  if (!isRecord(value)) return fallback;
  return {
    primaryLong: asString(value.primaryLong ?? value.primary_long ?? value.long, fallback.primaryLong),
    primaryShort: asString(value.primaryShort ?? value.primary_short ?? value.short, fallback.primaryShort),
    proxies: asStringArray(value.proxies ?? value.correlatedProxies ?? value.correlated_proxies, fallback.proxies),
    hedge: asString(value.hedge ?? value.secondary ?? value.hedgeSecondary ?? value.hedge_secondary, fallback.hedge),
  };
}

function buildObservableFacts(item: RiskItem, regime: RegimeSummary) {
  const facts = [
    item.summary,
    item.catalysts[0] ? `Catalyst in view: ${item.catalysts[0]}` : "",
    `Macro regime context: ${regime.label}`,
    item.sources[0] ? `Source tier available through Macro Vault: ${item.sources[0].title}` : "",
  ].filter(Boolean);

  return facts.slice(0, 4);
}

function buildTimeline(item: RiskItem, regime: RegimeSummary) {
  return [
    `Prior: Macro Vault regime classified as ${regime.label}.`,
    item.catalysts[0] ? `Current: ${item.catalysts[0]}` : `Current: ${item.status} signal remains active in the Vault feed.`,
    `Trigger: ${item.title} either confirms the buildup or invalidates the setup.`,
  ];
}

function divergenceLevel(value: number): "low" | "medium" | "high" | "extreme" {
  if (value >= 90) return "extreme";
  if (value >= 70) return "high";
  if (value >= 40) return "medium";
  return "low";
}

function buildScoreBreakdown(item: RiskItem): Buildup["scoreBreakdown"] {
  const total = Math.max(0, Math.min(100, Math.round((item.conviction + item.divergence) / 2)));
  return {
    visibility: Math.max(1, Math.min(25, Math.round((100 - item.divergence) / 4))),
    escalation: Math.max(1, Math.min(25, Math.round(item.conviction / 4))),
    mispricing: Math.max(1, Math.min(25, Math.round(item.divergence / 4))),
    directness: Math.max(1, Math.min(25, Math.round((item.conviction + item.divergence) / 8))),
    total,
  };
}

function buildRawTelemetry(item: RiskItem, series: SeriesItem[]) {
  return [
    `[MACRO_VAULT FEED] ${item.title}: conviction ${item.conviction}/100, divergence ${item.divergence}/100, severity ${item.severity}.`,
    `[MACRO_VAULT STATUS] ${item.status}. Updated ${compactDate(item.updatedAt) || item.updatedAt}.`,
    ...series.slice(0, 4).map((entry) => `[MACRO_VAULT SERIES] ${entry.label}: latest ${entry.latest}. ${entry.description}`),
  ];
}

function buildUltraDeepAnalysis(item: RiskItem, assetBasket: Buildup["assetBasket"]): Buildup["ultraDeepAnalysis"] {
  return {
    tradeStructuring: [
      `Express the thesis through ${assetBasket.primaryLong} rather than only the headline instrument when liquidity and convexity are acceptable.`,
      `Use ${assetBasket.proxies.slice(0, 2).join(" and ") || "correlated proxies"} to separate direct event exposure from broad beta.`,
      `Keep ${assetBasket.hedge} defined before entry; this is an event-risk setup, not a static allocation.`,
    ],
    redTeam: [
      "The market may already be correctly discounting the risk through instruments not shown in the headline dashboard.",
      "The apparent pause may be genuine de-escalation rather than pre-event repositioning.",
      "Alternative supply, policy response, or liquidity support could blunt the expected repricing.",
      "Blind spot: current Vault telemetry may be incomplete or lagging relative to private market positioning.",
    ],
    secondOrderEffects: [
      "Watch credit conditions for stress transmission beyond the first asset pair.",
      "Monitor input-cost-sensitive sectors for delayed earnings impact.",
      "Track insurance, freight, funding, or volatility surfaces for non-obvious confirmation.",
    ],
    historicalAnalogs: [
      "Compare with prior supply-shock episodes where equities initially faded the risk before repricing.",
      "Review similar policy or conflict windows where the first market move was a false calm.",
      "Look for historical price action in the primary long, primary short, and hedge legs around analog periods.",
    ],
    invalidationTriggers: [
      item.invalidation,
      "The binary catalyst window passes without confirming evidence.",
      "The short leg strengthens while the long/proxy legs fail to confirm stress.",
    ],
  };
}

function normalizeCoordinates(value: unknown): Buildup["coordinates"] {
  if (!isRecord(value)) return undefined;
  const lat = asNumber(value.lat ?? value.latitude, Number.NaN);
  const lon = asNumber(value.lon ?? value.lng ?? value.longitude, Number.NaN);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  return {
    lat,
    lon,
    label: asString(value.label ?? value.name),
  };
}

function normalizeSentimentDivergence(value: unknown, item: RiskItem): Buildup["sentimentDivergence"] {
  const level = divergenceLevel(item.divergence);
  if (!isRecord(value)) {
    return {
      groundTruth: `${item.status} signal held in Macro Vault with ${item.conviction}/100 conviction.`,
      mainstreamNews: item.divergence >= 70 ? "Complacent or lagging versus the Vault signal." : "Partially aligned with the Vault signal.",
      divergenceLevel: level,
      mispricingLogic: item.divergence >= 70
        ? "The market is not fully pricing the event risk implied by the Vault signal and nearby catalysts."
        : "The market has acknowledged some risk, so sizing should wait for a cleaner gap or better catalyst.",
    };
  }

  return {
    groundTruth: asString(value.groundTruth ?? value.ground_truth, `${item.status} signal held in Macro Vault with ${item.conviction}/100 conviction.`),
    mainstreamNews: asString(value.mainstreamNews ?? value.mainstream_news ?? value.news, "No mainstream-news read supplied by Macro Vault."),
    divergenceLevel: divergenceLevel(asNumber(value.divergenceLevel ?? value.divergence_level ?? value.level_score, item.divergence)),
    mispricingLogic: asString(value.mispricingLogic ?? value.mispricing_logic ?? value.logic, "No mispricing logic supplied by Macro Vault."),
  };
}

function normalizeComplacency(value: unknown, item: RiskItem): Buildup["complacency"] {
  const level = divergenceLevel(item.divergence);
  if (!isRecord(value)) {
    return {
      buildupSeverity: item.severity,
      marketReaction: item.divergence >= 70 ? "Complacent / underreacting" : "Partially reacting",
      gap: level === "extreme" ? "Critical" : level === "high" ? "High" : level === "medium" ? "Moderate" : "Low",
    };
  }
  return {
    buildupSeverity: asString(value.buildupSeverity ?? value.buildup_severity ?? value.severity, item.severity),
    marketReaction: asString(value.marketReaction ?? value.market_reaction, item.divergence >= 70 ? "Complacent / underreacting" : "Partially reacting"),
    gap: asString(value.gap, level === "extreme" ? "Critical" : level === "high" ? "High" : level === "medium" ? "Moderate" : "Low"),
  };
}

function normalizeScoreBreakdown(value: unknown, item: RiskItem): Buildup["scoreBreakdown"] {
  const fallback = buildScoreBreakdown(item);
  if (!isRecord(value)) return fallback;
  const total = asNumber(value.total ?? value.score, fallback.total);
  return {
    visibility: Math.max(0, Math.min(25, asNumber(value.visibility, fallback.visibility))),
    escalation: Math.max(0, Math.min(25, asNumber(value.escalation, fallback.escalation))),
    mispricing: Math.max(0, Math.min(25, asNumber(value.mispricing, fallback.mispricing))),
    directness: Math.max(0, Math.min(25, asNumber(value.directness, fallback.directness))),
    total: Math.max(0, Math.min(100, total)),
  };
}

function normalizeUltraDeepAnalysis(value: unknown, fallback: Buildup["ultraDeepAnalysis"]): Buildup["ultraDeepAnalysis"] {
  if (!isRecord(value)) return fallback;
  return {
    tradeStructuring: asStringArray(value.tradeStructuring ?? value.trade_structuring ?? value.proxies, fallback.tradeStructuring),
    redTeam: asStringArray(value.redTeam ?? value.red_team ?? value.devilsAdvocate ?? value.devils_advocate, fallback.redTeam),
    secondOrderEffects: asStringArray(value.secondOrderEffects ?? value.second_order_effects ?? value.effects, fallback.secondOrderEffects),
    historicalAnalogs: asStringArray(value.historicalAnalogs ?? value.historical_analogs ?? value.analogs, fallback.historicalAnalogs),
    invalidationTriggers: asStringArray(value.invalidationTriggers ?? value.invalidation_triggers ?? value.killSwitch ?? value.kill_switch, fallback.invalidationTriggers),
  };
}

type ParsedReport = {
  label?: string;
  situation?: string;
  coordinates?: Buildup["coordinates"];
  observableFacts?: string[];
  timeline?: string[];
  binaryEvent?: string;
  assetBasket?: Partial<Buildup["assetBasket"]>;
  marketReaction?: string;
  sentimentDivergence?: Partial<Buildup["sentimentDivergence"]>;
  crowdedness?: string[];
  catalysts?: string[];
  invalidation?: string;
  action?: string;
  rawTelemetry?: string[];
  ultraDeepAnalysis?: Partial<Buildup["ultraDeepAnalysis"]>;
  divergenceScore?: number;
  conviction?: number;
  scoreBreakdown?: Partial<Buildup["scoreBreakdown"]>;
};

const reportSectionNames = [
  "BUILDUP DETECTED",
  "OBSERVABLE FACTS",
  "TIMELINE",
  "BINARY EVENT IMPLIED",
  "ASSET CORRELATION BASKET",
  "MARKET REACTION",
  "SENTIMENT DIVERGENCE",
  "CROWDEDNESS INDICATOR",
  "COMPLACENCY CHECK",
  "UPCOMING CATALYSTS",
  "SCORE",
  "DOWNSIDE",
  "RAW TELEMETRY DATA",
  "ULTRA DEEP ANALYSIS",
  "TRADE STRUCTURING",
  "RED TEAMING",
  "SECOND & THIRD-ORDER EFFECTS",
  "HISTORICAL ANALOGS",
  "INVALIDATION TRIGGERS",
];

function getRawReport(raw: AnyRecord) {
  return asString(raw.rawReport ?? raw.raw_report ?? raw.report ?? raw.content ?? raw.text ?? raw.body ?? raw.analysis);
}

function cleanReportText(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripLinePrefix(value: string) {
  return value
    .replace(/^[\s>*•\-–—]+/, "")
    .replace(/^Event\s*$/i, "")
    .trim();
}

function splitReportLines(value: string) {
  return value
    .split("\n")
    .map((line) => stripLinePrefix(line))
    .filter(Boolean);
}

function scoreFromText(value: string | undefined) {
  if (!value) return undefined;
  const match = value.match(/(?:DIVERGENCE\s*(?:METER|SCORE)?|TOTAL|SCORE)\s*:?\s*(\d{1,3})(?:\s*\/\s*100)?/i);
  if (!match) return undefined;
  return Math.max(0, Math.min(100, Number(match[1])));
}

function extractBracketValue(report: string, label: string) {
  const match = report.match(new RegExp(`\\[${label}\\s*:\\s*([^\\]]+)\\]`, "i"));
  return match?.[1]?.trim();
}

function extractSection(report: string, headings: string[]) {
  const escaped = headings.map((heading) => heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const allHeadings = reportSectionNames.map((heading) => heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const optionalParenthetical = `(?:\\s*\\([^\\n)]*\\))?`;
  const match = report.match(new RegExp(`(?:^|\\n)\\s*(?:${escaped})${optionalParenthetical}\\s*:?\\s*\\n?([\\s\\S]*?)(?=\\n\\s*(?:${allHeadings})${optionalParenthetical}\\s*:?\\s*(?:\\n|$)|$)`, "i"));
  return match?.[1]?.trim();
}

function extractInlineField(report: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = report.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*:\\s*([^\\n]+)`, "i"));
  return match?.[1]?.trim();
}

function extractAction(report: string) {
  return report.match(/(?:^|\n)\s*(?:→\s*)?ACTION\s*:\s*([^\n]+)/i)?.[1]?.trim();
}

function parseCoordinates(report: string): Buildup["coordinates"] {
  const bracket = extractBracketValue(report, "COORDINATES");
  const geospatial = report.match(/Geospatial Lock\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i);
  const coordinateText = bracket ?? (geospatial ? `${geospatial[1]}, ${geospatial[2]}` : "");
  const match = coordinateText.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  return {
    lat: Number(match[1]),
    lon: Number(match[2]),
  };
}

function firstStrongHeading(report: string) {
  return splitReportLines(report).find((line) => /^[A-Z0-9][A-Z0-9\s"'()/:.-]{5,}$/.test(line) && !reportSectionNames.some((heading) => line.toUpperCase().startsWith(heading)));
}

function parseAssetBasket(report: string): ParsedReport["assetBasket"] | undefined {
  const section = extractSection(report, ["ASSET CORRELATION BASKET", "ASSET CORRELATION BASKET (The \"Basket\")"]);
  if (!section) return undefined;
  return {
    primaryLong: extractInlineField(section, "PRIMARY LONG"),
    primaryShort: extractInlineField(section, "PRIMARY SHORT"),
    proxies: asStringArray(extractInlineField(section, "CORRELATED PROXIES")?.split(/\s*&\s*|\s*,\s*/)),
    hedge: extractInlineField(section, "HEDGE/SECONDARY") ?? extractInlineField(section, "HEDGE"),
  };
}

function parseSentimentDivergence(report: string, divergenceScore?: number): ParsedReport["sentimentDivergence"] | undefined {
  const section = extractSection(report, ["SENTIMENT DIVERGENCE"]);
  if (!section) return undefined;
  return {
    groundTruth: extractInlineField(section, "Ground Truth"),
    mainstreamNews: extractInlineField(section, "Mainstream News"),
    divergenceLevel: divergenceLevel(divergenceScore ?? scoreFromText(section) ?? 50),
    mispricingLogic: extractInlineField(section, "Mispricing Logic"),
  };
}

function parseUltraDeepSection(report: string, headings: string[]) {
  return asStringArray(extractSection(report, headings)?.split(/\n(?=[A-Z][A-Za-z0-9 "'()/&.-]+:\s*)|\n{2,}/));
}

function normalizeParsedAssetBasket(value: ParsedReport["assetBasket"], fallback: Buildup["assetBasket"]): Buildup["assetBasket"] {
  if (!value) return fallback;
  return {
    primaryLong: asString(value.primaryLong, fallback.primaryLong),
    primaryShort: asString(value.primaryShort, fallback.primaryShort),
    proxies: value.proxies && value.proxies.length > 0 ? value.proxies : fallback.proxies,
    hedge: asString(value.hedge, fallback.hedge),
  };
}

function normalizeParsedUltraDeep(value: ParsedReport["ultraDeepAnalysis"], fallback: Buildup["ultraDeepAnalysis"]): Buildup["ultraDeepAnalysis"] {
  if (!value) return fallback;
  return {
    tradeStructuring: value.tradeStructuring && value.tradeStructuring.length > 0 ? value.tradeStructuring : fallback.tradeStructuring,
    redTeam: value.redTeam && value.redTeam.length > 0 ? value.redTeam : fallback.redTeam,
    secondOrderEffects: value.secondOrderEffects && value.secondOrderEffects.length > 0 ? value.secondOrderEffects : fallback.secondOrderEffects,
    historicalAnalogs: value.historicalAnalogs && value.historicalAnalogs.length > 0 ? value.historicalAnalogs : fallback.historicalAnalogs,
    invalidationTriggers: value.invalidationTriggers && value.invalidationTriggers.length > 0 ? value.invalidationTriggers : fallback.invalidationTriggers,
  };
}

function parseRawReport(value: string): ParsedReport | undefined {
  const report = cleanReportText(value);
  if (!report) return undefined;

  const buildupSection = extractSection(report, ["BUILDUP DETECTED"]);
  const situation = extractInlineField(report, "Situation") ?? splitReportLines(buildupSection ?? "")[0];
  const divergenceScore = scoreFromText(report.match(/DIVERGENCE METER[\s\S]*?(?=\n|$)/i)?.[0] ?? report);
  const totalScore = scoreFromText(extractSection(report, ["SCORE"]) ?? report);
  const observableFacts = splitReportLines(extractSection(report, ["OBSERVABLE FACTS"]) ?? "").slice(0, 8);
  const timelineText = extractSection(report, ["TIMELINE"]);
  const rawTelemetry = splitReportLines(extractSection(report, ["RAW TELEMETRY DATA"]) ?? "");

  return {
    label: extractBracketValue(report, "LABEL") ?? firstStrongHeading(report),
    situation,
    coordinates: parseCoordinates(report),
    observableFacts: observableFacts.length > 0 ? observableFacts : undefined,
    timeline: timelineText ? timelineText.split(/\s*→\s*|\n/).map(stripLinePrefix).filter(Boolean) : undefined,
    binaryEvent: extractSection(report, ["BINARY EVENT IMPLIED"]),
    assetBasket: parseAssetBasket(report),
    marketReaction: extractInlineField(report, "MARKET REACTION") ?? extractSection(report, ["MARKET REACTION"]),
    sentimentDivergence: parseSentimentDivergence(report, divergenceScore),
    crowdedness: splitReportLines(extractSection(report, ["CROWDEDNESS INDICATOR"]) ?? ""),
    catalysts: splitReportLines(extractSection(report, ["UPCOMING CATALYSTS"]) ?? "").filter((line) => !/^Event$/i.test(line)),
    invalidation: extractSection(report, ["DOWNSIDE"]),
    action: extractAction(report),
    rawTelemetry: rawTelemetry.length > 0 ? rawTelemetry : undefined,
    divergenceScore,
    conviction: totalScore ?? divergenceScore,
    scoreBreakdown: totalScore ? { total: totalScore } : undefined,
    ultraDeepAnalysis: {
      tradeStructuring: parseUltraDeepSection(report, ["TRADE STRUCTURING & PROXIES", "TRADE STRUCTURING"]),
      redTeam: parseUltraDeepSection(report, ["RED TEAMING", "RED TEAMING (DEVIL'S ADVOCATE)"]),
      secondOrderEffects: parseUltraDeepSection(report, ["SECOND & THIRD-ORDER EFFECTS", "SECOND & THIRD ORDER EFFECTS"]),
      historicalAnalogs: parseUltraDeepSection(report, ["HISTORICAL ANALOGS"]),
      invalidationTriggers: parseUltraDeepSection(report, ["INVALIDATION TRIGGERS", "INVALIDATION TRIGGERS (KILL SWITCH)"]),
    },
  };
}

function riskItemFromOpportunity(raw: AnyRecord, index: number, parsed?: ParsedReport): RiskItem {
  const divergence = Math.max(0, Math.min(100, asNumber(raw.divergenceScore ?? raw.divergence_score ?? raw.divergenceMeter ?? raw.divergence_meter ?? raw.divergence, parsed?.divergenceScore ?? 50)));
  const conviction = Math.max(0, Math.min(100, asNumber(raw.conviction ?? raw.convictionScore ?? raw.conviction_score ?? raw.score, parsed?.conviction ?? divergence)));
  const sources = normalizeSources(raw.sources);
  return {
    id: asString(raw.id, `opportunity-${index}`),
    title: asString(raw.label ?? raw.title ?? raw.name, parsed?.label ?? `Opportunity ${index + 1}`),
    summary: asString(raw.situation ?? raw.summary ?? raw.thesis ?? raw.description, parsed?.situation ?? "No situation supplied by Macro Vault."),
    severity: asSeverity(raw.severity ?? raw.riskLevel ?? raw.risk_level ?? divergence),
    conviction,
    divergence,
    status: asString(raw.status ?? raw.state, "opportunity"),
    updatedAt: asString(raw.updatedAt ?? raw.updated_at ?? raw.createdAt ?? raw.created_at ?? raw.timestamp, new Date().toISOString()),
    catalysts: asStringArray(raw.catalysts ?? raw.upcomingCatalysts ?? raw.upcoming_catalysts, parsed?.catalysts),
    invalidation: asString(raw.invalidation ?? raw.downside ?? raw.risk, parsed?.invalidation ?? "No downside scenario supplied by Macro Vault."),
    sources,
    rawPreview: buildRawPreview(raw),
  };
}

function normalizeExplicitBuildups(payload: unknown, regime: RegimeSummary, series: SeriesItem[]): Buildup[] {
  const rows = getFirstArray(payload, ["buildups", "opportunities", "alerts", "reports", "setups"]);
  return rows.filter(isRecord).map((raw, index): Buildup => {
    const parsed = parseRawReport(getRawReport(raw));
    const item = riskItemFromOpportunity(raw, index, parsed);
    const fallbackBasket = inferAssetBasket(item, series);
    const parsedBasket = normalizeParsedAssetBasket(parsed?.assetBasket, fallbackBasket);
    const assetBasket = normalizeAssetBasket(raw.assetBasket ?? raw.asset_basket ?? raw.basket, parsedBasket);
    const fallbackUltraDeep = buildUltraDeepAnalysis(item, assetBasket);
    const parsedUltraDeep = normalizeParsedUltraDeep(parsed?.ultraDeepAnalysis, fallbackUltraDeep);
    const binaryEvent = asString(raw.binaryEvent ?? raw.binary_event ?? raw.trigger ?? raw.binaryTrigger ?? raw.binary_trigger, parsed?.binaryEvent ?? item.catalysts[0] ?? "A catalyst confirms or invalidates the setup.");
    const timeline = asStringArray(raw.timeline, parsed?.timeline ?? buildTimeline(item, regime));
    const scoreBreakdown = normalizeScoreBreakdown(raw.scoreBreakdown ?? raw.score_breakdown ?? raw.score, item);
    const parsedScoreTotal = parsed?.scoreBreakdown?.total;

    return {
      id: item.id,
      origin: parsed ? "parsed" : "explicit",
      label: item.title,
      situation: item.summary,
      coordinates: normalizeCoordinates(raw.coordinates ?? raw.coordinate ?? raw.location) ?? parsed?.coordinates,
      observableFacts: asStringArray(raw.observableFacts ?? raw.observable_facts ?? raw.facts, parsed?.observableFacts ?? buildObservableFacts(item, regime)),
      timeline,
      groundTruth: asString(raw.groundTruth ?? raw.ground_truth, `${item.status} signal held in Macro Vault with ${item.conviction}/100 confidence.`),
      marketReaction: asString(raw.marketReaction ?? raw.market_reaction, parsed?.marketReaction ?? (item.divergence >= 70 ? "Market reaction appears underpriced versus the Vault signal." : "Market reaction is partial or aligned.")),
      binaryEvent,
      assetBasket,
      sentimentDivergence: normalizeSentimentDivergence(raw.sentimentDivergence ?? raw.sentiment_divergence ?? parsed?.sentimentDivergence, item),
      crowdedness: asStringArray(raw.crowdedness ?? raw.crowdednessIndicator ?? raw.crowdedness_indicator, parsed?.crowdedness && parsed.crowdedness.length > 0 ? parsed.crowdedness : [
        item.divergence >= 70 ? "Social/Retail Sentiment: Quiet or distracted relative to the signal." : "Social/Retail Sentiment: Partially aware.",
        item.conviction >= 70 ? "Institutional Positioning: Vulnerable to repricing if the catalyst confirms." : "Institutional Positioning: No clear crowding edge supplied by Vault.",
        item.divergence >= 70 ? "Short Squeeze Risk: Elevated if the binary event lands." : "Short Squeeze Risk: Moderate.",
      ]),
      complacency: normalizeComplacency(raw.complacency ?? raw.complacencyCheck ?? raw.complacency_check, item),
      scoreBreakdown: parsedScoreTotal && !isRecord(raw.scoreBreakdown ?? raw.score_breakdown) ? { ...scoreBreakdown, total: parsedScoreTotal } : scoreBreakdown,
      action: asString(raw.action ?? raw.recommendedAction ?? raw.recommended_action, parsed?.action ?? `Review ${assetBasket.primaryLong} versus ${assetBasket.primaryShort}; use ${assetBasket.hedge} as the risk-control leg.`),
      ultraDeepAnalysis: normalizeUltraDeepAnalysis(raw.ultraDeepAnalysis ?? raw.ultra_deep_analysis ?? raw.deepAnalysis ?? raw.deep_analysis, parsedUltraDeep),
      rawTelemetry: asStringArray(raw.rawTelemetry ?? raw.raw_telemetry ?? raw.telemetry, parsed?.rawTelemetry ?? buildRawTelemetry(item, series)),
      divergenceScore: item.divergence,
      conviction: item.conviction,
      catalysts: item.catalysts,
      invalidation: item.invalidation,
      severity: item.severity,
      status: item.status,
      updatedAt: item.updatedAt,
      sources: item.sources,
      rawPreview: item.rawPreview,
    };
  });
}

function normalizeDerivedBuildups(riskItems: RiskItem[], regime: RegimeSummary, series: SeriesItem[]): Buildup[] {
  return riskItems.map((item): Buildup => {
    const eventDate = compactDate(item.updatedAt);
    const binaryEvent =
      item.catalysts.find((catalyst) => catalyst.toLowerCase().startsWith("scheduled date:")) ??
      (eventDate ? `Scheduled macro release on ${eventDate}` : "A catalyst confirms or invalidates the setup");
    const assetBasket = inferAssetBasket(item, series);
    const scoreBreakdown = buildScoreBreakdown(item);
    const ultraDeepAnalysis = buildUltraDeepAnalysis(item, assetBasket);
    const level = divergenceLevel(item.divergence);

    return {
      id: item.id,
      origin: "derived",
      label: item.title,
      situation: item.summary,
      coordinates: undefined,
      observableFacts: buildObservableFacts(item, regime),
      timeline: buildTimeline(item, regime),
      groundTruth: `${item.status} signal held in Macro Vault with ${item.conviction}/100 confidence.`,
      marketReaction:
        item.divergence >= 70
          ? "Market reaction appears underpriced versus the Vault signal."
          : item.divergence >= 45
            ? "Market reaction is partial, with room for repricing if the catalyst lands."
            : "Market reaction is broadly aligned; treat this as a watch item.",
      binaryEvent,
      assetBasket,
      sentimentDivergence: {
        groundTruth: `${item.status} signal held in Macro Vault with ${item.conviction}/100 conviction.`,
        mainstreamNews: item.divergence >= 70 ? "Complacent or lagging versus the Vault signal." : "Partially aligned with the Vault signal.",
        divergenceLevel: level,
        mispricingLogic: item.divergence >= 70
          ? "The market is not fully pricing the event risk implied by the Vault signal and nearby catalysts."
          : "The market has acknowledged some risk, so sizing should wait for a cleaner gap or better catalyst.",
      },
      crowdedness: [
        item.divergence >= 70 ? "Social/Retail Sentiment: Quiet or distracted relative to the signal." : "Social/Retail Sentiment: Partially aware.",
        item.conviction >= 70 ? "Institutional Positioning: Vulnerable to repricing if the catalyst confirms." : "Institutional Positioning: No clear crowding edge supplied by Vault.",
        item.divergence >= 70 ? "Short Squeeze Risk: Elevated if the binary event lands." : "Short Squeeze Risk: Moderate.",
      ],
      complacency: {
        buildupSeverity: item.severity,
        marketReaction: item.divergence >= 70 ? "Complacent / underreacting" : "Partially reacting",
        gap: level === "extreme" ? "Critical" : level === "high" ? "High" : level === "medium" ? "Moderate" : "Low",
      },
      scoreBreakdown,
      action: `Review ${assetBasket.primaryLong} versus ${assetBasket.primaryShort}; use ${assetBasket.hedge} as the risk-control leg.`,
      ultraDeepAnalysis,
      rawTelemetry: buildRawTelemetry(item, series),
      divergenceScore: item.divergence,
      conviction: item.conviction,
      catalysts: item.catalysts,
      invalidation: item.invalidation,
      severity: item.severity,
      status: item.status,
      updatedAt: item.updatedAt,
      sources: item.sources,
      rawPreview: item.rawPreview,
    };
  });
}

function normalizeBuildups(payload: unknown, riskItems: RiskItem[], regime: RegimeSummary, series: SeriesItem[]): Buildup[] {
  const explicit = normalizeExplicitBuildups(payload, regime, series);
  if (explicit.length > 0) return explicit;
  return normalizeDerivedBuildups(riskItems, regime, series);
}

function countExplicitOpportunities(payload: unknown) {
  return getFirstArray(payload, ["buildups", "opportunities", "alerts", "reports", "setups"]).filter(isRecord).length;
}

function deriveGeneratedAt(payloads: VaultPayloads) {
  for (const endpoint of endpoints) {
    const payload = payloads[endpoint];
    if (isRecord(payload)) {
      const value = payload.generated_at ?? payload.generatedAt ?? payload.updated_at ?? payload.updatedAt;
      if (typeof value === "string") return value;
    }
  }
  return new Date().toISOString();
}

export function normalizeDashboardModel(
  payloads: VaultPayloads,
  errors: DashboardError[],
  mode: DashboardModel["freshness"]["mode"],
  diagnostics?: DashboardDiagnostics,
): DashboardModel {
  const riskItems = normalizeRiskItems(payloads["dashboard-feed"]);
  const events = normalizeEvents(payloads.events);
  const series = normalizeSeries(payloads.series);
  const generatedAt = deriveGeneratedAt(payloads);
  const regime = normalizeRegime(payloads.regime);
  const explicitOpportunityCount = countExplicitOpportunities(payloads["dashboard-feed"]);
  const buildups = normalizeBuildups(payloads["dashboard-feed"], riskItems, regime, series);
  const explicitCount = buildups.filter((buildup) => buildup.origin === "explicit").length;
  const parsedCount = buildups.filter((buildup) => buildup.origin === "parsed").length;
  const derivedCount = buildups.filter((buildup) => buildup.origin === "derived").length;
  const normalizedDiagnostics: DashboardDiagnostics = {
    endpoints: diagnostics?.endpoints ?? [],
    latestSeries: diagnostics?.latestSeries ?? {
      provider: "alternative_me",
      code: "ALT_FNG",
      country: "WLD",
    },
    opportunities: {
      mode: parsedCount > 0 ? "parsed" : explicitCount > 0 ? "explicit" : "derived",
      explicitCount,
      parsedCount,
      derivedCount: explicitOpportunityCount > 0 ? derivedCount : riskItems.length,
    },
  };

  return {
    contract: payloads.contract ?? {},
    regime,
    latest: normalizeLatest(payloads.latest, riskItems, events),
    riskItems,
    buildups,
    events,
    series,
    freshness: {
      generatedAt,
      stale: Date.now() - new Date(generatedAt).getTime() > 1000 * 60 * 60 * 24,
      mode,
    },
    errors,
    diagnostics: normalizedDiagnostics,
  };
}
