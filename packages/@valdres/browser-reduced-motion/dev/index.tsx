import { StrictMode, useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { Provider, useValue } from "valdres-react"
import { reducedMotionAtom, type ReducedMotion } from "../src"

type Entry = { at: string; value: ReducedMotion }

const Demo = () => {
    const value = useValue(reducedMotionAtom)
    const [log, setLog] = useState<Entry[]>([])
    const lastLogged = useRef<ReducedMotion | null>(null)

    useEffect(() => {
        if (lastLogged.current === value) return
        lastLogged.current = value
        setLog(prev =>
            [
                { at: new Date().toLocaleTimeString(), value },
                ...prev,
            ].slice(0, 20),
        )
    }, [value])

    return (
        <>
            <div className="card">
                <span className={`dot${value === "reduce" ? " on" : ""}`} />
                <span className="label">{value}</span>
            </div>
            <ul className="log">
                {log.map((entry, i) => (
                    <li key={i}>
                        {entry.at} — {entry.value}
                    </li>
                ))}
            </ul>
        </>
    )
}

const root = createRoot(document.getElementById("root")!)
root.render(
    <StrictMode>
        <Provider>
            <Demo />
        </Provider>
    </StrictMode>,
)
