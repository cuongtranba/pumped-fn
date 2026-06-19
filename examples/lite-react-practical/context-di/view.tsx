import { resource, tags } from "@pumped-fn/lite"
import { useResource } from "@pumped-fn/lite-react"
import { authorize, principal, type Action } from "./policy"

const actions: readonly Action[] = ["read", "write", "delete"]

const checker = resource({
  name: "ctxdi.checker",
  ownership: "current",
  deps: {
    principal: tags.required(principal),
    authorize: tags.required(authorize),
  },
  factory: (_ctx, { principal, authorize }) => (action: Action) =>
    authorize(principal, action),
})

export function PermissionList({ label }: { label: string }) {
  const { data: can } = useResource(checker, { suspense: false })
  if (!can) return null

  return (
    <ul aria-label={label}>
      {actions.map((action) => {
        const decision = can(action)
        return (
          <li key={action}>
            {action}: {decision.allowed ? "allowed" : `denied — ${decision.reason}`}
          </li>
        )
      })}
    </ul>
  )
}
