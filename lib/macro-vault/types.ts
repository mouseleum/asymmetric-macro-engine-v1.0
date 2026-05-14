export type VaultEndpoint =
  | "contract"
  | "dashboard-feed"
  | "events"
  | "regime"
  | "series"
  | "latest";

export type DataMode = "mock" | "live";

export interface SourceLink {
  title: string;
  url: string;
}

export interface RiskItem {
  id: string;
  title: string;
  summary: string;
  severity: "low" | "medium" | "high" | "extreme";
  conviction: number;
  divergence: number;
  status: string;
  updatedAt: string;
  catalysts: string[];
  invalidation: string;
  sources: SourceLink[];
}

export interface AssetBasket {
  primaryLong: string;
  primaryShort: string;
  proxies: string[];
  hedge: string;
}

export interface SentimentDivergence {
  groundTruth: string;
  mainstreamNews: string;
  divergenceLevel: "low" | "medium" | "high" | "extreme";
  mispricingLogic: string;
}

export interface ComplacencyCheck {
  buildupSeverity: string;
  marketReaction: string;
  gap: string;
}

export interface ScoreBreakdown {
  visibility: number;
  escalation: number;
  mispricing: number;
  directness: number;
  total: number;
}

export interface Coordinates {
  lat: number;
  lon: number;
  label?: string;
}

export interface UltraDeepAnalysis {
  tradeStructuring: string[];
  redTeam: string[];
  secondOrderEffects: string[];
  historicalAnalogs: string[];
  invalidationTriggers: string[];
}

export interface Buildup {
  id: string;
  origin: "explicit" | "derived" | "example";
  label: string;
  situation: string;
  coordinates?: Coordinates;
  observableFacts: string[];
  timeline: string[];
  groundTruth: string;
  marketReaction: string;
  binaryEvent: string;
  assetBasket: AssetBasket;
  sentimentDivergence: SentimentDivergence;
  crowdedness: string[];
  complacency: ComplacencyCheck;
  scoreBreakdown: ScoreBreakdown;
  action: string;
  ultraDeepAnalysis: UltraDeepAnalysis;
  rawTelemetry: string[];
  divergenceScore: number;
  conviction: number;
  catalysts: string[];
  invalidation: string;
  severity: RiskItem["severity"];
  status: string;
  updatedAt: string;
  sources: SourceLink[];
}

export interface MacroEvent {
  id: string;
  title: string;
  date: string;
  region: string;
  impact: "low" | "medium" | "high";
  summary: string;
}

export interface SeriesPoint {
  date: string;
  value: number;
}

export interface SeriesItem {
  id: string;
  label: string;
  latest: string;
  trend: "up" | "down" | "flat";
  description: string;
  points: SeriesPoint[];
}

export interface PulseMetric {
  id: string;
  label: string;
  value: string;
  trend: "up" | "down" | "flat";
  detail: string;
}

export interface RegimeSummary {
  label: string;
  summary: string;
  riskLevel: "low" | "medium" | "high" | "extreme";
  updatedAt: string;
}

export interface Freshness {
  generatedAt: string;
  oldestInputAt?: string;
  stale: boolean;
  mode: DataMode;
}

export interface DashboardError {
  endpoint: VaultEndpoint | "environment";
  message: string;
  status?: number;
}

export interface EndpointDiagnostic {
  endpoint: VaultEndpoint | "environment";
  state: "ok" | "mock" | "error";
  message: string;
  status?: number;
  itemCount?: number;
}

export interface DashboardDiagnostics {
  endpoints: EndpointDiagnostic[];
  latestSeries: {
    provider: string;
    code: string;
    country: string;
  };
  opportunities: {
    mode: "explicit" | "derived";
    explicitCount: number;
    derivedCount: number;
  };
}

export interface DashboardModel {
  contract: unknown;
  regime: RegimeSummary;
  latest: PulseMetric[];
  riskItems: RiskItem[];
  buildups: Buildup[];
  events: MacroEvent[];
  series: SeriesItem[];
  freshness: Freshness;
  errors: DashboardError[];
  diagnostics: DashboardDiagnostics;
}

export interface VaultPayloads {
  contract?: unknown;
  "dashboard-feed"?: unknown;
  events?: unknown;
  regime?: unknown;
  series?: unknown;
  latest?: unknown;
}
