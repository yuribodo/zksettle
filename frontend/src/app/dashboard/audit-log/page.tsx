import { AuditLogTable } from "@/components/dashboard/audit-log-table";
import { findNavItem } from "@/components/dashboard/nav-items";
import { PageHeader } from "@/components/dashboard/page-header";
import { RequireApiKey } from "@/components/dashboard/require-api-key";

const META = findNavItem("/dashboard/audit-log")!;

export default function AuditLogPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={META.label} subtitle={META.subtitle} />
      <RequireApiKey>
        <AuditLogTable />
      </RequireApiKey>
    </div>
  );
}
