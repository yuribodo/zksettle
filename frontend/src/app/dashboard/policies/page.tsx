import { Page } from "iconoir-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { TierBScaffold } from "@/components/dashboard/tier-b-scaffold";
import { findNavItem } from "@/components/dashboard/nav-items";

const META = findNavItem("/dashboard/policies")!;

export default function PoliciesPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={META.label} subtitle={META.subtitle} />
      <TierBScaffold
        icon={Page}
        title="Policy editor · coming soon"
        body="Define per-mint jurisdictions, sanctions posture, and credential minimums. Available to private-beta participants."
      />
    </div>
  );
}
