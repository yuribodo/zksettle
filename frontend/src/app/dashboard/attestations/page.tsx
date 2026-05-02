import { AttestationExplorerPanel } from "@/components/dashboard/attestation-explorer-panel";
import { findNavItem } from "@/components/dashboard/nav-items";
import { PageHeader } from "@/components/dashboard/page-header";

const META = findNavItem("/dashboard/attestations")!;

export default function AttestationsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={META.label} subtitle={META.subtitle} />
      <AttestationExplorerPanel />
    </div>
  );
}
