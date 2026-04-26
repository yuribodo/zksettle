import type { ComponentType, SVGProps } from "react";

import { DisplayHeading } from "@/components/ui/display-heading";
import { Button } from "@/components/ui/button";

export interface TierBScaffoldProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  body: string;
}

export function TierBScaffold({ icon: Icon, title, body }: TierBScaffoldProps) {
  return (
    <section
      aria-labelledby="tier-b-heading"
      className="flex min-h-[360px] flex-col items-center justify-center rounded-[var(--radius-6)] border border-border-subtle bg-surface px-8 py-16 text-center"
    >
      <Icon
        aria-hidden="true"
        strokeWidth={1.5}
        className="size-16 text-ghost"
      />
      <DisplayHeading level="m" as="h2" className="mt-6">
        <span id="tier-b-heading">{title}</span>
      </DisplayHeading>
      <p className="mt-3 max-w-md text-sm text-stone">{body}</p>
      <Button variant="ghost" size="sm" className="mt-6">
        Request access ↗
      </Button>
    </section>
  );
}
