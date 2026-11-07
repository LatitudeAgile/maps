import { describe, expect, test } from "vitest";
import { SidebarState } from "./SidebarState.ts";

function setup() {
  const state = new SidebarState();
  const changes: [string | undefined, string | undefined][] = [];
  state.onChange((open, previous) => changes.push([open, previous]));
  return { state, changes };
}

describe("SidebarState", () => {
  test("starts collapsed", () => {
    expect(new SidebarState().openId).toBeUndefined();
  });

  test("toggle opens a panel", () => {
    const { state, changes } = setup();
    state.toggle("legend");
    expect(state.openId).toBe("legend");
    expect(changes).toEqual([["legend", undefined]]);
  });

  test("toggle on another panel switches to it", () => {
    const { state, changes } = setup();
    state.toggle("legend");
    state.toggle("home");
    expect(state.openId).toBe("home");
    expect(changes.at(-1)).toEqual(["home", "legend"]);
  });

  test("toggle on the open panel collapses the sidebar", () => {
    const { state, changes } = setup();
    state.toggle("legend");
    state.toggle("legend");
    expect(state.openId).toBeUndefined();
    expect(changes.at(-1)).toEqual([undefined, "legend"]);
  });

  test("close collapses; closing when already collapsed does nothing", () => {
    const { state, changes } = setup();
    state.toggle("legend");
    state.close();
    state.close();
    expect(state.openId).toBeUndefined();
    expect(changes).toEqual([
      ["legend", undefined],
      [undefined, "legend"],
    ]);
  });

  test("unsubscribed listeners are not called", () => {
    const state = new SidebarState();
    const calls: unknown[] = [];
    const stop = state.onChange((open) => calls.push(open));
    stop();
    state.toggle("legend");
    expect(calls).toEqual([]);
  });
});
