import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures.ts";
import { mapReady, openPanels, serveSidebarConfig, sidebarAction } from "./helpers.ts";

// The sidebar's panel contract (add-print-and-sketch-panels D3, D4), checked from the outside
// with hello-world elements: the test listens to them and sends requests from them.

const hello = (page: Page, id: string) => page.locator(`viewer-hello-world[data-component-id="${id}"]`);

/** Record the open and close events the element is told about, in window.__told. */
async function recordEvents(page: Page, id: string): Promise<void> {
  await hello(page, id).evaluate((el) => {
    const w = window as unknown as { __told: string[] };
    w.__told = [];
    el.addEventListener("viewer-panel-open", () => w.__told.push("open"));
    el.addEventListener("viewer-panel-close", () => w.__told.push("close"));
  });
}

const requestOpen = (page: Page, id: string) =>
  hello(page, id).evaluate((el) => el.dispatchEvent(new Event("viewer-panel-request-open", { bubbles: true, composed: true })));

test.describe("panel components follow their panel (sidebar)", () => {
  test.beforeEach(async ({ page }) => {
    await serveSidebarConfig(page, [
      { id: "hello", type: "hello-world", placement: "panel" },
      { id: "legend", type: "legend", placement: "panel" },
      { id: "corner", type: "hello-world", placement: "top-right" },
    ]);
    await page.goto("./");
    await mapReady(page);
    await expect(sidebarAction(page, "hello")).toBeVisible();
  });

  test("Told on open and close: open, switch, open again, Escape", async ({ page }) => {
    await recordEvents(page, "hello");
    await sidebarAction(page, "hello").click();
    await sidebarAction(page, "legend").click();
    await sidebarAction(page, "hello").click();
    await page.keyboard.press("Escape");
    await expect.poll(() => page.evaluate(() => (window as unknown as { __told: string[] }).__told)).toEqual(["open", "close", "open", "close"]);
  });

  test("Asking to open: the Hello panel opens in place of Legend, its icon shown as open", async ({ page }) => {
    await sidebarAction(page, "legend").click();
    await requestOpen(page, "hello");
    await expect.poll(() => openPanels(page)).toEqual(["hello"]);
    await expect(sidebarAction(page, "hello")).toHaveAttribute("active", "");
  });

  test("Corner components aren't told: a request from a corner opens nothing", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await requestOpen(page, "corner");
    await page.waitForTimeout(300);
    expect(await openPanels(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

});

test.describe("Escape inside a panel (sidebar D4)", () => {
  test("Escape closes a popover open inside a panel first, then the panel", async ({ page }) => {
    // The sketch entry is there only so the build loads calcite-popover, which Sketch uses.
    await serveSidebarConfig(page, [
      { id: "hello", type: "hello-world", placement: "panel" },
      { id: "sketch", type: "sketch", placement: "panel" },
    ]);
    await page.goto("./");
    await mapReady(page);
    await page.waitForFunction(() => !!customElements.get("calcite-popover"));
    await sidebarAction(page, "hello").click();
    // A popover in the component's shadow root, as Sketch's Area fill has.
    await hello(page, "hello").evaluate(async (el) => {
      const button = document.createElement("button");
      button.textContent = "More";
      const popover = document.createElement("calcite-popover") as HTMLCalcitePopoverElement;
      popover.referenceElement = button;
      popover.label = "More";
      popover.autoClose = true;
      popover.innerHTML = "<p>Popover content</p>";
      el.shadowRoot!.append(button, popover);
      popover.open = true;
      button.focus();
    });
    const popoverOpen = () => hello(page, "hello").evaluate((el) => (el.shadowRoot!.querySelector("calcite-popover") as HTMLCalcitePopoverElement).open);
    await expect.poll(popoverOpen).toBe(true);

    await page.keyboard.press("Escape");
    await expect.poll(popoverOpen).toBe(false);
    expect(await openPanels(page)).toEqual(["hello"]);

    await page.keyboard.press("Escape");
    await expect.poll(() => openPanels(page)).toEqual([]);
    await expect(sidebarAction(page, "hello")).toBeFocused();
  });
});
