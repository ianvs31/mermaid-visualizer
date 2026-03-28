import { expect, type Page } from "@playwright/test";

export async function bootCleanEditor(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    const now = "2026-03-28T12:00:00.000Z";
    const blankDocument = {
      version: 1,
      id: "doc-blank",
      title: "未命名图表",
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
      code: "flowchart LR",
      codeDirty: false,
      model: {
        version: 2,
        direction: "LR",
        rawPassthroughStatements: [],
        groups: [],
        nodes: [],
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
            id: blankDocument.id,
            title: blankDocument.title,
            createdAt: blankDocument.createdAt,
            updatedAt: blankDocument.updatedAt,
            lastOpenedAt: blankDocument.lastOpenedAt,
          },
        ],
      }),
    );
    localStorage.setItem(`mv:document:${blankDocument.id}`, JSON.stringify(blankDocument));
    localStorage.setItem(
      "mv:workspace",
      JSON.stringify({
        version: 1,
        lastOpenedDocumentId: blankDocument.id,
      }),
    );
  });
  await page.reload();
  await expect(page.locator("textarea.code-box")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "文档标题" })).toBeVisible();
  await expect(page.getByRole("button", { name: "起止" })).toBeVisible();
  await expect(page.locator("textarea.code-box")).toHaveValue("flowchart LR");
}

export async function openHelp(page: Page) {
  await page.getByRole("button", { name: "帮助与导出" }).click();
  await expect(page.getByRole("dialog", { name: "帮助与导出" })).toBeVisible();
}
