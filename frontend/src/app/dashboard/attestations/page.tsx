import { Check } from "iconoir-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { TierBScaffold } from "@/components/dashboard/tier-b-scaffold";
import { findNavItem } from "@/components/dashboard/nav-items";

const META = findNavItem("/dashboard/attestations")!;

export default function AttestationsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={META.label} subtitle={META.subtitle} />
      <TierBScaffold
        icon={Check}
        title="Attestation explorer · coming soon"
        body="Filter, search, and inspect every ComplianceAttestation. Available to private-beta participants."
      />
    </div>
  );
}
