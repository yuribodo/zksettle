import {
  Activity,
  BookmarkBook,
  CheckCircle,
  ClockRotateRight,
  Community,
  DollarCircle,
  Group,
  Key,
} from "iconoir-react";
import type { FC, SVGProps } from "react";

export type NavGroup = "overview" | "controls" | "account";

export interface NavItem {
  label: string;
  href: string;
  icon: FC<SVGProps<SVGSVGElement>>;
  group: NavGroup;
  subtitle: string;
}

export interface NavGroupMeta {
  id: NavGroup;
  label: string;
}

export const NAV_GROUPS: readonly NavGroupMeta[] = [
  { id: "overview", label: "Overview" },
  { id: "controls", label: "Controls" },
  { id: "account", label: "Account" },
];

export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: "Transactions",
    href: "/dashboard/transactions",
    icon: Activity,
    group: "overview",
    subtitle:
      "Live feed of settlement events. Every row carries a proof; every proof is replayable six months from now.",
  },
  {
    label: "Attestations",
    href: "/dashboard/attestations",
    icon: CheckCircle,
    group: "overview",
    subtitle:
      "Filter, search, and inspect every ComplianceAttestation. Available to private-beta participants.",
  },
  {
    label: "Counterparties",
    href: "/dashboard/counterparties",
    icon: Community,
    group: "overview",
    subtitle: "Issuers that have published a Merkle root your policies trust.",
  },
  {
    label: "Policies",
    href: "/dashboard/policies",
    icon: BookmarkBook,
    group: "controls",
    subtitle:
      "Per-mint compliance rules. Define jurisdictions, sanctions posture, and credential minimums.",
  },
  {
    label: "API keys",
    href: "/dashboard/api-keys",
    icon: Key,
    group: "controls",
    subtitle:
      "Rotate, revoke, and audit the keys that sign SDK calls from your backend.",
  },
  {
    label: "Audit log",
    href: "/dashboard/audit-log",
    icon: ClockRotateRight,
    group: "controls",
    subtitle: "Every attestation, exportable on request.",
  },
  {
    label: "Team",
    href: "/dashboard/team",
    icon: Group,
    group: "account",
    subtitle: "Invite colleagues, assign roles, and review recent activity.",
  },
  {
    label: "Billing",
    href: "/dashboard/billing",
    icon: DollarCircle,
    group: "account",
    subtitle: "Pay for what you prove.",
  },
];

export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
