import { describe, expect, test } from "vitest"
import { persistDraft, usdFormat, usdViewer } from "./backend"

describe("the host's backend implements the FE contract by type", () => {
  test("usdViewer satisfies Viewer in USD", () => {
    expect(usdViewer).toEqual({ name: "Cuong", currency: "USD" })
  })

  test("usdFormat satisfies FormatPrice — an amount becomes a USD string", () => {
    expect(usdFormat(19.9)).toBe("$19.90")
  })

  test("persistDraft satisfies SaveDraft — returns the typed result for the draft", async () => {
    await expect(persistDraft("hello")).resolves.toEqual({ id: "draft-5" })
  })
})
