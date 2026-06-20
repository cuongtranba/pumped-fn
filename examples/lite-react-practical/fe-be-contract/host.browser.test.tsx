import { act, screen, within } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { mountCatalog, mountMain } from "./host"
import type { FormatPrice, Viewer } from "./contract"

async function lines(label: string): Promise<string[]> {
  const region = await screen.findByRole("region", { name: label })
  return within(region)
    .getAllByRole("listitem")
    .map((li) => li.textContent ?? "")
}

describe("the host owns the implementation and injects it through the contract tags", () => {
  test("mountMain wires a real Intl formatter; the FE component renders formatted prices", async () => {
    document.body.innerHTML = '<div id="root"></div>'
    let app: ReturnType<typeof mountMain>
    await act(async () => {
      app = mountMain()
    })

    expect(await screen.findByText("Cuong (USD)")).toBeInTheDocument()
    expect(await lines("catalog")).toEqual(["$9.90", "$19.90"])

    await act(async () => {
      await app!.unmount()
    })
    expect(document.getElementById("root")?.textContent).toBe("")
  })

  test("a missing root container is a host bootstrap error", () => {
    document.body.innerHTML = ""
    expect(() => mountMain()).toThrow("root container missing")
  })

  test("changing only the injected implementation changes output; the FE component is the same", async () => {
    const container = document.createElement("div")
    document.body.appendChild(container)
    const lena: Viewer = { name: "Lena", currency: "EUR" }
    const euro: FormatPrice = (amount) => `€${amount.toFixed(2)}`
    let app: ReturnType<typeof mountCatalog>
    await act(async () => {
      app = mountCatalog(container, lena, euro, [5])
    })

    expect(await screen.findByText("Lena (EUR)")).toBeInTheDocument()
    expect(await lines("catalog")).toEqual(["€5.00"])

    await act(async () => {
      await app!.unmount()
    })
  })
})
