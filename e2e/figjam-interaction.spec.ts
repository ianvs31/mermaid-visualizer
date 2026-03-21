import { expect, test } from "@playwright/test";
import { bootCleanEditor } from "./helpers";

test.describe("FigJam interaction preset", () => {
  test("supports quick-create connection flow from the selected node", async ({ page }) => {
    await bootCleanEditor(page);

    await page.getByRole("button", { name: "起止" }).click();
    await page.getByRole("button", { name: "快速连接 right" }).click();
    await page.getByRole("dialog", { name: "快速创建节点" }).getByRole("button", { name: "步骤" }).click();

    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
    await expect(page.locator("textarea.code-box")).toContainText("N1(开始)");
    await expect(page.locator("textarea.code-box")).toContainText("N2[处理步骤]");
    await expect(page.locator("textarea.code-box")).toContainText("N1 -->N2");
  });
});
