import { test, expect } from "./fixtures";

test.describe("Team", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/team");
  });

  test("shows the team page with coming soon scaffold", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Team", exact: true })).toBeVisible();
    await expect(page.getByText("Team workspace · coming soon")).toBeVisible();
    await expect(
      page.getByText("Available to private-beta participants"),
    ).toBeVisible();
  });
});
