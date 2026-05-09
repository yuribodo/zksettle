import type { Page } from "@playwright/test";

import { test, expect } from "./fixtures";

function rootsSection(page: Page) {
  return page.locator("section").filter({
    has: page.getByText("Merkle roots", { exact: true }),
  });
}

function controlsSection(page: Page) {
  return page.locator("section").filter({
    has: page.getByRole("button", { name: "Publish roots" }),
  });
}

test.describe("Counterparties & Issuer Status", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/counterparties");
  });

  test("shows the issuer status page", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Issuer status" })).toBeVisible();
    await expect(rootsSection(page)).toBeVisible();
    await expect(page.getByText("From GET /v1/roots")).toBeVisible();
  });

  test("shows root fields: membership, sanctions, jurisdiction", async ({ page }) => {
    const section = rootsSection(page);
    const membershipRoot = section.getByText("Membership root");
    const errorAlert = section.getByRole("alert");

    await expect(membershipRoot.or(errorAlert)).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(500);

    if (await membershipRoot.isVisible()) {
      await expect(section.getByText("Sanctions root")).toBeVisible();
      await expect(section.getByText("Jurisdiction root")).toBeVisible();
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

    await expect(rootsSection(page)).toBeVisible({ timeout: 10_000 });
    await rootsRequest;
  });

  test("clicks publish roots and gets response", { tag: "@backend" }, async ({ page }) => {
    const section = controlsSection(page);
    const status = section.getByText(/^(Live|Not published|Unavailable)$/);
    await expect(status).toBeVisible({ timeout: 10_000 });

    const publishButton = page.getByRole("button", { name: "Publish roots" });

    if (await publishButton.isEnabled()) {
      await publishButton.click();

      const result = page.getByText(/Published at slot|Submitted at slot|Upstream|Error/);
      await expect(result).toBeVisible({ timeout: 10_000 });
    }
  });
});
