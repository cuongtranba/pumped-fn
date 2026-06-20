# FE ↔ host contract — the FE declares the tag + type, the host injects the implementation

The integration point between a frontend component and whoever hosts it is a **tag**. The FE owns
the contract (the tag and its type); the host owns the implementation and injects it through context.
Neither side imports the other's code — they couple only through the contract module. This is
dependency inversion: both sides depend on the abstraction (`tag<T>`), not on each other.

```
                 contract.ts  (tag + type)
                   ▲                    ▲
        FE imports ┘                    └─ host imports
   FE ships <PriceList/> ───drop in───► host renders it
        └─ both import contract.ts only; neither imports the other's implementation
```

## ① The contract — `contract.ts` (FE owns; the only shared file)

```ts
export interface Viewer { readonly name: string; readonly currency: string } // data
export type FormatPrice = (amount: number) => string                          // function

export const viewer = tag<Viewer>({ label: "catalog.viewer" })
export const formatPrice = tag<FormatPrice>({ label: "catalog.formatPrice" })
```

The FE says *"give me, in context, a `Viewer` at `viewer` and a function matching `FormatPrice` at
`formatPrice`."* It never says how either is produced. A `tag` is a typed injection token (like
Angular's `InjectionToken<T>`) that travels through the execution context — no prop drilling.

## ② The usage — `catalog.tsx` (FE owns; imports the contract only)

```tsx
const capabilities = resource({
  ownership: "current",
  deps: { viewer: tags.required(viewer), format: tags.required(formatPrice) },
  factory: (_ctx, deps) => deps,
})

export function PriceList({ label, amounts }: { label: string; amounts: readonly number[] }) {
  const { data } = useResource(capabilities, { suspense: false })
  if (!data) return null
  return (
    <section aria-label={label}>
      <p>{data.viewer.name} ({data.viewer.currency})</p>   {/* data from the tag */}
      <ul>{amounts.map((a) => <li key={a}>{data.format(a)}</li>)}</ul>  {/* function from the tag */}
    </section>
  )
}
```

`tags.required(...)` is the FE *reading* the contract. The component uses `data.format` strictly by
its signature and holds no formatting logic. The resource is `ownership: "current"` so each
`ExecutionContextProvider` resolves its own instance — a nested provider can narrow the injection for
its subtree.

## ③ The implementation — `host.tsx` (host owns; imports the contract + drops the component in)

```tsx
const usd: FormatPrice = (amount) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)

root.render(
  <ScopeProvider scope={createScope()}>
    <ExecutionContextProvider tags={[viewer({ name: "Cuong", currency: "USD" }), formatPrice(usd)]}>
      <PriceList label="catalog" amounts={[9.9, 19.9]} />
    </ExecutionContextProvider>
  </ScopeProvider>
)
```

`<ExecutionContextProvider tags={[...]}>` is the host *fulfilling* the contract. The host's `usd`
implementation is invisible to the FE — the FE only ever saw `FormatPrice`.

## The function can cross to a real backend

The injected function is unconstrained beyond its signature, so the contract scales to an async
backend call with zero change to how the FE reads it:

```ts
export type SearchProducts = (q: string) => Promise<readonly Product[]>
export const searchProducts = tag<SearchProducts>({ label: "catalog.search" })
```

```tsx
// host injects a fetch-backed implementation; the FE only knows the signature
<ExecutionContextProvider tags={[searchProducts((q) => fetch(`/api?q=${q}`).then((r) => r.json()))]}>
```

## What it proves

1. **Contract is the only coupling** — `catalog.tsx` and `host.tsx` share `contract.ts` and nothing
   else. The FE can ship a code-generated component knowing nothing about the host's stack.
2. **Inject data *and* behaviour** — `viewer` is a value, `formatPrice` is a function; both ride the
   same tag mechanism.
3. **Swap implementation, component untouched** — `host.browser.test.tsx` mounts the same `PriceList`
   with a different injected formatter and gets different output; no FE edit.
4. **Typechecker enforces the contract** — injecting a value that doesn't match the tag's type is a
   compile error at the `tag(...)` call site.

## Files

| File | Owner | Role |
|---|---|---|
| `contract.ts` | FE | The tag + type — the integration point both sides import |
| `catalog.tsx` | FE | `PriceList`, the component that *uses* the injected data + function |
| `catalog.browser.test.tsx` | — | Inject fakes through the tags → the component renders; swap the formatter → output changes |
| `host.tsx` | host | Provides the implementation and injects it; `mountMain` wires a real `Intl` formatter |
| `host.browser.test.tsx` | — | `mountMain` renders; missing root errors; swapping only the injected implementation changes output |

## Run

```
pnpm test       # vitest run --coverage (node + browser), gated at 100%
pnpm typecheck
```
