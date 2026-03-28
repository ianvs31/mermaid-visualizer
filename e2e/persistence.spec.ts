import { expect, test } from "@playwright/test";
import { bootCleanEditor } from "./helpers";

test.describe("document persistence", () => {
  test("restores the latest browser-local document after a reload", async ({ page }) => {
    await bootCleanEditor(page);

    await page.getByRole("button", { name: "起止" }).click();
    await page.getByRole("button", { name: "步骤" }).click();
    await page.getByRole("textbox", { name: "文档标题" }).fill("回访流程");
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const workspace = JSON.parse(localStorage.getItem("mv:workspace") ?? "{}");
          const currentId = workspace.lastOpenedDocumentId;
          return currentId ? localStorage.getItem(`mv:document:${currentId}`) ?? "" : "";
        }),
      )
      .toContain("N2[处理步骤]");

    await page.reload();

    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    await expect(page.getByRole("textbox", { name: "文档标题" })).toHaveValue("回访流程");
    await expect(page.locator("textarea.code-box")).toContainText("N1([开始])");
    await expect(page.locator("textarea.code-box")).toContainText("N2[处理步骤]");
    await expect(page.getByText("已保存")).toBeVisible();
  });
});
