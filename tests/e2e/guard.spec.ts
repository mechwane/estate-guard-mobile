import { test, expect } from "@playwright/test";
import { signIn, skipIfMissing, expectDenied } from "./helpers";

test.describe("Guard role flow", () => {
  test.beforeEach(() => skipIfMissing("GUARD"));

  test("login redirects to guard home", async ({ page }) => {
    await signIn(page, "GUARD");
    await expect(page).toHaveURL(/\/app\/guard/);
  });

  test("guard navigation is visible", async ({ page }) => {
    await signIn(page, "GUARD");
    for (const label of ["Home", "Validate", "Inside", "Incidents", "More"]) {
      await expect(
        page.getByRole("link", { name: new RegExp(`^${label}$`, "i") }).first(),
      ).toBeVisible();
    }
  });

  test("history and incidents pages load", async ({ page }) => {
    await signIn(page, "GUARD");
    await page.goto("/app/guard/history");
    await expect(page).toHaveURL(/history/);
    await page.goto("/app/guard/incidents");
    await expect(page).toHaveURL(/incidents/);
  });

  test("valid / expired / revoked code validation", async ({ page }) => {
    const valid = process.env.E2E_GUEST_CODE_VALID;
    const expired = process.env.E2E_GUEST_CODE_EXPIRED;
    const revoked = process.env.E2E_GUEST_CODE_REVOKED;
    test.skip(!valid && !expired && !revoked, "no E2E_GUEST_CODE_* provided");
    await signIn(page, "GUARD");
    await page.goto("/app/guard/validate");
    for (const [code, expectHint] of [
      [valid, /valid|host/i],
      [expired, /expired/i],
      [revoked, /revoked/i],
    ] as const) {
      if (!code) continue;
      await page.getByRole("textbox").first().fill(code);
      await page
        .getByRole("button", { name: /validate|check/i })
        .first()
        .click();
      await expect(page.getByText(expectHint)).toBeVisible({ timeout: 5000 });
    }
  });

  test("admin and super routes are denied", async ({ page }) => {
    await signIn(page, "GUARD");
    await expectDenied(page, "/app/admin");
    await expectDenied(page, "/app/super");
  });
});
