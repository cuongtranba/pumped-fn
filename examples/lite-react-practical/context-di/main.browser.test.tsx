import { act, screen, within } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { readOnly, type Principal } from "./policy"
import { mountMain, mountPermissionsApp } from "./main"

const viewer: Principal = { id: "u-viewer", roles: ["viewer"] }

async function rows(label: string): Promise<string[]> {
  const list = await screen.findByRole("list", { name: label })
  return within(list)
    .getAllByRole("listitem")
    .map((li) => li.textContent ?? "")
}

describe("the FE declares the injection once, at the composition root", () => {
  test("OI1: mountMain creates the scope, wires both providers, renders the observer", async () => {
    document.body.innerHTML = '<div id="root"></div>'
    let app: ReturnType<typeof mountMain>
    await act(async () => {
      app = mountMain()
    })

    expect(await rows("permissions")).toEqual([
      "read: allowed",
      "write: allowed",
      "delete: allowed",
    ])

    await act(async () => {
      await app!.unmount()
    })
    expect(document.getElementById("root")?.textContent).toBe("")
  })

  test("OI2: a missing root container is an adapter error at bootstrap", () => {
    document.body.innerHTML = ""
    expect(() => mountMain()).toThrow("root container missing")
  })

  test("OI3: changing only the injected declaration changes behaviour, same components", async () => {
    const container = document.createElement("div")
    document.body.appendChild(container)
    let app: ReturnType<typeof mountPermissionsApp>
    await act(async () => {
      app = mountPermissionsApp(container, viewer, readOnly)
    })

    expect(await rows("permissions")).toEqual([
      "read: allowed",
      "write: denied — this context is read-only",
      "delete: denied — this context is read-only",
    ])

    await act(async () => {
      await app!.unmount()
    })
  })
})
