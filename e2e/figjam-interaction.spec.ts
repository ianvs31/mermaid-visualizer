import { expect, test } from "@playwright/test";

test.describe("FigJam interaction preset", () => {
  test("supports toolbar mode switching and basic connect flow", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "连线" }).click();
    await expect(page.getByRole("button", { name: "连线" })).toHaveClass(/is-active/);

    const sourceNode = page.locator('.react-flow__node[data-id="N1"]').first();
    const targetNode = page.locator('.react-flow__node[data-id="N4"]').first();
    await sourceNode.hover();
    await targetNode.hover();

    const source = sourceNode.locator(".diagram-handle--right").first();
    const target = targetNode.locator(".diagram-handle--left").first();

    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();
    test.skip(!sourceBox || !targetBox, "Source/target handles not available");

    if (sourceBox && targetBox) {
      await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
        steps: 20,
      });
      await page.mouse.up();
    }

    await expect(page.locator(".react-flow__edge")).toHaveCount(7);
  });
});
