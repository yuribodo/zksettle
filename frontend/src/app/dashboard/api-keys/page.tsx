import { ApiKeysPanel } from "@/components/dashboard/api-keys-panel";
import { findNavItem } from "@/components/dashboard/nav-items";
import { PageHeader } from "@/components/dashboard/page-header";

const META = findNavItem("/dashboard/api-keys")!;

export default function ApiKeysPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={META.label} subtitle={META.subtitle} />
      <ApiKeysPanel />
    </div>
  );
}
