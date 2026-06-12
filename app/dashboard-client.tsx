"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Copy,
  Database,
  ExternalLink,
  History,
  Loader2,
  MapPin,
  Pin,
  RadioTower,
  Search,
  Target,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  buildupTheme,
  candidateQuality,
  candidateRejectionReasons,
  clampScore,
  createScanningResearchRun,
  passesDerivedQualityGate,
  rejectionSummary,
  runResearchPass as runResearchPassModel,
  scoreBuildupWithoutKeywordFilter,
  type ResearchRun,
} from "@/lib/macro-vault/research";
import { sampleNorthernFrontBuildup } from "@/lib/macro-vault/sample-buildup";
import { recommendedDashboardFeedPayloadText } from "@/lib/macro-vault/recommended-payload";
import type { Buildup, DashboardModel, RiskItem } from "@/lib/macro-vault/types";

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function formatShortTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function severityClass(severity: RiskItem["severity"]) {
  return {
    low: "text-good",
    medium: "text-muted",
    high: "text-accent",
    extreme: "text-warn",
  }[severity];
}

function opportunityStatusText(model: DashboardModel, reportableCount: number) {
  if (model.diagnostics.opportunities.parsedCount > 0) {
    return `${model.diagnostics.opportunities.parsedCount} raw Vault report${model.diagnostics.opportunities.parsedCount === 1 ? "" : "s"} parsed into opportunities.`;
  }
  if (model.diagnostics.opportunities.explicitCount > 0) {
    return `${model.diagnostics.opportunities.explicitCount} explicit opportunities returned by Macro Vault.`;
  }
  if (reportableCount > 0) {
    return `${reportableCount} derived item cleared the strict alert gate.`;
  }
  return `No explicit opportunities returned. ${model.diagnostics.opportunities.derivedCount} derived Vault watch items held below the alert gate.`;
}

function parserCoverageText(model: DashboardModel) {
  const { explicitCount, parsedCount, derivedCount } = model.diagnostics.opportunities;
  const coordinateCount = model.buildups.filter((buildup) => buildup.coordinates).length;
  const telemetryCount = model.buildups.filter((buildup) => buildup.rawTelemetry.length > 0).length;

  return `${parsedCount} parsed raw // ${explicitCount} explicit // ${derivedCount} derived // ${coordinateCount} mapped // ${telemetryCount} telemetry-backed`;
}

function hasVaultContractGap(model: DashboardModel) {
  return model.diagnostics.opportunities.explicitCount === 0 && model.diagnostics.opportunities.parsedCount === 0;
}

function vaultContractGapText(model: DashboardModel) {
  if (!hasVaultContractGap(model)) return "Vault opportunity contract satisfied.";
  return "Vault contract gap: Finder needs explicit opportunity/report rows or raw report text to produce true alerts.";
}

function vaultContractStatusLabel(model: DashboardModel) {
  if (!hasVaultContractGap(model)) return "True opportunity feed";
  return model.freshness.mode === "live" ? "Live feed: watch-grade only" : "Mock feed: fixture/watch-grade";
}

function originLabel(buildup: Buildup) {
  return {
    explicit: "Vault explicit",
    parsed: "Parsed report",
    derived: "Derived watch item",
    example: "Example report",
  }[buildup.origin];
}

function mapExternalUrl(buildup: Buildup) {
  if (!buildup.coordinates) return "";
  const { lat, lon } = buildup.coordinates;
  return `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lon.toFixed(5)}#map=7/${lat.toFixed(5)}/${lon.toFixed(5)}`;
}

function mapRegion(buildup: Buildup) {
  const lat = buildup.coordinates?.lat;
  const lon = buildup.coordinates?.lon;
  if (lat && lon && lat >= 24 && lat <= 28.5 && lon >= 52 && lon <= 59) return "hormuz";
  if (lat && lon && lat >= 31 && lat <= 35.5 && lon >= 33 && lon <= 37) return "levant";
  return "generic";
}

function LocalMapLayer({ buildup }: { buildup: Buildup }) {
  const region = mapRegion(buildup);
  const isGeneric = region === "generic";
  const labels =
    region === "hormuz"
      ? [
          ["IRAN", "left-[46%] top-[18%]"],
          ["QATAR", "left-[31%] top-[62%]"],
          ["UAE", "left-[43%] top-[65%]"],
          ["OMAN", "left-[55%] top-[78%]"],
        ]
      : region === "levant"
        ? [
            ["LEBANON", "left-[47%] top-[42%]"],
            ["SYRIA", "left-[54%] top-[30%]"],
            ["ISRAEL", "left-[45%] top-[63%]"],
            ["MEDITERRANEAN SEA", "left-[7%] top-[43%]"],
          ]
        : [];

  return (
    <div className="absolute inset-0 bg-[#f8f8f5]">
      {isGeneric ? (
        <>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(20,20,20,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(20,20,20,0.035)_1px,transparent_1px)] bg-[length:120px_90px]" />
          <div className="absolute left-1/2 top-1/2 h-[54%] w-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/15" />
          <div className="absolute left-1/2 top-1/2 h-px w-[74%] -translate-x-1/2 bg-accent/10" />
          <div className="absolute left-1/2 top-1/2 h-[74%] w-px -translate-y-1/2 bg-accent/10" />
          <div className="absolute left-10 top-8 font-mono text-[11px] font-bold uppercase tracking-normal text-muted/55">
            No Coordinates Supplied
          </div>
          <div className="absolute bottom-8 right-10 text-right font-mono text-[11px] font-bold uppercase tracking-normal text-muted/55">
            Vault Signal Cluster
          </div>
        </>
      ) : (
        <>
          <div className="absolute left-[4%] top-[16%] h-[58%] w-[88%] rotate-[-4deg] rounded-[48%] border border-accent/10 bg-white/70" />
          <div className="absolute left-[24%] top-[27%] h-[45%] w-[52%] rotate-[10deg] rounded-[55%] bg-[#cfd7d8]" />
          <div className="absolute left-[34%] top-[10%] h-[48%] w-[25%] rotate-[15deg] rounded-[48%] bg-[#f8f8f5]" />
          <div className="absolute left-[50%] top-[25%] h-[54%] w-[38%] rotate-[6deg] rounded-[50%] bg-[#cfd7d8]" />
        </>
      )}
      {labels.map(([label, position]) => (
        <span
          key={label}
          className={cn(
            "absolute font-mono text-[11px] font-bold uppercase tracking-normal text-[#9aa8b2] drop-shadow-[0_1px_0_rgba(255,255,255,0.9)] md:text-lg",
            position,
          )}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function StatusBanner({ model }: { model: DashboardModel }) {
  if (model.errors.length === 0 && model.freshness.mode === "live") return null;

  return (
    <div className="border-b border-line bg-paper px-5 py-3">
      <div className="flex items-start gap-2 font-mono text-[11px] uppercase text-muted">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        <span>
          Vault status: {model.freshness.mode === "mock" ? "fixture mode" : "partial live data"} //{" "}
          {model.errors[0]?.message ?? "Macro Vault returned partial data."}
        </span>
      </div>
    </div>
  );
}

function VaultContractStatus({ model, feedStatus }: { model: DashboardModel; feedStatus: string }) {
  const { explicitCount, parsedCount, derivedCount } = model.diagnostics.opportunities;
  const contractGap = hasVaultContractGap(model);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "unavailable">("idle");

  async function copyRecommendedPayload() {
    try {
      await navigator.clipboard.writeText(recommendedDashboardFeedPayloadText);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("unavailable");
    }
  }

  return (
    <section className="border-b border-line/10 bg-paper px-5 py-4 md:px-10" aria-label="Vault contract status">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={cn(
                "inline-flex items-center gap-2 border px-3 py-2 font-mono text-[10px] font-bold uppercase",
                contractGap
                  ? "border-accent/30 bg-accent/5 text-accent"
                  : "border-good/30 bg-good/5 text-good",
              )}
            >
              <Database className="h-3.5 w-3.5" aria-hidden="true" />
              {vaultContractStatusLabel(model)}
            </span>
            <span className="font-mono text-[11px] uppercase text-muted">
              {explicitCount} explicit / {parsedCount} parsed / {derivedCount} derived
            </span>
          </div>
          <p className="mt-3 max-w-4xl font-mono text-[11px] uppercase leading-relaxed text-muted">
            {contractGap
              ? "True alerts require explicit opportunities or raw old-engine reports from Macro Vault. Current rows are interpreted as watch-grade signals."
              : "Macro Vault is supplying reportable opportunity payloads. Finder can render true alert reports from the live contract."}
          </p>
          <p className="mt-2 max-w-4xl font-mono text-[11px] uppercase leading-relaxed text-muted/75">
            {feedStatus}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={copyRecommendedPayload}
            className={cn(
              "inline-flex h-11 items-center justify-center gap-2 border px-4 font-mono text-[11px] font-bold uppercase hover:border-accent hover:text-accent",
              copyState === "unavailable"
                ? "border-warn/40 bg-warn/5 text-warn"
                : "border-line/20 bg-bg text-ink",
            )}
          >
            {copyState === "copied" ? (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {copyState === "copied"
              ? "Payload Copied"
              : copyState === "unavailable"
                ? "Copy Unavailable"
                : "Copy Vault Payload"}
          </button>
          <a
            href="/diagnostics"
            className="inline-flex h-11 items-center justify-center gap-2 border border-line/20 bg-bg px-4 font-mono text-[11px] font-bold uppercase text-ink hover:border-accent hover:text-accent"
          >
            Diagnostics
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}

function Masthead({ model }: { model: DashboardModel }) {
  return (
    <aside className="border-b border-line p-5 lg:border-b-0 lg:border-r">
      <h1 className="max-w-[180px] text-4xl font-extrabold uppercase leading-[0.98] tracking-normal">
        Asymmetric Macro Finder
      </h1>
      <div className="mt-5 space-y-1 font-mono text-xs uppercase leading-relaxed text-muted">
        <p>Editorial macro-risk</p>
        <p>briefing // Data:</p>
        <p>Macro Vault</p>
      </div>
      <div className="mt-6 inline-flex items-center gap-2 border border-line/20 bg-paper px-3 py-2 font-mono text-[10px] font-bold uppercase text-muted">
        <Database className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
        {model.freshness.mode === "live" ? "Live Vault" : "Mock Vault"}
      </div>
    </aside>
  );
}

function CommandBar({
  model,
  buildups,
  onComplete,
  onStart,
  onLoadExample,
  onLoadParserDemo,
}: {
  model: DashboardModel;
  buildups: Buildup[];
  onStart: (run: ResearchRun) => void;
  onComplete: (run: ResearchRun) => void;
  onLoadExample: () => void;
  onLoadParserDemo?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [targetEditorOpen, setTargetEditorOpen] = useState(false);
  const [threshold, setThreshold] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const queryInputRef = useRef<HTMLInputElement>(null);

  function runResearchPass() {
    const startedAt = new Date().toISOString();
    onStart(createScanningResearchRun({
      buildups,
      query,
      threshold,
      startedAt,
    }));
    setIsRunning(true);
    window.setTimeout(() => {
      setIsRunning(false);
      onComplete(runResearchPassModel({
        buildups,
        query,
        threshold,
        startedAt,
        completedAt: new Date().toISOString(),
      }));
    }, 450);
  }

  return (
    <div className="p-5 lg:p-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
        <label className="sr-only" htmlFor="target-opportunity">
          Target opportunity
        </label>
        <div className="relative min-w-0 flex-1 xl:max-w-[420px]" onClick={() => queryInputRef.current?.focus()}>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            ref={queryInputRef}
            id="target-opportunity"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Target Opportunity"
            className="h-12 w-full border border-line/10 bg-paper pl-11 pr-4 font-mono text-sm uppercase outline-none placeholder:text-muted/35 hover:border-accent focus:border-accent"
          />
        </div>
        <button
          type="button"
          onClick={() => setTargetEditorOpen((value) => !value)}
          className="inline-flex h-12 min-w-[118px] items-center justify-center border border-line/20 bg-paper px-4 font-mono text-[11px] font-bold uppercase text-ink hover:border-accent hover:text-accent"
        >
          Set Target
        </button>

        <div className="flex min-w-0 flex-wrap items-center gap-3 border border-line/10 bg-paper px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 border-r border-line/10 pr-4 font-mono text-[11px] font-bold uppercase text-muted">
            <RadioTower className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            Local pass over loaded Vault signals
          </div>
          <label htmlFor="alert-threshold" className="font-mono text-[11px] uppercase text-muted">
            Alert Threshold:
          </label>
          <input
            id="alert-threshold"
            type="number"
            min="0"
            max="100"
            value={threshold}
            onChange={(event) => setThreshold(clampScore(Number(event.target.value)))}
            className="h-8 w-16 border border-line/15 bg-bg px-2 text-center font-mono text-xs outline-none focus:border-accent"
          />
        </div>

        <button
          type="button"
          onClick={runResearchPass}
          disabled={isRunning || buildups.length === 0}
          className="inline-flex h-14 min-w-[170px] items-center justify-center gap-2 bg-ink px-6 font-mono text-sm font-bold uppercase tracking-normal text-bg hover:bg-accent hover:text-ink disabled:cursor-not-allowed disabled:bg-ink/20 disabled:text-muted"
        >
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Target className="h-4 w-4" aria-hidden="true" />}
          Run Research
        </button>
        <button
          type="button"
          onClick={onLoadExample}
          className="inline-flex h-14 min-w-[150px] items-center justify-center gap-2 border border-line/20 bg-paper px-5 font-mono text-xs font-bold uppercase text-ink hover:border-accent hover:text-accent"
        >
          Example Report
        </button>
        {onLoadParserDemo ? (
          <button
            type="button"
            onClick={onLoadParserDemo}
            className="inline-flex h-14 min-w-[145px] items-center justify-center gap-2 border border-line/20 bg-paper px-5 font-mono text-xs font-bold uppercase text-ink hover:border-accent hover:text-accent"
          >
            Parser Demo
          </button>
        ) : null}
      </div>

      {targetEditorOpen ? (
        <div className="mt-4 border border-line/10 bg-paper p-4">
          <label htmlFor="target-opportunity-expanded" className="font-mono text-[11px] font-bold uppercase text-muted">
            Target opportunity
          </label>
          <textarea
            id="target-opportunity-expanded"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type search words, tickers, region, thesis..."
            className="mt-2 min-h-24 w-full resize-y border border-line/10 bg-bg p-3 font-mono text-sm outline-none placeholder:text-muted/45 focus:border-accent"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {["Hormuz", "energy shock", "DAX", "Lebanon", "credit stress"].map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => setQuery(target)}
                className="border border-line/10 px-3 py-2 font-mono text-[10px] font-bold uppercase text-muted hover:border-accent hover:text-accent"
              >
                {target}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] uppercase text-muted">
        <span>Regime: {model.regime.label}</span>
        <span>Refresh: {formatShortTime(model.freshness.generatedAt)}</span>
        {model.latest.slice(0, 3).map((metric) => (
          <span key={metric.id}>
            {metric.label}: <b className="text-ink">{metric.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function SignalMap({ buildup }: { buildup: Buildup }) {
  const externalUrl = mapExternalUrl(buildup);

  return (
    <div className="border border-line/10 bg-[#eef0ed] p-1">
      <div className="relative h-[260px] overflow-hidden border-b border-line/10 md:h-[360px]">
        <LocalMapLayer buildup={buildup} />
        <div className="pointer-events-none absolute inset-0 z-20 bg-white/10" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 h-8 w-8 -translate-x-1/2 -translate-y-1/2">
          <span className="signal-pulse absolute inset-0 rounded-full bg-accent/45" />
          <span className="absolute left-1/2 top-1/2 block h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-accent shadow-[0_0_0_1px_#f27d26,0_6px_20px_rgba(242,125,38,0.35)]" />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f2f2f0] px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
        <span className="inline-flex items-center gap-2">
          <MapPin className="h-4 w-4" aria-hidden="true" />
          {buildup.coordinates
            ? `Geospatial Lock: ${buildup.coordinates.lat.toFixed(2)}, ${buildup.coordinates.lon.toFixed(2)}${buildup.coordinates.label ? ` // ${buildup.coordinates.label}` : ""}`
            : "Geospatial Lock: Vault-derived signal cluster"}
        </span>
        {externalUrl ? (
          <a href={externalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 hover:text-accent">
            Open map
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h4 className="font-mono text-[11px] font-bold uppercase tracking-normal text-muted">{children}</h4>;
}

function FactList({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink/70">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="font-mono text-accent">//</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function TradeBasket({ buildup }: { buildup: Buildup }) {
  const basketItems = [
    ["Primary Long", buildup.assetBasket.primaryLong, "text-good"],
    ["Primary Short", buildup.assetBasket.primaryShort, "text-warn"],
    ["Correlated Proxies", buildup.assetBasket.proxies.join(" & "), "text-accent"],
    ["Hedge / Secondary", buildup.assetBasket.hedge, "text-muted"],
  ];

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {basketItems.map(([label, value, color]) => (
        <div key={label} className="border border-line/10 bg-bg/45 p-4">
          <p className="font-mono text-[10px] font-bold uppercase text-muted">{label}</p>
          <p className={cn("mt-3 text-lg font-semibold leading-tight", color)}>{value || "Not supplied"}</p>
        </div>
      ))}
    </div>
  );
}

function SourceGrounding({ buildup }: { buildup: Buildup }) {
  return (
    <div className="mt-8 border-t border-line/10 pt-8">
      <SectionTitle>Source Grounding</SectionTitle>
      {buildup.sources.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {buildup.sources.slice(0, 4).map((source) => (
            <a
              key={`${source.title}-${source.url}`}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-4 border border-line/10 bg-bg/45 px-4 py-3 font-mono text-[11px] uppercase text-muted hover:border-accent hover:text-accent"
            >
              <span>{source.title}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </a>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-ink/70">
          Macro Vault did not attach source links to this signal. Treat it as watch-grade until grounding improves.
        </p>
      )}
    </div>
  );
}

function OpportunityReport({ buildup, model }: { buildup: Buildup; model: DashboardModel }) {
  const [copied, setCopied] = useState(false);
  const quality = candidateQuality(buildup);
  const rejectionReasons = candidateRejectionReasons(buildup, quality);
  const isExploratoryCandidate = buildup.origin === "derived" && !passesDerivedQualityGate(buildup);
  const hasCoordinates = Boolean(buildup.coordinates);
  const reportKicker = isExploratoryCandidate ? "Exploratory candidate" : "Opportunity identified";
  const reportTitle = isExploratoryCandidate ? "Candidate Detected" : "Buildup Detected";

  async function copyRawSummary() {
    const summary = [
      `Label: ${buildup.label}`,
      `Situation: ${buildup.situation}`,
      `Conviction: ${buildup.conviction}`,
      `Divergence: ${buildup.divergenceScore}`,
      `Binary Event: ${buildup.binaryEvent}`,
      `Market Reaction: ${buildup.marketReaction}`,
      `Action: ${buildup.action}`,
      `Downside: ${buildup.invalidation}`,
    ].join("\n");

    try {
      if (!navigator.clipboard?.writeText) return;
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className={cn("mx-auto max-w-5xl border bg-paper p-6 shadow-[10px_10px_0_#141414] md:p-10", isExploratoryCandidate ? "border-line" : "border-accent")}>
      <header className="border-b border-line/10 pb-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            {isExploratoryCandidate ? (
              <AlertTriangle className="mt-1 h-7 w-7 shrink-0 text-muted" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="mt-1 h-7 w-7 shrink-0 text-accent" aria-hidden="true" />
            )}
            <div>
              <h2 className="text-2xl font-extrabold uppercase leading-tight md:text-3xl">{buildup.label}</h2>
              <p className="mt-2 font-mono text-xs uppercase text-muted">{reportKicker}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase text-muted">
            <span className="inline-flex h-9 items-center gap-2 border border-line/10 px-3">
              <Database className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              {originLabel(buildup)}
            </span>
            <button type="button" onClick={copyRawSummary} className="inline-flex h-9 items-center gap-2 border border-line/10 px-3 hover:border-accent hover:text-accent">
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              {copied ? "Copied" : "Copy Raw"}
            </button>
            {buildup.sources[0] ? (
              <a href={buildup.sources[0].url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 border border-line/10 px-3 hover:border-accent hover:text-accent">
                Source
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </div>
        {isExploratoryCandidate ? (
          <div className="mt-8 border border-line/10 bg-bg/60 p-4">
            <p className="font-mono text-[11px] font-bold uppercase text-muted">Why not an alert yet</p>
            <p className="mt-3 text-sm leading-relaxed text-ink/70">
              This is a derived Vault watch item surfaced for exploration. It needs a more explicit opportunity payload, stronger
              structure, or cleaner evidence before Finder should present it as a high-conviction alert.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 font-mono text-[10px] uppercase text-muted">
              {(rejectionReasons.length > 0 ? rejectionReasons : ["watch-grade source"]).slice(0, 5).map((reason) => (
                <span key={reason} className="border border-line/10 bg-paper px-2 py-1">
                  {reason}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      {hasCoordinates ? (
        <div className="mt-8">
          <SignalMap buildup={buildup} />
        </div>
      ) : (
        <div className="mt-8 border border-line/10 bg-bg/45 px-4 py-3 font-mono text-[11px] uppercase text-muted">
          Geospatial lock unavailable // Macro Vault did not supply coordinates for this signal.
        </div>
      )}

      <nav className="mt-8 flex gap-2 overflow-x-auto border-y border-line/10 py-3 no-scrollbar" aria-label="Report sections">
        {[
          ["Buildup", "#buildup"],
          ["Basket", "#basket"],
          ["Divergence", "#divergence"],
          ["Catalysts", "#catalysts"],
          ...(buildup.origin !== "derived" ? [["Deep", "#deep-analysis"]] : []),
          ["Telemetry", "#telemetry"],
        ].map(([label, href]) => (
          <a
            key={href}
            href={href}
            className="shrink-0 border border-line/10 px-3 py-2 font-mono text-[10px] font-bold uppercase text-muted hover:border-accent hover:text-accent"
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="mt-8 flex items-center justify-between gap-4 border-b border-line/10 pb-8 font-mono text-xs uppercase text-muted">
        <span className="inline-flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-good" aria-hidden="true" />
          Initial analysis
        </span>
        <span>{formatTime(model.freshness.generatedAt)}</span>
      </div>

      <section id="buildup" className="mt-10 scroll-mt-6">
        <h3 className="text-2xl font-medium uppercase text-ink/75">{reportTitle}</h3>
        <p className="mt-6 max-w-3xl text-xl leading-relaxed text-ink/75">{buildup.situation}</p>

        <div className="mt-8 grid gap-6 border-y border-line/10 py-6 md:grid-cols-3">
          <div>
            <p className="font-mono text-[11px] uppercase text-muted">Conviction</p>
            <p className="mt-2 font-mono text-4xl font-bold text-accent">{buildup.conviction}</p>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase text-muted">Divergence</p>
            <p className="mt-2 font-mono text-4xl font-bold text-accent">{buildup.divergenceScore}</p>
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase text-muted">Severity</p>
            <p className={cn("mt-3 font-mono text-sm font-bold uppercase", severityClass(buildup.severity))}>{buildup.severity}</p>
          </div>
        </div>

        <div className="mt-8">
          <SectionTitle>Observable Facts</SectionTitle>
          <FactList items={buildup.observableFacts.slice(0, 4)} />
        </div>

        <div className="mt-8 border-t border-line/10 pt-8">
          <SectionTitle>Timeline</SectionTitle>
          <p className="mt-3 text-sm leading-relaxed text-ink/70">{buildup.timeline.join(" -> ")}</p>
        </div>

        <div className="mt-8 grid gap-8 border-t border-line/10 pt-8 md:grid-cols-2">
          <div>
            <SectionTitle>Binary Event Implied</SectionTitle>
            <p className="mt-3 leading-relaxed text-ink/70">{buildup.binaryEvent}</p>
          </div>
          <div>
            <SectionTitle>Market Reaction</SectionTitle>
            <p className="mt-3 leading-relaxed text-ink/70">{buildup.marketReaction}</p>
          </div>
        </div>

        <div id="basket" className="mt-8 scroll-mt-6 border-t border-line/10 pt-8">
          <SectionTitle>Asset Correlation Basket</SectionTitle>
          <TradeBasket buildup={buildup} />
        </div>

        <div id="divergence" className="mt-8 grid scroll-mt-6 gap-8 border-t border-line/10 pt-8 md:grid-cols-2">
          <div>
            <SectionTitle>Sentiment Divergence</SectionTitle>
            <dl className="mt-3 space-y-3 text-sm leading-relaxed text-ink/70">
              <div>
                <dt className="font-mono text-[10px] uppercase text-muted">Ground Truth</dt>
                <dd>{buildup.sentimentDivergence.groundTruth}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase text-muted">Mainstream News</dt>
                <dd>{buildup.sentimentDivergence.mainstreamNews}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase text-muted">Mispricing Logic</dt>
                <dd>{buildup.sentimentDivergence.mispricingLogic}</dd>
              </div>
            </dl>
          </div>
          <div>
            <SectionTitle>Crowdedness Indicator</SectionTitle>
            <FactList items={buildup.crowdedness} />
          </div>
        </div>

        <div className="mt-8 grid gap-8 border-t border-line/10 pt-8 md:grid-cols-[0.9fr_1.1fr]">
          <div>
            <SectionTitle>Complacency Check</SectionTitle>
            <dl className="mt-3 space-y-3 text-sm text-ink/70">
              <div className="flex justify-between gap-4">
                <dt>Buildup severity</dt>
                <dd className="font-mono uppercase">{buildup.complacency.buildupSeverity}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Market reaction</dt>
                <dd className="text-right">{buildup.complacency.marketReaction}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Gap</dt>
                <dd className="font-mono uppercase text-accent">{buildup.complacency.gap}</dd>
              </div>
            </dl>
          </div>
          <div>
            <SectionTitle>Score</SectionTitle>
            <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px] uppercase text-muted sm:grid-cols-5">
              {[
                ["Visibility", `${buildup.scoreBreakdown.visibility}/25`],
                ["Escalation", `${buildup.scoreBreakdown.escalation}/25`],
                ["Mispricing", `${buildup.scoreBreakdown.mispricing}/25`],
                ["Directness", `${buildup.scoreBreakdown.directness}/25`],
                ["Total", `${buildup.scoreBreakdown.total}/100`],
              ].map(([label, value]) => (
                <div key={label} className="border border-line/10 bg-bg/45 p-2">
                  <p>{label}</p>
                  <p className={cn("mt-1 font-bold", label === "Total" ? "text-accent" : "text-ink")}>{value}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm font-semibold leading-relaxed text-ink/75">-&gt; Action: {buildup.action}</p>
          </div>
        </div>

        <div id="catalysts" className="mt-8 grid scroll-mt-6 gap-6 border-t border-line/10 pt-8 md:grid-cols-[1.05fr_0.95fr]">
          <div>
            <SectionTitle>Upcoming Catalysts</SectionTitle>
            <FactList items={buildup.catalysts.length > 0 ? buildup.catalysts : ["No upcoming catalysts supplied by Macro Vault."]} />
          </div>
          <div className="border border-line/10 bg-bg/45 p-4">
            <SectionTitle>Downside / Invalidation</SectionTitle>
            <p className="mt-3 text-sm leading-relaxed text-ink/70">{buildup.invalidation}</p>
          </div>
        </div>

        <SourceGrounding buildup={buildup} />

        {/* Derived items only carry template-generated deep analysis; showing it would dress
            boilerplate up as research. Only Vault-authored origins get this section. */}
        {buildup.origin !== "derived" ? (
        <details id="deep-analysis" className="mt-8 scroll-mt-6 border-t border-line/10 pt-8">
          <summary className="cursor-pointer text-xl font-semibold uppercase text-ink/75 hover:text-accent">
            Ultra Deep Analysis (Pro)
          </summary>
          <div className="mt-6 space-y-8">
            <section>
              <SectionTitle>Trade Structuring & Proxies</SectionTitle>
              <FactList items={buildup.ultraDeepAnalysis.tradeStructuring} />
            </section>
            <section>
              <SectionTitle>Red Teaming / Devil's Advocate</SectionTitle>
              <FactList items={buildup.ultraDeepAnalysis.redTeam} />
            </section>
            <section>
              <SectionTitle>Second & Third-Order Effects</SectionTitle>
              <FactList items={buildup.ultraDeepAnalysis.secondOrderEffects} />
            </section>
            <section>
              <SectionTitle>Historical Analogs</SectionTitle>
              <FactList items={buildup.ultraDeepAnalysis.historicalAnalogs} />
            </section>
            <section>
              <SectionTitle>Invalidation Triggers / Kill Switch</SectionTitle>
              <FactList items={buildup.ultraDeepAnalysis.invalidationTriggers} />
            </section>
          </div>
        </details>
        ) : null}

        <details id="telemetry" className="mt-8 scroll-mt-6 border-t border-line/10 pt-8">
          <summary className="cursor-pointer font-mono text-[11px] font-bold uppercase tracking-normal text-muted hover:text-accent">
            Raw Telemetry Data
          </summary>
          <div className="mt-4 space-y-3 border border-line/10 bg-bg/60 p-4 font-mono text-[11px] leading-relaxed text-muted">
            {buildup.rawTelemetry.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </details>

        <details className="mt-8 border-t border-line/10 pt-8">
          <summary className="cursor-pointer font-mono text-[11px] font-bold uppercase tracking-normal text-muted hover:text-accent">
            Vault Signal Inspector
          </summary>
          <dl className="mt-4 grid gap-3 border border-line/10 bg-bg/60 p-4 font-mono text-[11px] uppercase text-muted md:grid-cols-2">
            <div className="flex justify-between gap-4">
              <dt>Origin</dt>
              <dd className="text-right text-ink">{originLabel(buildup)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Quality</dt>
              <dd className="text-right text-ink">{candidateQuality(buildup).score}/100</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Coordinates</dt>
              <dd className="text-right text-ink">{buildup.coordinates ? "present" : "missing"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Telemetry lines</dt>
              <dd className="text-right text-ink">{buildup.rawTelemetry.length}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Sources</dt>
              <dd className="text-right text-ink">{buildup.sources.length}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Research gate</dt>
              <dd className="text-right text-ink">{passesDerivedQualityGate(buildup) ? "eligible" : "watch-grade"}</dd>
            </div>
          </dl>
          <details className="mt-4 border border-line/10 bg-bg/60 p-4">
            <summary className="cursor-pointer font-mono text-[11px] font-bold uppercase tracking-normal text-muted hover:text-accent">
              Raw Vault Payload Preview
            </summary>
            <pre className="mt-4 max-h-[360px] overflow-auto whitespace-pre-wrap break-words border-t border-line/10 pt-4 font-mono text-[11px] leading-relaxed text-muted">
              {buildup.rawPreview}
            </pre>
          </details>
        </details>
      </section>
    </article>
  );
}

function ScanningReport({ run }: { run: ResearchRun }) {
  return (
    <article className="mx-auto max-w-5xl border border-accent bg-paper p-8 shadow-[10px_10px_0_#141414] md:p-12">
      <div className="flex items-start gap-4">
        <Loader2 className="mt-1 h-7 w-7 shrink-0 animate-spin text-accent" aria-hidden="true" />
        <div>
          <h2 className="text-3xl font-extrabold uppercase leading-tight">Research Running</h2>
          <p className="mt-2 font-mono text-xs uppercase text-muted">Local filter pass // threshold gate active</p>
        </div>
      </div>
      <div className="mt-10 border-y border-line/10 py-8">
        <p className="max-w-2xl text-xl leading-relaxed text-ink/70">
          Filtering the loaded Vault signals for a reportable buildup. Search words narrow the pass when they match; threshold zero can fall back to broad candidates.
        </p>
      </div>
      <dl className="mt-8 grid gap-5 font-mono text-xs uppercase text-muted md:grid-cols-3">
        <div>
          <dt>Search Words</dt>
          <dd className="mt-2 text-ink">{run.query || "All Vault Signals"}</dd>
        </div>
        <div>
          <dt>Threshold</dt>
          <dd className="mt-2 text-ink">{run.threshold}</dd>
        </div>
        <div>
          <dt>Candidate Set</dt>
          <dd className="mt-2 text-ink">{run.scanned}</dd>
        </div>
      </dl>
      <div className="mt-8 border border-line/10 bg-bg/45 px-4 py-3 font-mono text-[11px] uppercase text-muted">
        This pass re-grades the signals already loaded from Macro Vault; it does not fetch new data.
      </div>
    </article>
  );
}

function NoAlertReport({
  run,
  status,
}: {
  run: ResearchRun;
  status: string;
}) {
  return (
    <article className="mx-auto max-w-5xl border border-line bg-paper p-8 shadow-[10px_10px_0_#141414] md:p-12">
      <div className="flex items-start gap-4">
        <Clock3 className="mt-1 h-7 w-7 shrink-0 text-muted" aria-hidden="true" />
        <div>
          <h2 className="text-3xl font-extrabold uppercase leading-tight">No Alert Found</h2>
          <p className="mt-2 font-mono text-xs uppercase text-muted">Research completed // no forced trade</p>
        </div>
      </div>
      <div className="mt-10 border-y border-line/10 py-8">
        <p className="max-w-2xl text-xl leading-relaxed text-ink/70">
          No setup cleared the alert threshold. That is a valid result: the engine found no high-conviction asymmetry for this pass.
        </p>
        <p className="mt-4 max-w-2xl font-mono text-xs uppercase leading-relaxed text-muted">{status}</p>
      </div>
      <div className="mt-8 grid gap-3 font-mono text-[11px] uppercase text-muted">
        <div className="flex items-center justify-between border border-line/10 bg-bg/45 px-4 py-3">
          <span>Strict quality read</span>
          <span className={run.rejectedByQuality > 0 ? "text-accent" : "text-good"}>
            {run.rejectedByQuality > 0 ? `${run.rejectedByQuality} watch-grade` : "Clear"}
          </span>
        </div>
        <div className="flex items-center justify-between border border-line/10 bg-bg/45 px-4 py-3">
          <span>Keyword pass</span>
          <span className={run.rejectedByKeyword > 0 ? "text-accent" : "text-good"}>
            {run.keywords.length > 0 ? `${run.keywords.join(", ")}` : "All signals"}
          </span>
        </div>
        <div className="flex items-center justify-between border border-line/10 bg-bg/45 px-4 py-3">
          <span>Alert threshold</span>
          <span className={run.rejectedByThreshold > 0 ? "text-accent" : "text-good"}>
            {run.rejectedByThreshold > 0 ? `${run.rejectedByThreshold} below ${run.threshold}` : `Gate ${run.threshold}`}
          </span>
        </div>
      </div>
      <dl className="mt-8 grid gap-5 font-mono text-xs uppercase text-muted md:grid-cols-3">
        <div>
          <dt>Search Words</dt>
          <dd className="mt-2 text-ink">{run.query || "All Vault Signals"}</dd>
        </div>
        <div>
          <dt>Threshold</dt>
          <dd className="mt-2 text-ink">{run.threshold}</dd>
        </div>
        <div>
          <dt>Result</dt>
          <dd className="mt-2 text-ink">0 alerts</dd>
        </div>
        <div>
          <dt>Scanned</dt>
          <dd className="mt-2 text-ink">{run.scanned}</dd>
        </div>
        <div>
          <dt>Rejected</dt>
          <dd className="mt-2 text-ink">{run.rejected}</dd>
        </div>
        <div>
          <dt>Watch-grade</dt>
          <dd className="mt-2 text-ink">{run.rejectedByQuality}</dd>
        </div>
        <div>
          <dt>Keyword mismatch</dt>
          <dd className="mt-2 text-ink">{run.rejectedByKeyword}</dd>
        </div>
        <div>
          <dt>Below threshold</dt>
          <dd className="mt-2 text-ink">{run.rejectedByThreshold}</dd>
        </div>
      </dl>
      {run.topRejected ? (
        <div className="mt-8 border border-line/10 bg-bg/45 p-4">
          <p className="font-mono text-[11px] font-bold uppercase text-muted">Top Rejected Candidate</p>
          <h3 className="mt-3 font-bold uppercase">{run.topRejected.buildup.label}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink/70">{run.topRejectedReason}</p>
          <p className="mt-2 text-sm leading-relaxed text-ink/70">{run.topRejected.rationale}</p>
          <p className="mt-3 font-mono text-[11px] uppercase text-muted">
            Score {run.topRejected.score} // Conviction {run.topRejected.buildup.conviction} // Divergence {run.topRejected.buildup.divergenceScore}
          </p>
        </div>
      ) : null}
      {run.rejectedCandidates && run.rejectedCandidates.length > 0 ? (
        <div className="mt-8 border border-line/10 bg-bg/45 p-4">
          <p className="font-mono text-[11px] font-bold uppercase text-muted">Rejected Candidates</p>
          <div className="mt-4 space-y-4">
            {run.rejectedCandidates.map((candidate) => (
              <div key={candidate.buildup.id} className="border-t border-line/10 pt-4 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-bold uppercase">{candidate.buildup.label}</h3>
                  <span className="font-mono text-[11px] uppercase text-muted">
                    Score {candidate.score} // Quality {candidate.quality.score}/100
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink/70">{rejectionSummary(candidate)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ScanHistory({
  buildups,
  run,
  active,
  onSelect,
}: {
  buildups: Buildup[];
  run: ResearchRun;
  active?: Buildup;
  onSelect: (buildup: Buildup) => void;
}) {
  const records = run.hasRun && run.results.length > 0 ? run.results.map((result) => result.buildup) : buildups.slice(0, 8);

  return (
    <aside className="border-t border-line bg-paper lg:min-h-[calc(100vh-230px)] lg:border-l lg:border-t-0">
      <div className="flex items-center justify-between border-b border-line/10 px-6 py-6">
        <h2 className="inline-flex items-center gap-3 font-mono text-sm font-bold uppercase tracking-normal">
          <History className="h-5 w-5" aria-hidden="true" />
          Scan History
        </h2>
        <span className="font-mono text-[10px] uppercase text-muted">{run.phase === "scanning" ? "Scanning" : run.hasRun ? "Latest" : "Vault"}</span>
      </div>

      {run.phase === "scanning" ? (
        <div className="border-b border-line/10 bg-ink px-6 py-7 text-bg">
          <p className="font-mono text-[11px] uppercase text-bg/55">{formatShortTime(run.startedAt ?? new Date().toISOString())}</p>
          <h3 className="mt-4 flex items-center gap-2 font-bold uppercase">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Research running
          </h3>
          <p className="mt-2 font-mono text-[11px] uppercase text-bg/45">Threshold {run.threshold}</p>
        </div>
      ) : run.phase === "no-alert" ? (
        <div className="border-b border-line/10 bg-ink px-6 py-7 text-bg">
          <p className="font-mono text-[11px] uppercase text-bg/55">{formatShortTime(run.completedAt ?? new Date().toISOString())}</p>
          <h3 className="mt-4 font-bold uppercase">No alert found</h3>
          <p className="mt-2 font-mono text-[11px] uppercase text-bg/45">Threshold {run.threshold}</p>
        </div>
      ) : null}

      <div>
        {records.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            className={cn(
              "w-full border-b border-line/10 px-6 py-6 text-left transition-colors",
              active?.id === item.id ? "bg-ink text-bg" : "bg-paper text-ink hover:bg-white/60",
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className={cn("font-mono text-[11px] uppercase", active?.id === item.id ? "text-bg/55" : "text-muted")}>
                {formatShortTime(item.updatedAt)}
              </span>
              <span className="flex items-center gap-2">
                {index === 0 ? <Pin className="h-3.5 w-3.5 text-muted" aria-hidden="true" /> : null}
                <span className="h-2.5 w-2.5 rounded-full bg-accent" />
              </span>
            </div>
            <h3 className="font-bold uppercase leading-tight">{item.label}</h3>
            <p className={cn("mt-2 font-mono text-[11px] uppercase", active?.id === item.id ? "text-bg/45" : "text-muted")}>
              {item.origin === "derived" && !passesDerivedQualityGate(item) ? "Watch item below gate" : originLabel(item)} // {buildupTheme(item)}
            </p>
            <p className={cn("mt-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase", active?.id === item.id ? "text-bg/70" : "text-muted")}>
              View report
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </p>
          </button>
        ))}
      </div>
    </aside>
  );
}

export function DashboardClient({ model, parserDemoBuildup }: { model: DashboardModel; parserDemoBuildup?: Buildup }) {
  const sortedBuildups = useMemo(
    () => [...model.buildups].sort((a, b) => b.conviction + b.divergenceScore - (a.conviction + a.divergenceScore)),
    [model.buildups],
  );
  const [selectedId, setSelectedId] = useState<string | undefined>(sortedBuildups[0]?.id);
  const [researchRun, setResearchRun] = useState<ResearchRun>({
    phase: "idle",
    hasRun: false,
    query: "",
    keywords: [],
    threshold: 60,
    results: [],
    scanned: 0,
    rejected: 0,
    rejectedByQuality: 0,
    rejectedByKeyword: 0,
    rejectedByThreshold: 0,
    rejectedCandidates: [],
  });
  const [exampleLoaded, setExampleLoaded] = useState(false);
  const [parserDemoLoaded, setParserDemoLoaded] = useState(false);

  const displayBuildups = [
    ...(exampleLoaded ? [sampleNorthernFrontBuildup] : []),
    ...(parserDemoLoaded && parserDemoBuildup ? [parserDemoBuildup] : []),
    ...sortedBuildups,
  ];
  const reportableBuildups = displayBuildups.filter(passesDerivedQualityGate);
  const researchBuildups = researchRun.phase === "alert-found" ? researchRun.results.map((result) => result.buildup) : [];
  const selectableBuildups = researchBuildups.length > 0 ? researchBuildups : reportableBuildups;
  const activeBuildup = selectableBuildups.find((item) => item.id === selectedId) ?? selectableBuildups[0];
  const showScanning = researchRun.phase === "scanning";
  const showNoAlert = !showScanning && (researchRun.phase === "no-alert" || (!researchRun.hasRun && reportableBuildups.length === 0));
  const feedStatus = opportunityStatusText(model, reportableBuildups.length);

  function startResearch(run: ResearchRun) {
    setResearchRun(run);
  }

  function completeResearch(run: ResearchRun) {
    setResearchRun(run);
    if (run.results[0]) setSelectedId(run.results[0].buildup.id);
  }

  return (
    <main className="min-h-screen bg-bg text-ink">
      <div className="grid border-b border-line lg:grid-cols-[250px_1fr]">
        <Masthead model={model} />
        <CommandBar
          model={model}
          buildups={displayBuildups}
          onStart={startResearch}
          onComplete={completeResearch}
          onLoadExample={() => {
            setExampleLoaded(true);
            setSelectedId(sampleNorthernFrontBuildup.id);
            setResearchRun({
              phase: "idle",
              hasRun: false,
              query: "",
              keywords: [],
              threshold: 60,
              results: [],
              scanned: 0,
              rejected: 0,
              rejectedByQuality: 0,
              rejectedByKeyword: 0,
              rejectedByThreshold: 0,
              rejectedCandidates: [],
            });
          }}
          onLoadParserDemo={
            parserDemoBuildup
              ? () => {
                  setParserDemoLoaded(true);
                  setSelectedId(parserDemoBuildup.id);
                  setResearchRun({
                    phase: "idle",
                    hasRun: false,
                    query: "",
                    keywords: [],
                    threshold: 60,
                    results: [],
                    scanned: 0,
                    rejected: 0,
                    rejectedByQuality: 0,
                    rejectedByKeyword: 0,
                    rejectedByThreshold: 0,
                    rejectedCandidates: [],
                  });
                }
              : undefined
          }
        />
      </div>
      <StatusBanner model={model} />
      <VaultContractStatus model={model} feedStatus={feedStatus} />
      <div className="border-b border-line/10 bg-bg px-5 py-3 font-mono text-[11px] uppercase text-muted md:px-10">
        Parser coverage: {parserCoverageText(model)}
      </div>
      <div className="border-b border-line/10 bg-paper px-5 py-3 font-mono text-[11px] uppercase text-muted md:px-10">
        {vaultContractGapText(model)}
      </div>

      <div className="grid lg:grid-cols-[1fr_360px]">
        <section className="px-5 py-10 md:px-10 md:py-12">
          {showScanning ? (
            <ScanningReport run={researchRun} />
          ) : showNoAlert ? (
            <NoAlertReport
              run={
                researchRun.hasRun
                  ? researchRun
                  : {
                      phase: "idle",
                      hasRun: false,
                      query: "",
                      keywords: [],
                      threshold: 60,
                      results: [],
                      scanned: displayBuildups.length,
                      rejected: displayBuildups.length,
                      rejectedByQuality: displayBuildups.filter((buildup) => !passesDerivedQualityGate(buildup)).length,
                      rejectedByKeyword: 0,
                      rejectedByThreshold: 0,
                      rejectedCandidates: displayBuildups
                        .map(scoreBuildupWithoutKeywordFilter)
                        .sort((a, b) => b.score - a.score)
                        .slice(0, 3),
                    }
              }
              status={feedStatus}
            />
          ) : activeBuildup ? (
            <OpportunityReport buildup={activeBuildup} model={model} />
          ) : (
            <div className="mx-auto max-w-5xl border border-line bg-paper p-8 font-mono text-xs uppercase text-muted">
              No buildups available from Macro Vault.
            </div>
          )}
        </section>
        <ScanHistory buildups={displayBuildups} run={researchRun} active={activeBuildup} onSelect={(buildup) => setSelectedId(buildup.id)} />
      </div>
    </main>
  );
}
