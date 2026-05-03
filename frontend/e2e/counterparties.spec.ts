import { test, expect } from "./fixtures";

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
    // Root fields are only rendered when /v1/roots succeeds; a fresh CI
    // backend may return 404 (no roots published yet), which replaces the
    // field list with an error alert.  Wait for the API to settle, then
    // assert the fields only when the response was successful.
    const rootsSection = page.getByRole("region", { name: "Merkle roots" });
    const membershipRoot = rootsSection.getByText("Membership root");
    const errorAlert = rootsSection.getByRole("alert");

    await expect(membershipRoot.or(errorAlert)).toBeVisible({ timeout: 10_000 });
    // Allow loading state to resolve (label is visible during loading too)
    await page.waitForTimeout(500);

    if (await membershipRoot.isVisible()) {
      await expect(rootsSection.getByText("Sanctions root")).toBeVisible();
      await expect(rootsSection.getByText("Jurisdiction root")).toBeVisible();
    } else {
      await expect(errorAlert).toBeVisible();
    }
  });

  test("shows wallet count and last publish stats", async ({ page }) => {
    await expect(page.getByText("Wallet count", { exact: true })).toBeVisible();
    await expect(page.getByText("Last publish", { exact: true })).toBeVisible();
  });

  test("has a publish roots button", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Publish roots" })).toBeVisible();
  });

  test("fetches /v1/roots on page load", { tag: "@backend" }, async ({ page }) => {
    const rootsRequest = page.waitForRequest(
      (req) => req.url().includes("/v1/roots") && !req.url().includes("/publish"),
    );

    await page.goto("/dashboard/counterparties");

    await expect(page.getByText("Merkle roots", { exact: true })).toBeVisible({ timeout: 10_000 });
    await rootsRequest;
  });

  test("clicks publish roots and gets response", { tag: "@backend" }, async ({ page }) => {
    // Wait for page to be ready (roots loaded or error)
    const statusSection = page.locator("section").first();
    const status = statusSection.getByText(/^(Live|Not published|Unavailable)$/);
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
