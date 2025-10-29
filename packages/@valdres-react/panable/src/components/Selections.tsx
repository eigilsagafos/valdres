import { useActiveActonsByKind } from "../state/hooks/useActiveActonsByKind"
import { Selection } from "./Selection"

export const Selections = () => {
    const selectActions = useActiveActonsByKind("select")
    return (
        <>
            {selectActions.map(action => (
                <Selection key={action.eventId} eventId={action.eventId} />
            ))}
        </>
    )
}
