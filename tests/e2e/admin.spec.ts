import { test, expect } from "@playwright/test";
import { signIn, skipIfMissing, expectDenied } from "./helpers";

test.describe("Estate admin role flow", () => {
  test.beforeEach(() => skipIfMissing("ADMIN"));

  test("login redirects to admin overview", async ({ page }) => {
    await signIn(page, "ADMIN");
    await expect(page).toHaveURL(/\/app\/admin/);
  });

  test("verification queue and residents pages load", async ({ page }) => {
    await signIn(page, "ADMIN");
    await page.goto("/app/admin/verifications");
    await expect(page).toHaveURL(/verifications/);
    await page.goto("/app/admin/residents");
    await expect(page).toHaveURL(/residents/);
  });

  test("super route is denied", async ({ page }) => {
    await signIn(page, "ADMIN");
    await expectDenied(page, "/app/super");
  });
});
