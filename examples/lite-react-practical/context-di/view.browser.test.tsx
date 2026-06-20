import { createScope } from "@pumped-fn/lite"
import { ExecutionContextProvider, ScopeProvider } from "@pumped-fn/lite-react"
import { render, screen, within } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { authorize, principal, rbac, readOnly, type Principal } from "./policy"
import { PermissionList } from "./view"

const admin: Principal = { id: "u-admin", roles: ["admin"] }
const viewer: Principal = { id: "u-viewer", roles: ["viewer"] }

async function rows(label: string): Promise<string[]> {
  const list = await screen.findByRole("list", { name: label })
  return within(list)
    .getAllByRole("listitem")
    .map((li) => li.textContent ?? "")
}

describe("a parent injects principal + policy; a child component consumes them", () => {
  test("admin under rbac sees every action allowed", async () => {
    const scope = createScope()
    render(
      <ScopeProvider scope={scope}>
        <ExecutionContextProvider tags={[principal(admin), authorize(rbac)]}>
          <PermissionList label="permissions" />
        </ExecutionContextProvider>
      </ScopeProvider>
    )

    expect(await rows("permissions")).toEqual([
      "read: allowed",
      "write: allowed",
      "delete: allowed",
    ])
    await scope.dispose()
  })

  test("the injected typed value (viewer) narrows what the injected function allows", async () => {
    const scope = createScope()
    render(
      <ScopeProvider scope={scope}>
        <ExecutionContextProvider tags={[principal(viewer), authorize(rbac)]}>
          <PermissionList label="permissions" />
        </ExecutionContextProvider>
      </ScopeProvider>
    )

    expect(await rows("permissions")).toEqual([
      "read: allowed",
      "write: denied — write requires an elevated role",
      "delete: denied — delete requires an elevated role",
    ])
    await scope.dispose()
  })
})

describe("a nested provider narrows the injected function for its subtree", () => {
  test("the inner read-only policy shadows the outer rbac policy; principal is inherited", async () => {
    const scope = createScope()
    render(
      <ScopeProvider scope={scope}>
        <ExecutionContextProvider tags={[principal(admin), authorize(rbac)]}>
          <PermissionList label="outer" />
          <ExecutionContextProvider tags={[authorize(readOnly)]}>
            <PermissionList label="inner" />
          </ExecutionContextProvider>
        </ExecutionContextProvider>
      </ScopeProvider>
    )

    expect(await rows("outer")).toEqual([
      "read: allowed",
      "write: allowed",
      "delete: allowed",
    ])
    expect(await rows("inner")).toEqual([
      "read: allowed",
      "write: denied — this context is read-only",
      "delete: denied — this context is read-only",
    ])
    await scope.dispose()
  })
})
