import { StrictMode, useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { Provider, useValue } from "valdres-react"
import { contrastAtom, type Contrast } from "../src"

type Entry = { at: string; value: Contrast }

const Demo = () => {
    const value = useValue(contrastAtom)
    const [log, setLog] = useState<Entry[]>([])
    const lastLogged = useRef<Contrast | null>(null)

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
                <span
                    className={`dot${value !== "no-preference" ? " on" : ""}`}
                />
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
