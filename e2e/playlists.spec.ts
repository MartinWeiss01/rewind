import { expect, type Page, test } from "@playwright/test";

const playlist = "/app/playlists/demo-playlist-01";

async function openTool(page: Page, name: string) {
  await page.getByRole("button", { name: "Tools" }).click();
  await page.getByRole("menuitem", { name }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

const trackCount = async (page: Page) =>
  Number(
    (
      (await page
        .getByText(/^\d+ tracks$/)
        .first()
        .textContent()) ?? ""
    ).split(" ")[0],
  );

test("the library lists the demo playlists", async ({ page }) => {
  await page.goto("/app/playlists");
  await expect(page.getByRole("heading", { name: "Playlists" })).toBeVisible();
  await page
    .getByRole("link", { name: /Late night drives/ })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`${playlist}$`));
});

test("removing duplicates saves a snapshot that undoes it", async ({ page }) => {
  await page.goto(playlist);
  const before = await trackCount(page);
  await openTool(page, "Remove duplicates");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /^Remove \d+/ }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => trackCount(page)).toBeLessThan(before);

  await page.getByRole("button", { name: "History & undo" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Restore" }).first().click();
  await expect.poll(() => trackCount(page)).toBe(before);
});

test("sorting into playlists moves the ticked tracks", async ({ page }) => {
  await page.goto(playlist);
  const before = await trackCount(page);
  await openTool(page, "Sort into playlists");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Sort into" }).click();
  await page.getByRole("option", { name: "Synth sunsets" }).click();
  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: /^Suggest for/ }).click();

  await expect(dialog.getByRole("heading", { name: "Review suggestions" })).toBeVisible();
  await expect(dialog.getByText("Suggestions are pre-made")).toBeVisible();
  const move = dialog.getByRole("button", { name: /^Move \d+ tracks?$/ });
  const moved = Number(((await move.textContent()) ?? "").split(" ")[1]);
  expect(moved).toBeGreaterThan(0);
  await move.click();
  await expect(dialog.getByRole("heading", { name: /^Moved \d+ tracks?$/ })).toBeVisible();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect.poll(() => trackCount(page)).toBeLessThan(before);
});

test("reset demo restores the fictional library", async ({ page }) => {
  await page.goto(playlist);
  const before = await trackCount(page);
  await openTool(page, "Remove duplicates");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Remove \d+/ })
    .click();
  await expect.poll(() => trackCount(page)).toBeLessThan(before);

  await page.goto("/app/settings");
  const reset = page.waitForResponse((r) => r.request().method() === "POST");
  await page.getByRole("button", { name: "Reset demo" }).click();
  await reset;
  await page.goto(playlist);
  await expect.poll(() => trackCount(page)).toBe(before);
});
