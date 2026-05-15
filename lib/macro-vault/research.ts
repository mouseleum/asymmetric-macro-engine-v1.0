import type { Buildup } from "./types";

export type CandidateQuality = {
  hasCatalyst: boolean;
  hasNonGenericBasket: boolean;
  hasUsefulInvalidation: boolean;
  hasCoordinates: boolean;
  hasTelemetry: boolean;
  isStructured: boolean;
  score: number;
};

export type ResearchResult = {
  buildup: Buildup;
  score: number;
  matchedKeywords: string[];
  rationale: string;
  quality: CandidateQuality;
  rejectionReasons: string[];
};

export type ResearchPhase = "idle" | "scanning" | "no-alert" | "alert-found" | "error";

export type ResearchRun = {
  phase: ResearchPhase;
  hasRun: boolean;
  query: string;
  keywords: string[];
  threshold: number;
  results: ResearchResult[];
  scanned: number;
  rejected: number;
  rejectedByQuality: number;
  rejectedByKeyword: number;
  rejectedByThreshold: number;
  topRejected?: ResearchResult;
  topRejectedReason?: string;
  rejectedCandidates?: ResearchResult[];
  targetFallback?: boolean;
  startedAt?: string;
  completedAt?: string;
  error?: string;
};

export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function tokenizeSearch(value: string) {
  return value
    .toLowerCase()
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

export function buildupTheme(buildup: Buildup) {
  const text = `${buildup.label} ${buildup.situation} ${buildup.status}`.toLowerCase();
  if (text.includes("inflation") || text.includes("cpi") || text.includes("ppi")) return "Inflation";
  if (text.includes("gdp") || text.includes("growth") || text.includes("pmi") || text.includes("industrial")) return "Growth";
  if (text.includes("rate") || text.includes("yield") || text.includes("central bank")) return "Rates";
  if (text.includes("oil") || text.includes("gas") || text.includes("energy")) return "Energy";
  if (text.includes("currency") || text.includes("fx") || text.includes("dollar")) return "FX";
  return "Macro";
}

function buildupSearchText(buildup: Buildup) {
  return [
    buildup.label,
    buildup.situation,
    buildup.status,
    buildup.groundTruth,
    buildup.marketReaction,
    buildup.binaryEvent,
    buildup.timeline.join(" "),
    buildup.observableFacts.join(" "),
    buildup.catalysts.join(" "),
    buildup.invalidation,
    buildup.sentimentDivergence.mispricingLogic,
    buildup.crowdedness.join(" "),
    buildup.ultraDeepAnalysis.tradeStructuring.join(" "),
    buildup.ultraDeepAnalysis.redTeam.join(" "),
    buildup.ultraDeepAnalysis.secondOrderEffects.join(" "),
    buildup.ultraDeepAnalysis.historicalAnalogs.join(" "),
    buildup.ultraDeepAnalysis.invalidationTriggers.join(" "),
    buildup.rawTelemetry.join(" "),
    buildup.sources.map((source) => source.title).join(" "),
    buildupTheme(buildup),
  ]
    .join(" ")
    .toLowerCase();
}

function includesGeneric(value: string) {
  return [
    "macro-sensitive beneficiary basket",
    "complacent risk beta",
    "position-size and event-risk hedge",
    "quality defensives",
    "cyclical growth beta",
  ].some((phrase) => value.toLowerCase().includes(phrase));
}

function isDefaultInvalidation(value: string) {
  return /release lands in line with consensus|no downside scenario supplied|binary catalyst window passes/i.test(value);
}

export function candidateQuality(buildup: Buildup): CandidateQuality {
  const hasCatalyst = buildup.catalysts.some((catalyst) => !/^scheduled date:/i.test(catalyst) && catalyst.trim().length > 8);
  const basketText = [
    buildup.assetBasket.primaryLong,
    buildup.assetBasket.primaryShort,
    buildup.assetBasket.hedge,
    ...buildup.assetBasket.proxies,
  ].join(" ");
  const hasNonGenericBasket = basketText.trim().length > 0 && !includesGeneric(basketText);
  const hasUsefulInvalidation = buildup.invalidation.trim().length > 20 && !isDefaultInvalidation(buildup.invalidation);
  const hasCoordinates = Boolean(buildup.coordinates);
  const hasTelemetry = buildup.rawTelemetry.length > 0;
  const isStructured = buildup.origin === "explicit" || buildup.origin === "parsed" || buildup.origin === "example";
  const score =
    (hasCatalyst ? 18 : 0) +
    (hasNonGenericBasket ? 18 : 0) +
    (hasUsefulInvalidation ? 18 : 0) +
    (hasCoordinates ? 14 : 0) +
    (hasTelemetry ? 12 : 0) +
    (isStructured ? 20 : 0);

  return {
    hasCatalyst,
    hasNonGenericBasket,
    hasUsefulInvalidation,
    hasCoordinates,
    hasTelemetry,
    isStructured,
    score,
  };
}

export function candidateRejectionReasons(buildup: Buildup, quality: CandidateQuality) {
  return [
    buildup.origin === "derived" && !quality.isStructured ? "derived watch item, not a Vault opportunity" : "",
    !quality.hasCatalyst ? "no specific catalyst" : "",
    !quality.hasNonGenericBasket ? "generic asset basket" : "",
    !quality.hasUsefulInvalidation ? "weak invalidation" : "",
    !quality.hasCoordinates ? "no coordinates" : "",
    buildup.divergenceScore < 70 ? "weak divergence" : "",
    buildup.conviction < 70 ? "weak conviction" : "",
  ].filter(Boolean);
}

export function scoreBuildupForResearch(buildup: Buildup, keywords: string[]): ResearchResult | null {
  const searchText = buildupSearchText(buildup);
  const matchedKeywords = keywords.filter((keyword) => searchText.includes(keyword));
  if (keywords.length > 0 && matchedKeywords.length === 0) return null;

  const quality = candidateQuality(buildup);
  const rejectionReasons = candidateRejectionReasons(buildup, quality);
  const severityBoost = { low: 0, medium: 2, high: 5, extreme: 8 }[buildup.severity];
  const keywordBoost = Math.min(12, matchedKeywords.length * 4);
  const qualityAdjustment = quality.isStructured ? 8 : Math.round((quality.score - 50) / 5);
  const baseScore = buildup.conviction * 0.52 + buildup.divergenceScore * 0.48;
  const score = clampScore(baseScore + severityBoost + keywordBoost + qualityAdjustment);
  const leadingSignal = buildup.divergenceScore >= buildup.conviction ? "divergence" : "conviction";

  return {
    buildup,
    score,
    matchedKeywords,
    quality,
    rejectionReasons,
    rationale: `${leadingSignal} leads // quality ${quality.score}/100 // ${buildup.severity} severity // ${buildup.catalysts.length} catalyst${buildup.catalysts.length === 1 ? "" : "s"}`,
  };
}

export function scoreBuildupWithoutKeywordFilter(buildup: Buildup): ResearchResult {
  const quality = candidateQuality(buildup);
  return scoreBuildupForResearch(buildup, []) ?? {
    buildup,
    score: 0,
    matchedKeywords: [],
    quality,
    rejectionReasons: candidateRejectionReasons(buildup, quality),
    rationale: "No score available",
  };
}

export function passesDerivedQualityGate(buildup: Buildup) {
  if (buildup.origin !== "derived") return true;
  const quality = candidateQuality(buildup);
  return buildup.conviction >= 85 && buildup.divergenceScore >= 85 && quality.hasNonGenericBasket && quality.hasUsefulInvalidation;
}

export function rejectionSummary(result: ResearchResult) {
  if (result.rejectionReasons.length === 0) return `Score ${result.score} did not clear the current pass.`;
  return result.rejectionReasons.slice(0, 4).join(", ");
}

export function createScanningResearchRun({
  buildups,
  query,
  threshold,
  startedAt = new Date().toISOString(),
}: {
  buildups: Buildup[];
  query: string;
  threshold: number;
  startedAt?: string;
}): ResearchRun {
  return {
    phase: "scanning",
    hasRun: true,
    query,
    keywords: tokenizeSearch(query),
    threshold,
    results: [],
    scanned: buildups.length,
    rejected: 0,
    rejectedByQuality: 0,
    rejectedByKeyword: 0,
    rejectedByThreshold: 0,
    rejectedCandidates: [],
    startedAt,
  };
}

export function runResearchPass({
  buildups,
  query,
  threshold,
  startedAt = new Date().toISOString(),
  completedAt = new Date().toISOString(),
}: {
  buildups: Buildup[];
  query: string;
  threshold: number;
  startedAt?: string;
  completedAt?: string;
}): ResearchRun {
  const keywords = tokenizeSearch(query);
  const allScored = buildups.map(scoreBuildupWithoutKeywordFilter);
  const directKeywordMatched = buildups
    .map((buildup) => scoreBuildupForResearch(buildup, keywords))
    .filter((result): result is ResearchResult => Boolean(result));
  const targetFallback = threshold === 0 && keywords.length > 0 && directKeywordMatched.length === 0;
  const keywordMatched = targetFallback
    ? allScored
    : directKeywordMatched;
  const exploratoryPass = threshold === 0;
  const qualityRejected = keywordMatched.filter((result) => !passesDerivedQualityGate(result.buildup));
  const qualityAccepted = keywordMatched.filter((result) => passesDerivedQualityGate(result.buildup));
  const resultCandidates = exploratoryPass ? keywordMatched : qualityAccepted;
  const results = resultCandidates
    .filter((result) => result.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  const thresholdRejected = resultCandidates.filter((result) => result.score < threshold);
  const keywordRejected = targetFallback ? 0 : buildups.length - keywordMatched.length;
  const topQualityRejected = [...qualityRejected].sort((a, b) => b.score - a.score)[0];
  const topThresholdRejected = thresholdRejected.sort((a, b) => b.score - a.score)[0];
  const keywordRejectedCandidates = keywords.length > 0 && !targetFallback
    ? allScored.filter((result) => !directKeywordMatched.some((matched) => matched.buildup.id === result.buildup.id))
    : [];
  const topRejected = topThresholdRejected ?? topQualityRejected ?? keywordRejectedCandidates.sort((a, b) => b.score - a.score)[0];
  const topRejectedReason = topThresholdRejected
    ? `Score ${topThresholdRejected.score} did not clear threshold ${threshold}.`
    : topQualityRejected
      ? `Below the quality gate: ${topQualityRejected.rejectionReasons.slice(0, 3).join(", ")}.`
      : keywordRejected > 0
        ? "Rejected by keyword mismatch."
        : undefined;
  const rejectedCandidates = [
    ...thresholdRejected,
    ...qualityRejected,
    ...keywordRejectedCandidates,
  ]
    .filter((candidate, index, candidates) => candidates.findIndex((item) => item.buildup.id === candidate.buildup.id) === index)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    phase: results.length > 0 ? "alert-found" : "no-alert",
    hasRun: true,
    query,
    keywords,
    threshold,
    results,
    scanned: buildups.length,
    rejected: buildups.length - results.length,
    rejectedByQuality: exploratoryPass ? 0 : qualityRejected.length,
    rejectedByKeyword: keywordRejected,
    rejectedByThreshold: thresholdRejected.length,
    topRejected,
    topRejectedReason,
    rejectedCandidates,
    targetFallback,
    startedAt,
    completedAt,
  };
}
