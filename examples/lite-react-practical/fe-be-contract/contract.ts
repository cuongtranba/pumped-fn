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

/** Injection token for the {@link Viewer} data. The FE↔host integration point. */
export const viewer = tag<Viewer>({ label: "catalog.viewer" })

/** Injection token for the {@link FormatPrice} function. The FE↔host integration point. */
export const formatPrice = tag<FormatPrice>({ label: "catalog.formatPrice" })
