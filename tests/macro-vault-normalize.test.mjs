import assert from "node:assert/strict";
import { test } from "node:test";

import { mockVaultPayloads } from "../lib/macro-vault/fixtures.ts";
import { normalizeDashboardModel } from "../lib/macro-vault/normalize.ts";

function cloneFixture() {
  return structuredClone(mockVaultPayloads);
}

test("parses old-engine raw reports into structured buildups", () => {
  const model = normalizeDashboardModel(cloneFixture(), [], "mock");
  const buildup = model.buildups.find((item) => item.id === "raw-hormuz-blockade");

  assert.ok(buildup);
  assert.equal(buildup.origin, "parsed");
  assert.equal(buildup.label, "Hormuz Blockade");
  assert.equal(buildup.coordinates?.lat, 26.56);
  assert.equal(buildup.coordinates?.lon, 56.25);
  assert.equal(buildup.assetBasket.primaryLong, "Brent Crude (BZ=F)");
  assert.equal(buildup.assetBasket.primaryShort, "European cyclicals");
  assert.deepEqual(buildup.assetBasket.proxies, ["TTF gas", "PAXG", "freight rates"]);
  assert.equal(buildup.divergenceScore, 88);
  assert.equal(buildup.conviction, 85);
  assert.match(buildup.binaryEvent, /verified closure/i);
  assert.ok(buildup.catalysts.some((item) => /insurance renewal/i.test(item)));
  assert.match(buildup.invalidation, /routing normalizes/i);
  assert.ok(buildup.rawTelemetry.some((item) => item.includes("LIVE SHIPPING_PROXY API")));
  assert.ok(buildup.ultraDeepAnalysis.tradeStructuring.some((item) => /energy volatility/i.test(item)));
  assert.ok(buildup.ultraDeepAnalysis.redTeam.some((item) => /Shadow routing/i.test(item)));
  assert.equal(model.diagnostics.opportunities.mode, "parsed");
  assert.equal(model.diagnostics.opportunities.explicitCount, 1);
  assert.equal(model.diagnostics.opportunities.parsedCount, 1);
  assert.equal(model.diagnostics.opportunities.derivedCount, 0);
});

test("keeps explicit structured fields ahead of parsed raw text", () => {
  const payloads = cloneFixture();
  payloads["dashboard-feed"] = {
    opportunities: [
      {
        id: "structured-wins",
        label: "Structured Title",
        situation: "Structured situation should survive parser fill.",
        coordinates: { lat: 1.23, lon: 4.56, label: "Structured Point" },
        divergenceScore: 77,
        conviction: 66,
        assetBasket: {
          primaryLong: "Structured Long",
          primaryShort: "Structured Short",
          proxies: ["Structured Proxy"],
          hedge: "Structured Hedge",
        },
        report: `[LABEL: Parsed Title]
[COORDINATES: 26.56, 56.25]

BUILDUP DETECTED
Situation: Parsed situation should not replace structured fields.

DIVERGENCE METER: 99/100

ASSET CORRELATION BASKET:
PRIMARY LONG: Parsed Long
PRIMARY SHORT: Parsed Short
CORRELATED PROXIES: Parsed Proxy
HEDGE/SECONDARY: Parsed Hedge`,
      },
    ],
  };

  const [buildup] = normalizeDashboardModel(payloads, [], "mock").buildups;

  assert.equal(buildup.origin, "parsed");
  assert.equal(buildup.label, "Structured Title");
  assert.equal(buildup.situation, "Structured situation should survive parser fill.");
  assert.deepEqual(buildup.coordinates, { lat: 1.23, lon: 4.56, label: "Structured Point" });
  assert.equal(buildup.divergenceScore, 77);
  assert.equal(buildup.conviction, 66);
  assert.equal(buildup.assetBasket.primaryLong, "Structured Long");
  assert.equal(buildup.assetBasket.primaryShort, "Structured Short");
  assert.deepEqual(buildup.assetBasket.proxies, ["Structured Proxy"]);
  assert.equal(buildup.assetBasket.hedge, "Structured Hedge");
});

test("renders partial raw reports without crashing", () => {
  const payloads = cloneFixture();
  payloads["dashboard-feed"] = {
    opportunities: [
      {
        id: "partial-raw",
        report: `BUILDUP DETECTED
Situation: Partial report has only a situation and a score.

Divergence Score: 72/100`,
      },
    ],
  };

  const [buildup] = normalizeDashboardModel(payloads, [], "mock").buildups;

  assert.equal(buildup.origin, "parsed");
  assert.equal(buildup.id, "partial-raw");
  assert.equal(buildup.label, "Opportunity 1");
  assert.equal(buildup.situation, "Partial report has only a situation and a score.");
  assert.equal(buildup.divergenceScore, 72);
  assert.equal(buildup.conviction, 72);
  assert.ok(buildup.observableFacts.length > 0);
  assert.ok(buildup.timeline.length > 0);
  assert.ok(buildup.action.length > 0);
});

test("still derives watch buildups when no explicit opportunities exist", () => {
  const payloads = cloneFixture();
  const dashboardFeed = payloads["dashboard-feed"];
  payloads["dashboard-feed"] = {
    ...dashboardFeed,
    opportunities: [],
  };

  const model = normalizeDashboardModel(payloads, [], "mock");

  assert.ok(model.buildups.length > 0);
  assert.equal(model.diagnostics.opportunities.mode, "derived");
  assert.equal(model.diagnostics.opportunities.parsedCount, 0);
  assert.ok(model.buildups.every((item) => item.origin === "derived"));
});
