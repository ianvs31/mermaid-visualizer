import { expect, test } from "@playwright/test";
import { bootCleanEditor } from "./helpers";

test.describe("draft persistence", () => {
  test("restores the latest draft after a reload", async ({ page }) => {
    await bootCleanEditor(page);

    await page.getByRole("button", { name: "起止" }).click();
    await page.getByRole("button", { name: "步骤" }).click();
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem("mv:draft") ?? ""))
      .toContain("N2[处理步骤]");

    await page.reload();

    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    await expect(page.locator("textarea.code-box")).toContainText("N1(开始)");
    await expect(page.locator("textarea.code-box")).toContainText("N2[处理步骤]");
    await expect(page.getByRole("status")).toContainText("恢复");
  });
});
