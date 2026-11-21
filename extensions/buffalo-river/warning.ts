// The one-time safety warning. It goes on document.body, not in the panel: the panel's element is
// created while the sidebar is still collapsed, and the coloured river the warning is about shows
// on the map before anyone opens the panel (design D8). It can only be closed by Acknowledge.
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-dialog";

const PARAGRAPHS = [
  "Water levels shown are estimates derived from USGS gauge data and interpolation models. Conditions may differ substantially from actual river conditions. This map is provided for information only and should not be relied on as the sole basis for safety or trip-planning decisions.",
  "River conditions can change rapidly because of rainfall, dam operations, debris or sensor errors. Estimated water levels may be wrong. Always use your own judgment and check conditions before going on the river.",
];

/** Shows the warning, and calls `onAcknowledge` once it's acknowledged. Returns a remover. */
export function showSafetyWarning(onAcknowledge: () => void): () => void {
  const dialog = document.createElement("calcite-dialog");
  dialog.classList.add("viewer-buffalo-river-warning");
  dialog.heading = "Before you use this map";
  dialog.kind = "warning";
  dialog.modal = true;
  dialog.closeDisabled = true;
  dialog.escapeDisabled = true;
  dialog.outsideCloseDisabled = true;
  dialog.style.setProperty("--calcite-dialog-max-size-x", "32rem");
  for (const text of PARAGRAPHS) {
    const p = document.createElement("p");
    p.style.margin = "0 0 var(--calcite-spacing-md)";
    p.textContent = text;
    dialog.append(p);
  }
  const acknowledge = document.createElement("calcite-button");
  acknowledge.slot = "footer-end";
  acknowledge.textContent = "Acknowledge";
  dialog.append(acknowledge);

  const remove = () => {
    dialog.open = false;
    dialog.remove();
  };
  acknowledge.addEventListener("click", () => {
    remove();
    onAcknowledge();
  });
  document.body.append(dialog);
  dialog.open = true;
  return remove;
}
