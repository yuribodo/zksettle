import { describe, expect, it } from "vitest";
import type { EventDto } from "@/lib/api/schemas";
import { buildCsvContent, buildJsonContent } from "./export";

const SAMPLE_EVENT: EventDto = {
  signature: "abc123",
  slot: 42,
  timestamp: 1713456000,
  issuer: "issuer_addr",
  nullifier_hash: "nullhash",
  merkle_root: "mroot",
  sanctions_root: "sroot",
  jurisdiction_root: "jroot",
  mint: "mint_addr",
  recipient: "recipient_addr",
  payer: "payer_addr",
  amount: 50_000_000,
  epoch: 10,
};

describe("buildCsvContent", () => {
  it("produces a header row with 13 columns", () => {
    const csv = buildCsvContent([]);
    const header = csv.split("\n")[0];
    expect(header.split(",")).toHaveLength(13);
    expect(header).toBe(
      "signature,slot,timestamp,issuer,nullifier_hash,merkle_root,sanctions_root,jurisdiction_root,mint,recipient,payer,amount,epoch",
    );
  });

  it("converts timestamp to ISO 8601", () => {
    const csv = buildCsvContent([SAMPLE_EVENT]);
    const row = csv.split("\n")[1];
    expect(row).toContain("2024-04-18T");
  });

  it("converts amount from micro-units to units", () => {
    const csv = buildCsvContent([SAMPLE_EVENT]);
    const row = csv.split("\n")[1];
    const fields = row.split(",");
    // amount is the 12th column (index 11)
    expect(fields[11]).toBe("50");
  });

  it("escapes fields containing commas", () => {
    const event: EventDto = { ...SAMPLE_EVENT, issuer: "addr,with,commas" };
    const csv = buildCsvContent([event]);
    const row = csv.split("\n")[1];
    expect(row).toContain('"addr,with,commas"');
  });

  it("escapes fields containing double quotes", () => {
    const event: EventDto = { ...SAMPLE_EVENT, issuer: 'addr"quoted' };
    const csv = buildCsvContent([event]);
    const row = csv.split("\n")[1];
    expect(row).toContain('"addr""quoted"');
  });

  it("returns only the header for an empty array", () => {
    const csv = buildCsvContent([]);
    expect(csv.split("\n")).toHaveLength(1);
  });
});

describe("buildJsonContent", () => {
  it("produces valid JSON that round-trips", () => {
    const events = [SAMPLE_EVENT];
    const json = buildJsonContent(events);
    expect(JSON.parse(json)).toEqual(events);
  });

  it("returns an empty array for no events", () => {
    const json = buildJsonContent([]);
    expect(JSON.parse(json)).toEqual([]);
  });
});
