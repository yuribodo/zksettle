import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DisplayHeading } from "@/components/ui/display-heading";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusPill } from "@/components/dashboard/status-pill";
import { TransactionTable } from "@/components/dashboard/transaction-row";
import { INITIAL_TRANSACTIONS, ISSUERS } from "@/lib/mock-data";

const DEMO_TXS = INITIAL_TRANSACTIONS.slice(0, 5);
const issuerName = (id: string) =>
  ISSUERS.find((issuer) => issuer.id === id)?.name ?? "Unknown";

export const metadata = {
  title: "UI primitives",
  description: "Visual catalog of ZKSettle shadcn-style primitives.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-6 border-t border-border-subtle pt-10 first:border-t-0 first:pt-0">
      <header className="flex flex-col gap-2">
        <span className="font-mono text-xs tracking-[0.08em] text-forest uppercase">{title}</span>
        <span
          aria-hidden="true"
          className="block h-px w-5 bg-forest"
        />
      </header>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="font-mono text-xs tracking-[0.06em] text-muted uppercase">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export default function UIPage() {
  return (
    <main id="main-content" className="mx-auto max-w-3xl px-6 py-24">
      <header className="mb-16 flex flex-col gap-4">
        <span className="font-mono text-xs tracking-[0.08em] text-forest uppercase">
          Primitives
        </span>
        <h1 className="font-display text-5xl leading-[0.95] tracking-[-0.035em]">
          The <em>shared</em> language.
        </h1>
        <p className="max-w-prose text-lg text-quill">
          Every landing and dashboard surface pulls from this single set of token-driven
          primitives. Hover, click, and tab through them to feel the focus ring.
        </p>
      </header>

      <div className="flex flex-col gap-14">
        <Section title="DisplayHeading">
          <Row label="display-xl · h1 default · clamp(56–128px) / 0.95 / -3.5%">
            <DisplayHeading level="xl">
              Settle <em>everywhere</em>.
            </DisplayHeading>
          </Row>
          <Row label="display-l · h2 default · clamp(40–72px) / 1.03 / -3.5%">
            <DisplayHeading level="l">
              Prove <em>anywhere</em>.
            </DisplayHeading>
          </Row>
          <Row label="display-m · h3 default · clamp(32–48px) / 1.05 / -2%">
            <DisplayHeading level="m">
              Audited in <em>real time</em>.
            </DisplayHeading>
          </Row>
          <Row label="Polymorphic · as='p'">
            <DisplayHeading level="m" as="p">
              The <em>shared</em> language.
            </DisplayHeading>
          </Row>
        </Section>

        <Section title="Button">
          <Row label="Variants">
            <Button variant="primary">Primary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Read the docs</Button>
          </Row>
          <Row label="Sizes">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </Row>
          <Row label="Disabled">
            <Button variant="primary" disabled>
              Primary
            </Button>
            <Button variant="ghost" disabled>
              Ghost
            </Button>
            <Button variant="link" disabled>
              Link
            </Button>
          </Row>
        </Section>

        <Section title="Input">
          <Row label="Default">
            <Input placeholder="5g8H4nP3eR...9JbK" className="max-w-sm" defaultValue="" />
          </Row>
          <Row label="Filled + disabled">
            <Input defaultValue="1,200" className="max-w-xs" />
            <Input defaultValue="disabled" disabled className="max-w-xs" />
          </Row>
        </Section>

        <Section title="Select">
          <Row label="Jurisdiction">
            <div className="w-64">
              <Select defaultValue="us">
                <option value="us">United States</option>
                <option value="eu">European Union</option>
                <option value="uk">United Kingdom</option>
                <option value="br">Brazil</option>
              </Select>
            </div>
          </Row>
        </Section>

        <Section title="Slider">
          <Row label="Amount · 100–10,000 USDC">
            <div className="flex w-full max-w-md items-center gap-4">
              <Slider defaultValue={1200} min={100} max={10000} step={100} />
              <span className="font-mono text-sm text-ink">1,200</span>
            </div>
          </Row>
        </Section>

        <Section title="Badge">
          <Row label="Status">
            <Badge>Default</Badge>
            <Badge variant="success">Verified</Badge>
            <Badge variant="warning">Pending</Badge>
            <Badge variant="danger">Rejected</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="forest">Live</Badge>
          </Row>
        </Section>

        <Section title="Tabs">
          <Tabs defaultValue="proof">
            <TabsList>
              <TabsTrigger value="proof">Proof</TabsTrigger>
              <TabsTrigger value="settlement">Settlement</TabsTrigger>
              <TabsTrigger value="audit">Audit</TabsTrigger>
            </TabsList>
            <TabsContent value="proof">
              <p className="text-base text-quill">
                181ms Groth16 proof. Verifiable on devnet.
              </p>
            </TabsContent>
            <TabsContent value="settlement">
              <p className="text-base text-quill">
                Sub-5-second wall clock, end to end.
              </p>
            </TabsContent>
            <TabsContent value="audit">
              <p className="text-base text-quill">
                Every attestation exportable on request.
              </p>
            </TabsContent>
          </Tabs>
        </Section>

        <Section title="StatusPill">
          <Row label="verified · blocked · warning · info · test">
            <StatusPill kind="verified" />
            <StatusPill kind="blocked" />
            <StatusPill kind="warning" label="Stale (>24h)" />
            <StatusPill kind="info" label="Pending" />
            <StatusPill kind="test" />
          </Row>
        </Section>

        <Section title="StatCard">
          <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
            <StatCard
              label="Proofs verified (24h)"
              value="1,847"
              sub="+12% vs yesterday"
            />
            <StatCard label="Blocked" value="23" sub="1.2% rejection rate" />
            <StatCard label="Avg proving time" value="4.7s" sub="p95 6.2s" />
            <StatCard label="Avg verify cost" value="$0.00091" sub="Devnet" />
          </div>
        </Section>

        <Section title="TransactionTable">
          <div className="w-full overflow-x-auto">
            <TransactionTable transactions={DEMO_TXS} issuerName={issuerName} />
          </div>
        </Section>
      </div>
    </main>
  );
}
