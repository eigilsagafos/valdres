import { useValue } from "valdres-react"
import { cursorSelector } from "../state/selectors/cursorSelector"
import { usePanableEvents } from "../state/hooks/usePanableEvents"

export const EventHandler = ({ children }: { children: React.ReactNode }) => {
    const cursor = useValue(cursorSelector)
    const ref = usePanableEvents()
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
