import type { FormatPrice, SaveDraft, Viewer } from "./contract"

/**
 * The host's implementations of the FE contract. Each binding is annotated with
 * the contract type, so the compiler proves conformance here — no `any`, and a
 * drift from the signature is a build error in this file, not a runtime surprise
 * in the FE.
 */
export const usdViewer: Viewer = { name: "Cuong", currency: "USD" }

export const usdFormat: FormatPrice = (amount) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)

export const persistDraft: SaveDraft = async (text) => ({
  id: `draft-${text.length}`,
})
