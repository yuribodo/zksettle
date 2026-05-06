import { findNavItem } from "@/components/dashboard/nav-items";
import { PageHeader } from "@/components/dashboard/page-header";
import { ProveFlowPanel } from "@/components/dashboard/prove-flow-panel";
import { RequireApiKey } from "@/components/dashboard/require-api-key";

const META = findNavItem("/dashboard/prove")!;

export default function ProvePage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={META.label} subtitle={META.subtitle} />
      <RequireApiKey>
        <ProveFlowPanel />
      </RequireApiKey>
    </div>
  );
}
