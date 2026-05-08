import { test, expect } from "./fixtures";

test.describe("Billing & Usage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/billing");
  });

  test("shows the billing page with tier info", async ({ page }) => {
    await expect(page.getByText("Current tier")).toBeVisible();

    const tierOrState = page.getByText(/Developer|Startup|Growth|Enterprise|Unavailable|—”/).first();
    await expect(tierOrState).toBeVisible({ timeout: 10_000 });
  });

  test("shows usage progress bar", async ({ page }) => {
    await expect(page.getByRole("progressbar")).toBeVisible({ timeout: 10_000 });
  });

  test("shows 30-day usage chart section", async ({ page }) => {
    await expect(page.getByText("30-day requests")).toBeVisible();
    await expect(page.getByRole("img", { name: /usage chart/i })).toBeVisible();
  });

  test("shows usage summary details", async ({ page }) => {
    await expect(page.getByText(/Used this month/i)).toBeVisible();
    await expect(page.getByText(/GET \/usage\/history/)).toBeVisible();
  });

  test("fetches /usage and /usage/history endpoints", { tag: "@backend" }, async ({ page }) => {
    const usageRequest = page.waitForRequest(
      (req) => req.url().includes("/usage") && !req.url().includes("/usage/history"),
    );
    const historyRequest = page.waitForRequest((req) => req.url().includes("/usage/history"));

    await page.goto("/dashboard/billing");

    await expect(page.getByText("Current tier")).toBeVisible({ timeout: 10_000 });
    await Promise.all([usageRequest, historyRequest]);
  });
});
