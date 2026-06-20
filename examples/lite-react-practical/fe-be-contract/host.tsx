import { createScope, type Lite } from "@pumped-fn/lite"
import { ExecutionContextProvider, ScopeProvider } from "@pumped-fn/lite-react"
import { createRoot } from "react-dom/client"
import {
  formatPrice,
  saveDraft,
  viewer,
  type FormatPrice,
  type SaveDraft,
  type Viewer,
} from "./contract"
import { persistDraft, usdFormat, usdViewer } from "./backend"
import { PriceList } from "./catalog"
import { DraftEditor } from "./editor"

export interface MountedCatalog {
  scope: Lite.Scope
  unmount(): Promise<void>
}

export function mountCatalog(
  container: Element,
  who: Viewer,
  format: FormatPrice,
  save: SaveDraft,
  amounts: readonly number[]
): MountedCatalog {
  const scope = createScope()
  const root = createRoot(container)

  root.render(
    <ScopeProvider scope={scope}>
      <ExecutionContextProvider
        tags={[viewer(who), formatPrice(format), saveDraft(save)]}
      >
        <PriceList label="catalog" amounts={amounts} />
        <DraftEditor label="editor" />
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

  return mountCatalog(container, usdViewer, usdFormat, persistDraft, [9.9, 19.9])
}
