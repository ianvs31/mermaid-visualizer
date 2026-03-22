import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { bootCleanEditor, openHelp } from "./helpers";

test.describe("file workflow", () => {
  test("downloads Mermaid and reopens it from the file menu", async ({ page }, testInfo) => {
    await bootCleanEditor(page);
    await page.getByRole("button", { name: "起止" }).click();

    await openHelp(page);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载 Mermaid" }).click();
    const download = await downloadPromise;
    const savedPath = testInfo.outputPath("diagram.md");
    await download.saveAs(savedPath);

    const mermaidText = await readFile(savedPath, "utf8");
    expect(mermaidText).toContain("```mermaid");
    expect(mermaidText).toContain("N1([开始])");

    await page.getByRole("button", { name: "新建图表" }).click();
    await expect(page.locator("textarea.code-box")).toHaveValue("flowchart LR");

    const chooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "打开 Mermaid 文件" }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles(savedPath);

    await expect(page.locator("textarea.code-box")).toContainText("N1([开始])");
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
  });
});
