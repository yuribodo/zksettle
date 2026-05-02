import { test, expect } from "@playwright/test";

test.describe("Counterparties & Issuer Status", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/counterparties");
  });

  test("shows the issuer status page", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Issuer status" })).toBeVisible();
    await expect(page.getByText("Merkle roots", { exact: true })).toBeVisible();
    await expect(page.getByText("From GET /v1/roots")).toBeVisible();
  });

  test("shows root fields: membership, sanctions, jurisdiction", async ({ page }) => {
    await expect(page.getByText("Membership root")).toBeVisible();
    await expect(page.getByText("Sanctions root")).toBeVisible();
    await expect(page.getByText("Jurisdiction root")).toBeVisible();
  });

  test("shows wallet count and last publish stats", async ({ page }) => {
    await expect(page.getByText("Wallet count", { exact: true })).toBeVisible();
    await expect(page.getByText("Last publish", { exact: true })).toBeVisible();
  });

  test("has a publish roots button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Publish roots" })).toBeVisible();
  });

  test("fetches /v1/roots on page load", { tag: "@backend" }, async ({ page }) => {
    let rootsCalled = false;
    page.on("request", (req) => {
      if (req.url().includes("/v1/roots") && !req.url().includes("/publish")) {
        rootsCalled = true;
      }
    });

    await page.goto("/dashboard/counterparties");

    // Wait for roots data to load or show error
    const content = page.getByText(/loading…|Live|Not published|Unavailable/);
    await expect(content).toBeVisible({ timeout: 10_000 });
    expect(rootsCalled).toBe(true);
  });

  test("clicks publish roots and gets response", { tag: "@backend" }, async ({ page }) => {
    // Wait for page to be ready (roots loaded or error)
    const status = page.getByText(/Live|Not published|Unavailable/);
    await expect(status).toBeVisible({ timeout: 10_000 });

    const publishButton = page.getByRole("button", { name: "Publish roots" });

    // Only click if not disabled (disabled when loading or error)
    if (await publishButton.isEnabled()) {
      await publishButton.click();

      // Should show "Publishing…" then a toast or error
      const result = page.getByText(/Published at slot|Submitted at slot|Upstream|Error/);
      await expect(result).toBeVisible({ timeout: 10_000 });
    }
  });
});
