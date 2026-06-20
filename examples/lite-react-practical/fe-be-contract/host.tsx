import { createScope, type Lite } from "@pumped-fn/lite"
import { ExecutionContextProvider, ScopeProvider } from "@pumped-fn/lite-react"
import { createRoot } from "react-dom/client"
import { formatPrice, viewer, type FormatPrice, type Viewer } from "./contract"
import { PriceList } from "./catalog"

export interface MountedCatalog {
  scope: Lite.Scope
  unmount(): Promise<void>
}

export function mountCatalog(
  container: Element,
  who: Viewer,
  format: FormatPrice,
  amounts: readonly number[]
): MountedCatalog {
  const scope = createScope()
  const root = createRoot(container)

  root.render(
    <ScopeProvider scope={scope}>
      <ExecutionContextProvider tags={[viewer(who), formatPrice(format)]}>
        <PriceList label="catalog" amounts={amounts} />
      </ExecutionContextProvider>
    </ScopeProvider>
  )

  return {
    scope,
    unmount: async () => {
      root.unmount()
      await scope.dispose()
    },
  }
}

export function mountMain(): MountedCatalog {
  const container = document.getElementById("root")
  if (container === null) throw new Error("root container missing")

  const usd: FormatPrice = (amount) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)

  return mountCatalog(container, { name: "Cuong", currency: "USD" }, usd, [
    9.9, 19.9,
  ])
}
