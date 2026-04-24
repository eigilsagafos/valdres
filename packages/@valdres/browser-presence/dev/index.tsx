import { StrictMode, useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import { Provider, useValue } from "valdres-react"
import { focusAtom } from "@valdres/browser-focus"
import { visibilityAtom } from "@valdres/browser-visibility"
import { presenceSelector } from "../src"

type Entry = { at: string; present: boolean }

const Demo = () => {
    const present = useValue(presenceSelector)
    const focused = useValue(focusAtom)
    const visibility = useValue(visibilityAtom)
    const [log, setLog] = useState<Entry[]>([])
    const lastLogged = useRef<boolean | null>(null)

    useEffect(() => {
        if (lastLogged.current === present) return
        lastLogged.current = present
        setLog(prev =>
            [
                { at: new Date().toLocaleTimeString(), present },
                ...prev,
            ].slice(0, 20),
        )
    }, [present])

    return (
        <>
            <div className="card">
                <span className={`dot${present ? " on" : ""}`} />
                <span className="label">{present ? "present" : "away"}</span>
            </div>
            <div className="inputs">
                <span>visibility: {visibility}</span>
                <span>focus: {focused ? "focused" : "blurred"}</span>
            </div>
            <ul className="log">
                {log.map((entry, i) => (
                    <li key={i}>
                        {entry.at} — {entry.present ? "present" : "away"}
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
