import { test, expect } from "@playwright/test";
import { signIn, skipIfMissing, expectDenied } from "./helpers";

test.describe("Resident role flow", () => {
  test.beforeEach(() => skipIfMissing("RESIDENT"));

  test("login redirects to resident home", async ({ page }) => {
    await signIn(page, "RESIDENT");
    await expect(page).toHaveURL(/\/app\/resident/);
  });

  test("resident navigation is visible", async ({ page }) => {
    await signIn(page, "RESIDENT");
    for (const label of ["Home", "Guests", "Bills", "Events", "More"]) {
      await expect(
        page.getByRole("link", { name: new RegExp(`^${label}$`, "i") }).first(),
      ).toBeVisible();
    }
  });

  test("profile and verification pages load", async ({ page }) => {
    await signIn(page, "RESIDENT");
    await page.goto("/app/resident/profile");
    await expect(page).toHaveURL(/profile/);
    await page.goto("/app/resident/verification");
    await expect(page).toHaveURL(/verification/);
  });

  test("guest, events, bills screens accessible", async ({ page }) => {
    await signIn(page, "RESIDENT");
    for (const path of ["/app/resident/guests", "/app/resident/events", "/app/resident/bills"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(path));
    }
  });

  test("admin and super routes are denied", async ({ page }) => {
    await signIn(page, "RESIDENT");
    await expectDenied(page, "/app/admin");
    await expectDenied(page, "/app/super");
  });
});
