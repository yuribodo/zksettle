import { test, expect } from "@playwright/test";

test.describe("Billing & Usage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/billing");
  });

  test("shows the billing page with tier info", async ({ page }) => {
    await expect(page.getByText("Current tier")).toBeVisible();

    // Should show tier name or loading/error state
    const tierOrState = page.getByText(/Developer|Startup|Growth|Enterprise|Unavailable|—/).first();
    await expect(tierOrState).toBeVisible({ timeout: 10_000 });
  });

  test("shows usage progress bar", async ({ page }) => {
    const progressBar = page.getByRole("progressbar");
    await expect(progressBar).toBeVisible({ timeout: 10_000 });
  });

  test("shows 30-day usage chart section", async ({ page }) => {
    await expect(page.getByText("30-day requests")).toBeVisible();
  });

  test("shows invoices section with mock data", async ({ page }) => {
    await expect(page.getByText("Invoices (mock)")).toBeVisible();

    // Invoice table should have headers
    const invoiceTable = page.locator("section", { has: page.getByText("Invoices (mock)") }).locator("table");
    await expect(invoiceTable).toBeVisible();
    await expect(invoiceTable.getByText("Period")).toBeVisible();
    await expect(invoiceTable.getByText("Amount")).toBeVisible();
    await expect(invoiceTable.getByText("Status")).toBeVisible();
  });

  test("upgrade button is disabled", async ({ page }) => {
    const upgradeButton = page.getByRole("button", { name: /Upgrade plan/ });
    await expect(upgradeButton).toBeDisabled();
  });

  test("fetches /usage and /usage/history endpoints", { tag: "@backend" }, async ({ page }) => {
    let usageCalled = false;
    let historyCalled = false;
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("/usage/history")) historyCalled = true;
      else if (url.includes("/usage")) usageCalled = true;
    });

    await page.goto("/dashboard/billing");

    // Wait for usage data to load
    await expect(page.getByText(/Developer|Startup|Growth|Enterprise/).first()).toBeVisible({
      timeout: 10_000,
    });

    expect(usageCalled).toBe(true);
    expect(historyCalled).toBe(true);
  });
});
