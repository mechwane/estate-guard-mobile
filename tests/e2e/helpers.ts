import { test, expect, type Page } from "@playwright/test";

type Creds = { email?: string; password?: string };

export function getCreds(role: "RESIDENT" | "GUARD" | "ADMIN" | "SUPER"): Creds {
  return {
    email: process.env[`E2E_${role}_EMAIL`],
    password: process.env[`E2E_${role}_PASSWORD`],
  };
}

export function skipIfMissing(role: "RESIDENT" | "GUARD" | "ADMIN" | "SUPER") {
  const { email, password } = getCreds(role);
  test.skip(
    !email || !password,
    `E2E_${role}_EMAIL / _PASSWORD not set — skipping authenticated test`,
  );
}

export async function signIn(page: Page, role: "RESIDENT" | "GUARD" | "ADMIN" | "SUPER") {
  const { email, password } = getCreds(role);
  await page.goto("/auth/sign-in");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/app\//, { timeout: 15_000 });
}

export async function expectDenied(page: Page, url: string) {
  await page.goto(url);
  await expect(page).toHaveURL(/\/app\/denied/);
}

export { expect };
