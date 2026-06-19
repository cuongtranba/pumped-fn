import { createScope } from "@pumped-fn/lite"
import { describe, expect, test } from "vitest"
import {
  authorize,
  boundary,
  guard,
  principal,
  rbac,
  readOnly,
  type Principal,
} from "./policy"

const admin: Principal = { id: "u-admin", roles: ["admin"] }
const editor: Principal = { id: "u-editor", roles: ["editor"] }
const viewer: Principal = { id: "u-viewer", roles: ["viewer"] }

describe("inject a function + typed value through context", () => {
  test("a deep child reads both injected tags; no middle flow carries them", async () => {
    const scope = createScope()
    const ctx = scope.createContext({
      tags: [principal(admin), authorize(rbac)],
    })

    await expect(ctx.exec({ flow: boundary, input: "delete" })).resolves.toEqual({
      allowed: true,
    })
  })

  test("the injected typed value steers the injected function's decision", async () => {
    const scope = createScope()
    const ctx = scope.createContext({
      tags: [principal(viewer), authorize(rbac)],
    })

    await expect(ctx.exec({ flow: guard, input: "write" })).resolves.toEqual({
      allowed: false,
      reason: "write requires an elevated role",
    })
  })

  test("read is open to everyone under the injected rbac policy", async () => {
    const scope = createScope()
    const ctx = scope.createContext({
      tags: [principal(viewer), authorize(rbac)],
    })

    await expect(ctx.exec({ flow: guard, input: "read" })).resolves.toEqual({
      allowed: true,
    })
  })

  test("editor is granted write, denied delete (typed roles drive branches)", async () => {
    const scope = createScope()
    const ctx = scope.createContext({
      tags: [principal(editor), authorize(rbac)],
    })

    await expect(ctx.exec({ flow: guard, input: "write" })).resolves.toEqual({
      allowed: true,
    })
    await expect(ctx.exec({ flow: guard, input: "delete" })).resolves.toEqual({
      allowed: false,
      reason: "delete requires an elevated role",
    })
  })
})

describe("narrow the injected function from parent to child", () => {
  test("an exec-level policy shadows the parent context policy for that sub-execution", async () => {
    const scope = createScope()
    const ctx = scope.createContext({
      tags: [principal(admin), authorize(rbac)],
    })

    await expect(ctx.exec({ flow: guard, input: "delete" })).resolves.toEqual({
      allowed: true,
    })
    await expect(
      ctx.exec({ flow: guard, input: "delete", tags: [authorize(readOnly)] })
    ).resolves.toEqual({ allowed: false, reason: "this context is read-only" })
  })
})

describe("substitute the policy through the seam (DI), no mocks", () => {
  test("swapping the injected function changes behavior with the same code", async () => {
    const scope = createScope()

    const strict = scope.createContext({
      tags: [principal(admin), authorize(readOnly)],
    })
    await expect(strict.exec({ flow: guard, input: "write" })).resolves.toEqual({
      allowed: false,
      reason: "this context is read-only",
    })
    await expect(strict.exec({ flow: guard, input: "read" })).resolves.toEqual({
      allowed: true,
    })
  })

  test("a required policy that was never injected fails loudly", async () => {
    const scope = createScope()
    const ctx = scope.createContext({ tags: [principal(admin)] })

    await expect(ctx.exec({ flow: guard, input: "read" })).rejects.toThrow(
      "auth.policy"
    )
  })
})
