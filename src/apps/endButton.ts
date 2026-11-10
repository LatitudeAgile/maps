import type { Catalog } from "./catalog.ts";

/** What the button at the end of the icon bar holds (add-settings D4). */
export interface EndButton {
  /** The apps list: another app is in the catalog, and the app doesn't hide the list. */
  apps: boolean;
  /** The Settings section. */
  settings: boolean;
}

/**
 * The button at the end of the icon bar (add-app-selector D3, add-settings D4): the apps list,
 * the Settings section, or both. Undefined when it holds neither, so there is no button.
 */
export function endButton(
  catalog: Catalog | undefined,
  currentName: string,
  { selectorVisible, settingsVisible }: { selectorVisible: boolean; settingsVisible: boolean },
): EndButton | undefined {
  const apps = selectorVisible && catalog !== undefined && catalog.names.some((name) => name !== currentName);
  const settings = settingsVisible;
  return apps || settings ? { apps, settings } : undefined;
}

/** The button's icon and label (add-settings D4). */
export function endButtonLook({ apps, settings }: EndButton): { icon: string; heading: string } {
  if (!apps) return { icon: "gear", heading: "Settings" };
  return { icon: "apps", heading: settings ? "Apps and settings" : "Apps" };
}
