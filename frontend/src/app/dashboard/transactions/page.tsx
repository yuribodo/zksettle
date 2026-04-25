import { findNavItem } from "@/components/dashboard/nav-items";
import { PageHeader } from "@/components/dashboard/page-header";
import { WalletsCredentialsPanel } from "@/components/dashboard/wallets-credentials-panel";

const META = findNavItem("/dashboard/transactions")!;

export default function WalletsCredentialsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={META.label} subtitle={META.subtitle} />
      <WalletsCredentialsPanel />
    </div>
  );
}
