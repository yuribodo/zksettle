import { test, expect } from "@playwright/test";

test.describe("API Keys management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/api-keys");
  });

  test("shows the API keys page with create form", async ({ page }) => {
    await expect(page.getByText("Create new key")).toBeVisible();
    await expect(page.getByText("Provisioned keys")).toBeVisible();
    await expect(page.getByPlaceholder("e.g. backend-prod")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create key" })).toBeVisible();
  });

  test("create key button is disabled when owner is empty", async ({ page }) => {
    const createButton = page.getByRole("button", { name: "Create key" });
    await expect(createButton).toBeDisabled();
  });

  test("create key button enables when owner is filled", async ({ page }) => {
    await page.getByPlaceholder("e.g. backend-prod").fill("e2e-test-key");
    const createButton = page.getByRole("button", { name: "Create key" });
    await expect(createButton).toBeEnabled();
  });

  test("creates a new API key and shows it in the list", { tag: "@backend" }, async ({ page }) => {
    const ownerName = `e2e-test-${Date.now()}`;
    await page.getByPlaceholder("e.g. backend-prod").fill(ownerName);
    await page.getByRole("button", { name: "Create key" }).click();

    // The reveal dialog should appear
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText("Copy this key now")).toBeVisible();

    // The key value should be shown
    const keyCode = dialog.locator("code");
    await expect(keyCode).toBeVisible();
    const keyText = await keyCode.textContent();
    expect(keyText).toBeTruthy();

    // Dismiss the dialog
    await dialog.getByRole("button", { name: "I saved it" }).click();
    await expect(dialog).not.toBeVisible();

    // The key should appear in the list
    await expect(page.getByText(ownerName)).toBeVisible();
  });

  test("shows key count in the provisioned keys section", { tag: "@backend" }, async ({ page }) => {
    // Wait for loading to finish
    await expect(page.getByText("loading…")).not.toBeVisible({ timeout: 10_000 });

    // Should show count (e.g. "0 active" or "N active")
    await expect(page.getByText(/\d+ active/)).toBeVisible();
  });
});
