import { expect, test } from "@playwright/test";

test("discover suggests tracks for a vibe from pre-made demo answers", async ({ page }) => {
  await page.goto("/app/discover");
  await expect(page.getByRole("heading", { name: "What should play next?" })).toBeVisible();
  await page.getByLabel("Describe the vibe").fill("late night synth drive");
  await page.getByRole("button", { name: /^Suggest \d+ tracks$/ }).click();
  await expect(page.getByText(/· “late night synth drive”/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Regenerate" })).toBeVisible();
});
