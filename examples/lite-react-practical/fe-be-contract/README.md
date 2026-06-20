# FE ↔ host contract — the FE declares the tag + type, the host injects the implementation

The integration point between a frontend component and whoever hosts it is a **tag**. The FE owns
the contract (the tag and its type); the host owns the implementation and injects it through context.
Neither side imports the other's code — they couple only through the contract module. This is
dependency inversion: both sides depend on the abstraction (`tag<T>`), not on each other.

```
                 contract.ts  (tag + type)
                   ▲                    ▲
        FE imports ┘                    └─ host imports
   FE ships <PriceList/> + <DraftEditor/> ──drop in──► host renders them
        └─ both sides import contract.ts only; neither imports the other's implementation
```

## ① The contract — `contract.ts` (FE owns; the only shared file)

```ts
export interface Viewer { readonly name: string; readonly currency: string }  // data
export type FormatPrice = (amount: number) => string                          // function (render)
export type SaveDraft = (text: string) => Promise<SaveResult>                 // async action (event)
export interface SaveResult { readonly id: string }                           // typed return

export const viewer = tag<Viewer>({ label: "catalog.viewer" })
export const formatPrice = tag<FormatPrice>({ label: "catalog.formatPrice" })
export const saveDraft = tag<SaveDraft>({ label: "catalog.saveDraft" })
```

The FE says *"give me, in context, a `Viewer`, a `FormatPrice`, and a `SaveDraft`."* It never says how
any of them is produced. A `tag` is a typed injection token (like Angular's `InjectionToken<T>`) that
travels through the execution context — no prop drilling.

## ② Reading data + calling a function in render — `catalog.tsx` (FE owns)

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
      <p>{data.viewer.name} ({data.viewer.currency})</p>          {/* data from the tag */}
      <ul>{amounts.map((a) => <li key={a}>{data.format(a)}</li>)}</ul>  {/* function from the tag */}
    </section>
  )
}
```

`data.viewer` is `Viewer` and `data.format` is `FormatPrice` — concrete types, no `any`. (`tags.required`
returns `TagExecutor<Viewer, Viewer>`; at the call site the type is fully carried. The only `any` in the
stack is `TagExecutor<any, any>` *inside* the lite library's dependency union — a deliberate
type-erased dispatch slot, never surfaced to your code.)

## ③ Calling an injected async action on an event — `editor.tsx` + `draft.ts` (FE owns)

A function travels through a tag the same way whether the FE calls it during render or on a click. For
an action, the FE holds the function and invokes it later. The editor's state lives in the **graph**
(a `scopedValue`), not React `useState` — feature components keep state in the graph and read it back.

```ts
// draft.ts — graph-owned state + the action that calls the injected function
export const draft = scopedValue({
  deps: { save: tags.required(saveDraft) },
  initial: () => ({ text: "", saved: null }),
  actions: (helpers, { save }) => ({
    setText: (text: string) => helpers.patch({ text }),
    submit: async () => helpers.patch({ saved: await save(helpers.get().text) }),
  }),
})
```

```tsx
// editor.tsx — no useState; reads the scopedValue, calls the injected action
const state = useScopedValue(draft, { suspense: false })
if (state.status !== "ready") return null
const { snapshot, actions } = state.data
return (
  <form aria-label={label} onSubmit={(e) => { e.preventDefault(); void actions.submit() }}>
    <input value={snapshot.text} onChange={(e) => actions.setText(e.currentTarget.value)} />
    <button type="submit">Save</button>
    {snapshot.saved ? <p>saved {snapshot.saved.id}</p> : null}   {/* typed result back from the host */}
  </form>
)
```

The FE knows only `(text: string) => Promise<SaveResult>`. It never learns whether the host saves over
HTTP, a queue, or a stub — and it gets a typed `SaveResult` back.

## ④ How the host implements the contract — `backend.ts` (host owns)

Each binding is annotated with the contract type, so the **compiler proves conformance in this file** —
no `any`, and any drift from the signature is a build error here, not a runtime surprise in the FE.

```ts
import type { FormatPrice, SaveDraft, Viewer } from "./contract"

export const usdViewer: Viewer = { name: "Cuong", currency: "USD" }
export const usdFormat: FormatPrice = (amount) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
export const persistDraft: SaveDraft = async (text) => ({ id: `draft-${text.length}` })
```

Swap `persistDraft`'s body for `await fetch("/api/draft", { method: "POST", body: text }).then((r) =>
r.json())` and **nothing in the FE changes** — it only ever saw `SaveDraft`.

## ⑤ The composition root — `host.tsx` (host owns)

Wire the implementations to the contract tags, drop the FE components in:

```tsx
import { persistDraft, usdFormat, usdViewer } from "./backend"

<ScopeProvider scope={createScope()}>
  <ExecutionContextProvider
    tags={[viewer(usdViewer), formatPrice(usdFormat), saveDraft(persistDraft)]}
  >
    <PriceList label="catalog" amounts={[9.9, 19.9]} />
    <DraftEditor label="editor" />
  </ExecutionContextProvider>
</ScopeProvider>
```

One injection point feeds every component; each FE component reads only the tags it declares.

## ⑥ Injecting through an explicit ctx — and inheriting outer contexts

`ExecutionContextProvider` takes either `tags={[...]}` (it builds and manages the ctx, auto-inheriting
the parent provider) **or** `ctx={ctx}` (you build the ctx yourself). The FE can build its own ctx,
inject into it, and even inherit another ctx by passing `parent`:

```tsx
const outer = scope.createContext({ tags: [viewer(buyer), formatPrice(hashPrice)] })
const inner = scope.createContext({ parent: outer, tags: [formatPrice(stars)] }) // inherit viewer, override format

<ExecutionContextProvider ctx={outer}>
  <PriceList label="outer" amounts={[5]} />   {/* Mai (USD), "#5"  */}
</ExecutionContextProvider>
<ExecutionContextProvider ctx={inner}>
  <PriceList label="inner" amounts={[5]} />   {/* Mai (USD) inherited, "5★" overridden */}
</ExecutionContextProvider>
```

`inner` never sets `viewer`; `tags.required(viewer)` walks the `parent` chain (`seekTag`) up to `outer`
and finds it, while `formatPrice` set on `inner` shadows `outer`'s. Difference from `tags={[...]}`:
explicit-ctx mode does **not** auto-inherit the surrounding provider or manage the ctx lifecycle — you
pass `parent` yourself and the ctx is disposed with `scope.dispose()`. Use `tags=` for in-tree DI with
nested narrowing; use `ctx=` when the FE builds and composes contexts outside the JSX (e.g. tests, or a
ctx reused across mounts).

## What it proves

1. **Contract is the only coupling** — the FE files and the host files share `contract.ts` and nothing
   else. The FE can ship code-generated components knowing nothing about the host's stack.
2. **Inject data, a render function, *and* an async action** — `viewer`, `formatPrice`, `saveDraft` all
   ride the same tag mechanism, and the action returns typed data to the FE.
3. **Swap implementation, components untouched** — the browser tests mount the same `PriceList` /
   `DraftEditor` with different injected implementations and get different output; no FE edit.
4. **Typechecker enforces the contract** — `backend.ts` annotates each implementation with the contract
   type; a mismatch is a compile error, and consumer reads are concretely typed (no `any`).

## Files

| File | Owner | Role |
|---|---|---|
| `contract.ts` | FE | The tags + types — the integration point both sides import |
| `catalog.tsx` | FE | `PriceList` — reads injected data + calls an injected function in render |
| `draft.ts` | FE | Graph-owned editor state + the action that calls the injected `SaveDraft` |
| `editor.tsx` | FE | `DraftEditor` — reads the scopedValue, invokes the injected action on submit |
| `backend.ts` | host | Implementations annotated with the contract types — proof of conformance |
| `host.tsx` | host | Composition root — wires the implementations to the tags, mounts the components |
| `catalog.browser.test.tsx` | — | Inject through the tags → render; swap the formatter → output changes |
| `editor.browser.test.tsx` | — | Type + submit → the injected async action runs and the typed result shows |
| `backend.test.ts` | — | The host implementations satisfy the contract types in isolation |
| `host.browser.test.tsx` | — | `mountMain` renders; missing root errors; swapping only the impl changes output |
| `inherit.browser.test.tsx` | — | Inject via `ctx={ctx}`; a child ctx with `parent` inherits the outer tags and overrides one |

## Run

```
pnpm test       # vitest run --coverage (node + browser), gated at 100%
pnpm typecheck
```
