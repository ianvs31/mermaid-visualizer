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
    await expect(page.locator("textarea.code-box")).toContainText("N1([开始])");
    await expect(page.locator("textarea.code-box")).toContainText("N2[处理步骤]");
    await expect(page.locator("textarea.code-box")).toContainText("N1 --> N2");
  });

  test("keeps quick-connect active while moving through the expanded hover zone", async ({ page }) => {
    await bootCleanEditor(page);
    await page.getByRole("button", { name: "起止" }).click();
    await page.locator(".react-flow__pane").click({ position: { x: 24, y: 24 } });

    const node = page.locator('.react-flow__node[data-model-id="N1"] .diagram-node-host');
    const quickConnect = node.getByRole("button", { name: "快速连接 right" });

    await expect(node).toHaveAttribute("data-interaction-active", "false");

    await node.hover();
    await expect(node).toHaveAttribute("data-interaction-active", "true");

    const nodeBox = await node.boundingBox();
    const buttonBox = await quickConnect.boundingBox();
    if (!nodeBox || !buttonBox) {
      throw new Error("Missing node or quick-connect geometry");
    }

    await page.mouse.move((nodeBox.x + nodeBox.width + buttonBox.x) / 2, nodeBox.y + nodeBox.height / 2);
    await expect(node).toHaveAttribute("data-interaction-active", "true");

    await quickConnect.evaluate((button) => (button as HTMLButtonElement).click());
    await expect(page.getByRole("dialog", { name: "快速创建节点" })).toBeVisible();
  });

  test("renders decision nodes as square hosts with an inner rotated square and outside quick-connect buttons", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const node = page.locator('.react-flow__node[data-model-id="N3"] .diagram-node-host');
    const diamond = node.locator(".diagram-node__decision-diamond");
    const topHandle = node.locator(".diagram-handle--top");
    const bottomHandle = node.locator(".diagram-handle--bottom");
    const bottomQuickConnect = node.getByRole("button", { name: "快速连接 bottom" });

    await node.hover();

    const nodeBox = await node.boundingBox();
    const topHandleBox = await topHandle.boundingBox();
    const bottomHandleBox = await bottomHandle.boundingBox();
    const bottomQuickConnectBox = await bottomQuickConnect.boundingBox();

    if (!nodeBox || !topHandleBox || !bottomHandleBox || !bottomQuickConnectBox) {
      throw new Error("Missing decision node geometry");
    }

    const decisionMetrics = await node.evaluate((hostElement) => {
      const hostStyle = getComputedStyle(hostElement as HTMLElement);
      const diamondStyle = getComputedStyle(
        (hostElement as HTMLElement).querySelector(".diagram-node__decision-diamond") as HTMLElement,
      );
      return {
        hostWidth: parseFloat(hostStyle.width),
        hostHeight: parseFloat(hostStyle.height),
        diamondWidth: parseFloat(diamondStyle.width),
        diamondHeight: parseFloat(diamondStyle.height),
        transform: diamondStyle.transform,
      };
    });

    expect(Math.abs(nodeBox.width - nodeBox.height)).toBeLessThan(1);
    expect(decisionMetrics.diamondWidth).toBeLessThan(decisionMetrics.hostWidth);
    expect(decisionMetrics.diamondHeight).toBeLessThan(decisionMetrics.hostHeight);
    expect(decisionMetrics.transform).not.toBe("none");

    const hostCenterX = nodeBox.x + nodeBox.width / 2;
    expect(Math.abs(topHandleBox.x + topHandleBox.width / 2 - hostCenterX)).toBeLessThan(6);
    expect(Math.abs(bottomHandleBox.x + bottomHandleBox.width / 2 - hostCenterX)).toBeLessThan(6);
    expect(bottomQuickConnectBox.y).toBeGreaterThan(bottomHandleBox.y + bottomHandleBox.height);
  });
});
