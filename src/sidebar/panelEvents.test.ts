import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { notifyPanels, PANEL_CLOSE, PANEL_OPEN, PANEL_REQUEST_OPEN, requestPanelOpen } from "./panelEvents.ts";
import { SidebarState } from "./SidebarState.ts";

/** Two components that record what they are told, wired to a SidebarState as the sidebar does. */
function setup() {
  const told: string[] = [];
  const components = new Map<string, EventTarget>();
  for (const id of ["hello", "legend"]) {
    const target = new EventTarget();
    target.addEventListener(PANEL_OPEN, () => told.push(`${id}:open`));
    target.addEventListener(PANEL_CLOSE, () => told.push(`${id}:close`));
    components.set(id, target);
  }
  const state = new SidebarState();
  state.onChange((openId, previousId) => notifyPanels(components, openId, previousId));
  return { state, told };
}

describe("panel events (add-print-and-sketch-panels D3)", () => {
  test("Told on open and close: open, switch, open again, Escape", () => {
    const { state, told } = setup();
    state.toggle("hello");
    state.toggle("legend");
    state.toggle("hello");
    state.close();
    expect(told).toEqual(["hello:open", "hello:close", "legend:open", "legend:close", "hello:open", "hello:close"]);
  });

  test("on a switch, the old panel is told it closed before the new one opens", () => {
    const { state, told } = setup();
    state.toggle("legend");
    told.length = 0;
    state.toggle("hello");
    expect(told).toEqual(["legend:close", "hello:open"]);
  });

  test("an open request for the open panel changes nothing and tells no one", () => {
    const { state, told } = setup();
    state.open("hello");
    state.open("hello");
    expect(state.openId).toBe("hello");
    expect(told).toEqual(["hello:open"]);
  });

  test.each([PANEL_OPEN, PANEL_CLOSE, PANEL_REQUEST_OPEN])("docs/custom-components.md documents %s", (name) => {
    const doc = readFileSync(new URL("../../docs/custom-components.md", import.meta.url), "utf8");
    expect(doc).toContain(`\`${name}\``);
  });

  test("requestPanelOpen dispatches a bubbling, composed request", () => {
    const target = new EventTarget();
    let seen: Event | undefined;
    target.addEventListener(PANEL_REQUEST_OPEN, (e) => (seen = e));
    requestPanelOpen(target as unknown as Element);
    expect(seen?.bubbles).toBe(true);
    expect(seen?.composed).toBe(true);
  });
});
