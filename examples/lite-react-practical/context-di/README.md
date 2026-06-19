# Context as dependency injection — narrowing typed data (and functions) parent → child

A `tag` is the typed ambient channel in `@pumped-fn/lite`. A parent attaches a value to an
execution context; any descendant reads it by **declaring a dependency** — no intermediate
signature carries it. This is dependency injection through context, and the injected payload can be
a plain typed value *or a function*, with its full type preserved end to end.

This standalone demo injects two things and proves four properties.

## What is injected (`policy.ts`)

```ts
export const principal = tag<Principal>({ label: "auth.principal" })   // typed value
export const authorize = tag<AuthorizePolicy>({ label: "auth.policy" }) // function, fully typed
```

- `Principal = { id: string; roles: readonly Role[] }` — injected **data**.
- `AuthorizePolicy = (principal: Principal, action: Action) => Decision` — injected **behaviour**.
  The whole function, and its type, travels as one tag value. No `any` anywhere.

`rbac` and `readOnly` are two concrete policies; swapping which one is injected swaps behaviour
without touching a line of consumer code.

## What it proves

1. **Inject + deep read, zero drilling** — a parent context attaches `principal` + `authorize`; the
   `boundary → review → guard` flow chain carries the request down, and only the leaf `guard` declares
   `tags.required(principal)` / `tags.required(authorize)` and calls the policy. The middle flows never
   mention either.
2. **Narrow / shadow** — a child re-attaches `authorize` with a stricter policy (an exec-level tag, or a
   nested `ExecutionContextProvider`). That subtree sees the narrowed policy; everything else still sees
   the parent's. `principal` is inherited through the parent chain (`ctx.data.seekTag`).
3. **Substitute through the seam (DI)** — tests inject a different policy purely through context tags.
   Same code, different decision. No mocks.
4. **React consumer** (`view.tsx`) — `<ExecutionContextProvider tags={[principal(...), authorize(...)]}>`
   injects; a `tags.required` resource binds `principal` + `authorize` into a single `can(action)` check
   and exposes it through the context. `PermissionList` reads `can` via `useResource` and renders
   allow/deny per action — it never touches `principal` or the raw policy, so the component holds no
   authorization logic. A nested provider narrows the policy for its subtree.

The check is **extracted into the graph, not assembled in the component**: the resource is the seam that
binds who-is-acting to how-this-context-decides. For an *action* (not render), execute the `guard` flow
through `ctx.exec` instead — same binding, async result.

The resource is `ownership: "current"` so each provider context resolves its own instance — that is what
lets a nested provider narrow the injected function rather than reuse the parent's.

## Files

| File | Role |
|---|---|
| `policy.ts` | The `Principal`/`Action`/`Decision` types, the two tags, the policies, the flow chain |
| `policy.test.ts` | Node test: inject, deep-read no-drill, narrowing, substitution, missing-required |
| `view.tsx` | React component consuming the injected policy |
| `view.browser.test.tsx` | Browser test: provider injects → renders decisions; nested provider narrows |
| `main.tsx` | Composition root — what the FE declares to wire the injection |
| `main.browser.test.tsx` | Browser test: mount renders; missing root errors; swapping the declaration swaps behaviour |

## What the FE declares

The frontend declares the injection once, at the composition root. Everything below just reads it.

```tsx
export function mountPermissionsApp(
  container: Element,
  actor: Principal,        // the typed value the FE injects
  policy: AuthorizePolicy  // the function the FE injects
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

  return { scope, unmount: async () => { root.unmount(); await scope.dispose() } }
}
```

Three things, and only here:

1. `createScope()` — the graph/test boundary, created once.
2. `<ScopeProvider scope={scope}>` — exposes the scope to the tree.
3. `<ExecutionContextProvider tags={[principal(actor), authorize(policy)]}>` — **the injection**: a typed
   value and a fully-typed function attached to the context.

Consumers (`PermissionList`) declare `tags.required(...)` and read a bound `can(action)` — they never
receive `actor` or `policy` as props. Changing who/what is injected (per tenant, per role, read-only
preview) means editing only this declaration; no component changes.

## Run

```
pnpm test       # vitest run --coverage (node + browser), gated at 100%
pnpm typecheck
```
