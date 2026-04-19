import { PageHeader } from "@/components/dashboard/page-header";
import { findNavItem } from "@/components/dashboard/nav-items";

export function PlaceholderPage({ path, children }: { path: string; children?: React.ReactNode }) {
  const meta = findNavItem(path);
  if (!meta) {
    throw new Error(`PlaceholderPage: unknown path ${path}`);
  }
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={meta.label} subtitle={meta.subtitle} />
      {children ?? (
        <section
          aria-label={`${meta.label} placeholder`}
          className="rounded-[var(--radius-6)] border border-border-subtle bg-surface p-8 text-sm text-stone"
        >
          Content renders here in a follow-up story.
        </section>
      )}
    </div>
  );
}
