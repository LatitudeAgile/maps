import { describe, expect, test } from "vitest";
import { followPopupDocking, popupDockOptions } from "./popupDock.ts";

/** A media query whose match the test flips, notifying listeners as the browser does. */
function fakeQuery(matches: boolean) {
  const listeners = new Set<() => void>();
  return {
    matches,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
    flip(next: boolean) {
      this.matches = next;
      for (const l of listeners) l();
    },
  };
}

describe("popup docking (sidebar, design D14)", () => {
  test("never docked automatically; docked by the user, at the top on phones", () => {
    expect(popupDockOptions(false)).toEqual({ breakpoint: false, position: "top-center" });
    expect(popupDockOptions(true)).toEqual({ breakpoint: false, position: "auto" });
  });

  test("starts undocked, even when the SDK had already docked it", () => {
    const popup = { dockOptions: {} as Record<string, unknown>, dockEnabled: true };
    followPopupDocking({ popupElement: popup }, fakeQuery(false) as unknown as MediaQueryList);
    expect(popup.dockEnabled).toBe(false);
  });

  test("follows the layout across the breakpoint, keeping the other dock options and the user's docking", () => {
    const popup = { dockOptions: { buttonEnabled: true, position: "auto", breakpoint: { width: 544 } } as Record<string, unknown>, dockEnabled: true };
    const query = fakeQuery(false);
    const stop = followPopupDocking({ popupElement: popup }, query as unknown as MediaQueryList);
    expect(popup.dockOptions).toEqual({ buttonEnabled: true, position: "top-center", breakpoint: false });
    popup.dockEnabled = true; // the user docks it
    query.flip(true);
    expect(popup.dockEnabled).toBe(true);
    expect(popup.dockOptions).toEqual({ buttonEnabled: true, position: "auto", breakpoint: false });
    stop();
    query.flip(false);
    expect(popup.dockOptions.position).toBe("auto");
  });

  test("no popup element: nothing to do, no error", () => {
    expect(() => followPopupDocking({ popupElement: null }, fakeQuery(false) as unknown as MediaQueryList)).not.toThrow();
  });
});
