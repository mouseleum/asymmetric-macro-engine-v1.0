import assert from "node:assert/strict";
import { test } from "node:test";

import { mockVaultPayloads } from "../lib/macro-vault/fixtures.ts";
import { normalizeDashboardModel } from "../lib/macro-vault/normalize.ts";
import { passesDerivedQualityGate, runResearchPass } from "../lib/macro-vault/research.ts";

function derivedBuildups() {
  const payloads = structuredClone(mockVaultPayloads);
  payloads["dashboard-feed"] = {
    ...payloads["dashboard-feed"],
    opportunities: [],
  };

  return normalizeDashboardModel(payloads, [], "mock").buildups;
}

test("threshold zero returns exploratory candidates even when derived items fail the strict gate", () => {
  const buildups = derivedBuildups();
  assert.ok(buildups.length > 0);
  assert.ok(buildups.some((buildup) => !passesDerivedQualityGate(buildup)));

  const run = runResearchPass({
    buildups,
    query: "",
    threshold: 0,
    startedAt: "2026-05-15T00:00:00.000Z",
    completedAt: "2026-05-15T00:00:01.000Z",
  });

  assert.equal(run.phase, "alert-found");
  assert.ok(run.results.length > 0);
  assert.ok(run.results.every((result) => result.buildup.origin === "derived"));
  assert.equal(run.rejectedByQuality, 0);
});

test("normal thresholds keep derived watch-grade items below true alert status", () => {
  const buildups = derivedBuildups();

  const run = runResearchPass({
    buildups,
    query: "",
    threshold: 60,
    startedAt: "2026-05-15T00:00:00.000Z",
    completedAt: "2026-05-15T00:00:01.000Z",
  });

  assert.equal(run.phase, "no-alert");
  assert.equal(run.results.length, 0);
  assert.ok(run.rejectedByQuality > 0);
  assert.ok(run.rejectedCandidates?.length > 0);
});

test("keyword fallback only broadens search when threshold is zero", () => {
  const buildups = derivedBuildups();

  const strictRun = runResearchPass({
    buildups,
    query: "zzzz-no-match",
    threshold: 60,
    startedAt: "2026-05-15T00:00:00.000Z",
    completedAt: "2026-05-15T00:00:01.000Z",
  });

  assert.equal(strictRun.phase, "no-alert");
  assert.equal(strictRun.targetFallback, false);
  assert.equal(strictRun.rejectedByKeyword, buildups.length);
  assert.equal(strictRun.results.length, 0);

  const exploratoryRun = runResearchPass({
    buildups,
    query: "zzzz-no-match",
    threshold: 0,
    startedAt: "2026-05-15T00:00:00.000Z",
    completedAt: "2026-05-15T00:00:01.000Z",
  });

  assert.equal(exploratoryRun.phase, "alert-found");
  assert.equal(exploratoryRun.targetFallback, true);
  assert.equal(exploratoryRun.rejectedByKeyword, 0);
  assert.ok(exploratoryRun.results.length > 0);
});
