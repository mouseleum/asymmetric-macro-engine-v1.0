import "server-only";

import { mockVaultPayloads } from "./fixtures";
import { normalizeDashboardModel } from "./normalize";
import type { DashboardError, DashboardDiagnostics, DashboardModel, VaultEndpoint, VaultPayloads } from "./types";

const endpointPaths: Record<VaultEndpoint, string> = {
  contract: "/api/vault/contract",
  "dashboard-feed": "/api/vault/dashboard-feed?days=30&limit=12",
  events: "/api/vault/events?limit=12",
  regime: "/api/vault/regime",
  series: "/api/vault/series?limit=12",
  latest: "/api/vault/latest",
};

const endpoints = Object.keys(endpointPaths) as VaultEndpoint[];

function latestSeriesConfig() {
  return {
    provider: process.env.MACRO_VAULT_LATEST_PROVIDER ?? "alternative_me",
    code: process.env.MACRO_VAULT_LATEST_CODE ?? "ALT_FNG",
    country: process.env.MACRO_VAULT_LATEST_COUNTRY ?? "WLD",
  };
}

function countPayloadItems(payload: unknown): number | undefined {
  if (Array.isArray(payload)) return payload.length;
  if (typeof payload !== "object" || payload === null) return undefined;
  const record = payload as Record<string, unknown>;

  for (const key of ["buildups", "opportunities", "alerts", "reports", "setups", "risks", "items", "rows", "feed", "data", "signals", "upcomingCriticalEvents", "events", "series", "metrics", "latest"]) {
    if (Array.isArray(record[key])) return record[key].length;
  }

  for (const key of ["data", "payload", "result", "results", "dashboardFeed", "dashboard_feed", "feed"]) {
    const count: number | undefined = countPayloadItems(record[key]);
    if (count !== undefined) return count;
  }

  if ("observation" in record) return 1;
  return undefined;
}

function shouldUseMock() {
  return process.env.NEXT_PUBLIC_USE_MOCK_VAULT === "true" || !process.env.MACRO_VAULT_API_KEY;
}

async function fetchVaultEndpoint(endpoint: VaultEndpoint) {
  const baseUrl = process.env.MACRO_VAULT_URL ?? "https://macro-vault-v3.vercel.app";
  const apiKey = process.env.MACRO_VAULT_API_KEY;
  const path =
    endpoint === "latest"
      ? latestEndpointPath()
      : endpointPaths[endpoint];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(new URL(path, baseUrl), {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      // Response bodies stay in server logs; the model (and /diagnostics) only carries the status.
      const detail = await response.text().catch(() => "");
      if (detail) console.error(`Macro Vault ${endpoint} returned ${response.status}: ${detail.slice(0, 500)}`);
      const message =
        response.status === 401
          ? "Macro Vault rejected the server API key."
          : `Macro Vault ${endpoint} returned ${response.status}.`;

      return {
        endpoint,
        error: { endpoint, status: response.status, message } satisfies DashboardError,
      };
    }

    return {
      endpoint,
      payload: (await response.json()) as unknown,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Macro Vault request failure";
    return {
      endpoint,
      error: {
        endpoint,
        message: `Macro Vault ${endpoint} request failed: ${message}`,
      } satisfies DashboardError,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function latestEndpointPath() {
  const { provider, code, country } = latestSeriesConfig();
  const params = new URLSearchParams({ provider, code, country });

  return `${endpointPaths.latest}?${params.toString()}`;
}

// Per-instance throttle so public page views cannot hammer Macro Vault: live models
// are reused for CACHE_TTL_MS, and concurrent requests share one in-flight fetch.
const CACHE_TTL_MS = 60_000;
let cachedLiveModel: { promise: Promise<DashboardModel>; expiresAt: number } | undefined;

export async function getDashboardModel(): Promise<DashboardModel> {
  if (shouldUseMock()) return getMockDashboardModel();

  if (!cachedLiveModel || cachedLiveModel.expiresAt <= Date.now()) {
    cachedLiveModel = {
      promise: buildLiveDashboardModel(),
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
  }

  return cachedLiveModel.promise;
}

function getMockDashboardModel(): DashboardModel {
  const diagnostics: DashboardDiagnostics = {
    endpoints: endpoints.map((endpoint) => ({
      endpoint,
      state: "mock",
      message: "Using local fixture payload.",
      itemCount: countPayloadItems(mockVaultPayloads[endpoint]),
    })),
    endpointShapes: [],
    latestSeries: latestSeriesConfig(),
    opportunities: {
      mode: "derived",
      explicitCount: 0,
      parsedCount: 0,
      derivedCount: 0,
    },
    opportunityReadiness: [],
  };

  return normalizeDashboardModel(
    mockVaultPayloads,
    [
      {
        endpoint: "environment",
        message: process.env.MACRO_VAULT_API_KEY
          ? "Mock mode is enabled by NEXT_PUBLIC_USE_MOCK_VAULT=true."
          : "MACRO_VAULT_API_KEY is missing, so the dashboard is using local fixtures.",
      },
    ],
    "mock",
    diagnostics,
  );
}

async function buildLiveDashboardModel(): Promise<DashboardModel> {
  const results = await Promise.all(endpoints.map(fetchVaultEndpoint));
  const payloads: VaultPayloads = {};
  const errors: DashboardError[] = [];
  const diagnosticEndpoints: DashboardDiagnostics["endpoints"] = [];

  for (const result of results) {
    if ("payload" in result) {
      payloads[result.endpoint] = result.payload;
      diagnosticEndpoints.push({
        endpoint: result.endpoint,
        state: "ok",
        message: "Macro Vault returned JSON.",
        itemCount: countPayloadItems(result.payload),
      });
    } else {
      // Leave the payload empty: fixture data must never render inside a live model.
      errors.push(result.error);
      diagnosticEndpoints.push({
        endpoint: result.endpoint,
        state: "error",
        status: result.error.status,
        message: result.error.message,
      });
    }
  }

  return normalizeDashboardModel(payloads, errors, "live", {
    endpoints: diagnosticEndpoints,
    endpointShapes: [],
    latestSeries: latestSeriesConfig(),
    opportunities: {
      mode: "derived",
      explicitCount: 0,
      parsedCount: 0,
      derivedCount: 0,
    },
    opportunityReadiness: [],
  });
}
