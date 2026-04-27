import { useAtom } from "valdres-react"
import { countAtom } from "./shared-store"

export function ReactCounter() {
    const [count, setCount] = useAtom(countAtom)

    return (
        <div className="island-card" onClick={() => setCount(c => (c as number) + 1)}>
            <span className="island-count" style={{ color: "#61DAFB" }}>
                {count as number}
            </span>
        </div>
    )
}
