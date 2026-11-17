import { expect, test } from "@playwright/test";

test("the dashboard shows the demo listener's stats", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(page.getByText("No listening in this period")).toHaveCount(0);
  await expect(page.getByRole("heading").first()).toBeVisible();
});

test("history lists plays and filters them by search", async ({ page }) => {
  await page.goto("/app/history");
  const rows = page.getByRole("row");
  await expect(rows.nth(1)).toBeVisible();
  const search = page
    .getByRole("searchbox", { name: "Search plays" })
    .or(page.getByLabel("Search plays"));
  await search.first().fill("zzzz-no-such-track");
  await search.first().press("Enter");
  await expect(page.getByText("No plays match these filters")).toBeVisible();
});

test("the recap rewinds a period", async ({ page }) => {
  await page.goto("/app/rewind");
  await expect(page.getByText(/rewound/).first()).toBeVisible();
  await expect(page.getByText("Not enough tape for a recap")).toHaveCount(0);
});
