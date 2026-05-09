import { test, expect } from "./fixtures";

test.describe("Prove", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/prove");
  });

  test("shows the prove page intro state", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Prove" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "End-to-end compliance proof" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect" })).toBeVisible();
    await expect(page.getByText("Connect a wallet to begin")).toBeVisible();
  });
});
