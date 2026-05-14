import { getDashboardModel } from "@/lib/macro-vault/client";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const model = await getDashboardModel();

  return <DashboardClient model={model} />;
}
