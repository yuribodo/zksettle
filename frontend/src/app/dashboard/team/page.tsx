import { Group } from "iconoir-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { TierBScaffold } from "@/components/dashboard/tier-b-scaffold";
import { findNavItem } from "@/components/dashboard/nav-items";

const META = findNavItem("/dashboard/team")!;

export default function TeamPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={META.label} subtitle={META.subtitle} />
      <TierBScaffold
        icon={Group}
        title="Team workspace · coming soon"
        body="Invite colleagues, assign roles, and review recent activity. Available to private-beta participants."
      />
    </div>
  );
}
