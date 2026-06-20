import { useScopedValue } from "@pumped-fn/lite-react"
import { draft } from "./draft"

export function DraftEditor({ label }: { label: string }) {
  const state = useScopedValue(draft, { suspense: false })
  if (state.status !== "ready") return null
  const { snapshot, actions } = state.data

  return (
    <form
      aria-label={label}
      onSubmit={(event) => {
        event.preventDefault()
        void actions.submit()
      }}
    >
      <input
        aria-label="draft"
        value={snapshot.text}
        onChange={(event) => actions.setText(event.currentTarget.value)}
      />
      <button type="submit">Save</button>
      {snapshot.saved ? <p>saved {snapshot.saved.id}</p> : null}
    </form>
  )
}
