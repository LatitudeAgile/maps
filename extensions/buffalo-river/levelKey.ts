// The River levels block's key to the level colours: a bar that blends the five band colours as
// the river does, their names, what each band means, and a marker at the trip's level. The
// element owns the state; this only shows it.
import "@esri/calcite-components/components/calcite-accordion";
import "@esri/calcite-components/components/calcite-accordion-item";
import { LEVEL_BANDS } from "./levels.ts";
import { levelElements } from "./tripBlock.ts";

/** What the key shows. */
export interface LevelKeyView {
  /** Whether the river is coloured by level. */
  visible: boolean;
  /** The trip's level score at the newest reading, or null with no trip or no level. */
  tripScore: number | null;
}

/** The top score; a score's place on the bar is its share of this. */
const MAX_SCORE = 1000;

const percent = (score: number): string => `${(Math.max(0, Math.min(MAX_SCORE, score)) / MAX_SCORE) * 100}%`;

export const STYLE = `
  .level-key { margin: 0 0 var(--calcite-spacing-sm); }
  .level-key-scale { position: relative; padding-block: 4px; }
  .level-key-bar { height: 10px; border-radius: 3px; border: 1px solid var(--calcite-color-border-1); }
  .level-key-marker {
    position: absolute; inset-block: 0; width: 4px; border-radius: 2px;
    background: var(--calcite-color-text-1); box-shadow: 0 0 0 1.5px var(--calcite-color-foreground-1);
  }
  .level-key-names {
    display: grid; margin-block-start: var(--calcite-spacing-xxs);
    color: var(--calcite-color-text-2); font-size: var(--calcite-font-size--1); line-height: 1.3;
  }
  /* All in one cell, so the row is as tall as the tallest name. The middle names are centred on
     their stops; the end ones keep to their end, and wrap before reaching the next name. */
  .level-key-names span { grid-area: 1 / 1; justify-self: start; white-space: nowrap; transform: translateX(-50%); }
  .level-key-names span:first-child, .level-key-names span:last-child { white-space: normal; max-width: calc(25% - 1.5em); transform: none; }
  .level-key-names span:last-child { justify-self: end; text-align: end; }
  .level-key calcite-accordion { margin-block-start: var(--calcite-spacing-xs); }
  .level-key calcite-accordion-item .guidance:last-child { margin-block-end: 0; }
`;

export class LevelKey {
  readonly element: HTMLElement;
  #marker: HTMLElement;
  #view: LevelKeyView = { visible: false, tripScore: null };

  constructor() {
    this.element = document.createElement("div");
    this.element.className = "level-key";

    const scale = document.createElement("div");
    scale.className = "level-key-scale";
    const bar = document.createElement("div");
    bar.className = "level-key-bar";
    // Stops where the renderer's are, so the bar blends between bands as the river does.
    bar.style.background = `linear-gradient(to right, ${LEVEL_BANDS.map((band) => `${band.color} ${percent(band.score)}`).join(", ")})`;
    // The Trip block says the trip's band in words.
    this.#marker = document.createElement("div");
    this.#marker.className = "level-key-marker";
    this.#marker.setAttribute("aria-hidden", "true");
    this.#marker.title = "This trip's level";
    scale.append(bar, this.#marker);

    const names = document.createElement("div");
    names.className = "level-key-names";
    for (const band of LEVEL_BANDS) {
      const name = document.createElement("span");
      name.textContent = band.label;
      if (band !== LEVEL_BANDS[0] && band !== LEVEL_BANDS.at(-1)) name.style.marginLeft = percent(band.score);
      names.append(name);
    }

    // The same rows as the Trip block's level, so the guidance is the same text.
    const accordion = document.createElement("calcite-accordion");
    accordion.appearance = "transparent";
    accordion.scale = "s";
    const item = document.createElement("calcite-accordion-item");
    item.heading = "What the colours mean";
    item.append(...LEVEL_BANDS.flatMap((band) => levelElements(band.score)));
    accordion.append(item);

    this.element.append(scale, names, accordion);
    this.#apply();
  }

  /** Updates what's given and keeps the rest, since the element renders levels and trips apart. */
  render(view: Partial<LevelKeyView>): void {
    this.#view = { ...this.#view, ...view };
    this.#apply();
  }

  #apply(): void {
    const { visible, tripScore } = this.#view;
    this.element.hidden = !visible;
    this.#marker.hidden = tripScore === null;
    if (tripScore !== null) {
      // Shifted back by the same share of its own width, so it stays on the bar at either end.
      this.#marker.style.left = percent(tripScore);
      this.#marker.style.transform = `translateX(-${percent(tripScore)})`;
    }
  }
}
