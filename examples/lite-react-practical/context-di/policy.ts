import { flow, tag, tags, typed } from "@pumped-fn/lite"

export type Role = "admin" | "editor" | "viewer"

export interface Principal {
  readonly id: string
  readonly roles: readonly Role[]
}

export type Action = "read" | "write" | "delete"

export type Decision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string }

/**
 * A behaviour injected through context: given who is acting and what they want
 * to do, return a decision. The whole function — and its type — travels parent
 * to child as one tag value.
 */
export type AuthorizePolicy = (
  principal: Principal,
  action: Action
) => Decision

/** Injected typed value: who is acting in this context. */
export const principal = tag<Principal>({ label: "auth.principal" })

/** Injected function: how this context decides what is allowed. */
export const authorize = tag<AuthorizePolicy>({ label: "auth.policy" })

export const rbac: AuthorizePolicy = (principal, action) => {
  if (action === "read") return { allowed: true }
  if (principal.roles.includes("admin")) return { allowed: true }
  if (action === "write" && principal.roles.includes("editor")) {
    return { allowed: true }
  }
  return { allowed: false, reason: `${action} requires an elevated role` }
}

export const readOnly: AuthorizePolicy = (_principal, action) =>
  action === "read"
    ? { allowed: true }
    : { allowed: false, reason: "this context is read-only" }

export const guard = flow({
  name: "ctxdi.guard",
  parse: typed<Action>(),
  deps: {
    principal: tags.required(principal),
    authorize: tags.required(authorize),
  },
  factory: (ctx, { principal, authorize }) => authorize(principal, ctx.input),
})

export const review = flow({
  name: "ctxdi.review",
  parse: typed<Action>(),
  factory: (ctx) => ctx.exec({ flow: guard, input: ctx.input }),
})

export const boundary = flow({
  name: "ctxdi.boundary",
  parse: typed<Action>(),
  factory: (ctx) => ctx.exec({ flow: review, input: ctx.input }),
})
