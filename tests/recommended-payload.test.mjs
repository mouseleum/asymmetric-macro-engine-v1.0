import assert from "node:assert/strict";
import { test } from "node:test";

import {
  recommendedDashboardFeedPayload,
  recommendedDashboardFeedPayloadText,
} from "../lib/macro-vault/recommended-payload.ts";
import { normalizeDashboardModel } from "../lib/macro-vault/normalize.ts";

test("recommended dashboard-feed payload is valid explicit opportunity input", () => {
  const parsed = JSON.parse(recommendedDashboardFeedPayloadText);

  assert.deepEqual(parsed, recommendedDashboardFeedPayload);
  assert.equal(parsed.opportunities.length, 1);
  assert.equal(parsed.opportunities[0].status, "opportunity");
  assert.equal(typeof parsed.opportunities[0].report, "string");
  assert.equal(parsed.opportunities[0].coordinates.lat, 26.56);
});

test("recommended dashboard-feed payload normalizes as a true parsed opportunity", () => {
  const model = normalizeDashboardModel(
    {
      "dashboard-feed": recommendedDashboardFeedPayload,
      events: { events: [] },
      series: { series: [] },
      latest: { metrics: [] },
      regime: { regime: { label: "neutral" } },
    },
    [],
    "mock",
  );
  const [buildup] = model.buildups;

  assert.equal(model.diagnostics.opportunities.mode, "parsed");
  assert.equal(model.diagnostics.opportunities.parsedCount, 1);
  assert.equal(model.diagnostics.opportunities.derivedCount, 0);
  assert.equal(buildup.origin, "parsed");
  assert.equal(buildup.label, "Hormuz Blockade");
  assert.equal(buildup.coordinates?.lon, 56.25);
  assert.equal(buildup.assetBasket.primaryLong, "Brent Crude (BZ=F)");
});

test("recommended payload text stays free of downstream-write concepts", () => {
  assert.doesNotMatch(recommendedDashboardFeedPayloadText, /supabase|telegram|ingest|scan button/i);
});
