import { expect, test } from "@playwright/test";

test.describe("mermaid fidelity interactions", () => {
  test("edits edge labels, toggles dashed edges, and keeps swimlane collapse stable", async ({ page }) => {
    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.locator("textarea.code-box")).toBeVisible();
    await expect(page.locator('.react-flow__node[data-id="N1"]')).toHaveCount(1);

    await page.locator('.react-flow__edge[data-id="E1"]').evaluate((element) => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await expect(page.getByRole("button", { name: "编辑标签" })).toBeVisible();

    await page.getByRole("button", { name: "编辑标签" }).click();
    await page.getByPlaceholder("连线标签").fill("继续处理");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.locator("textarea.code-box")).toContainText("N1 -->|继续处理| N2");

    await page.getByRole("button", { name: "虚线" }).click();
    await expect(page.locator("textarea.code-box")).toContainText("N1 -. 继续处理 .-> N2");

    await page.getByRole("button", { name: "折叠 业务侧" }).click();
    await expect(page.locator('.react-flow__node[data-id="N1"]')).toHaveCount(0);

    await page.getByRole("button", { name: "展开 业务侧" }).click();
    await expect(page.locator('.react-flow__node[data-id="N1"]')).toHaveCount(1);

    await page.getByRole("button", { name: "折叠 业务侧" }).click();
    await expect(page.locator('.react-flow__node[data-id="N1"]')).toHaveCount(0);
    await expect(page.locator('.react-flow__edge[data-id="E1"]')).toHaveCount(0);
  });
});
