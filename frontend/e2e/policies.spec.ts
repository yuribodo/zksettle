import { test, expect } from "./fixtures";

test.describe("Policies", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/policies");
  });

  test("shows the policies page with coming soon scaffold", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Policies" })).toBeVisible();
    await expect(page.getByText("Policy editor · coming soon")).toBeVisible();
    await expect(
      page.getByText("Define per-mint jurisdictions, sanctions posture"),
    ).toBeVisible();
  });
});
