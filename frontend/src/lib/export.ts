import type { EventDto } from "@/lib/api/schemas";

const CSV_COLUMNS: (keyof EventDto)[] = [
  "signature",
  "slot",
  "timestamp",
  "issuer",
  "nullifier_hash",
  "merkle_root",
  "sanctions_root",
  "jurisdiction_root",
  "mint",
  "recipient",
  "payer",
  "amount",
  "epoch",
];

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCsvValue(key: keyof EventDto, value: string | number): string {
  if (key === "timestamp") return new Date((value as number) * 1000).toISOString();
  if (key === "amount") return String((value as number) / 1_000_000);
  return String(value);
}

export function buildCsvContent(events: EventDto[]): string {
  const header = CSV_COLUMNS.join(",");
  const rows = events.map((e) =>
    CSV_COLUMNS.map((col) => escapeCsvField(formatCsvValue(col, e[col]))).join(","),
  );
  return [header, ...rows].join("\n");
}

export function buildJsonContent(events: EventDto[]): string {
  return JSON.stringify(events, null, 2);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToCsv(events: EventDto[], filename: string): void {
  const content = buildCsvContent(events);
  triggerDownload(new Blob([content], { type: "text/csv;charset=utf-8" }), filename);
}

export function exportToJson(events: EventDto[], filename: string): void {
  const content = buildJsonContent(events);
  triggerDownload(new Blob([content], { type: "application/json" }), filename);
}
