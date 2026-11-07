/** One runtime problem, reported on the app model's error channel. */
export interface ErrorReport {
  /** Where it came from, such as a layer id (`layer:parcels`) or `map`. */
  source: string;
  message: string;
  /** Extra detail, such as an SDK error message. */
  detail?: string;
}

export type ErrorSubscriber = (report: ErrorReport) => void;

const REDACTED = "[redacted]";

/**
 * Error channel. Every report is redacted before any subscriber sees it, because SDK error
 * messages can contain request URLs that carry the API key (design D7).
 */
export class ErrorChannel {
  readonly #subscribers = new Set<ErrorSubscriber>();
  readonly #secrets: string[];

  /** @param secrets values to remove from every report, such as the API key */
  constructor(secrets: (string | undefined)[] = []) {
    this.#secrets = secrets.filter((s): s is string => !!s && s.length > 0);
  }

  report(report: ErrorReport): void {
    const clean: ErrorReport = {
      source: this.#redact(report.source),
      message: this.#redact(report.message),
      ...(report.detail !== undefined ? { detail: this.#redact(report.detail) } : {}),
    };
    for (const subscriber of [...this.#subscribers]) {
      try {
        subscriber(clean);
      } catch {
        // A failing subscriber must not stop the others or the reporter.
      }
    }
  }

  /** Subscribe to reports. Returns a function that unsubscribes. */
  subscribe(subscriber: ErrorSubscriber): () => void {
    this.#subscribers.add(subscriber);
    return () => {
      this.#subscribers.delete(subscriber);
    };
  }

  #redact(text: string): string {
    let out = text;
    for (const secret of this.#secrets) {
      out = out.split(secret).join(REDACTED).split(encodeURIComponent(secret)).join(REDACTED);
    }
    return out;
  }
}

/** Best-effort message from anything thrown. */
export function errorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) return String((err as { message: unknown }).message);
  return String(err);
}
