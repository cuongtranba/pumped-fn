import { resource, tags } from "@pumped-fn/lite"
import { useResource } from "@pumped-fn/lite-react"
import { formatPrice, viewer } from "./contract"

const capabilities = resource({
  name: "febe.capabilities",
  ownership: "current",
  deps: {
    viewer: tags.required(viewer),
    format: tags.required(formatPrice),
  },
  factory: (_ctx, deps) => deps,
})

export function PriceList({
  label,
  amounts,
}: {
  label: string
  amounts: readonly number[]
}) {
  const { data } = useResource(capabilities, { suspense: false })
  if (!data) return null

  return (
    <section aria-label={label}>
      <p>
        {data.viewer.name} ({data.viewer.currency})
      </p>
      <ul>
        {amounts.map((amount) => (
          <li key={amount}>{data.format(amount)}</li>
        ))}
      </ul>
    </section>
  )
}
