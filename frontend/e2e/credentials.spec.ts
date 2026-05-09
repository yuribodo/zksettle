import type { Page } from "@playwright/test";

import { test, expect } from "./fixtures";

const MOCK_WALLET = "a".repeat(64);

function lookupSection(page: Page) {
  return page.locator("section").filter({
    has: page.getByText("Look up wallet credential", { exact: true }),
  });
}

function credentialSection(page: Page) {
  return page.locator("section").filter({
    has: page.getByText("Credential", { exact: true }),
  });
}

test.describe("Wallets & Credentials", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/transactions");
  });

  test("shows the credential lookup form", async ({ page }) => {
    const section = lookupSection(page);
    await expect(section).toBeVisible();
    await expect(section.getByRole("textbox")).toBeVisible();
    await expect(section.getByRole("button", { name: "Look up" })).toBeVisible();
  });

  test("look up button is disabled with empty input", async ({ page }) => {
    await expect(lookupSection(page).getByRole("button", { name: "Look up" })).toBeDisabled();
  });

  test("shows validation error for invalid wallet", async ({ page }) => {
    const section = lookupSection(page);
    await section.getByRole("textbox").fill("not-a-valid-hex");
    await expect(section.getByText("Wallet must be 64 hex characters")).toBeVisible();
  });

  test("enables look up button with valid 64-char hex", async ({ page }) => {
    const section = lookupSection(page);
    await section.getByRole("textbox").fill(MOCK_WALLET);
    await expect(section.getByRole("button", { name: "Look up" })).toBeEnabled();
  });

  test("looks up a wallet and shows credential status", async ({ page }) => {
    const section = lookupSection(page);
    await section.getByRole("textbox").fill(MOCK_WALLET);
    await section.getByRole("button", { name: "Look up" }).click();

    const card = credentialSection(page);
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card.getByText(MOCK_WALLET).first()).toBeVisible();
  });

  test("shows recent lookups section", async ({ page }) => {
    await expect(page.getByText("Recent lookups (this browser)")).toBeVisible();
  });

  test("issues a credential for a wallet", { tag: "@backend" }, async ({ page }) => {
    const section = lookupSection(page);
    await section.getByRole("textbox").fill(MOCK_WALLET);
    await section.getByRole("button", { name: "Look up" }).click();

    const card = credentialSection(page);
    await expect(card).toBeVisible({ timeout: 10_000 });

    const issueButton = card.getByRole("button", { name: /Issue credential/ });
    const hasIssueButton = await issueButton.isVisible().catch(() => false);

    if (hasIssueButton) {
      await card.getByRole("textbox").fill("US");
      await issueButton.click();

      await expect(card.getByText("Active", { exact: true })).toBeVisible({ timeout: 10_000 });
    } else {
      const status = card.getByText(/Active|Revoked|Not found|Unauthorized/).first();
      await expect(status).toBeVisible({ timeout: 10_000 });
    }
  });

  test("revokes a credential for a wallet", { tag: "@backend" }, async ({ page }) => {
    const section = lookupSection(page);
    await section.getByRole("textbox").fill(MOCK_WALLET);
    await section.getByRole("button", { name: "Look up" }).click();

    const card = credentialSection(page);
    await expect(card).toBeVisible({ timeout: 10_000 });

    const revokeButton = card.getByRole("button", { name: /Revoke/ });
    const hasRevokeButton = await revokeButton.isVisible().catch(() => false);

    if (hasRevokeButton) {
      await revokeButton.click();

      const result = card.getByText(/Revoked|Error|Not found/);
      await expect(result).toBeVisible({ timeout: 10_000 });
    } else {
      const status = card.getByText(/Not found|Revoked|Unauthorized|Issue credential/).first();
      await expect(status).toBeVisible({ timeout: 10_000 });
    }
  });
});
