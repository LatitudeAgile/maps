export type SidebarListener = (openId: string | undefined, previousId: string | undefined) => void;

/**
 * Which sidebar panel is open, if any (design D3). Mirrors dojo-sidebar's tabClickHandler,
 * openTab and closeTab: toggling the open panel collapses the sidebar; toggling another
 * switches to it. Pure state, so it is tested without a DOM.
 */
export class SidebarState {
  #openId: string | undefined;
  readonly #listeners = new Set<SidebarListener>();

  /** The open panel's component id, or undefined when collapsed. The sidebar starts collapsed. */
  get openId(): string | undefined {
    return this.#openId;
  }

  /** Open this panel, or collapse the sidebar if it is already the open one. */
  toggle(id: string): void {
    this.#set(this.#openId === id ? undefined : id);
  }

  /** Open this panel; a no-op if it is already open (a component's open request, D3). */
  open(id: string): void {
    this.#set(id);
  }

  /** Collapse the sidebar. */
  close(): void {
    this.#set(undefined);
  }

  /** Listen for changes. Returns a function that stops listening. */
  onChange(listener: SidebarListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #set(next: string | undefined): void {
    const previous = this.#openId;
    if (next === previous) return;
    this.#openId = next;
    for (const listener of [...this.#listeners]) listener(next, previous);
  }
}
