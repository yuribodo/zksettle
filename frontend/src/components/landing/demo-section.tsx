import Link from "next/link";

import { SectionHeader, Section } from "@/components/landing/section";
import { PinnedSection } from "@/components/motion/pinned-section";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { COPY } from "@/content/copy";
import { cn } from "@/lib/cn";

export function DemoSection() {
  const { eyebrow, headline, initialTerminal, form, honestyFooter } = COPY.demo;

  return (
    <Section id="demo" aria-labelledby="demo-heading">
      <PinnedSection pinDuration={1.5} showProgress className="pb-20 md:pb-24">
        <SectionHeader
          eyebrow={eyebrow}
          headline={<span id="demo-heading">{headline}</span>}
          level="l"
        />
        <div className="mt-16 grid gap-8 md:mt-20 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12">
          <div
            role="group"
            aria-label="Proof request"
            className="flex flex-col gap-6 rounded-[var(--radius-6)] border border-border-subtle bg-surface p-6 md:p-8"
          >
            <label className="flex flex-col gap-2">
              <span className="font-mono text-xs uppercase tracking-[0.08em] text-quill">
                {form.recipient.label}
              </span>
              <Input
                type="text"
                defaultValue={String(form.recipient.defaultValue ?? "")}
                placeholder={form.recipient.placeholder}
                readOnly
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="flex items-baseline justify-between font-mono text-xs uppercase tracking-[0.08em] text-quill">
                <span>{form.amount.label}</span>
                <span className="text-stone">
                  {form.amount.defaultValue} / {form.amount.max} USDC
                </span>
              </span>
              <Slider
                min={form.amount.min}
                max={form.amount.max}
                defaultValue={form.amount.defaultValue}
                disabled
                aria-label={form.amount.label}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="font-mono text-xs uppercase tracking-[0.08em] text-quill">
                {form.jurisdiction.label}
              </span>
              <Select defaultValue={String(form.jurisdiction.defaultValue ?? "US")} disabled>
                {form.jurisdiction.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </Select>
            </label>
            <div className="flex flex-col gap-3">
              <Link
                href="#demo"
                aria-disabled
                className={cn(
                  buttonVariants({ variant: "primary", size: "md" }),
                  "pointer-events-none opacity-80",
                )}
              >
                {form.generateCta}
              </Link>
              <label className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.08em] text-stone">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded-[2px] border border-border"
                  disabled
                />
                {form.expiredToggle}
              </label>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div
              aria-label="Proof console"
              className="min-h-[280px] rounded-[var(--radius-6)] border border-border-subtle bg-surface-deep p-6 font-mono text-sm leading-relaxed text-stone"
            >
              <p className="text-muted">{initialTerminal}</p>
            </div>
            <p className="font-mono text-xs text-muted">{honestyFooter}</p>
          </div>
        </div>
      </PinnedSection>
    </Section>
  );
}
