import { createScope } from "@pumped-fn/lite"
import { ExecutionContextProvider, ScopeProvider } from "@pumped-fn/lite-react"
import { render, screen, within } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { formatPrice, viewer, type FormatPrice, type Viewer } from "./contract"
import { PriceList } from "./catalog"

const buyer: Viewer = { name: "Mai", currency: "USD" }
const hashPrice: FormatPrice = (amount) => `#${amount}`
const stars: FormatPrice = (amount) => `${amount}★`

function rows(region: HTMLElement): string[] {
  return within(region)
    .getAllByRole("listitem")
    .map((li) => li.textContent ?? "")
}

describe("the FE builds its own ctx and injects it through ExecutionContextProvider ctx={ctx}", () => {
  test("a ctx from scope.createContext({tags}) injects exactly like the tags prop", async () => {
    const scope = createScope()
    const ctx = scope.createContext({
      tags: [viewer(buyer), formatPrice(hashPrice)],
    })
    render(
      <ScopeProvider scope={scope}>
        <ExecutionContextProvider ctx={ctx}>
          <PriceList label="catalog" amounts={[9.9]} />
        </ExecutionContextProvider>
      </ScopeProvider>
    )

    const region = await screen.findByRole("region", { name: "catalog" })
    expect(within(region).getByText("Mai (USD)")).toBeInTheDocument()
    expect(rows(region)).toEqual(["#9.9"])
    await scope.dispose()
  })

  test("a child ctx created with parent inherits the outer tags and can override one", async () => {
    const scope = createScope()
    const outer = scope.createContext({
      tags: [viewer(buyer), formatPrice(hashPrice)],
    })
    const inner = scope.createContext({
      parent: outer,
      tags: [formatPrice(stars)],
    })
    render(
      <ScopeProvider scope={scope}>
        <ExecutionContextProvider ctx={outer}>
          <PriceList label="outer" amounts={[5]} />
        </ExecutionContextProvider>
        <ExecutionContextProvider ctx={inner}>
          <PriceList label="inner" amounts={[5]} />
        </ExecutionContextProvider>
      </ScopeProvider>
    )

    const outerRegion = await screen.findByRole("region", { name: "outer" })
    expect(within(outerRegion).getByText("Mai (USD)")).toBeInTheDocument()
    expect(rows(outerRegion)).toEqual(["#5"])

    const innerRegion = await screen.findByRole("region", { name: "inner" })
    expect(within(innerRegion).getByText("Mai (USD)")).toBeInTheDocument()
    expect(rows(innerRegion)).toEqual(["5★"])

    await scope.dispose()
  })
})
