import {
  Activity,
  CheckCircle,
  ClockRotateRight,
  Community,
  DollarCircle,
  Flash,
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
    label: "Wallets & credentials",
    href: "/dashboard/transactions",
    icon: Activity,
    group: "overview",
    subtitle:
      "Look up a wallet to inspect its issuer credential, or issue/revoke one against the live merkle tree.",
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
    label: "Issuer status",
    href: "/dashboard/counterparties",
    icon: Community,
    group: "overview",
    subtitle:
      "Live merkle roots, wallet count, and last on-chain publish for the issuer behind this workspace.",
  },
  {
    label: "Prove",
    href: "/dashboard/prove",
    icon: Flash,
    group: "overview",
    subtitle:
      "Generate a compliance proof and submit it on-chain. End-to-end in under 15 seconds.",
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
