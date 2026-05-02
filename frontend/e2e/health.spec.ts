import { test, expect } from "@playwright/test";

test.describe("Dashboard health", () => {
  test("loads the dashboard and shows sidebar navigation", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard\/transactions/);

    const sidebar = page.getByLabel("Dashboard navigation");
    await expect(sidebar).toBeVisible();

    await expect(sidebar.getByText("Wallets & credentials")).toBeVisible();
    await expect(sidebar.getByText("Attestations")).toBeVisible();
    await expect(sidebar.getByText("API keys")).toBeVisible();
    await expect(sidebar.getByText("Audit log")).toBeVisible();
    await expect(sidebar.getByText("Billing")).toBeVisible();
    await expect(sidebar.getByText("Team")).toBeVisible();
  });

  test("displays page header on transactions page", async ({ page }) => {
    await page.goto("/dashboard/transactions");

    await expect(page.getByText("Wallets & credentials")).toBeVisible();
  });

  test("navigates between dashboard pages via sidebar", async ({ page }) => {
    await page.goto("/dashboard/transactions");

    await page.getByLabel("Dashboard navigation").getByText("API keys").click();
    await expect(page).toHaveURL(/\/dashboard\/api-keys/);
    await expect(page.getByText("API keys")).toBeVisible();

    await page.getByLabel("Dashboard navigation").getByText("Billing").click();
    await expect(page).toHaveURL(/\/dashboard\/billing/);
    await expect(page.getByText("Billing")).toBeVisible();
  });
});
