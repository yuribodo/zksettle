import { Key } from "iconoir-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { TierBScaffold } from "@/components/dashboard/tier-b-scaffold";
import { findNavItem } from "@/components/dashboard/nav-items";

const META = findNavItem("/dashboard/api-keys")!;

export default function ApiKeysPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={META.label} subtitle={META.subtitle} />
      <TierBScaffold
        icon={Key}
        title="API key management · coming soon"
        body="Rotate, revoke, and audit the keys that sign SDK calls. Available to private-beta participants."
      />
    </div>
  );
}
