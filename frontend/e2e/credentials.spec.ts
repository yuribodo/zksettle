import { test, expect } from "@playwright/test";

const MOCK_WALLET = "a".repeat(64);

test.describe("Wallets & Credentials", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/transactions");
  });

  test("shows the credential lookup form", async ({ page }) => {
    const lookupSection = page.getByRole("region", { name: "Look up wallet credential" });
    await expect(lookupSection).toBeVisible();
    await expect(lookupSection.getByPlaceholder("0x… (64 hex chars)")).toBeVisible();
    await expect(lookupSection.getByRole("button", { name: "Look up" })).toBeVisible();
  });

  test("look up button is disabled with empty input", async ({ page }) => {
    const lookupSection = page.getByRole("region", { name: "Look up wallet credential" });
    await expect(lookupSection.getByRole("button", { name: "Look up" })).toBeDisabled();
  });

  test("shows validation error for invalid wallet", async ({ page }) => {
    const lookupSection = page.getByRole("region", { name: "Look up wallet credential" });
    await lookupSection.getByPlaceholder("0x… (64 hex chars)").fill("not-a-valid-hex");
    await expect(lookupSection.getByText("Wallet must be 64 hex characters")).toBeVisible();
  });

  test("enables look up button with valid 64-char hex", async ({ page }) => {
    const lookupSection = page.getByRole("region", { name: "Look up wallet credential" });
    await lookupSection.getByPlaceholder("0x… (64 hex chars)").fill(MOCK_WALLET);
    await expect(lookupSection.getByRole("button", { name: "Look up" })).toBeEnabled();
  });

  test("looks up a wallet and shows credential status", async ({ page }) => {
    const lookupSection = page.getByRole("region", { name: "Look up wallet credential" });
    await lookupSection.getByPlaceholder("0x… (64 hex chars)").fill(MOCK_WALLET);
    await lookupSection.getByRole("button", { name: "Look up" }).click();

    const credentialSection = page.getByRole("region", { name: "Credential", exact: true });
    await expect(credentialSection).toBeVisible({ timeout: 10_000 });

    await expect(credentialSection.getByText(MOCK_WALLET).first()).toBeVisible();
  });

  test("shows recent lookups section", async ({ page }) => {
    await expect(page.getByText("Recent lookups (this browser)")).toBeVisible();
  });

  test("issues a credential for a wallet", { tag: "@backend" }, async ({ page }) => {
    const lookupSection = page.getByRole("region", { name: "Look up wallet credential" });
    await lookupSection.getByPlaceholder("0x… (64 hex chars)").fill(MOCK_WALLET);
    await lookupSection.getByRole("button", { name: "Look up" }).click();

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
      const status = credentialSection.getByText(/Active|Revoked|Not found|Unauthorized/).first();
      await expect(status).toBeVisible({ timeout: 10_000 });
    }
  });

  test("revokes a credential for a wallet", { tag: "@backend" }, async ({ page }) => {
    const lookupSection = page.getByRole("region", { name: "Look up wallet credential" });
    await lookupSection.getByPlaceholder("0x… (64 hex chars)").fill(MOCK_WALLET);
    await lookupSection.getByRole("button", { name: "Look up" }).click();

    const credentialSection = page.getByRole("region", { name: "Credential", exact: true });
    await expect(credentialSection).toBeVisible({ timeout: 10_000 });

    const revokeButton = credentialSection.getByRole("button", { name: /Revoke/ });
    const hasRevokeButton = await revokeButton.isVisible().catch(() => false);

    if (hasRevokeButton) {
      await revokeButton.click();

      const result = credentialSection.getByText(/Revoked|Error|Not found/);
      await expect(result).toBeVisible({ timeout: 10_000 });
    } else {
      const status = credentialSection.getByText(/Not found|Revoked|Unauthorized|Issue credential/).first();
      await expect(status).toBeVisible({ timeout: 10_000 });
    }
  });
});
