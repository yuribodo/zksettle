import { test, expect } from "@playwright/test";

test.describe("Audit Log", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/audit-log");
  });

  test("shows the audit log page with filters", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();

    // Filter controls
    await expect(page.getByText("Range")).toBeVisible();
    await expect(page.getByRole("button", { name: "Apply" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
  });

  test("shows export buttons", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export JSON" })).toBeVisible();
  });

  test("shows table headers", async ({ page }) => {
    const table = page.locator("table");
    await expect(table).toBeVisible();

    await expect(table.getByText("Time (UTC)")).toBeVisible();
    await expect(table.getByText("Status")).toBeVisible();
    await expect(table.getByText("Recipient")).toBeVisible();
    await expect(table.getByText("Issuer")).toBeVisible();
    await expect(table.getByText("Amount")).toBeVisible();
  });

  test("shows loading or events or error state", async ({ page }) => {
    // The page should show one of: loading, events data, error, or empty state
    const loadingOrContent = page.getByText(
      /loading…|events? loaded|Unavailable|No events match/,
    );
    await expect(loadingOrContent).toBeVisible({ timeout: 10_000 });
  });

  test("range filter has expected options", async ({ page }) => {
    const rangeSelect = page.locator("select");
    await expect(rangeSelect).toBeVisible();

    const options = rangeSelect.locator("option");
    await expect(options).toHaveCount(4);
    await expect(options.nth(0)).toHaveText("All time");
    await expect(options.nth(1)).toHaveText("Last 24h");
    await expect(options.nth(2)).toHaveText("Last 7 days");
    await expect(options.nth(3)).toHaveText("Last 30 days");
  });

  test("clear filters resets the range to default", async ({ page }) => {
    const rangeSelect = page.locator("select");
    await rangeSelect.selectOption("24h");
    await expect(rangeSelect).toHaveValue("24h");

    await page.getByRole("button", { name: "Clear" }).click();
    await expect(rangeSelect).toHaveValue("30d");
  });

  test("fetches events from /v1/events endpoint", { tag: "@backend" }, async ({ page }) => {
    const eventsRequest = page.waitForRequest((req) => req.url().includes("/v1/events"));

    await page.goto("/dashboard/audit-log");

    await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible({ timeout: 10_000 });
    await eventsRequest;
  });
});
