import { test, expect } from "@playwright/test";
import { signIn, skipIfMissing } from "./helpers";

test.describe("Super admin role flow", () => {
  test.beforeEach(() => skipIfMissing("SUPER"));

  test("login redirects to super estates", async ({ page }) => {
    await signIn(page, "SUPER");
    await expect(page).toHaveURL(/\/app\/super/);
  });

  test("estate search filters the list", async ({ page }) => {
    await signIn(page, "SUPER");
    await page.goto("/app/super");
    const search = page.getByPlaceholder(/search/i).first();
    await search.fill("zzzzz-no-such-estate");
    await expect(page.getByText(/no estates|no matches/i)).toBeVisible();
  });

  test("open first estate detail", async ({ page }) => {
    await signIn(page, "SUPER");
    await page.goto("/app/super");
    const firstEstate = page.locator("a[href*='/app/super/estates/']").first();
    if (await firstEstate.count()) {
      await firstEstate.click();
      await expect(page).toHaveURL(/\/app\/super\/estates\//);
      await expect(page.getByText(/People|Guest passes|Incidents/i).first()).toBeVisible();
    } else test.skip(true, "no estates in database");
  });
});
