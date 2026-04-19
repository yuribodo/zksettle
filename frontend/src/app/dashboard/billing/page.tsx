import { BillingCards } from "@/components/dashboard/billing-cards";
import { PageHeader } from "@/components/dashboard/page-header";
import { findNavItem } from "@/components/dashboard/nav-items";

const META = findNavItem("/dashboard/billing")!;

export default function BillingPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={META.label} subtitle={META.subtitle} />
      <BillingCards />
    </div>
  );
}
