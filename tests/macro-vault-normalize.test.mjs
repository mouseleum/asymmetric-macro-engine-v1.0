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
        api_key: "secret-vault-key",
        authorization: "Bearer live-secret-token",
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
  assert.match(buildup.rawPreview, /Structured Title/);
  assert.doesNotMatch(buildup.rawPreview, /secret-vault-key|live-secret-token/);
  assert.match(buildup.rawPreview, /\[REDACTED\]/);
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
  assert.ok(model.buildups.every((item) => item.rawPreview.includes(item.label)));
});

test("parses raw reports from nested dashboard-feed rows", () => {
  const payloads = cloneFixture();
  payloads["dashboard-feed"] = {
    dashboardFeed: {
      rows: [
        {
          id: "nested-row-report",
          metadata: {
            analysis: `[LABEL: Nested Hormuz Watch]
[COORDINATES: 26.56, 56.25]

BUILDUP DETECTED
Situation: Raw text buried in metadata still describes a clear chokepoint buildup.

ASSET CORRELATION BASKET:
PRIMARY LONG: Brent volatility
PRIMARY SHORT: European importers
CORRELATED PROXIES: TTF gas, freight rates
HEDGE/SECONDARY: USD cash

DIVERGENCE METER: 82/100`,
            source_url: "https://macro-vault-v3.vercel.app/nested-report",
            source_title: "Nested report source",
          },
          coordinates: "bad coordinate value",
        },
      ],
    },
  };

  const model = normalizeDashboardModel(payloads, [], "mock");
  const [buildup] = model.buildups;
  const dashboardFeedShape = model.diagnostics.endpointShapes.find((shape) => shape.endpoint === "dashboard-feed");

  assert.equal(buildup.origin, "parsed");
  assert.equal(buildup.label, "Nested Hormuz Watch");
  assert.equal(buildup.coordinates?.lat, 26.56);
  assert.equal(buildup.coordinates?.lon, 56.25);
  assert.equal(buildup.assetBasket.primaryLong, "Brent volatility");
  assert.equal(buildup.sources[0]?.url, "https://macro-vault-v3.vercel.app/nested-report");
  assert.ok(dashboardFeedShape?.nestedArrayFields.includes("dashboardFeed.rows"));
  assert.ok(dashboardFeedShape?.rawReportFields.includes("metadata.analysis"));
});

test("nested generic data items stay derived instead of promoted to alerts", () => {
  const payloads = cloneFixture();
  payloads["dashboard-feed"] = {
    data: {
      items: [
        {
          id: "nested-watch-row",
          title: "Nested Inflation Watch",
          summary: "A nested row has macro pressure, but no explicit opportunity report.",
          severity: "high",
          conviction: 82,
          divergence_score: 78,
          metadata: {
            source_url: "https://macro-vault-v3.vercel.app/watch-row",
            source_title: "Watch row source",
          },
        },
      ],
    },
  };

  const model = normalizeDashboardModel(payloads, [], "mock");
  const [buildup] = model.buildups;

  assert.equal(buildup.origin, "derived");
  assert.equal(buildup.label, "Nested Inflation Watch");
  assert.equal(buildup.sources[0]?.title, "Watch row source");
  assert.equal(model.diagnostics.opportunities.mode, "derived");
  assert.equal(model.diagnostics.opportunityReadiness[0].missingFields.includes("explicit opportunity/raw report"), true);
});

test("malformed explicit coordinates fall back without crashing", () => {
  const payloads = cloneFixture();
  payloads["dashboard-feed"] = {
    opportunities: [
      {
        id: "bad-coordinates",
        label: "Bad Coordinate Report",
        situation: "Structured payload supplies unusable coordinates but remains renderable.",
        coordinates: { lat: "north", lon: "east" },
        assetBasket: {
          primaryLong: "Oil volatility",
          primaryShort: "Transport equities",
          proxies: ["Freight"],
          hedge: "Cash",
        },
      },
    ],
  };

  const [buildup] = normalizeDashboardModel(payloads, [], "mock").buildups;

  assert.equal(buildup.origin, "explicit");
  assert.equal(buildup.coordinates, undefined);
  assert.equal(buildup.assetBasket.primaryShort, "Transport equities");
});
