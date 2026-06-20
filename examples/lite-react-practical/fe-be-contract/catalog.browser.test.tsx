import { createScope } from "@pumped-fn/lite"
import { ExecutionContextProvider, ScopeProvider } from "@pumped-fn/lite-react"
import { render, screen, within } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { formatPrice, viewer, type FormatPrice, type Viewer } from "./contract"
import { PriceList } from "./catalog"

const buyer: Viewer = { name: "Mai", currency: "USD" }
const hashPrice: FormatPrice = (amount) => `#${amount}`

async function lines(label: string): Promise<string[]> {
  const region = await screen.findByRole("region", { name: label })
  return within(region)
    .getAllByRole("listitem")
    .map((li) => li.textContent ?? "")
}

describe("the FE component consumes whatever the host injects under the contract tags", () => {
  test("it reads the injected viewer (data) and calls the injected formatter (function)", async () => {
    const scope = createScope()
    render(
      <ScopeProvider scope={scope}>
        <ExecutionContextProvider tags={[viewer(buyer), formatPrice(hashPrice)]}>
          <PriceList label="catalog" amounts={[9.9, 19.9]} />
        </ExecutionContextProvider>
      </ScopeProvider>
    )

    expect(await screen.findByText("Mai (USD)")).toBeInTheDocument()
    expect(await lines("catalog")).toEqual(["#9.9", "#19.9"])
    await scope.dispose()
  })

  test("swapping only the injected formatter changes output; the component is untouched", async () => {
    const scope = createScope()
    const stars: FormatPrice = (amount) => `${amount}★`
    render(
      <ScopeProvider scope={scope}>
        <ExecutionContextProvider tags={[viewer(buyer), formatPrice(stars)]}>
          <PriceList label="catalog" amounts={[5]} />
        </ExecutionContextProvider>
      </ScopeProvider>
    )

    expect(await lines("catalog")).toEqual(["5★"])
    await scope.dispose()
  })
})
