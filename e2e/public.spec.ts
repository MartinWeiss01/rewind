import { expect, test } from "@playwright/test";

test("the landing describes every feature and opens the demo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your music library, tidied up.",
  );
  for (const feature of ["Listening stats", "Your own recap", "Playlist tools", "AI suggestions"]) {
    await expect(page.getByRole("heading", { name: feature })).toBeVisible();
  }
  // A demo-only deployment offers no sign-in.
  await expect(page.getByRole("link", { name: /connect my library/i })).toHaveCount(0);
  await page.getByRole("link", { name: "Try the demo" }).first().click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText("You’re exploring a fictional listener.")).toBeVisible();
});

test("the admin page doesn't exist for demo visitors", async ({ page }) => {
  // The page streams behind a loading state, so the status is 200; the content is the not-found page.
  await page.goto("/app/admin");
  await expect(page.getByText("Nothing here")).toBeVisible();
  await expect(page.getByRole("heading", { name: /access/i })).toHaveCount(0);
});

test("the app works in Czech", async ({ page, context }) => {
  await context.addCookies([{ name: "locale", value: "cs", url: "http://127.0.0.1:3100" }]);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hudební knihovna v pořádku.");
});
