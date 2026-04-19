import { PageHeader } from "@/components/dashboard/page-header";
import { findNavItem } from "@/components/dashboard/nav-items";
import { TransactionsLiveFeed } from "@/components/dashboard/transactions-live-feed";

const META = findNavItem("/dashboard/transactions")!;

function parseSeed(raw: string | undefined): number {
  if (!raw) return 1337;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 1337;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ seed?: string }>;
}) {
  const params = await searchParams;
  const seed = parseSeed(params.seed);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={META.label} subtitle={META.subtitle} />
      <TransactionsLiveFeed seed={seed} />
    </div>
  );
}
