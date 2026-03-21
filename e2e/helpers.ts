import { expect, type Page } from "@playwright/test";

export async function bootCleanEditor(page: Page) {
  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("textarea.code-box")).toBeVisible();
  await expect(page.getByRole("button", { name: "起止" })).toBeVisible();
  await openHelp(page);
  await page.getByRole("button", { name: "新建图表" }).click();
  await expect(page.locator("textarea.code-box")).toHaveValue("flowchart LR");
  await page.getByRole("button", { name: "帮助与导出" }).click();
}

export async function openHelp(page: Page) {
  await page.getByRole("button", { name: "帮助与导出" }).click();
  await expect(page.getByRole("dialog", { name: "帮助与导出" })).toBeVisible();
}
