import { useUpdateAtom, useValue } from "valdres-react"
import { countAtom } from "./shared-store"

export function ReactCounter() {
    const count = useValue(countAtom)
    const updateCount = useUpdateAtom(countAtom)

    return (
        <div className="island-card" onClick={() => updateCount(c => c + 1)}>
            <span className="island-count" style={{ color: "#61DAFB" }}>
                {count}
            </span>
        </div>
    )
}
