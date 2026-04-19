import { PageHeader } from "@/components/dashboard/page-header";
import { findNavItem } from "@/components/dashboard/nav-items";

const META = findNavItem("/dashboard/transactions")!;

export default function TransactionsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={META.label} subtitle={META.subtitle} />
      <section
        aria-label="Transactions placeholder"
        className="rounded-[var(--radius-6)] border border-border-subtle bg-surface p-8 text-sm text-stone"
      >
        Live feed renders here — fully wired in US-024.
      </section>
    </div>
  );
}
