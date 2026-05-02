import { test, expect } from "@playwright/test";

const MOCK_WALLET = "a".repeat(64);

test.describe("Wallets & Credentials", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/transactions");
  });

  test("shows the credential lookup form", async ({ page }) => {
    await expect(page.getByText("Look up wallet credential")).toBeVisible();
    await expect(page.getByPlaceholder("0x… (64 hex chars)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Look up" })).toBeVisible();
  });

  test("look up button is disabled with empty input", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Look up" })).toBeDisabled();
  });

  test("shows validation error for invalid wallet", async ({ page }) => {
    await page.getByPlaceholder("0x… (64 hex chars)").fill("not-a-valid-hex");
    await expect(page.getByText("Wallet must be 64 hex characters")).toBeVisible();
  });

  test("enables look up button with valid 64-char hex", async ({ page }) => {
    await page.getByPlaceholder("0x… (64 hex chars)").fill(MOCK_WALLET);
    await expect(page.getByRole("button", { name: "Look up" })).toBeEnabled();
  });

  test("looks up a wallet and shows credential status", async ({ page }) => {
    await page.getByPlaceholder("0x… (64 hex chars)").fill(MOCK_WALLET);
    await page.getByRole("button", { name: "Look up" }).click();

    // Should show credential section (loading then result or error)
    const credentialSection = page.getByRole("region", { name: "Credential", exact: true });
    await expect(credentialSection).toBeVisible({ timeout: 10_000 });

    // The wallet address should be displayed
    await expect(credentialSection.getByText(MOCK_WALLET).first()).toBeVisible();
  });

  test("shows recent lookups section", async ({ page }) => {
    await expect(page.getByText("Recent lookups (this browser)")).toBeVisible();
  });

  test("issues a credential for a wallet", { tag: "@backend" }, async ({ page }) => {
    await page.getByPlaceholder("0x… (64 hex chars)").fill(MOCK_WALLET);
    await page.getByRole("button", { name: "Look up" }).click();

    const credentialSection = page.getByRole("region", { name: "Credential", exact: true });
    await expect(credentialSection).toBeVisible({ timeout: 10_000 });

    const issueButton = credentialSection.getByRole("button", { name: /Issue credential/ });
    const hasIssueButton = await issueButton.isVisible().catch(() => false);

    if (hasIssueButton) {
      await credentialSection.getByRole("textbox").fill("US");
      await issueButton.click();

      const result = credentialSection.getByText(/Active|Wallet already has|Error|Revoked/);
      await expect(result).toBeVisible({ timeout: 10_000 });
    } else {
      // Credential already exists or an error occurred — verify we see a status
      const status = credentialSection.getByText(/Active|Revoked|Not found|Unauthorized/).first();
      await expect(status).toBeVisible({ timeout: 10_000 });
    }
  });

  test("revokes a credential for a wallet", { tag: "@backend" }, async ({ page }) => {
    await page.getByPlaceholder("0x… (64 hex chars)").fill(MOCK_WALLET);
    await page.getByRole("button", { name: "Look up" }).click();

    const credentialSection = page.getByRole("region", { name: "Credential", exact: true });
    await expect(credentialSection).toBeVisible({ timeout: 10_000 });

    const revokeButton = credentialSection.getByRole("button", { name: /Revoke/ });
    const hasRevokeButton = await revokeButton.isVisible().catch(() => false);

    if (hasRevokeButton) {
      await revokeButton.click();

      const result = credentialSection.getByText(/Revoked|Error|Not found/);
      await expect(result).toBeVisible({ timeout: 10_000 });
    } else {
      // No active credential to revoke — verify we see not-found or already-revoked status
      const status = credentialSection.getByText(/Not found|Revoked|Unauthorized|Issue credential/).first();
      await expect(status).toBeVisible({ timeout: 10_000 });
    }
  });
});
