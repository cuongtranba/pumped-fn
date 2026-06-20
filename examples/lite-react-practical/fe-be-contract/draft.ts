import { tags } from "@pumped-fn/lite"
import { scopedValue } from "@pumped-fn/lite-react"
import { saveDraft, type SaveResult } from "./contract"

export const draft = scopedValue({
  name: "febe.draft",
  deps: { save: tags.required(saveDraft) },
  initial: (): { text: string; saved: SaveResult | null } => ({
    text: "",
    saved: null,
  }),
  actions: (helpers, { save }) => ({
    setText: (text: string) => helpers.patch({ text }),
    submit: async () => {
      const saved = await save(helpers.get().text)
      helpers.patch({ saved })
    },
  }),
})
