import { StrictMode, useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { store } from "valdres"
import { Provider, useValue } from "valdres-react"
import { reducedMotionAtom, type ReducedMotion } from "../src"


// One store owns this demo root. valdres-react has no implicit global
// store: every Provider names the store its subtree reads.
const demoStore = store()

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
        <Provider store={demoStore}>
            <Demo />
        </Provider>
    </StrictMode>,
)
