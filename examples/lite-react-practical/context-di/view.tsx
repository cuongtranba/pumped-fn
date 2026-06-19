import { resource, tags } from "@pumped-fn/lite"
import { useResource } from "@pumped-fn/lite-react"
import { authorize, principal, type Action } from "./policy"

const actions: readonly Action[] = ["read", "write", "delete"]

const policyView = resource({
  name: "ctxdi.policyView",
  ownership: "current",
  deps: {
    principal: tags.required(principal),
    authorize: tags.required(authorize),
  },
  factory: (_ctx, deps) => deps,
})

export function PermissionList({ label }: { label: string }) {
  const { data } = useResource(policyView, { suspense: false })
  if (!data) return null

  return (
    <ul aria-label={label}>
      {actions.map((action) => {
        const decision = data.authorize(data.principal, action)
        return (
          <li key={action}>
            {action}: {decision.allowed ? "allowed" : `denied — ${decision.reason}`}
          </li>
        )
      })}
    </ul>
  )
}
