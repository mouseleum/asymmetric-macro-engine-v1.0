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
      const detail = await response.text().catch(() => "");
      const message =
        response.status === 401
          ? "Macro Vault rejected the server API key."
          : `Macro Vault ${endpoint} returned ${response.status}${detail ? `: ${detail}` : ""}`;

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

export async function getDashboardModel(): Promise<DashboardModel> {
  if (shouldUseMock()) {
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
      errors.push(result.error);
      payloads[result.endpoint] = mockVaultPayloads[result.endpoint];
      diagnosticEndpoints.push({
        endpoint: result.endpoint,
        state: "error",
        status: result.error.status,
        message: result.error.message,
        itemCount: countPayloadItems(mockVaultPayloads[result.endpoint]),
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
