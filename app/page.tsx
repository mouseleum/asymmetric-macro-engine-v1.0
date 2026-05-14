import { getDashboardModel } from "@/lib/macro-vault/client";
import { mockVaultPayloads } from "@/lib/macro-vault/fixtures";
import { normalizeDashboardModel } from "@/lib/macro-vault/normalize";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const model = await getDashboardModel();
  const parserDemoModel = normalizeDashboardModel(mockVaultPayloads, [], "mock");
  const parserDemoBuildup = parserDemoModel.buildups.find((buildup) => buildup.id === "raw-hormuz-blockade");

  return <DashboardClient model={model} parserDemoBuildup={parserDemoBuildup} />;
}
