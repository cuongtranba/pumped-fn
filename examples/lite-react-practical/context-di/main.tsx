import { createScope, type Lite } from "@pumped-fn/lite"
import { ExecutionContextProvider, ScopeProvider } from "@pumped-fn/lite-react"
import { createRoot } from "react-dom/client"
import {
  authorize,
  principal,
  rbac,
  type AuthorizePolicy,
  type Principal,
} from "./policy"
import { PermissionList } from "./view"

export interface MountedPermissionsApp {
  scope: Lite.Scope
  unmount(): Promise<void>
}

export function mountPermissionsApp(
  container: Element,
  actor: Principal,
  policy: AuthorizePolicy
): MountedPermissionsApp {
  const scope = createScope()
  const root = createRoot(container)

  root.render(
    <ScopeProvider scope={scope}>
      <ExecutionContextProvider tags={[principal(actor), authorize(policy)]}>
        <PermissionList label="permissions" />
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

export function mountMain(): MountedPermissionsApp {
  const container = document.getElementById("root")
  if (container === null) throw new Error("root container missing")
  return mountPermissionsApp(container, { id: "u-admin", roles: ["admin"] }, rbac)
}
