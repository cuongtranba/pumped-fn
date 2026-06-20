import { tag } from "@pumped-fn/lite"

/**
 * Data the FE component needs but does not own: who is viewing and in which
 * currency. The host supplies the value; the FE only declares the shape.
 */
export interface Viewer {
  readonly name: string
  readonly currency: string
}

/**
 * Behaviour the FE component needs but does not implement: turn an amount into a
 * display string. The host supplies any function matching this signature — Intl,
 * a backend call, a stub — and the FE calls it without knowing which.
 */
export type FormatPrice = (amount: number) => string

/** Typed result the host returns to the FE after persisting a draft. */
export interface SaveResult {
  readonly id: string
}

/**
 * An action the FE invokes on demand but does not implement: persist a draft and
 * resolve with its server-assigned id. The host supplies any async function
 * matching this signature — a `fetch` call, a queue, a stub — and the FE awaits it
 * on an event, knowing only the contract.
 */
export type SaveDraft = (text: string) => Promise<SaveResult>

/** Injection token for the {@link Viewer} data. The FE↔host integration point. */
export const viewer = tag<Viewer>({ label: "catalog.viewer" })

/** Injection token for the {@link FormatPrice} function. The FE↔host integration point. */
export const formatPrice = tag<FormatPrice>({ label: "catalog.formatPrice" })

/** Injection token for the {@link SaveDraft} action. The FE↔host integration point. */
export const saveDraft = tag<SaveDraft>({ label: "catalog.saveDraft" })
