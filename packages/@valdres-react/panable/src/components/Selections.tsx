import { useActiveActonsByKind } from "../state/hooks/useActiveActonsByKind"
import { Selection } from "./Selection"
import type { ScopeId } from "../types/ScopeId"

export const Selections = ({ scopeId }: { scopeId: ScopeId }) => {
    const selectActions = useActiveActonsByKind("select", scopeId)
    return (
        <>
            {selectActions.map(action => (
                <Selection
                    key={action.eventId}
                    eventId={action.eventId}
                    scopeId={scopeId}
                />
            ))}
        </>
    )
}
