import { test, expect } from "@playwright/test";

const MOCK_WALLET = "b".repeat(64);

test.describe("Attestation Explorer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/attestations");
  });

  test("shows the attestation search form", async ({ page }) => {
    await expect(page.getByText("Search wallet attestation")).toBeVisible();
    await expect(page.getByPlaceholder("0x… (64 hex chars)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Search", exact: true })).toBeVisible();
  });

  test("search button is disabled with empty input", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Search", exact: true })).toBeDisabled();
  });

  test("shows validation error for invalid wallet", async ({ page }) => {
    await page.getByPlaceholder("0x… (64 hex chars)").fill("xyz");
    await expect(page.getByText("Wallet must be 64 hex characters")).toBeVisible();
  });

  test("searches for a wallet and shows compliance status", async ({ page }) => {
    await page.getByPlaceholder("0x… (64 hex chars)").fill(MOCK_WALLET);
    await page.getByRole("button", { name: "Search", exact: true }).click();

    // Should show compliance status section
    const statusSection = page.locator("section", { has: page.getByText("Compliance status") });
    await expect(statusSection).toBeVisible({ timeout: 10_000 });

    // The wallet should appear in the status section
    await expect(statusSection.getByText(MOCK_WALLET, { exact: true })).toBeVisible();
  });

  test("shows recent lookups section", async ({ page }) => {
    await expect(page.getByText("Recent lookups (this browser)")).toBeVisible();
  });

  test("fetches /v1/roots when the attestation page loads", { tag: "@backend" }, async ({ page }) => {
    const rootsRequest = page.waitForRequest(
      (req) => req.url().includes("/v1/roots") && !req.url().includes("/publish"),
    );

    await page.goto("/dashboard/attestations");

    await expect(page.getByText("Search wallet attestation")).toBeVisible({ timeout: 10_000 });
    await rootsRequest;
  });

  test("fetches membership and sanctions proofs on search", { tag: "@backend" }, async ({ page }) => {
    const membershipRequest = page.waitForRequest(
      (req) => req.url().includes("/v1/proofs/membership/"),
    );
    const sanctionsRequest = page.waitForRequest(
      (req) => req.url().includes("/v1/proofs/sanctions/"),
    );

    await page.getByPlaceholder("0x… (64 hex chars)").fill(MOCK_WALLET);
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await Promise.all([membershipRequest, sanctionsRequest]);
  });
});
