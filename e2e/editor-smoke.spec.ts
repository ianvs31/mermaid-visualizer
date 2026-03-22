import { expect, test } from "@playwright/test";
import { bootCleanEditor } from "./helpers";

test.describe("editor smoke flow", () => {
  test("creates toolbar items and arms swimlane drawing", async ({ page }) => {
    await bootCleanEditor(page);

    await page.getByRole("button", { name: "起止" }).click();
    await page.getByRole("button", { name: "步骤" }).click();
    await page.getByRole("button", { name: "判断" }).click();

    await expect(page.locator(".react-flow__node")).toHaveCount(3);
    await expect(page.locator("textarea.code-box")).toContainText("N1((开始))");
    await expect(page.locator("textarea.code-box")).toContainText("N2[处理步骤]");
    await expect(page.locator("textarea.code-box")).toContainText("N3{是否通过?}");

    await page.getByRole("button", { name: "泳道" }).click();

    await expect(page.getByText("拖拽创建泳道区域，按 Esc 取消")).toBeVisible();
  });
});
