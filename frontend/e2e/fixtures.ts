import { test as base } from "@playwright/test";

const MOCK_TENANT = {
  tenant_id: "00000000-0000-0000-0000-000000000001",
  wallet: "GgMEeuntnq4v9jrR7q958thgDuEWMseg2U94fvK5tvQk",
  name: null,
  tier: "developer",
};

export const test = base.extend({
  page: async ({ page }, apply) => {
    await page.route("**/auth/me", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_TENANT) }),
    );
    await apply(page);
  },
});

export { expect } from "@playwright/test";
