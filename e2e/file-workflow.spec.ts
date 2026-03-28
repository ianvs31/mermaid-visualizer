import { expect, test } from "@playwright/test";
import { bootCleanEditor } from "./helpers";

test.describe("file workflow", () => {
  test("does not show document action buttons in the sidebar", async ({ page }) => {
    await bootCleanEditor(page);

    await expect(page.getByRole("textbox", { name: "文档标题" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "最近文档" })).toBeVisible();
    await expect(page.getByRole("complementary")).not.toContainText("文档操作");
    await expect(page.getByRole("button", { name: "新建文档" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "创建副本" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "导入 Mermaid" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "导入 draw.io" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "下载 Mermaid" })).toHaveCount(0);
  });

  test("switches between recent documents without losing either canvas", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      const firstDocument = {
        version: 1,
        id: "doc-first",
        title: "第一个流程",
        createdAt: "2026-03-28T12:00:00.000Z",
        updatedAt: "2026-03-28T12:00:00.000Z",
        lastOpenedAt: "2026-03-28T12:30:00.000Z",
        code: "flowchart LR\nN1([开始])",
        codeDirty: false,
        model: {
          version: 2,
          direction: "LR",
          rawPassthroughStatements: [],
          groups: [],
          nodes: [{ id: "N1", type: "start", label: "开始", x: 80, y: 120, width: 130, height: 66 }],
          edges: [],
        },
      };
      const secondDocument = {
        version: 1,
        id: "doc-second",
        title: "第二个流程",
        createdAt: "2026-03-28T12:10:00.000Z",
        updatedAt: "2026-03-28T12:10:00.000Z",
        lastOpenedAt: "2026-03-28T12:20:00.000Z",
        code: "flowchart LR\nN1[处理步骤]",
        codeDirty: false,
        model: {
          version: 2,
          direction: "LR",
          rawPassthroughStatements: [],
          groups: [],
          nodes: [{ id: "N1", type: "process", label: "处理步骤", x: 80, y: 120, width: 148, height: 72 }],
          edges: [],
        },
      };

      localStorage.clear();
      localStorage.setItem(
        "mv:documents:index",
        JSON.stringify({
          version: 1,
          documents: [
            {
              id: firstDocument.id,
              title: firstDocument.title,
              createdAt: firstDocument.createdAt,
              updatedAt: firstDocument.updatedAt,
              lastOpenedAt: firstDocument.lastOpenedAt,
            },
            {
              id: secondDocument.id,
              title: secondDocument.title,
              createdAt: secondDocument.createdAt,
              updatedAt: secondDocument.updatedAt,
              lastOpenedAt: secondDocument.lastOpenedAt,
            },
          ],
        }),
      );
      localStorage.setItem(`mv:document:${firstDocument.id}`, JSON.stringify(firstDocument));
      localStorage.setItem(`mv:document:${secondDocument.id}`, JSON.stringify(secondDocument));
      localStorage.setItem(
        "mv:workspace",
        JSON.stringify({
          version: 1,
          lastOpenedDocumentId: firstDocument.id,
        }),
      );
    });
    await page.reload();

    await page.getByRole("combobox", { name: "最近文档" }).selectOption({ label: "第一个流程" });
    await expect(page.locator("textarea.code-box")).toContainText("N1([开始])");
    await expect(page.getByRole("textbox", { name: "文档标题" })).toHaveValue("第一个流程");

    await page.getByRole("combobox", { name: "最近文档" }).selectOption({ label: "第二个流程" });
    await expect(page.locator("textarea.code-box")).toContainText("N1[处理步骤]");
    await expect(page.getByRole("textbox", { name: "文档标题" })).toHaveValue("第二个流程");
  });
});
