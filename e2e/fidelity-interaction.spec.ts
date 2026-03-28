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

  test("selects an edge through its visible path and opens label editing on double click", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const edgeInteraction = page.locator('.react-flow__edge[data-id="E1"] .react-flow__edge-interaction');
    await expect(edgeInteraction).toHaveCount(1);

    await edgeInteraction.click();
    await expect(page.getByRole("button", { name: "编辑标签" })).toBeVisible();
    await expect(page.locator(".flow-edge__endpoint")).toHaveCount(2);

    await edgeInteraction.dblclick();
    await expect(page.getByPlaceholder("连线标签")).toBeVisible();
  });
});
