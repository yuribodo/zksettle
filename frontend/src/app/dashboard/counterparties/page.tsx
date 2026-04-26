import { IssuerStatusPanel } from "@/components/dashboard/issuer-status-panel";
import { findNavItem } from "@/components/dashboard/nav-items";
import { PageHeader } from "@/components/dashboard/page-header";

const META = findNavItem("/dashboard/counterparties")!;

export default function CounterpartiesPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={META.label} subtitle={META.subtitle} />
      <IssuerStatusPanel />
    </div>
  );
}
