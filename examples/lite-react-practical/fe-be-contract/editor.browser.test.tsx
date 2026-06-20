import { createScope } from "@pumped-fn/lite"
import { ExecutionContextProvider, ScopeProvider } from "@pumped-fn/lite-react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"
import { saveDraft, type SaveDraft } from "./contract"
import { DraftEditor } from "./editor"

describe("the FE calls the injected async function on an event", () => {
  test("submitting saves the draft through the injected impl and shows the typed result", async () => {
    const calls: string[] = []
    const fakeSave: SaveDraft = async (text) => {
      calls.push(text)
      return { id: `id-${text}` }
    }
    const scope = createScope()
    render(
      <ScopeProvider scope={scope}>
        <ExecutionContextProvider tags={[saveDraft(fakeSave)]}>
          <DraftEditor label="editor" />
        </ExecutionContextProvider>
      </ScopeProvider>
    )

    const input = await screen.findByLabelText("draft")
    fireEvent.change(input, { target: { value: "hello" } })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("saved id-hello")).toBeInTheDocument()
    expect(calls).toEqual(["hello"])
    await scope.dispose()
  })
})
