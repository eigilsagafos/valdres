import { useValue } from "valdres-react"
import { cursorSelector } from "../state/selectors/cursorSelector"
import { usePanableEvents } from "../state/hooks/usePanableEvents"
import type { ScopeId } from "../types/ScopeId"

export const EventHandler = ({
    scopeId,
    children,
}: {
    scopeId: ScopeId
    children: React.ReactNode
}) => {
    const cursor = useValue(cursorSelector(scopeId))
    const ref = usePanableEvents(scopeId)
    return (
        <div
            ref={ref}
            style={{
                cursor,
                width: "100%",
                height: "100%",
                touchAction: "none",
            }}
        >
            {children}
        </div>
    )
}
