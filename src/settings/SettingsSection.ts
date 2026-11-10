import "@esri/calcite-components/components/calcite-link";
import "@esri/calcite-components/components/calcite-segmented-control";
import "@esri/calcite-components/components/calcite-segmented-control-item";

import type { ColorMode } from "../config/types.ts";
import { applyMode } from "../ui/theme.ts";
import { forgetChoice, readChoice, storeChoice } from "./modeChoice.ts";

export interface SettingsSectionOptions {
  /** The app's `app.mode`: what the viewer shows with no stored choice. */
  appMode: ColorMode;
  /** Show a "Settings" heading: only in the combined Apps and settings panel (add-settings D5). */
  heading: boolean;
}

const CHOICES: { mode: ColorMode; label: string }[] = [
  { mode: "auto", label: "System" },
  { mode: "light", label: "Light" },
  { mode: "dark", label: "Dark" },
];

/**
 * The Settings section (add-settings D5, D6): an Appearance control (System, Light, Dark) and a
 * "Use each app's default" link, shown while a choice is stored. A pick applies at once and is
 * stored for the whole viewer site; when storage fails, it still applies to this page.
 */
export function createSettingsSection({ appMode, heading }: SettingsSectionOptions): HTMLElement {
  const section = document.createElement("section");
  section.classList.add("settings-section");
  section.setAttribute("aria-label", "Settings");

  if (heading) {
    const title = document.createElement("h3");
    title.classList.add("settings-heading");
    title.textContent = "Settings";
    section.append(title);
  }

  // Tracked in memory, so the link still works for this page when storage doesn't (D6).
  let stored = readChoice() !== undefined;

  const control = document.createElement("calcite-segmented-control");
  control.labelText = "Appearance";
  // Calcite 5.2.1 shows labelText but doesn't name the radio group with it.
  control.setAttribute("aria-label", "Appearance");
  control.width = "full";
  // Each item's value is its label: Calcite 5.2.1 names each radio by its value.
  const items = CHOICES.map(({ label }) => {
    const item = document.createElement("calcite-segmented-control-item");
    item.value = label;
    item.textContent = label;
    return item;
  });
  control.append(...items);
  const select = (mode: ColorMode) => {
    for (const [i, item] of items.entries()) item.checked = CHOICES[i].mode === mode;
  };
  select(readChoice() ?? appMode);

  const reset = document.createElement("calcite-link");
  reset.classList.add("settings-reset");
  reset.textContent = "Use each app's default";
  const showReset = () => (reset.hidden = !stored);

  control.addEventListener("calciteSegmentedControlChange", () => {
    const mode = CHOICES.find((c) => c.label === control.value)?.mode;
    if (!mode) return;
    storeChoice(mode);
    applyMode(mode);
    stored = true;
    showReset();
  });
  reset.addEventListener("click", () => {
    forgetChoice();
    applyMode(appMode);
    select(appMode);
    stored = false;
    showReset();
    // The link is gone: don't leave focus on nothing. Next frame, once the control has moved
    // its selection, so focus lands on the selected choice.
    requestAnimationFrame(() => void control.setFocus());
  });
  showReset();

  section.append(control, reset);
  return section;
}
