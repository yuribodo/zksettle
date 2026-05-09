import type { Page } from "@playwright/test";

import { test, expect } from "./fixtures";

const MOCK_WALLET = "b".repeat(64);

function searchSection(page: Page) {
  return page.locator("section").filter({
    has: page.getByText("Search wallet attestation", { exact: true }),
  });
}

function statusSection(page: Page) {
  return page.locator("section").filter({
    has: page.getByText("Compliance status", { exact: true }),
  });
}

test.describe("Attestation Explorer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/attestations");
  });

  test("shows the attestation search form", async ({ page }) => {
    const section = searchSection(page);
    await expect(section).toBeVisible();
    await expect(section.getByRole("textbox")).toBeVisible();
    await expect(section.getByRole("button", { name: "Search", exact: true })).toBeVisible();
  });

  test("search button is disabled with empty input", async ({ page }) => {
    await expect(searchSection(page).getByRole("button", { name: "Search", exact: true })).toBeDisabled();
  });

  test("shows validation error for invalid wallet", async ({ page }) => {
    const section = searchSection(page);
    await section.getByRole("textbox").fill("xyz");
    await expect(section.getByText("Wallet must be 64 hex characters")).toBeVisible();
  });

  test("searches for a wallet and shows compliance status", async ({ page }) => {
    const section = searchSection(page);
    await section.getByRole("textbox").fill(MOCK_WALLET);
    await section.getByRole("button", { name: "Search", exact: true }).click();

    const card = statusSection(page);
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card.getByText(MOCK_WALLET, { exact: true })).toBeVisible();
  });

  test("shows recent lookups section", async ({ page }) => {
    await expect(page.getByText("Recent lookups (this browser)")).toBeVisible();
  });

  test("fetches /v1/roots when the attestation page loads", { tag: "@backend" }, async ({ page }) => {
    const rootsRequest = page.waitForRequest(
      (req) => req.url().includes("/v1/roots") && !req.url().includes("/publish"),
    );

    await page.goto("/dashboard/attestations");

    await expect(searchSection(page)).toBeVisible({ timeout: 10_000 });
    await rootsRequest;
  });

  test("fetches membership and sanctions proofs on search", { tag: "@backend" }, async ({ page }) => {
    const membershipRequest = page.waitForRequest(
      (req) => req.url().includes("/v1/proofs/membership/"),
    );
    const sanctionsRequest = page.waitForRequest(
      (req) => req.url().includes("/v1/proofs/sanctions/"),
    );

    const section = searchSection(page);
    await section.getByRole("textbox").fill(MOCK_WALLET);
    await section.getByRole("button", { name: "Search", exact: true }).click();

    await Promise.all([membershipRequest, sanctionsRequest]);
  });
});
